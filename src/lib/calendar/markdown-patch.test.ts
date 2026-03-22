import { describe, it, expect } from 'vitest'
import { parseMarkdown } from '../parser/md-to-ast'
import { findNodeById, patchSchedule, patchTaskTitle, formatSchedule } from './markdown-patch'
import { DateTime } from 'luxon'

// ----------------------------------------------------------------
// formatSchedule
// ----------------------------------------------------------------

describe('formatSchedule', () => {
  it('formats DateTime pair to schedule string', () => {
    const start = DateTime.fromISO('2026-04-01T10:00')
    const end = DateTime.fromISO('2026-04-01T12:00')
    expect(formatSchedule(start, end)).toBe('2026-04-01T10:00/2026-04-01T12:00')
  })
})

// ----------------------------------------------------------------
// findNodeById
// ----------------------------------------------------------------

describe('findNodeById', () => {
  const md = `- [ ] タスクA\n  @schedule: 2026-04-01T10:00/2026-04-01T12:00\n- [ ] タスクB\n`

  it('finds a node by id', () => {
    const doc = parseMarkdown(md)
    const nodeA = doc.sections[0].children[0]
    const found = findNodeById(doc, nodeA.id)
    expect(found).not.toBeNull()
    expect((found as any).text).toBe('タスクA')
  })

  it('returns null for unknown id', () => {
    const doc = parseMarkdown(md)
    expect(findNodeById(doc, 'nonexistent')).toBeNull()
  })

  it('finds nested node', () => {
    const nestedMd = `- 親\n  - [ ] 子タスク\n    @schedule: 2026-04-01T10:00/2026-04-01T12:00\n`
    const doc = parseMarkdown(nestedMd)
    const child = (doc.sections[0].children[0] as any).children[0]
    const found = findNodeById(doc, child.id)
    expect(found).not.toBeNull()
    expect((found as any).text).toBe('子タスク')
  })

  it('finds node across sections', () => {
    const md2 = `# セクション1\n\n- [ ] タスク1\n\n# セクション2\n\n- [ ] タスク2\n  @schedule: 2026-04-01T10:00/2026-04-01T12:00\n`
    const doc = parseMarkdown(md2)
    const node2 = doc.sections[1].children[0]
    const found = findNodeById(doc, node2.id)
    expect(found).not.toBeNull()
    expect((found as any).text).toBe('タスク2')
  })
})

// ----------------------------------------------------------------
// patchSchedule — must not alter blank lines or other content
// ----------------------------------------------------------------

