import { describe, it, expect } from 'vitest'
import { parseMarkdown } from '../parser/md-to-ast'
import { extractCalendarItems, parseSchedule } from './ast-to-calendar'
import { updateNodeSchedule, updateNodeText } from './calendar-to-ast'
import { DateTime } from 'luxon'
import { serializeAst } from '../parser/ast-to-md'

// ----------------------------------------------------------------
// parseSchedule
// ----------------------------------------------------------------

describe('parseSchedule', () => {
  it('parses valid range', () => {
    const result = parseSchedule('2026-04-01T10:00/2026-04-01T12:00')
    expect(result).not.toBeNull()
    expect(result!.start.toISO()).toContain('2026-04-01T10:00')
    expect(result!.end.toISO()).toContain('2026-04-01T12:00')
  })

  it('returns null for invalid format (no slash)', () => {
    expect(parseSchedule('2026-04-01T10:00')).toBeNull()
  })

  it('returns null for invalid date strings', () => {
    expect(parseSchedule('not-a-date/also-not-a-date')).toBeNull()
  })

  it('returns null when start >= end', () => {
    expect(parseSchedule('2026-04-01T12:00/2026-04-01T10:00')).toBeNull()
    expect(parseSchedule('2026-04-01T10:00/2026-04-01T10:00')).toBeNull()
  })
})

// ----------------------------------------------------------------
// extractCalendarItems
// ----------------------------------------------------------------

const MD_WITH_SCHEDULE = `
- [ ] タスクA
  @schedule: 2026-04-01T10:00/2026-04-01T12:00
- [ ] タスクB（スケジュールなし）
- [x] タスクC
  @schedule: 2026-04-02T09:00/2026-04-02T17:00
`

describe('extractCalendarItems', () => {
  it('extracts only tasks with meta.schedule', () => {
    const doc = parseMarkdown(MD_WITH_SCHEDULE)
    const items = extractCalendarItems(doc)
    expect(items).toHaveLength(2)
    expect(items[0].title).toBe('タスクA')
    expect(items[1].title).toBe('タスクC')
  })

  it('uses AST node id as CalendarItem id', () => {
    const doc = parseMarkdown(MD_WITH_SCHEDULE)
    const items = extractCalendarItems(doc)
    // Find the corresponding AST node
    const nodeA = doc.sections[0].children.find(
      n => n.type === 'task' && (n as any).text === 'タスクA'
    )
    expect(items[0].id).toBe(nodeA!.id)
  })

  it('CalendarItem type is task', () => {
    const doc = parseMarkdown(MD_WITH_SCHEDULE)
    const items = extractCalendarItems(doc)
    items.forEach(item => expect(item.type).toBe('task'))
  })

  it('maps done status correctly', () => {
    const doc = parseMarkdown(MD_WITH_SCHEDULE)
    const items = extractCalendarItems(doc)
    const taskC = items.find(i => i.title === 'タスクC')
    expect((taskC as any).status).toBe('done')
  })

  it('maps blocked/hold to todo', () => {
    const md = `- [!] ブロック中\n  @schedule: 2026-04-01T10:00/2026-04-01T11:00\n- [-] 保留\n  @schedule: 2026-04-01T11:00/2026-04-01T12:00\n`
    const doc = parseMarkdown(md)
    const items = extractCalendarItems(doc)
    expect(items).toHaveLength(2)
    items.forEach(item => expect((item as any).status).toBe('todo'))
  })

  it('ignores quote nodes', () => {
    const md = `> - [ ] クォート内タスク\n  @schedule: 2026-04-01T10:00/2026-04-01T12:00\n- [ ] 通常タスク\n  @schedule: 2026-04-01T10:00/2026-04-01T12:00\n`
    const doc = parseMarkdown(md)
    const items = extractCalendarItems(doc)
    expect(items).toHaveLength(1)
    expect(items[0].title).toBe('通常タスク')
  })

  it('ignores tasks with invalid schedule format', () => {
    const md = `- [ ] タスク\n  @schedule: invalid-format\n`
    const doc = parseMarkdown(md)
    const items = extractCalendarItems(doc)
    expect(items).toHaveLength(0)
  })

  it('extracts tasks from nested sections', () => {
    const md = `# セクション1\n\n- [ ] タスク1\n  @schedule: 2026-04-01T10:00/2026-04-01T12:00\n\n## サブセクション\n\n- [ ] タスク2\n  @schedule: 2026-04-02T10:00/2026-04-02T12:00\n`
    const doc = parseMarkdown(md)
    const items = extractCalendarItems(doc)
    expect(items).toHaveLength(2)
  })

  it('extracts tasks recursively from nested children', () => {
    const md = `- グループ\n  - [ ] 子タスク\n    @schedule: 2026-04-01T10:00/2026-04-01T12:00\n`
    const doc = parseMarkdown(md)
    const items = extractCalendarItems(doc)
    expect(items).toHaveLength(1)
    expect(items[0].title).toBe('子タスク')
  })

  it('returns empty array when no scheduled tasks', () => {
    const doc = parseMarkdown('- [ ] タスク\n- リスト\n')
    const items = extractCalendarItems(doc)
    expect(items).toHaveLength(0)
  })

  it('sets parents from path', () => {
    const md = `- 親\n  - [ ] 子タスク\n    @schedule: 2026-04-01T10:00/2026-04-01T12:00\n`
    const doc = parseMarkdown(md)
    const items = extractCalendarItems(doc)
    expect(items[0].parents).toContain('親')
  })
})

