import { DateTime } from 'luxon'
import type { Task, TaskStatus, CalendarItem } from 'svelte-calendar-lib'
import type { Document, Section, Node, Status } from '../parser/types'

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

function extractFromNodes(nodes: Node[], items: CalendarItem[]): void {
  for (const node of nodes) {
    if (node.type === 'quote') continue

    if (node.type === 'task' && node.meta?.schedule) {
      const parsed = parseSchedule(node.meta.schedule)
      if (parsed) {
        // Build parents from path (strip sibling index from each element)
        const parents = node.path.slice(0, -1).map(p => p.replace(/\[\d+\]$/, ''))

        // temporal 型をスケジュール形式に応じて分岐
        const temporal = parsed.kind === 'dateRange'
          ? { kind: 'CalendarDateRange' as const, start: parsed.start, endExclusive: parsed.endExclusive }
          : { kind: 'CalendarDateTimeRange' as const, start: parsed.start, end: parsed.end }

        // Create Task-shaped object directly (factory functions not in dist)
        const item: Task = {
          id: node.id,
          type: 'task',
          title: node.text,
          status: mapStatus(node.status),
          parents,
          temporal,
        }
        items.push(item)
      }
    }

    if ((node.type === 'task' || node.type === 'list') && node.children.length > 0) {
      extractFromNodes(node.children, items)
    }
  }
}

function extractFromSection(section: Section, items: CalendarItem[]): void {
  extractFromNodes(section.children, items)
  for (const sub of section.subSections) {
    extractFromSection(sub, items)
  }
}

// ----------------------------------------------------------------
// Public API
// ----------------------------------------------------------------

export function extractCalendarItems(doc: Document): CalendarItem[] {
  const items: CalendarItem[] = []
  for (const section of doc.sections) {
    extractFromSection(section, items)
  }
  return items
}
