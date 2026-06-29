import { DateTime } from 'luxon'
import type { GanttNode, GanttNodeType } from 'svelte-gantt-lib'
import type { Document, Section, Node, TaskNode, ListNode } from '../parser/types'
import type { SourceEntry } from '../viewmodel/contract'
import { makeGlobalKey } from '../viewmodel/global-key'
import { expandOccurrences } from '../recurrence/expand'

// ----------------------------------------------------------------
// Schedule string parser (same logic as calendar/ast-to-calendar.ts)
// ----------------------------------------------------------------

function parseSchedule(schedule: string): { start: DateTime; end: DateTime } | null {
  const parts = schedule.split('/')
  if (parts.length !== 2) return null

  const start = DateTime.fromISO(parts[0].trim())
  const end = DateTime.fromISO(parts[1].trim())

  if (!start.isValid || !end.isValid) return null
  if (start >= end) return null

  return { start, end }
}

// ----------------------------------------------------------------
// Descendant schedule check + min/max range
// ----------------------------------------------------------------

type DateRange = { start: DateTime; end: DateTime }

function hasScheduleDescendant(nodes: Node[]): boolean {
  for (const node of nodes) {
    if (node.type === 'quote') continue
    if (node.type === 'task' && node.meta?.schedule) return true
    if ((node.type === 'task' || node.type === 'list') && node.children.length > 0) {
      if (hasScheduleDescendant(node.children)) return true
    }
  }
  return false
}

function sectionHasSchedule(section: Section): boolean {
  if (hasScheduleDescendant(section.children)) return true
  for (const sub of section.subSections) {
    if (sectionHasSchedule(sub)) return true
  }
  return false
}

/** Recursively compute the min start / max end of all scheduled descendant tasks. */
function descendantDateRange(nodes: Node[]): DateRange | null {
  let minStart: DateTime | null = null
  let maxEnd: DateTime | null = null

  for (const node of nodes) {
    if (node.type === 'quote') continue

    if (node.type === 'task' && node.meta?.schedule) {
      const parsed = parseSchedule(node.meta.schedule)
      if (parsed) {
        if (!minStart || parsed.start < minStart) minStart = parsed.start
        if (!maxEnd || parsed.end > maxEnd) maxEnd = parsed.end
      }
    }

    if ((node.type === 'task' || node.type === 'list') && node.children.length > 0) {
      const child = descendantDateRange(node.children)
      if (child) {
        if (!minStart || child.start < minStart) minStart = child.start
        if (!maxEnd || child.end > maxEnd) maxEnd = child.end
      }
    }
  }

  return minStart && maxEnd ? { start: minStart, end: maxEnd } : null
}

function sectionDescendantDateRange(section: Section): DateRange | null {
  let range = descendantDateRange(section.children)

  for (const sub of section.subSections) {
    const subRange = sectionDescendantDateRange(sub)
    if (subRange) {
      if (!range) {
        range = subRange
      } else {
        if (subRange.start < range.start) range = { ...range, start: subRange.start }
        if (subRange.end > range.end) range = { ...range, end: subRange.end }
      }
    }
  }

  return range
}

// ----------------------------------------------------------------
// Node traversal — builds flat GanttNode[] with parentId references
// ----------------------------------------------------------------

type ViewRange = { start: DateTime; end: DateTime }