// ----------------------------------------------------------------
// updateNodeSchedule
// ----------------------------------------------------------------

describe('updateNodeSchedule', () => {
  it('updates meta.schedule of the target node', () => {
    const md = `- [ ] タスク\n  @schedule: 2026-04-01T10:00/2026-04-01T12:00\n`
    const doc = parseMarkdown(md)
    const node = doc.sections[0].children[0] as any
    const newStart = DateTime.fromISO('2026-04-05T09:00')
    const newEnd = DateTime.fromISO('2026-04-05T11:00')
    const newDoc = updateNodeSchedule(doc, node.id, newStart, newEnd)
    const newNode = newDoc.sections[0].children[0] as any
    expect(newNode.meta.schedule).toBe('2026-04-05T09:00/2026-04-05T11:00')
  })

  it('does not modify other nodes', () => {
    const md = `- [ ] タスクA\n  @schedule: 2026-04-01T10:00/2026-04-01T12:00\n- [ ] タスクB\n  @schedule: 2026-04-02T10:00/2026-04-02T12:00\n`
    const doc = parseMarkdown(md)
    const nodeA = doc.sections[0].children[0] as any
    const newDoc = updateNodeSchedule(doc, nodeA.id, DateTime.fromISO('2026-05-01T09:00'), DateTime.fromISO('2026-05-01T10:00'))
    const nodeB = newDoc.sections[0].children[1] as any
    expect(nodeB.meta.schedule).toBe('2026-04-02T10:00/2026-04-02T12:00')
  })

  it('returns unchanged doc structure when id not found', () => {
    const md = `- [ ] タスク\n  @schedule: 2026-04-01T10:00/2026-04-01T12:00\n`
    const doc = parseMarkdown(md)
    const newDoc = updateNodeSchedule(doc, 'nonexistent-id', DateTime.now(), DateTime.now().plus({ hours: 1 }))
    const node = newDoc.sections[0].children[0] as any
    expect(node.meta.schedule).toBe('2026-04-01T10:00/2026-04-01T12:00')
  })
})

// ----------------------------------------------------------------
// updateNodeText
// ----------------------------------------------------------------

describe('updateNodeText', () => {
  it('updates text of the target node', () => {
    const md = `- [ ] 旧タイトル\n  @schedule: 2026-04-01T10:00/2026-04-01T12:00\n`
    const doc = parseMarkdown(md)
    const node = doc.sections[0].children[0] as any
    const newDoc = updateNodeText(doc, node.id, '新タイトル')
    const newNode = newDoc.sections[0].children[0] as any
    expect(newNode.text).toBe('新タイトル')
  })

  it('serializes updated text correctly', () => {
    const md = `- [ ] 旧タイトル\n  @schedule: 2026-04-01T10:00/2026-04-01T12:00\n`
    const doc = parseMarkdown(md)
    const node = doc.sections[0].children[0] as any
    const newDoc = updateNodeText(doc, node.id, '新タイトル')
    const newMd = serializeAst(newDoc)
    expect(newMd).toContain('新タイトル')
    expect(newMd).not.toContain('旧タイトル')
  })
})
