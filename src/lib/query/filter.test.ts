import { describe, it, expect, beforeAll } from 'vitest'
import { parseMarkdown } from '../parser/parse-markdown'
import { filterNodes } from './filter'
import type { Document, TaskNode } from '../parser/types'

// ──────────────────────────────────────────────────────────────────
// フィクスチャ
// ──────────────────────────────────────────────────────────────────

/*
  構造:
  # Projects
    - [ ] Task A   @tags:[total, urgent]  @priority:1  @due:2025-12-31
      - [x] SubTask A1
      - [>] Task A2  @schedule:2025-01-15T09:00/2025-01-15T10:00
    - ListGroup
      - [!] Blocked Task B  @tags:[total]  @priority:3  @due:2026-01-15
  ## Alpha
    - [-] Hold Task C
  # Personal
    - [>] Task D  @due:2025-06-30  @schedule:2025-06-30T08:00/2025-06-30T09:00
    - [ ] Task E  @tags:[urgent]   @priority:2  @due:2026-01-01
*/
const FIXTURE_MD = [
  '# Projects',
  '- [ ] Task A',
  '  - @tags: total, urgent',
  '  - @priority: 1',
  '  - @due: 2025-12-31',
  '  - [x] SubTask A1',
  '  - [>] Task A2',
  '    - @schedule: 2025-01-15T09:00/2025-01-15T10:00',
  '- ListGroup',
  '  - [!] Blocked Task B',
  '    - @tags: total',
  '    - @priority: 3',
  '    - @due: 2026-01-15',
  '## Alpha',
  '- [-] Hold Task C',
  '# Personal',
  '- [>] Task D',
  '  - @due: 2025-06-30',
  '  - @schedule: 2025-06-30T08:00/2025-06-30T09:00',
  '- [ ] Task E',
  '  - @tags: urgent',
  '  - @priority: 2',
  '  - @due: 2026-01-01',
].join('\n')

let doc: Document

beforeAll(() => {
  doc = parseMarkdown(FIXTURE_MD)
})

// ──────────────────────────────────────────────────────────────────
// ヘルパー
// ──────────────────────────────────────────────────────────────────

function allTasks(d: Document): TaskNode[] {
  const result: TaskNode[] = []
  function fromNodes(nodes: typeof d.sections[0]['children']): void {
    for (const n of nodes) {
      if (n.type === 'task') { result.push(n); fromNodes(n.children) }
      else if (n.type === 'list') fromNodes(n.children)
    }
  }
  for (const sec of d.sections) {
    fromNodes(sec.children)
    for (const sub of sec.subSections) fromNodes(sub.children)
  }
  return result
}

function taskTexts(d: Document): string[] {
  return allTasks(d).map(t => t.text)
}

// ──────────────────────────────────────────────────────────────────
// 空クエリ
// ──────────────────────────────────────────────────────────────────

describe('filterNodes — 空クエリ', () => {
  it('空クエリは同じ Document 参照を返す', () => {
    expect(filterNodes(doc, {})).toBe(doc)
  })
})

// ──────────────────────────────────────────────────────────────────
// 単条件
// ──────────────────────────────────────────────────────────────────

describe('filterNodes — status', () => {
  it('todo のみ', () => {
    const result = filterNodes(doc, { status: ['todo'] })
    const texts = taskTexts(result)
    expect(texts).toContain('Task A')
    expect(texts).toContain('Task E')
    expect(texts).not.toContain('SubTask A1')   // done
    expect(texts).not.toContain('Task A2')       // doing
    expect(texts).not.toContain('Blocked Task B') // blocked
    expect(texts).not.toContain('Hold Task C')   // hold
  })

  it('done のみ (keepAncestors:true で親 Task A が祖先として残る)', () => {
    const result = filterNodes(doc, { status: ['done'] })
    const texts = taskTexts(result)
    expect(texts).toContain('SubTask A1')       // 合致
    expect(texts).toContain('Task A')           // 祖先として保持
    expect(texts).not.toContain('Task A2')      // 兄弟（祖先でない）
    expect(texts).not.toContain('Blocked Task B')
    expect(texts).not.toContain('Hold Task C')
  })

  it('複数ステータスは OR', () => {
    const result = filterNodes(doc, { status: ['doing', 'blocked'] })
    const texts = taskTexts(result)
    expect(texts).toContain('Task A2')
    expect(texts).toContain('Blocked Task B')
    expect(texts).toContain('Task D')
    // Task A は Task A2 の祖先なので keepAncestors:true で保持される
    expect(texts).toContain('Task A')
    expect(texts).not.toContain('Task E')
    expect(texts).not.toContain('SubTask A1')
  })
})

