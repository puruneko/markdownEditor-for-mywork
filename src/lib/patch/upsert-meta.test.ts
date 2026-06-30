import { describe, it, expect } from 'vitest'
import { parseMarkdown } from '../parser/parse-markdown'
import { upsertMeta, upsertSchedule, upsertDue } from './upsert-meta'
import type { TaskNode } from '../parser/types'

function getTaskNode(md: string, title: string): TaskNode {
  const doc = parseMarkdown(md)
  for (const section of doc.sections) {
    const found = findTask(section.children, title)
    if (found) return found
  }
  throw new Error(`TaskNode '${title}' not found in:\n${md}`)
}

function findTask(nodes: unknown[], title: string): TaskNode | null {
  for (const node of nodes as TaskNode[]) {
    if (node.type === 'task' && node.text === title) return node
    if ((node.type === 'task' || node.type === 'list') && (node as { children: unknown[] }).children) {
      const found = findTask((node as { children: unknown[] }).children, title)
      if (found) return found
    }
  }
  return null
}

// ----------------------------------------------------------------
// upsertSchedule — 新規挿入
// ----------------------------------------------------------------

describe('upsertSchedule — 子なし: タスク直後に挿入', () => {
  it('子のないタスクに @schedule を新規挿入する', () => {
    const md = '- [ ] タスクA\n- [ ] タスクB\n'
    const node = getTaskNode(md, 'タスクA')
    const result = upsertSchedule(md, node, '2026-06-30T10:00/2026-06-30T11:00')
    expect(result).toBe('- [ ] タスクA\n  - @schedule: 2026-06-30T10:00/2026-06-30T11:00\n- [ ] タスクB\n')
  })

  it('ファイル末尾の子なしタスクに挿入する', () => {
    const md = '- [ ] タスクA\n'
    const node = getTaskNode(md, 'タスクA')
    const result = upsertSchedule(md, node, '2026-06-30T09:00/2026-06-30T10:00')
    expect(result).toContain('  - @schedule: 2026-06-30T09:00/2026-06-30T10:00')
  })
})

describe('upsertSchedule — 子あり・メタなし: 子領域末尾に挿入', () => {
  it('既存の子リスト末尾に @schedule を追加する', () => {
    const md = '- [ ] タスクA\n  - メモ\n- [ ] タスクB\n'
    const node = getTaskNode(md, 'タスクA')
    const result = upsertSchedule(md, node, '2026-06-30T14:00/2026-06-30T15:00')
    expect(result).toBe('- [ ] タスクA\n  - メモ\n  - @schedule: 2026-06-30T14:00/2026-06-30T15:00\n- [ ] タスクB\n')
  })

  it('複数の子を持つタスクの末尾に挿入する', () => {
    const md = '- [ ] タスクA\n  - 子1\n  - 子2\n- [ ] タスクB\n'
    const node = getTaskNode(md, 'タスクA')
    const result = upsertSchedule(md, node, '2026-06-30T14:00/2026-06-30T15:00')
    const lines = result.split('\n')
    const schedIdx = lines.findIndex(l => l.includes('@schedule'))
    expect(lines[schedIdx - 1]).toBe('  - 子2')
  })
})

describe('upsertSchedule — 既存 @schedule の置換', () => {
  it('既存の @schedule を新しい値で置換する', () => {
    const md = '- [ ] タスクA\n  - @schedule: 2026-01-01T09:00/2026-01-01T10:00\n'
    const node = getTaskNode(md, 'タスクA')
    const result = upsertSchedule(md, node, '2026-06-30T14:00/2026-06-30T15:00')
    expect(result).toBe('- [ ] タスクA\n  - @schedule: 2026-06-30T14:00/2026-06-30T15:00\n')
    expect(result).not.toContain('2026-01-01')
  })

  it('複数の @schedule がある場合は最初のものを置換し、残りは保持する', () => {
    const md = '- [ ] タスクA\n  - @schedule: 2026-01-01T09:00/2026-01-01T10:00\n  - @schedule: 2026-02-01T09:00/2026-02-01T10:00\n'
    const node = getTaskNode(md, 'タスクA')
    const result = upsertSchedule(md, node, '2026-06-30T14:00/2026-06-30T15:00')
    const lines = result.split('\n')
    const schedLines = lines.filter(l => l.includes('@schedule'))
    expect(schedLines[0]).toBe('  - @schedule: 2026-06-30T14:00/2026-06-30T15:00')
    expect(schedLines[1]).toBe('  - @schedule: 2026-02-01T09:00/2026-02-01T10:00')
  })
})

