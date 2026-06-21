import { describe, it, expect } from 'vitest'
import { parseMarkdown } from '../parser/md-to-ast'
import { extractGanttNodes } from './ast-to-gantt'

// ----------------------------------------------------------------
// extractGanttNodes
// ----------------------------------------------------------------

describe('extractGanttNodes', () => {
  it('returns empty array when no schedules exist', () => {
    const doc = parseMarkdown('- [ ] タスクA\n')
    expect(extractGanttNodes(doc)).toEqual([])
  })

  it('converts a scheduled task to GanttNode type=task', () => {
    const doc = parseMarkdown('- [ ] タスクA\n  - @schedule: 2026-04-01T10:00/2026-04-01T12:00\n')
    const nodes = extractGanttNodes(doc)
    const task = nodes.find(n => n.type === 'task')
    expect(task).toBeDefined()
    expect(task!.name).toBe('タスクA')
    expect(task!.start).toBeDefined()
    expect(task!.end).toBeDefined()
  })

  it('does not include nodes without schedule and without schedule descendants', () => {
    const doc = parseMarkdown('- [ ] タスクA\n- [ ] タスクB\n  - @schedule: 2026-04-01T10:00/2026-04-01T12:00\n')
    const nodes = extractGanttNodes(doc)
    expect(nodes.every(n => n.name !== 'タスクA')).toBe(true)
  })

  it('creates a project node for depth=1 section with min/max of descendants', () => {
    const doc = parseMarkdown('# プロジェクト\n\n- [ ] タスク\n  - @schedule: 2026-04-01T10:00/2026-04-01T12:00\n')
    const nodes = extractGanttNodes(doc)
    const project = nodes.find(n => n.type === 'project')
    expect(project).toBeDefined()
    expect(project!.name).toBe('プロジェクト')
    expect(project!.parentId).toBeNull()
    // start/end should be derived from child task
    expect(project!.start?.toISO()).toContain('2026-04-01T10:00')
    expect(project!.end?.toISO()).toContain('2026-04-01T12:00')
  })

  it('creates a section node for depth>=2 section with min/max of descendants', () => {
    const doc = parseMarkdown('# 親\n\n## 子セクション\n\n- [ ] タスク\n  - @schedule: 2026-04-01T10:00/2026-04-01T12:00\n')
    const nodes = extractGanttNodes(doc)
    const section = nodes.find(n => n.type === 'section')
    expect(section).toBeDefined()
    expect(section!.name).toBe('子セクション')
    expect(section!.start?.toISO()).toContain('2026-04-01T10:00')
    expect(section!.end?.toISO()).toContain('2026-04-01T12:00')
  })

  it('creates a subsection node with min/max of child tasks', () => {
    const doc = parseMarkdown('- 親タスク\n  - [ ] 子タスク\n    - @schedule: 2026-04-01T10:00/2026-04-01T12:00\n')
    const nodes = extractGanttNodes(doc)
    const subsection = nodes.find(n => n.type === 'subsection')
    expect(subsection).toBeDefined()
    expect(subsection!.name).toBe('親タスク')
    expect(subsection!.start?.toISO()).toContain('2026-04-01T10:00')
    expect(subsection!.end?.toISO()).toContain('2026-04-01T12:00')
  })

  it('section start/end spans the full range of multiple child tasks', () => {
    const md = `# プロジェクト\n\n- [ ] タスクA\n  - @schedule: 2026-04-01T10:00/2026-04-01T12:00\n- [ ] タスクB\n  - @schedule: 2026-04-05T14:00/2026-04-05T18:00\n`
    const doc = parseMarkdown(md)
    const nodes = extractGanttNodes(doc)
    const project = nodes.find(n => n.type === 'project')!
    expect(project.start?.toISO()).toContain('2026-04-01T10:00')
    expect(project.end?.toISO()).toContain('2026-04-05T18:00')
  })

  it('sets parentId correctly for nested nodes', () => {
    const doc = parseMarkdown('# プロジェクト\n\n- [ ] タスク\n  - @schedule: 2026-04-01T10:00/2026-04-01T12:00\n')
    const nodes = extractGanttNodes(doc)
    const project = nodes.find(n => n.type === 'project')!
    const task = nodes.find(n => n.type === 'task')!
    expect(task.parentId).toBe(project.id)
  })

  it('excludes QuoteNodes', () => {
    const doc = parseMarkdown('> メモ\n> - メモ内容\n\n- [ ] タスク\n  - @schedule: 2026-04-01T10:00/2026-04-01T12:00\n')
    const nodes = extractGanttNodes(doc)
    expect(nodes.every(n => n.name !== 'メモ')).toBe(true)
  })

  it('skips sections without any schedule descendants', () => {
    const doc = parseMarkdown('# 予定あり\n\n- [ ] タスク\n  - @schedule: 2026-04-01T10:00/2026-04-01T12:00\n\n# 予定なし\n\n- [ ] メモ\n')
    const nodes = extractGanttNodes(doc)
    expect(nodes.some(n => n.name === '予定あり')).toBe(true)
    expect(nodes.some(n => n.name === '予定なし')).toBe(false)
  })

  it('stores status and schedule in metadata', () => {
    const doc = parseMarkdown('- [ ] タスク\n  - @schedule: 2026-04-01T10:00/2026-04-01T12:00\n')
    const nodes = extractGanttNodes(doc)
    const task = nodes.find(n => n.type === 'task')!
    expect(task.metadata?.status).toBe('todo')
    expect(task.metadata?.schedule).toBe('2026-04-01T10:00/2026-04-01T12:00')
  })

  it('does not set start/end for invalid schedule (GR-016)', () => {
    const doc = parseMarkdown('- [ ] タスク\n  - @schedule: invalid\n')
    const nodes = extractGanttNodes(doc)
    // invalid schedule → node included as task but without start/end
    const task = nodes.find(n => n.type === 'task')
    expect(task).toBeDefined()
    expect(task!.start).toBeUndefined()
    expect(task!.end).toBeUndefined()
  })

  it('handles multiple sections and tasks', () => {
    const md = `# セクション1

- [ ] タスクA
  - @schedule: 2026-04-01T10:00/2026-04-01T12:00
- [ ] タスクB
  - @schedule: 2026-04-02T10:00/2026-04-02T12:00

# セクション2

- [ ] タスクC
  - @schedule: 2026-04-03T10:00/2026-04-03T12:00
`
    const doc = parseMarkdown(md)
    const nodes = extractGanttNodes(doc)
    expect(nodes.filter(n => n.type === 'project')).toHaveLength(2)
    expect(nodes.filter(n => n.type === 'task')).toHaveLength(3)
  })
})