describe('filterNodes — tags', () => {
  it('total タグ', () => {
    const result = filterNodes(doc, { tags: ['total'] })
    const texts = taskTexts(result)
    expect(texts).toContain('Task A')
    expect(texts).toContain('Blocked Task B')
    expect(texts).not.toContain('Task E')
  })

  it('urgent タグ', () => {
    const result = filterNodes(doc, { tags: ['urgent'] })
    const texts = taskTexts(result)
    expect(texts).toContain('Task A')
    expect(texts).toContain('Task E')
    expect(texts).not.toContain('Blocked Task B')
  })

  it('複数タグは OR', () => {
    const result = filterNodes(doc, { tags: ['total', 'urgent'] })
    const texts = taskTexts(result)
    expect(texts).toContain('Task A')
    expect(texts).toContain('Blocked Task B')
    expect(texts).toContain('Task E')
  })
})

describe('filterNodes — priorityMax', () => {
  it('priorityMax:1 は priority 1 のみ', () => {
    const result = filterNodes(doc, { priorityMax: 1 })
    const texts = taskTexts(result)
    expect(texts).toContain('Task A')
    expect(texts).not.toContain('Task E')       // priority 2
    expect(texts).not.toContain('Blocked Task B') // priority 3
  })

  it('priorityMax:2 は priority 1,2', () => {
    const result = filterNodes(doc, { priorityMax: 2 })
    const texts = taskTexts(result)
    expect(texts).toContain('Task A')
    expect(texts).toContain('Task E')
    expect(texts).not.toContain('Blocked Task B')
  })

  it('priority 未設定タスクは除外', () => {
    const result = filterNodes(doc, { priorityMax: 5 })
    const texts = taskTexts(result)
    expect(texts).not.toContain('SubTask A1')
    expect(texts).not.toContain('Task A2')
  })
})

describe('filterNodes — dueBefore / dueAfter (同日を含む)', () => {
  it('dueBefore:2025-12-31 は当日含む', () => {
    const result = filterNodes(doc, { dueBefore: '2025-12-31' })
    const texts = taskTexts(result)
    expect(texts).toContain('Task A')     // due 2025-12-31 (境界当日)
    expect(texts).toContain('Task D')     // due 2025-06-30
    expect(texts).not.toContain('Blocked Task B') // due 2026-01-15
    expect(texts).not.toContain('Task E') // due 2026-01-01
  })

  it('dueAfter:2026-01-01 は当日含む', () => {
    const result = filterNodes(doc, { dueAfter: '2026-01-01' })
    const texts = taskTexts(result)
    expect(texts).toContain('Blocked Task B') // due 2026-01-15
    expect(texts).toContain('Task E')         // due 2026-01-01 (境界当日)
    expect(texts).not.toContain('Task A')
    expect(texts).not.toContain('Task D')
  })

  it('due 未設定は除外', () => {
    const result = filterNodes(doc, { dueBefore: '2030-12-31' })
    const texts = taskTexts(result)
    expect(texts).not.toContain('SubTask A1')
    expect(texts).not.toContain('Hold Task C')
  })
})

describe('filterNodes — hasSchedule', () => {
  it('hasSchedule:true は schedule 有りのみ（祖先は保持）', () => {
    const result = filterNodes(doc, { hasSchedule: true })
    const texts = taskTexts(result)
    expect(texts).toContain('Task A2')
    expect(texts).toContain('Task D')
    // Task A は Task A2 の祖先なので保持される
    expect(texts).toContain('Task A')
    expect(texts).not.toContain('Task E')
    expect(texts).not.toContain('SubTask A1')
  })

  it('hasSchedule:false は schedule 無しのみ', () => {
    const result = filterNodes(doc, { hasSchedule: false })
    const texts = taskTexts(result)
    expect(texts).not.toContain('Task A2')
    expect(texts).not.toContain('Task D')
    expect(texts).toContain('Task A')
    expect(texts).toContain('Task E')
  })
})

