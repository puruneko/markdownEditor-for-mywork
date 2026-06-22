/**
 * demo/indent-patterns.md を実際にパースして
 * 全インデントパターンが想定通りのAST構造を生成するか検証する。
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, it, expect, beforeAll } from 'vitest'
import { parseMarkdown } from './parse-markdown'
import type { Document, Section, TaskNode, ListNode, QuoteNode } from './types'

// ----------------------------------------------------------------
// Setup: parse the demo file once
// ----------------------------------------------------------------

let doc: Document
let sections: Section[]

beforeAll(() => {
  const md = readFileSync(resolve(process.cwd(), 'demo/indent-patterns.md'), 'utf-8')
  doc = parseMarkdown(md)
  sections = doc.sections
})

// ----------------------------------------------------------------
// Helper
// ----------------------------------------------------------------

function findSection(title: string): Section {
  function search(list: Section[]): Section | undefined {
    for (const s of list) {
      if (s.title === title) return s
      const found = search(s.subSections)
      if (found) return found
    }
  }
  const s = search(sections)
  if (!s) throw new Error(`Section not found: "${title}"`)
  return s
}

// ----------------------------------------------------------------
// セクション 1: 2スペース（標準）
// ----------------------------------------------------------------

describe('セクション1: 2スペース（標準）', () => {
  it('親グループが5つの子タスクを持つ', () => {
    const sec = findSection('1. 2スペース（標準）')
    const group = sec.children.find(n => n.type === 'list') as ListNode
    expect(group.text).toBe('標準グループ')
    expect(group.isGroup).toBe(true)
    expect(group.children).toHaveLength(5)
  })

  it('全ステータスマーカーが正しく解析される', () => {
    const sec = findSection('1. 2スペース（標準）')
    const group = sec.children.find(n => n.type === 'list') as ListNode
    const tasks = group.children as TaskNode[]
    expect(tasks[0].status).toBe('todo')
    expect(tasks[1].status).toBe('done')
    expect(tasks[2].status).toBe('doing')
    expect(tasks[3].status).toBe('blocked')
    expect(tasks[4].status).toBe('hold')
  })

  it('@schedule と @due が子から抽出され正規化される', () => {
    const sec = findSection('1. 2スペース（標準）')
    const group = sec.children.find(n => n.type === 'list') as ListNode
    const todo = group.children[0] as TaskNode
    expect(todo.meta?.schedule).toBe('2026-06-01T09:00/2026-06-01T10:00')
    expect(todo.meta?.due).toBe('2026-06-01')
    // blockquote が children に残るため isLeafTask=false, isGroup=false（task子孫なし）
    expect(todo.isGroup).toBe(false)
    expect(todo.hasTaskDescendant).toBe(false)
  })

  it('blockquote が QuoteNode として子に入る', () => {
    const sec = findSection('1. 2スペース（標準）')
    const group = sec.children.find(n => n.type === 'list') as ListNode
    const todo = group.children[0] as TaskNode
    const quote = todo.children[0] as QuoteNode
    expect(quote.type).toBe('quote')
    expect(quote.raw).toBe('2スペースのコメント')
  })
})

// ----------------------------------------------------------------
// セクション 2: 4スペース
// ----------------------------------------------------------------

describe('セクション2: 4スペース', () => {
  it('親グループが5つの子タスクを持つ（2スペース版と同じ構造）', () => {
    const sec = findSection('2. 4スペース')
    const group = sec.children.find(n => n.type === 'list') as ListNode
    expect(group.text).toBe('標準グループ')
    expect(group.isGroup).toBe(true)
    expect(group.children).toHaveLength(5)
  })

  it('全ステータスマーカーが正しく解析される', () => {
    const sec = findSection('2. 4スペース')
    const group = sec.children.find(n => n.type === 'list') as ListNode
    const tasks = group.children as TaskNode[]
    expect(tasks[0].status).toBe('todo')
    expect(tasks[1].status).toBe('done')
    expect(tasks[2].status).toBe('doing')
    expect(tasks[3].status).toBe('blocked')
    expect(tasks[4].status).toBe('hold')
  })

  it('@meta が8スペースから抽出・正規化される', () => {
    const sec = findSection('2. 4スペース')
    const group = sec.children.find(n => n.type === 'list') as ListNode
    const todo = group.children[0] as TaskNode
    expect(todo.meta?.schedule).toBe('2026-06-01T09:00/2026-06-01T10:00')
    expect(todo.meta?.due).toBe('2026-06-01')
  })

  it('blockquote が QuoteNode として認識される', () => {
    const sec = findSection('2. 4スペース')
    const group = sec.children.find(n => n.type === 'list') as ListNode
    const todo = group.children[0] as TaskNode
    const quote = todo.children[0] as QuoteNode
    expect(quote.type).toBe('quote')
    expect(quote.raw).toBe('4スペースのコメント')
  })
})

// ----------------------------------------------------------------
// セクション 3: 4スペース（深いネスト）
// ----------------------------------------------------------------

describe('セクション3: 4スペース（深いネスト）', () => {
  it('親グループが2つの子タスクを持つ', () => {
    const sec = findSection('3. 4スペース（深いネスト）')
    const group = sec.children.find(n => n.type === 'list') as ListNode
    expect(group.isGroup).toBe(true)
    expect(group.children).toHaveLength(2)
  })

  it('@meta が8スペースから正しく抽出される', () => {
    const sec = findSection('3. 4スペース（深いネスト）')
    const group = sec.children.find(n => n.type === 'list') as ListNode
    const todo = group.children[0] as TaskNode
    expect(todo.meta?.schedule).toBe('2026-06-01T09:00/2026-06-01T10:00')
    expect(todo.meta?.due).toBe('2026-06-01')
  })

  it('blockquote が QuoteNode として認識される', () => {
    const sec = findSection('3. 4スペース（深いネスト）')
    const group = sec.children.find(n => n.type === 'list') as ListNode
    const todo = group.children[0] as TaskNode
    const quote = todo.children[0] as QuoteNode
    expect(quote.type).toBe('quote')
    expect(quote.raw).toBe('4スペースのコメント（深いネスト）')
  })
})

// ----------------------------------------------------------------
// セクション 4: 兄弟間で異なるインデント幅
// ----------------------------------------------------------------

describe('セクション4: 兄弟間で異なるインデント幅', () => {
  it('3つのタスクがセクション直下に並ぶ', () => {
    const sec = findSection('4. 兄弟間で異なるインデント幅')
    const tasks = sec.children.filter(n => n.type === 'task') as TaskNode[]
    expect(tasks).toHaveLength(3)
  })

  it('タスクAの@metaが2スペース子から正しく抽出される', () => {
    const sec = findSection('4. 兄弟間で異なるインデント幅')
    const tasks = sec.children.filter(n => n.type === 'task') as TaskNode[]
    expect(tasks[0].text).toContain('タスクA')
    expect(tasks[0].meta?.schedule).toBe('2026-06-10T09:00/2026-06-10T10:00')
    expect(tasks[0].meta?.due).toBe('2026-06-10')
    expect(tasks[0].isLeafTask).toBe(true)
  })

  it('タスクBの@metaが4スペース子から正しく抽出される', () => {
    const sec = findSection('4. 兄弟間で異なるインデント幅')
    const tasks = sec.children.filter(n => n.type === 'task') as TaskNode[]
    expect(tasks[1].text).toContain('タスクB')
    expect(tasks[1].meta?.schedule).toBe('2026-06-11T09:00/2026-06-11T10:00')
    expect(tasks[1].meta?.due).toBe('2026-06-11')
    expect(tasks[1].isLeafTask).toBe(true)
  })

  it('タスクCの@metaが4スペース子から正しく抽出される', () => {
    const sec = findSection('4. 兄弟間で異なるインデント幅')
    const tasks = sec.children.filter(n => n.type === 'task') as TaskNode[]
    expect(tasks[2].text).toContain('タスクC')
    expect(tasks[2].meta?.schedule).toBe('2026-06-12T09:00/2026-06-12T10:00')
    expect(tasks[2].meta?.due).toBe('2026-06-12')
    expect(tasks[2].isLeafTask).toBe(true)
  })
})

// ----------------------------------------------------------------
// セクション 5: 3階層ネスト（4スペース）
// ----------------------------------------------------------------

describe('セクション5: 3階層ネスト（4スペース）', () => {
  it('L1→L2→L3の3階層が正しく構成される', () => {
    const sec = findSection('5. 3階層ネスト（4スペース）')
    const l1 = sec.children.find(n => n.type === 'list') as ListNode
    expect(l1.text).toBe('L1グループ')
    expect(l1.isGroup).toBe(true)

    const l2 = l1.children[0] as ListNode
    expect(l2.text).toBe('L2グループ')
    expect(l2.isGroup).toBe(true)

    const l3 = l2.children[0] as TaskNode
    expect(l3.text).toBe('L3リーフタスク')
    // blockquote が children に残るため isGroup=false（task子孫なし）
    expect(l3.isGroup).toBe(false)
    expect(l3.hasTaskDescendant).toBe(false)
  })

  it('L3タスクの@metaが正しく抽出される', () => {
    const sec = findSection('5. 3階層ネスト（4スペース）')
    const l1 = sec.children.find(n => n.type === 'list') as ListNode
    const l2 = l1.children[0] as ListNode
    const l3 = l2.children[0] as TaskNode
    expect(l3.meta?.schedule).toBe('2026-06-20T10:00/2026-06-20T12:00')
    expect(l3.meta?.due).toBe('2026-06-20')
  })

  it('L3タスクのblockquoteが認識される', () => {
    const sec = findSection('5. 3階層ネスト（4スペース）')
    const l1 = sec.children.find(n => n.type === 'list') as ListNode
    const l2 = l1.children[0] as ListNode
    const l3 = l2.children[0] as TaskNode
    const quote = l3.children[0] as QuoteNode
    expect(quote.type).toBe('quote')
    expect(quote.raw).toBe('L3コメント')
  })
})

// ----------------------------------------------------------------
// セクション 6: 3階層ネスト（混合：2→4→2スペース）
// ----------------------------------------------------------------

describe('セクション6: 3階層ネスト（混合インデント）', () => {
  it('L1→L2→L3の3階層が混合幅でも正しく構成される', () => {
    const sec = findSection('6. 3階層ネスト（混合：2→4→2スペース）')
    const l1 = sec.children.find(n => n.type === 'list') as ListNode
    expect(l1.text).toBe('L1グループ')
    expect(l1.isGroup).toBe(true)

    const l2 = l1.children[0] as ListNode
    expect(l2.text).toBe('L2グループ')
    expect(l2.isGroup).toBe(true)

    const l3 = l2.children[0] as TaskNode
    expect(l3.text).toBe('L3リーフタスク')
    // blockquote が children に残るため isGroup=false（task子孫なし）
    expect(l3.isGroup).toBe(false)
    expect(l3.hasTaskDescendant).toBe(false)
  })

  it('L3タスクの@metaが混合インデントでも正しく抽出される', () => {
    const sec = findSection('6. 3階層ネスト（混合：2→4→2スペース）')
    const l1 = sec.children.find(n => n.type === 'list') as ListNode
    const l2 = l1.children[0] as ListNode
    const l3 = l2.children[0] as TaskNode
    expect(l3.meta?.schedule).toBe('2026-06-21T10:00/2026-06-21T12:00')
    expect(l3.meta?.due).toBe('2026-06-21')
  })
})

// ----------------------------------------------------------------
// セクション 7: 日付省略記法 × 各インデント幅
// ----------------------------------------------------------------

describe('セクション7: 日付省略記法 × 各インデント幅', () => {
  it('2スペース + 時刻連続省略が正規化される', () => {
    const sec = findSection('7. 日付省略記法 × 各インデント幅')
    const tasks = sec.children.filter(n => n.type === 'task') as TaskNode[]
    expect(tasks[0].meta?.schedule).toBe('2026-06-27T08:00/2026-06-27T17:00')
    expect(tasks[0].meta?.due).toBe('2026-06-27')
  })

  it('4スペース + 日付連続省略が正規化される', () => {
    const sec = findSection('7. 日付省略記法 × 各インデント幅')
    const tasks = sec.children.filter(n => n.type === 'task') as TaskNode[]
    expect(tasks[1].meta?.schedule).toBe('2026-06-01/2026-06-05')
    expect(tasks[1].meta?.due).toBe('2026-06-05')
  })

  it('4スペース + 分省略 + 2桁年が正規化される', () => {
    const sec = findSection('7. 日付省略記法 × 各インデント幅')
    const tasks = sec.children.filter(n => n.type === 'task') as TaskNode[]
    expect(tasks[2].meta?.schedule).toBe('2026-07-01T10:00/2026-07-01T11:00')
    expect(tasks[2].meta?.due).toBe('2026-07-01')
  })
})

// ----------------------------------------------------------------
// 横断検証: セクション1 と セクション2 の構造が等しい
// ----------------------------------------------------------------

describe('横断検証: 2スペース版と4スペース版の構造が同等', () => {
  it('子タスク数・ステータス・@meta 値が一致する', () => {
    const sec2 = findSection('1. 2スペース（標準）')
    const sec4 = findSection('2. 4スペース')

    const grp2 = sec2.children.find(n => n.type === 'list') as ListNode
    const grp4 = sec4.children.find(n => n.type === 'list') as ListNode

    // child count
    expect(grp4.children).toHaveLength(grp2.children.length)

    // status sequence
    const statuses2 = (grp2.children as TaskNode[]).map(t => t.status)
    const statuses4 = (grp4.children as TaskNode[]).map(t => t.status)
    expect(statuses4).toEqual(statuses2)

    // meta of first child
    const todo2 = grp2.children[0] as TaskNode
    const todo4 = grp4.children[0] as TaskNode
    expect(todo4.meta?.schedule).toBe(todo2.meta?.schedule)
    expect(todo4.meta?.due).toBe(todo2.meta?.due)
  })
})