describe('patchSchedule', () => {
  it('replaces only the @schedule line', () => {
    const md = `- [ ] タスク\n  @schedule: 2026-04-01T10:00/2026-04-01T12:00\n`
    const result = patchSchedule(md, '2026-04-01T10:00/2026-04-01T12:00', '2026-04-05T09:00/2026-04-05T11:00')
    expect(result).toContain('@schedule: 2026-04-05T09:00/2026-04-05T11:00')
    expect(result).not.toContain('2026-04-01T10:00/2026-04-01T12:00')
  })

  it('preserves blank lines around the target line', () => {
    const md = `- グループ\n\n  - [ ] タスクA\n    @schedule: 2026-04-01T10:00/2026-04-01T12:00\n\n  - [ ] タスクB\n`
    const result = patchSchedule(md, '2026-04-01T10:00/2026-04-01T12:00', '2026-04-05T09:00/2026-04-05T11:00')
    // Blank lines must still be present
    expect(result).toContain('\n\n  - [ ] タスクA\n')
    expect(result).toContain('\n\n  - [ ] タスクB\n')
  })

  it('preserves indentation of the @schedule line', () => {
    const md = `- [ ] タスク\n    @schedule: 2026-04-01T10:00/2026-04-01T12:00\n`
    const result = patchSchedule(md, '2026-04-01T10:00/2026-04-01T12:00', '2026-04-05T09:00/2026-04-05T11:00')
    expect(result).toContain('    @schedule: 2026-04-05T09:00/2026-04-05T11:00')
  })

  it('returns original if old and new are the same', () => {
    const md = `- [ ] タスク\n  @schedule: 2026-04-01T10:00/2026-04-01T12:00\n`
    const result = patchSchedule(md, '2026-04-01T10:00/2026-04-01T12:00', '2026-04-01T10:00/2026-04-01T12:00')
    expect(result).toBe(md)
  })

  it('does not touch unrelated @schedule lines', () => {
    const md = `- [ ] タスクA\n  @schedule: 2026-04-01T10:00/2026-04-01T12:00\n- [ ] タスクB\n  @schedule: 2026-04-02T10:00/2026-04-02T12:00\n`
    const result = patchSchedule(md, '2026-04-01T10:00/2026-04-01T12:00', '2026-04-05T09:00/2026-04-05T11:00')
    expect(result).toContain('@schedule: 2026-04-02T10:00/2026-04-02T12:00')
  })

  it('preserves all lines that are not the target', () => {
    const md = `# セクション\n\n> メモ\n\n- [ ] タスク\n  @schedule: 2026-04-01T10:00/2026-04-01T12:00\n  - 子リスト\n`
    const result = patchSchedule(md, '2026-04-01T10:00/2026-04-01T12:00', '2026-04-05T09:00/2026-04-05T11:00')
    expect(result).toContain('# セクション')
    expect(result).toContain('> メモ')
    expect(result).toContain('- 子リスト')
    // Blank lines preserved
    expect(result.split('\n\n').length).toBe(md.split('\n\n').length)
  })
})

// ----------------------------------------------------------------
// patchTaskTitle — must not alter blank lines or other content
// ----------------------------------------------------------------

describe('patchTaskTitle', () => {
  it('replaces only the task title line', () => {
    const md = `- [ ] 旧タイトル\n  @schedule: 2026-04-01T10:00/2026-04-01T12:00\n`
    const result = patchTaskTitle(md, 'todo', '旧タイトル', '新タイトル')
    expect(result).toContain('- [ ] 新タイトル')
    expect(result).not.toContain('旧タイトル')
  })

  it('preserves @schedule line after the task line', () => {
    const md = `- [ ] 旧タイトル\n  @schedule: 2026-04-01T10:00/2026-04-01T12:00\n`
    const result = patchTaskTitle(md, 'todo', '旧タイトル', '新タイトル')
    expect(result).toContain('  @schedule: 2026-04-01T10:00/2026-04-01T12:00')
  })

  it('preserves blank lines', () => {
    const md = `- [ ] タスクA\n\n- [ ] 旧タイトル\n  @schedule: 2026-04-01T10:00/2026-04-01T12:00\n\n- [ ] タスクB\n`
    const result = patchTaskTitle(md, 'todo', '旧タイトル', '新タイトル')
    expect(result.split('\n\n').length).toBe(md.split('\n\n').length)
  })

  it('preserves indentation', () => {
    const md = `- グループ\n  - [ ] 旧タイトル\n    @schedule: 2026-04-01T10:00/2026-04-01T12:00\n`
    const result = patchTaskTitle(md, 'todo', '旧タイトル', '新タイトル')
    expect(result).toContain('  - [ ] 新タイトル')
  })

  it('returns original if title unchanged', () => {
    const md = `- [ ] タスク\n`
    expect(patchTaskTitle(md, 'todo', 'タスク', 'タスク')).toBe(md)
  })

  it('handles doing marker correctly', () => {
    const md = `- [>] 進行中タスク\n  @schedule: 2026-04-01T10:00/2026-04-01T12:00\n`
    const result = patchTaskTitle(md, 'doing', '進行中タスク', '完了タスク')
    expect(result).toContain('- [>] 完了タスク')
  })
})