function extractFromNodes(
  nodes: Node[],
  parentId: string | null,
  sourcePath: string,
  result: GanttNode[],
  viewRange: ViewRange | null,
): void {
  for (const node of nodes) {
    if (node.type === 'quote') continue

    if (node.type === 'task') {
      const hasSchedule = !!node.meta?.schedule
      const hasChildSchedule = node.children.length > 0 && hasScheduleDescendant(node.children)

      if (!hasSchedule && !hasChildSchedule) continue

      const nodeId = makeGlobalKey(sourcePath, node.id)

      // @repeat あり: viewRange があれば展開、なければスキップ（本体スケジュールは出さない）
      if (hasSchedule && node.meta?.repeat) {
        if (viewRange) {
          const occurrences = expandOccurrences(node.meta, viewRange.start, viewRange.end)
          occurrences.forEach((occ, idx) => {
            result.push({
              id: `${nodeId}__r${idx}`,
              parentId,
              type: 'task',
              name: node.text,
              start: occ.start,
              end: occ.end,
              metadata: { status: node.status, schedule: node.meta?.schedule ?? null, sourceNodeId: nodeId },
            })
          })
        }
        if (node.children.length > 0) {
          extractFromNodes(node.children, nodeId, sourcePath, result, viewRange)
        }
        continue
      }

      const type: GanttNodeType = hasChildSchedule ? 'subsection' : 'task'
      const ganttNode: GanttNode = {
        id: nodeId,
        parentId,
        type,
        name: node.text,
        metadata: {
          status: node.status,
          schedule: node.meta?.schedule ?? null,
        },
      }

      if (hasSchedule && node.meta?.schedule) {
        const parsed = parseSchedule(node.meta.schedule)
        if (parsed) {
          ganttNode.start = parsed.start
          ganttNode.end = parsed.end
        }
      }

      // For group nodes without own schedule, derive range from descendants
      if (!ganttNode.start && hasChildSchedule) {
        const range = descendantDateRange(node.children)
        if (range) {
          ganttNode.start = range.start
          ganttNode.end = range.end
        }
      }

      result.push(ganttNode)

      if (node.children.length > 0) {
        extractFromNodes(node.children, nodeId, sourcePath, result, viewRange)
      }
    } else if (node.type === 'list') {
      const hasChildSchedule = node.children.length > 0 && hasScheduleDescendant(node.children)
      if (!hasChildSchedule) continue

      const range = descendantDateRange(node.children)
      const nodeId = makeGlobalKey(sourcePath, node.id)
      const ganttNode: GanttNode = {
        id: nodeId,
        parentId,
        type: 'subsection',
        name: node.text,
        ...(range ? { start: range.start, end: range.end } : {}),
        metadata: {
          schedule: null,
        },
      }
      result.push(ganttNode)

      if (node.children.length > 0) {
        extractFromNodes(node.children, nodeId, sourcePath, result, viewRange)
      }
    }
  }
}

function extractFromSection(
  section: Section,
  parentId: string | null,
  sourcePath: string,
  result: GanttNode[],
  viewRange: ViewRange | null,
): void {
  if (!sectionHasSchedule(section)) return

  const type: GanttNodeType = section.depth === 1 ? 'project' : 'section'
  const range = sectionDescendantDateRange(section)
  const sectionId = makeGlobalKey(sourcePath, section.id)
  const ganttNode: GanttNode = {
    id: sectionId,
    parentId,
    type,
    name: section.title,
    ...(range ? { start: range.start, end: range.end } : {}),
  }
  result.push(ganttNode)

  extractFromNodes(section.children, sectionId, sourcePath, result, viewRange)

  for (const sub of section.subSections) {
    extractFromSection(sub, sectionId, sourcePath, result, viewRange)
  }
}

function extractFromDocument(
  doc: Document,
  sourcePath: string,
  result: GanttNode[],
  viewRange: ViewRange | null,
): void {
  for (const section of doc.sections) {
    extractFromSection(section, null, sourcePath, result, viewRange)
  }
}

// ----------------------------------------------------------------
// Public API
// ----------------------------------------------------------------

/**
 * 複数ソースから GanttNode[] を生成する。
 * viewRange を渡すと @repeat タスクを表示範囲内で展開する。
 * 各ノードの id・parentId は globalKey で全体でユニーク。
 * 単一ファイルの場合は要素 1 の配列として渡す。
 */
export function extractGanttNodes(sources: SourceEntry[], viewRange?: ViewRange): GanttNode[] {
  const result: GanttNode[] = []
  const range = viewRange ?? null
  for (const { path, doc } of sources) {
    extractFromDocument(doc, path, result, range)
  }
  return result
}
