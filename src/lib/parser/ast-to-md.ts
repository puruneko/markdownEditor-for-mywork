import type { Document, Section, Node, TaskNode, ListNode, QuoteNode, Meta, Status } from './types'
import { META_KEYS } from './meta-keys'

// ----------------------------------------------------------------
// Status → Checkbox marker
// ----------------------------------------------------------------

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
// Meta serialization
// ----------------------------------------------------------------

function serializeMeta(meta: Meta): string[] {
  const lines: string[] = []
  if (meta.schedule  !== undefined) lines.push(`- @${META_KEYS.schedule}: ${meta.schedule}`)
  if (meta.due       !== undefined) lines.push(`- @${META_KEYS.due}: ${meta.due}`)
  if (meta.priority  !== undefined) lines.push(`- @${META_KEYS.priority}: ${meta.priority}`)
  if (meta.dependsOn !== undefined) lines.push(`- @${META_KEYS.dependsOn}: ${meta.dependsOn.join(', ')}`)
  if (meta.tags      !== undefined) lines.push(`- @${META_KEYS.tags}: ${meta.tags.join(', ')}`)
  if (meta.repeat    !== undefined) lines.push(`- @${META_KEYS.repeat}: ${meta.repeat}`)
  return lines
}

// ----------------------------------------------------------------
// Node serialization
// ----------------------------------------------------------------

/**
 * Serialize a node at a given nesting level using tab-based indentation.
 * Using tabs matches Obsidian's native Tab-key behavior, so files written
 * by this serializer and files edited in Obsidian share the same indent
 * character, preventing mixed-indent issues in the parser.
 */
function serializeNode(node: Node, level: number): string[] {
  const pad = '\t'.repeat(level)
  const childPad = '\t'.repeat(level + 1)
  const lines: string[] = []

  if (node.type === 'quote') {
    node.raw.split('\n').forEach(line => lines.push(`${pad}> ${line}`))
    return lines
  }

  if (node.type === 'task') {
    lines.push(`${pad}- ${statusToMarker(node.status)} ${node.text}`)
    if (node.meta) {
      serializeMeta(node.meta).forEach(ml => lines.push(`${childPad}${ml}`))
    }
    node.children.forEach(child => lines.push(...serializeNode(child, level + 1)))
    return lines
  }

  if (node.type === 'list') {
    lines.push(`${pad}- ${node.text}`)
    if (node.meta) {
      serializeMeta(node.meta).forEach(ml => lines.push(`${childPad}${ml}`))
    }
    node.children.forEach(child => lines.push(...serializeNode(child, level + 1)))
    return lines
  }

  return lines
}

// ----------------------------------------------------------------
// Section serialization
// ----------------------------------------------------------------

function serializeSection(section: Section, isNested: boolean): string[] {
  const lines: string[] = []

  if (section.title) {
    const prefix = '#'.repeat(section.depth)
    if (isNested) lines.push('')
    lines.push(`${prefix} ${section.title}`)
    lines.push('')
  }

  section.children.forEach(node => {
    lines.push(...serializeNode(node, 0))
  })

  section.subSections.forEach(sub => {
    lines.push(...serializeSection(sub, true))
  })

  return lines
}

// ----------------------------------------------------------------
// Public API
// ----------------------------------------------------------------

export function serializeAst(doc: Document): string {
  const lines: string[] = []

  doc.sections.forEach((section, i) => {
    if (i > 0) lines.push('')
    lines.push(...serializeSection(section, false))
  })

  // Trim leading/trailing blank lines, end with single newline
  const trimmed = lines.join('\n').trim()
  return trimmed ? trimmed + '\n' : ''
}
