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

export function parseSchedule(schedule: string): { start: DateTime; end: DateTime } | null {
  const parts = schedule.split('/')
  if (parts.length !== 2) return null

  const start = DateTime.fromISO(parts[0].trim())
  const end = DateTime.fromISO(parts[1].trim())

  if (!start.isValid || !end.isValid) return null
  if (start >= end) return null

  return { start, end }
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

        // Create Task-shaped object directly (factory functions not in dist)
        const item: Task = {
          id: node.id,
          type: 'task',
          title: node.text,
          status: mapStatus(node.status),
          parents,
          temporal: {
            kind: 'CalendarDateTimeRange' as const,
            start: parsed.start,
            end: parsed.end,
          },
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
