import { describe, it, expect } from 'vitest'
import { parseMarkdown } from '../parser/parse-markdown'
import { extractCalendarItems, parseSchedule } from './ast-to-calendar'
import { updateNodeSchedule, updateNodeText } from './calendar-to-ast'
import { DateTime } from 'luxon'
import { serializeAst } from '../parser/ast-to-md'
import { parseGlobalKey } from '../viewmodel/global-key'

// ----------------------------------------------------------------
// ヘルパー: 単一ファイルソースの作成
// ----------------------------------------------------------------
function src(md: string, path = 'test.md') {
  return [{ path, doc: parseMarkdown(md) }]
}

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
  - @schedule: 2026-04-01T10:00/2026-04-01T12:00
- [ ] タスクB（スケジュールなし）
- [x] タスクC
  - @schedule: 2026-04-02T09:00/2026-04-02T17:00
`

describe('extractCalendarItems', () => {
  it('extracts only tasks with meta.schedule', () => {
    const items = extractCalendarItems(src(MD_WITH_SCHEDULE))
    expect(items).toHaveLength(2)
    expect(items[0].title).toBe('タスクA')
    expect(items[1].title).toBe('タスクC')
  })

  it('CalendarItem の id は globalKey 形式（sourcePath::localId）', () => {
    const doc = parseMarkdown(MD_WITH_SCHEDULE)
    const items = extractCalendarItems([{ path: 'test.md', doc }])
    const { filePath, localId } = parseGlobalKey(items[0].id)
    // filePath は sourcePath と一致する
    expect(filePath).toBe('test.md')
    // localId は AST ノードの id と一致する
    const nodeA = doc.sections[0].children.find(
      n => n.type === 'task' && (n as any).text === 'タスクA'
    )
    expect(localId).toBe(nodeA!.id)
  })

  it('CalendarItem type is task', () => {
    const items = extractCalendarItems(src(MD_WITH_SCHEDULE))
    items.forEach(item => expect(item.type).toBe('task'))
  })

  it('maps done status correctly', () => {
    const items = extractCalendarItems(src(MD_WITH_SCHEDULE))
    const taskC = items.find(i => i.title === 'タスクC')
    expect((taskC as any).status).toBe('done')
  })

  it('maps blocked/hold to todo', () => {
    const md = `- [!] ブロック中\n  - @schedule: 2026-04-01T10:00/2026-04-01T11:00\n- [-] 保留\n  - @schedule: 2026-04-01T11:00/2026-04-01T12:00\n`
    const items = extractCalendarItems(src(md))
    expect(items).toHaveLength(2)
    items.forEach(item => expect((item as any).status).toBe('todo'))
  })

  it('ignores quote nodes', () => {
    const md = `> - [ ] クォート内タスク\n  - @schedule: 2026-04-01T10:00/2026-04-01T12:00\n- [ ] 通常タスク\n  - @schedule: 2026-04-01T10:00/2026-04-01T12:00\n`
    const items = extractCalendarItems(src(md))
    expect(items).toHaveLength(1)
    expect(items[0].title).toBe('通常タスク')
  })

  it('ignores tasks with invalid schedule format', () => {
    const md = `- [ ] タスク\n  - @schedule: invalid-format\n`
    expect(extractCalendarItems(src(md))).toHaveLength(0)
  })

  it('extracts tasks from nested sections', () => {
    const md = `# セクション1\n\n- [ ] タスク1\n  - @schedule: 2026-04-01T10:00/2026-04-01T12:00\n\n## サブセクション\n\n- [ ] タスク2\n  - @schedule: 2026-04-02T10:00/2026-04-02T12:00\n`
    expect(extractCalendarItems(src(md))).toHaveLength(2)
  })

  it('extracts tasks recursively from nested children', () => {
    const md = `- グループ\n  - [ ] 子タスク\n    - @schedule: 2026-04-01T10:00/2026-04-01T12:00\n`
    const items = extractCalendarItems(src(md))
    expect(items).toHaveLength(1)
    expect(items[0].title).toBe('子タスク')
  })

  it('returns empty array when no scheduled tasks', () => {
    expect(extractCalendarItems(src('- [ ] タスク\n- リスト\n'))).toHaveLength(0)
  })

  it('sets parents from path', () => {
    const md = `- 親\n  - [ ] 子タスク\n    - @schedule: 2026-04-01T10:00/2026-04-01T12:00\n`
    const items = extractCalendarItems(src(md))
    expect(items[0].parents).toContain('親')
  })
})

