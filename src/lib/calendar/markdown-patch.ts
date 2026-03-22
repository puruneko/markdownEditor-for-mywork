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
 * Replace a @schedule line in-place.
 * Finds the exact line `@schedule: <oldSchedule>` and replaces only that value.
 * All other content (blank lines, indentation, other text) is preserved.
 */
export function patchSchedule(md: string, oldSchedule: string, newSchedule: string): string {
  if (oldSchedule === newSchedule) return md
  // Match the trimmed content of the line to avoid indentation issues,
  // but keep the original indentation by replacing only the value part.
  return md
    .split('\n')
    .map(line => {
      if (line.trimStart() === `@schedule: ${oldSchedule}`) {
        return line.replace(oldSchedule, newSchedule)
      }
      return line
    })
    .join('\n')
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
