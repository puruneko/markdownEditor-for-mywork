import type { Document, Section, Node, TaskNode, ListNode, QuoteNode, Meta, Status } from './types'

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
  if (meta.schedule  !== undefined) lines.push(`- @schedule: ${meta.schedule}`)
  if (meta.due       !== undefined) lines.push(`- @due: ${meta.due}`)
  if (meta.priority  !== undefined) lines.push(`- @priority: ${meta.priority}`)
  if (meta.dependsOn !== undefined) lines.push(`- @dependsOn: ${meta.dependsOn.join(', ')}`)
  if (meta.tags      !== undefined) lines.push(`- @tags: ${meta.tags.join(', ')}`)
  return lines
}

// ----------------------------------------------------------------
// Node serialization
// ----------------------------------------------------------------

function serializeNode(node: Node, indent: number): string[] {
  const pad = ' '.repeat(indent)
  const lines: string[] = []

  if (node.type === 'quote') {
    node.raw.split('\n').forEach(line => lines.push(`${pad}> ${line}`))
    return lines
  }

  if (node.type === 'task') {
    lines.push(`${pad}- ${statusToMarker(node.status)} ${node.text}`)
    if (node.meta) {
      serializeMeta(node.meta).forEach(ml => lines.push(`${pad}  ${ml}`))
    }
    node.children.forEach(child => lines.push(...serializeNode(child, indent + 2)))
    return lines
  }

  if (node.type === 'list') {
    lines.push(`${pad}- ${node.text}`)
    if (node.meta) {
      serializeMeta(node.meta).forEach(ml => lines.push(`${pad}  ${ml}`))
    }
    node.children.forEach(child => lines.push(...serializeNode(child, indent + 2)))
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