describe('filterNodes — hasDate', () => {
  it('hasDate:true は schedule または due 有り', () => {
    const result = filterNodes(doc, { hasDate: true })
    const texts = taskTexts(result)
    expect(texts).toContain('Task A')
    expect(texts).toContain('Task A2')
    expect(texts).toContain('Blocked Task B')
    expect(texts).toContain('Task D')
    expect(texts).toContain('Task E')
    expect(texts).not.toContain('SubTask A1')
    expect(texts).not.toContain('Hold Task C')
  })

  it('hasDate:false は日付なし（祖先 Task A は保持）', () => {
    const result = filterNodes(doc, { hasDate: false })
    const texts = taskTexts(result)
    expect(texts).toContain('SubTask A1')
    expect(texts).toContain('Hold Task C')
    // Task A は SubTask A1 の祖先なので保持される
    expect(texts).toContain('Task A')
    expect(texts).not.toContain('Task D')
    expect(texts).not.toContain('Task E')
  })
})

describe('filterNodes — text', () => {
  it('部分一致・大文字小文字無視', () => {
    const result = filterNodes(doc, { text: 'task a' })
    const texts = taskTexts(result)
    expect(texts).toContain('Task A')
    expect(texts).toContain('Task A2')
    expect(texts).toContain('SubTask A1')
    expect(texts).not.toContain('Task D')
    expect(texts).not.toContain('Task E')
  })

  it('一致なしは空 Document', () => {
    const result = filterNodes(doc, { text: 'xxxxxx' })
    expect(allTasks(result)).toHaveLength(0)
  })
})

describe('filterNodes — sectionPath', () => {
  it('sectionPath:[Projects] は Projects セクション内タスクのみ', () => {
    const result = filterNodes(doc, { sectionPath: ['Projects'] })
    const texts = taskTexts(result)
    expect(texts).toContain('Task A')
    expect(texts).toContain('Blocked Task B')
    expect(texts).not.toContain('Task D')
    expect(texts).not.toContain('Task E')
  })

  it('sectionPath:[Projects, Alpha] は Alpha サブセクションのみ', () => {
    const result = filterNodes(doc, { sectionPath: ['Projects', 'Alpha'] })
    const texts = taskTexts(result)
    expect(texts).toContain('Hold Task C')
    expect(texts).not.toContain('Task A')
    expect(texts).not.toContain('Task D')
  })

  it('sectionPath:[Personal] は Personal セクション内タスクのみ', () => {
    const result = filterNodes(doc, { sectionPath: ['Personal'] })
    const texts = taskTexts(result)
    expect(texts).toContain('Task D')
    expect(texts).toContain('Task E')
    expect(texts).not.toContain('Task A')
    expect(texts).not.toContain('Blocked Task B')
  })
})

// ──────────────────────────────────────────────────────────────────
// 複合条件（AND）
// ──────────────────────────────────────────────────────────────────

describe('filterNodes — 複数条件 AND', () => {
  it('status:todo かつ tags:urgent', () => {
    const result = filterNodes(doc, { status: ['todo'], tags: ['urgent'] })
    const texts = taskTexts(result)
    expect(texts).toContain('Task A')
    expect(texts).toContain('Task E')
    expect(texts).not.toContain('Blocked Task B') // blocked (not todo)
  })

  it('tags:total かつ priorityMax:1', () => {
    const result = filterNodes(doc, { tags: ['total'], priorityMax: 1 })
    const texts = taskTexts(result)
    expect(texts).toContain('Task A')
    expect(texts).not.toContain('Blocked Task B') // priority 3
  })

  it('dueBefore と dueAfter で範囲指定', () => {
    const result = filterNodes(doc, { dueAfter: '2025-07-01', dueBefore: '2025-12-31' })
    const texts = taskTexts(result)
    expect(texts).toContain('Task A')   // 2025-12-31
    expect(texts).not.toContain('Task D') // 2025-06-30 (範囲外)
    expect(texts).not.toContain('Task E') // 2026-01-01 (範囲外)
  })
})

// ──────────────────────────────────────────────────────────────────
// keepAncestors
// ──────────────────────────────────────────────────────────────────