describe('upsertSchedule — インデント', () => {
  it('ネストしたタスクに正しいインデントで挿入する', () => {
    const md = '- 親\n  - [ ] 子タスク\n- 別\n'
    const node = getTaskNode(md, '子タスク')
    const result = upsertSchedule(md, node, '2026-06-30T10:00/2026-06-30T11:00')
    expect(result).toContain('    - @schedule: 2026-06-30T10:00/2026-06-30T11:00')
  })
})

describe('upsertSchedule — 冪等性', () => {
  it('同じ値で2回適用しても @schedule は1行のみになる', () => {
    const md = '- [ ] タスクA\n'
    const node = getTaskNode(md, 'タスクA')
    const once = upsertSchedule(md, node, '2026-06-30T10:00/2026-06-30T11:00')
    const nodeAfter = getTaskNode(once, 'タスクA')
    const twice = upsertSchedule(once, nodeAfter, '2026-06-30T10:00/2026-06-30T11:00')
    const schedCount = twice.split('\n').filter(l => l.includes('@schedule')).length
    expect(schedCount).toBe(1)
  })
})

// ----------------------------------------------------------------
// upsertDue
// ----------------------------------------------------------------

describe('upsertDue — 新規挿入', () => {
  it('子のないタスクに @due を新規挿入する', () => {
    const md = '- [ ] タスクA\n- [ ] タスクB\n'
    const node = getTaskNode(md, 'タスクA')
    const result = upsertDue(md, node, '2026-06-30')
    expect(result).toBe('- [ ] タスクA\n  - @due: 2026-06-30\n- [ ] タスクB\n')
  })

  it('既存の @due を置換する', () => {
    const md = '- [ ] タスクA\n  - @due: 2026-01-01\n'
    const node = getTaskNode(md, 'タスクA')
    const result = upsertDue(md, node, '2026-06-30')
    expect(result).toBe('- [ ] タスクA\n  - @due: 2026-06-30\n')
  })
})

// ----------------------------------------------------------------
// upsertMeta — @schedule と @due が共存する場合
// ----------------------------------------------------------------

describe('upsertMeta — schedule と due が共存', () => {
  it('@schedule の置換は @due に影響しない', () => {
    const md = '- [ ] タスクA\n  - @schedule: 2026-01-01T09:00/2026-01-01T10:00\n  - @due: 2026-01-05\n'
    const node = getTaskNode(md, 'タスクA')
    const result = upsertSchedule(md, node, '2026-06-30T14:00/2026-06-30T15:00')
    expect(result).toContain('  - @due: 2026-01-05')
    expect(result).toContain('  - @schedule: 2026-06-30T14:00/2026-06-30T15:00')
    expect(result).not.toContain('2026-01-01T09:00')
  })

  it('@due の置換は @schedule に影響しない', () => {
    const md = '- [ ] タスクA\n  - @schedule: 2026-01-01T09:00/2026-01-01T10:00\n  - @due: 2026-01-05\n'
    const node = getTaskNode(md, 'タスクA')
    const result = upsertDue(md, node, '2026-06-30')
    expect(result).toContain('  - @schedule: 2026-01-01T09:00/2026-01-01T10:00')
    expect(result).toContain('  - @due: 2026-06-30')
    expect(result).not.toContain('2026-01-05')
  })
})

// ----------------------------------------------------------------
// 回帰: 他の子行・空行・本文を壊さない
// ----------------------------------------------------------------

describe('upsertMeta — 他行への影響なし', () => {
  it('兄弟タスクのメタを変更しない', () => {
    const md = '- [ ] タスクA\n- [ ] タスクB\n  - @schedule: 2026-02-01T09:00/2026-02-01T10:00\n'
    const nodeA = getTaskNode(md, 'タスクA')
    const result = upsertSchedule(md, nodeA, '2026-06-30T10:00/2026-06-30T11:00')
    expect(result).toContain('  - @schedule: 2026-02-01T09:00/2026-02-01T10:00')
  })

  it('空行を含む子領域でも正しく動作する', () => {
    const md = '- [ ] タスクA\n  - 子1\n\n  - 子2\n- [ ] タスクB\n'
    const node = getTaskNode(md, 'タスクA')
    const result = upsertSchedule(md, node, '2026-06-30T10:00/2026-06-30T11:00')
    expect(result).toContain('  - @schedule: 2026-06-30T10:00/2026-06-30T11:00')
    expect(result).toContain('- [ ] タスクB')
  })
})