describe('extractCalendarItems — マルチソース', () => {
  it('複数ファイルのアイテムを集約し id が全体でユニーク', () => {
    const mdA = '- [ ] タスクA\n  - @schedule: 2026-04-01T10:00/2026-04-01T12:00\n'
    const mdB = '- [ ] タスクA\n  - @schedule: 2026-04-02T10:00/2026-04-02T12:00\n'
    const sources = [
      { path: 'fileA.md', doc: parseMarkdown(mdA) },
      { path: 'fileB.md', doc: parseMarkdown(mdB) },
    ]
    const items = extractCalendarItems(sources)
    expect(items).toHaveLength(2)
    const ids = items.map(i => i.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('各アイテムの id の filePath が正しいファイルを指す', () => {
    const sources = [
      { path: 'fileA.md', doc: parseMarkdown('- [ ] A\n  - @schedule: 2026-04-01T10:00/2026-04-01T12:00\n') },
      { path: 'fileB.md', doc: parseMarkdown('- [ ] B\n  - @schedule: 2026-04-01T10:00/2026-04-01T12:00\n') },
    ]
    const items = extractCalendarItems(sources)
    const itemA = items.find(i => i.title === 'A')!
    const itemB = items.find(i => i.title === 'B')!
    expect(parseGlobalKey(itemA.id).filePath).toBe('fileA.md')
    expect(parseGlobalKey(itemB.id).filePath).toBe('fileB.md')
  })
})

// ----------------------------------------------------------------
// extractCalendarItems — @repeat 展開
// ----------------------------------------------------------------

describe('extractCalendarItems — @repeat 展開', () => {
  const viewRange = {
    start: DateTime.fromISO('2026-04-01T00:00'),
    end: DateTime.fromISO('2026-04-30T23:59'),
  }

  it('@repeat あり・viewRange あり: 表示範囲内オカレンスを展開する', () => {
    const md = [
      '- [ ] 毎週金曜',
      '  - @schedule: 2026-04-03T10:00/2026-04-03T11:00',
      '  - @repeat: FREQ=WEEKLY;BYDAY=FR',
    ].join('\n') + '\n'
    const items = extractCalendarItems(src(md), viewRange)
    // 4月の金曜: 3,10,17,24 = 4件
    expect(items).toHaveLength(4)
    items.forEach(item => {
      expect((item as any).temporal.kind).toBe('CalendarDateTimeRange')
    })
  })

  it('@repeat あり・viewRange あり: 各オカレンスの id が __r{index} サフィックスを持つ', () => {
    const md = [
      '- [ ] 繰り返し',
      '  - @schedule: 2026-04-03T10:00/2026-04-03T11:00',
      '  - @repeat: FREQ=WEEKLY;BYDAY=FR',
    ].join('\n') + '\n'
    const items = extractCalendarItems(src(md), viewRange)
    items.forEach((item, idx) => {
      expect(item.id).toMatch(new RegExp(`__r${idx}$`))
    })
  })

  it('@repeat あり・viewRange あり: オカレンスの duration が初回 @schedule と一致する', () => {
    const md = [
      '- [ ] 繰り返し',
      '  - @schedule: 2026-04-03T10:00/2026-04-03T12:00',
      '  - @repeat: FREQ=WEEKLY;BYDAY=FR',
    ].join('\n') + '\n'
    const items = extractCalendarItems(src(md), viewRange)
    items.forEach(item => {
      const t = (item as any).temporal
      const durationMs = t.end.toMillis() - t.start.toMillis()
      expect(durationMs).toBe(2 * 60 * 60 * 1000) // 2時間
    })
  })

  it('@repeat あり・viewRange なし: 展開せず空になる', () => {
    const md = [
      '- [ ] 繰り返し',
      '  - @schedule: 2026-04-03T10:00/2026-04-03T11:00',
      '  - @repeat: FREQ=WEEKLY;BYDAY=FR',
    ].join('\n') + '\n'
    const items = extractCalendarItems(src(md))
    // viewRange なし → 展開スキップ → 0件
    expect(items).toHaveLength(0)
  })

  it('@repeat 不正値: 展開スキップ（例外を投げない）', () => {
    const md = [
      '- [ ] 不正repeat',
      '  - @schedule: 2026-04-03T10:00/2026-04-03T11:00',
      '  - @repeat: INVALID_RRULE',
    ].join('\n') + '\n'
    expect(() => extractCalendarItems(src(md), viewRange)).not.toThrow()
    expect(extractCalendarItems(src(md), viewRange)).toHaveLength(0)
  })

  it('@repeat なしタスクは従来どおり展開しない（回帰）', () => {
    const md = '- [ ] タスク\n  - @schedule: 2026-04-01T10:00/2026-04-01T12:00\n'
    const items = extractCalendarItems(src(md), viewRange)
    expect(items).toHaveLength(1)
    expect(items[0].id).not.toMatch(/__r\d+$/)
  })
})

// ----------------------------------------------------------------
// updateNodeSchedule
// ----------------------------------------------------------------

describe('updateNodeSchedule', () => {
  it('updates meta.schedule of the target node', () => {
    const md = `- [ ] タスク\n  - @schedule: 2026-04-01T10:00/2026-04-01T12:00\n`
    const doc = parseMarkdown(md)
    const node = doc.sections[0].children[0] as any
    const newStart = DateTime.fromISO('2026-04-05T09:00')
    const newEnd = DateTime.fromISO('2026-04-05T11:00')
    const newDoc = updateNodeSchedule(doc, node.id, newStart, newEnd)
    const newNode = newDoc.sections[0].children[0] as any
    expect(newNode.meta.schedule).toBe('2026-04-05T09:00/2026-04-05T11:00')
  })

  it('does not modify other nodes', () => {
    const md = `- [ ] タスクA\n  - @schedule: 2026-04-01T10:00/2026-04-01T12:00\n- [ ] タスクB\n  - @schedule: 2026-04-02T10:00/2026-04-02T12:00\n`
    const doc = parseMarkdown(md)
    const nodeA = doc.sections[0].children[0] as any
    const newDoc = updateNodeSchedule(doc, nodeA.id, DateTime.fromISO('2026-05-01T09:00'), DateTime.fromISO('2026-05-01T10:00'))
    const nodeB = newDoc.sections[0].children[1] as any
    expect(nodeB.meta.schedule).toBe('2026-04-02T10:00/2026-04-02T12:00')
  })

  it('returns unchanged doc structure when id not found', () => {
    const md = `- [ ] タスク\n  - @schedule: 2026-04-01T10:00/2026-04-01T12:00\n`
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
    const md = `- [ ] 旧タイトル\n  - @schedule: 2026-04-01T10:00/2026-04-01T12:00\n`
    const doc = parseMarkdown(md)
    const node = doc.sections[0].children[0] as any
    const newDoc = updateNodeText(doc, node.id, '新タイトル')
    const newNode = newDoc.sections[0].children[0] as any
    expect(newNode.text).toBe('新タイトル')
  })

  it('serializes updated text correctly', () => {
    const md = `- [ ] 旧タイトル\n  - @schedule: 2026-04-01T10:00/2026-04-01T12:00\n`
    const doc = parseMarkdown(md)
    const node = doc.sections[0].children[0] as any
    const newDoc = updateNodeText(doc, node.id, '新タイトル')
    const newMd = serializeAst(newDoc)
    expect(newMd).toContain('新タイトル')
    expect(newMd).not.toContain('旧タイトル')
  })
})