describe('filterNodes — keepAncestors:true (既定)', () => {
  it('合致タスクの ListNode 祖先を保持する', () => {
    // Blocked Task B は ListGroup の子なので、keepAncestors:true なら ListGroup が残る
    const result = filterNodes(doc, { status: ['blocked'] }, { keepAncestors: true })
    const sec = result.sections[0]
    expect(sec).toBeDefined()
    // ListGroup (list) が children に含まれること
    const listNode = sec.children.find(n => n.type === 'list')
    expect(listNode).toBeDefined()
  })

  it('合致タスクの非合致 TaskNode 祖先を保持する', () => {
    // SubTask A1 が合致 → 親 Task A (todo) が祖先として保持される
    const result = filterNodes(doc, { status: ['done'] }, { keepAncestors: true })
    const sec = result.sections[0]
    const taskA = sec.children.find(n => n.type === 'task' && (n as TaskNode).text === 'Task A')
    expect(taskA).toBeDefined()
  })

  it('セクションが空になる場合は落とす', () => {
    // done タスクは Projects にしかない → Personal セクションは消える
    const result = filterNodes(doc, { status: ['done'] }, { keepAncestors: true })
    expect(result.sections.find(s => s.title === 'Personal')).toBeUndefined()
  })
})

describe('filterNodes — keepAncestors:false', () => {
  it('ListNode 祖先を保持しない（合致タスクをフラットに返す）', () => {
    // Blocked Task B は ListGroup の子だが、keepAncestors:false では ListGroup なしで返す
    const result = filterNodes(doc, { status: ['blocked'] }, { keepAncestors: false })
    const sec = result.sections[0]
    expect(sec).toBeDefined()
    const listNode = sec.children.find(n => n.type === 'list')
    expect(listNode).toBeUndefined()
    const task = sec.children.find(n => n.type === 'task' && (n as TaskNode).text === 'Blocked Task B')
    expect(task).toBeDefined()
  })

  it('非合致 TaskNode 祖先を保持しない', () => {
    // SubTask A1 が合致 → 親 Task A は保持されず SubTask A1 が直接返る
    const result = filterNodes(doc, { status: ['done'] }, { keepAncestors: false })
    const sec = result.sections[0]
    const taskA = sec.children.find(n => n.type === 'task' && (n as TaskNode).text === 'Task A')
    expect(taskA).toBeUndefined()
    const subTaskA1 = sec.children.find(n => n.type === 'task' && (n as TaskNode).text === 'SubTask A1')
    expect(subTaskA1).toBeDefined()
  })
})

// ──────────────────────────────────────────────────────────────────
// イミュータビリティ
// ──────────────────────────────────────────────────────────────────

describe('filterNodes — イミュータビリティ', () => {
  it('入力 Document の sections 参照が変化しない', () => {
    const originalSections = doc.sections
    const originalChildren = doc.sections[0].children
    filterNodes(doc, { status: ['todo'] })
    expect(doc.sections).toBe(originalSections)
    expect(doc.sections[0].children).toBe(originalChildren)
  })

  it('入力 Document の nodeLineMap が変化しない', () => {
    const originalSize = doc.nodeLineMap.size
    filterNodes(doc, { status: ['todo'] })
    expect(doc.nodeLineMap.size).toBe(originalSize)
  })
})

// ──────────────────────────────────────────────────────────────────
// nodeLineMap の構築
// ──────────────────────────────────────────────────────────────────

describe('filterNodes — nodeLineMap', () => {
  it('フィルタ後の Document は合致タスクの行番号を保持する', () => {
    const result = filterNodes(doc, { status: ['done'] })
    const tasks = allTasks(result)
    for (const task of tasks) {
      expect(result.nodeLineMap.has(task.id)).toBe(true)
    }
  })

  it('フィルタ後の Document は結果に存在しないタスクの行番号を含まない', () => {
    // keepAncestors:false で完全に除外されたタスクの行番号が含まれないことを確認
    const result = filterNodes(doc, { status: ['done'] }, { keepAncestors: false })
    const resultTaskIds = new Set(allTasks(result).map(t => t.id))
    const allOriginalTasks = allTasks(doc)
    for (const task of allOriginalTasks) {
      if (!resultTaskIds.has(task.id)) {
        expect(result.nodeLineMap.has(task.id)).toBe(false)
      }
    }
  })
})
