import { DateTime } from 'luxon'
import type { Document, Section, Node, TaskNode, Status } from '../parser/types'

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

export function formatSchedule(start: DateTime, end: DateTime): string {
  const fmt = (dt: DateTime) => dt.toFormat("yyyy-MM-dd'T'HH:mm")
  return `${fmt(start)}/${fmt(end)}`
}

function statusToMarker(status: Status): string {
  switch (status) {
    case 'todo':    return '[ ]'
    case 'done':    return '[x]'
    case 'doing':   return '[>]'
    case 'blocked': return '[!]'
    case 'hold':    return '[-]'
  }
}

// ----------------------------------------------------------------
// Node lookup (read-only, no mutation)
// ----------------------------------------------------------------

function searchNodes(nodes: Node[], id: string): TaskNode | null {
  for (const node of nodes) {
    if (node.type === 'quote') continue
    if (node.id === id && node.type === 'task') return node
    if ((node.type === 'task' || node.type === 'list') && node.children.length > 0) {
      const found = searchNodes(node.children, id)
      if (found) return found
    }
  }
  return null
}

function searchSection(section: Section, id: string): TaskNode | null {
  const found = searchNodes(section.children, id)
  if (found) return found
  for (const sub of section.subSections) {
    const sub_found = searchSection(sub, id)
    if (sub_found) return sub_found
  }
  return null
}

/** Find a TaskNode by ID without modifying the AST */
export function findNodeById(doc: Document, nodeId: string): TaskNode | null {
  for (const section of doc.sections) {
    const found = searchSection(section, nodeId)
    if (found) return found
  }
  return null
}

// ----------------------------------------------------------------
// Targeted markdown line patches
// (never regenerate markdown from AST — only replace specific lines)
// ----------------------------------------------------------------

/**
 * Replace the first occurrence of "- @schedule: oldSchedule" with the new value.
 * Preserves indentation; replaces only the first matching line.
 */
export function patchSchedule(md: string, oldSchedule: string, newSchedule: string): string {
  if (oldSchedule === newSchedule) return md
  const target = `- @schedule: ${oldSchedule}`
  const lines = md.split('\n')
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trimStart() === target) {
      lines[i] = lines[i].replace(target, `- @schedule: ${newSchedule}`)
      return lines.join('\n')
    }
  }
  return md
}

/**
 * Replace a @schedule line for a specific task node.
 * Uses the task title line as an anchor to locate the correct @schedule line,
 * preventing false matches when multiple tasks share the same schedule value.
 */
export function patchScheduleForNode(md: string, node: TaskNode, newSchedule: string): string {
  const oldSchedule = node.meta?.schedule
  if (!oldSchedule || oldSchedule === newSchedule) return md

  const marker = statusToMarker(node.status)
  const titlePattern = `- ${marker} ${node.text}`

  const lines = md.split('\n')
  let taskLineIdx = -1
  let taskIndent = 0

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trimStart() === titlePattern) {
      taskLineIdx = i
      taskIndent = lines[i].length - lines[i].trimStart().length
      break
    }
  }
  if (taskLineIdx === -1) return md

  for (let i = taskLineIdx + 1; i < lines.length; i++) {
    const line = lines[i]
    if (line.trim() === '') continue
    const lineIndent = line.length - line.trimStart().length
    if (lineIndent <= taskIndent) break
    if (line.trimStart() === `- @schedule: ${oldSchedule}`) {
      lines[i] = line.replace(oldSchedule, newSchedule)
      return lines.join('\n')
    }
  }
  return md
}

/**
 * Replace the status marker on the exact line recorded in node.lineNumber.
 * Uses the 0-based absolute line index to avoid title-based false matches.
 */
export function patchNodeStatus(
  md: string,
  node: TaskNode,
  newStatus: Status,
): string {
  if (node.status === newStatus) return md
  const lines = md.split('\n')
  const lineIdx = node.lineNumber
  if (lineIdx < 0 || lineIdx >= lines.length) return md
  const newMarker = statusToMarker(newStatus)
  lines[lineIdx] = lines[lineIdx].replace(/(\s*- )\[[xX>!\- ]\]/, `$1${newMarker}`)
  return lines.join('\n')
}

/**
 * Replace a task title line in-place.
 * Finds `- <marker> <oldTitle>` and replaces only the title part.
 * The checkbox marker is preserved; indentation and surrounding lines are untouched.
 */
export function patchTaskTitle(
  md: string,
  status: Status,
  oldTitle: string,
  newTitle: string,
): string {
  if (oldTitle === newTitle) return md
  const marker = statusToMarker(status)
  const oldPattern = `- ${marker} ${oldTitle}`
  const newPattern = `- ${marker} ${newTitle}`
  return md
    .split('\n')
    .map(line => {
      if (line.trimStart() === oldPattern) {
        return line.replace(oldPattern, newPattern)
      }
      return line
    })
    .join('\n')
}
