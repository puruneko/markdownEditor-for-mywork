import { DateTime } from 'luxon'
import type { Task, TaskStatus, CalendarItem } from 'svelte-calendar-lib'
import type { Document, Section, Node, Status } from '../parser/types'
import type { SourceEntry } from '../viewmodel/contract'
import { makeGlobalKey } from '../viewmodel/global-key'
import { expandOccurrences } from '../recurrence/expand'

// ----------------------------------------------------------------
// Status mapping (AST → CalendarItem)
// ----------------------------------------------------------------

function mapStatus(status: Status): TaskStatus {
  switch (status) {
    case 'doing': return 'doing'
    case 'done':  return 'done'
    default:      return 'todo'  // todo / blocked / hold → todo
  }
}

// ----------------------------------------------------------------
// Schedule string parser
// ----------------------------------------------------------------

type ParsedSchedule =
  | { kind: 'dateTimeRange'; start: DateTime; end: DateTime }
  | { kind: 'dateRange'; start: string; endExclusive: string }

export function parseSchedule(schedule: string): ParsedSchedule | null {
  const parts = schedule.split('/')
  if (parts.length !== 2) return null

  const rawStart = parts[0].trim()
  const rawEnd = parts[1].trim()

  // 日付のみスケジュール（"T" を含まない）→ CalendarDateRange
  if (!rawStart.includes('T') && !rawEnd.includes('T')) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(rawStart) || !/^\d{4}-\d{2}-\d{2}$/.test(rawEnd)) return null
    if (rawEnd <= rawStart) return null
    return { kind: 'dateRange', start: rawStart, endExclusive: rawEnd }
  }

  // 時刻付きスケジュール → DateTime でパース
  const start = DateTime.fromISO(rawStart)
  const end = DateTime.fromISO(rawEnd)

  if (!start.isValid || !end.isValid) return null
  if (start >= end) return null

  // 同一日内 → CalendarDateTimeRange
  if (start.hasSame(end.minus({ milliseconds: 1 }), 'day')) {
    return { kind: 'dateTimeRange', start, end }
  }

  // 複数日にまたがる → CalendarDateRange（時刻情報を切り捨て）
  const startDate = start.toISODate()!
  const endExclusive = end.minus({ milliseconds: 1 }).startOf('day').plus({ days: 1 }).toISODate()!
  if (endExclusive <= startDate) return null
  return { kind: 'dateRange', start: startDate, endExclusive }
}

// ----------------------------------------------------------------
// Node traversal
// ----------------------------------------------------------------

type ViewRange = { start: DateTime; end: DateTime }

function extractFromNodes(
  nodes: Node[],
  sourcePath: string,
  items: CalendarItem[],
  viewRange: ViewRange | null,
): void {
  for (const node of nodes) {
    if (node.type === 'quote') continue

    if (node.type === 'task' && node.meta?.schedule) {
      const parents = node.path.slice(0, -1).map(p => p.replace(/\[\d+\]$/, ''))
      const baseId = makeGlobalKey(sourcePath, node.id)

      if (node.meta.repeat) {
        // @repeat あり: viewRange があれば展開、なければスキップ（本体スケジュールは出さない）
        if (viewRange) {
          const occurrences = expandOccurrences(node.meta, viewRange.start, viewRange.end)
          occurrences.forEach((occ, idx) => {
            const item: Task = {
              id: `${baseId}__r${idx}`,
              type: 'task',
              title: node.text,
              status: mapStatus(node.status),
              parents,
              temporal: { kind: 'CalendarDateTimeRange' as const, start: occ.start, end: occ.end },
            }
            items.push(item)
          })
        }
      } else {
        const parsed = parseSchedule(node.meta.schedule)
        if (parsed) {
          const temporal = parsed.kind === 'dateRange'
            ? { kind: 'CalendarDateRange' as const, start: parsed.start, endExclusive: parsed.endExclusive }
            : { kind: 'CalendarDateTimeRange' as const, start: parsed.start, end: parsed.end }

          const item: Task = {
            id: baseId,
            type: 'task',
            title: node.text,
            status: mapStatus(node.status),
            parents,
            temporal,
          }
          items.push(item)
        }
      }
    }

    if ((node.type === 'task' || node.type === 'list') && node.children.length > 0) {
      extractFromNodes(node.children, sourcePath, items, viewRange)
    }
  }
}

function extractFromSection(
  section: Section,
  sourcePath: string,
  items: CalendarItem[],
  viewRange: ViewRange | null,
): void {
  extractFromNodes(section.children, sourcePath, items, viewRange)
  for (const sub of section.subSections) {
    extractFromSection(sub, sourcePath, items, viewRange)
  }
}

function extractFromDocument(
  doc: Document,
  sourcePath: string,
  items: CalendarItem[],
  viewRange: ViewRange | null,
): void {
  for (const section of doc.sections) {
    extractFromSection(section, sourcePath, items, viewRange)
  }
}

// ----------------------------------------------------------------
// Public API
// ----------------------------------------------------------------

/**
 * 複数ソースから CalendarItem[] を生成する。
 * viewRange を渡すと @repeat タスクを表示範囲内で展開する。
 * 各アイテムの id は globalKey（sourcePath::localId）で全体でユニーク。
 * 単一ファイルの場合は要素 1 の配列として渡す。
 */
export function extractCalendarItems(sources: SourceEntry[], viewRange?: ViewRange): CalendarItem[] {
  const items: CalendarItem[] = []
  const range = viewRange ?? null
  for (const { path, doc } of sources) {
    extractFromDocument(doc, path, items, range)
  }
  return items
}
