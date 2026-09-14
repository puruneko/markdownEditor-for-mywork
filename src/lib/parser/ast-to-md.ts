import type { Document, Section, Node, TaskNode, ListNode, QuoteNode, Meta, Status } from './types'
import { META_KEYS } from './meta-keys'
import { MARKER_BY_STATUS } from '../contract/canonical'

// ----------------------------------------------------------------
// Status → Checkbox marker
// ----------------------------------------------------------------

function statusToMarker(status: Status): string {
  return MARKER_BY_STATUS[status]
}

// ----------------------------------------------------------------
// Meta serialization
// ----------------------------------------------------------------

/** `?`（仮置き）修飾子付きのキーは、ラウンドトリップ保証のため `?` 付きのまま出力する（issue-phase004-002）。 */
function tentativeSuffix(meta: Meta, key: 'plan' | 'schedule' | 'due'): string {
  return meta.tentative?.[key] ? '?' : ''
}

/**
 * string | string[] を取るメタキー（condition/purpose/savepoint/special_note）を出力する。
 * string ならこれまでどおり単一行。string[] なら親行 `- @key:` の下に、1段深い子リスト
 * として各要素を出力する（issue-phase005-001 C-1。パース側の子リスト受理と対称）。
 */
function serializeMultiValueMeta(key: string, value: string | string[]): string[] {
  if (typeof value === 'string') return [`- @${key}: ${value}`]
  return [`- @${key}:`, ...value.map(v => `\t- ${v}`)]
}

function serializeMeta(meta: Meta): string[] {
  const lines: string[] = []
  if (meta.plan         !== undefined) lines.push(`- @${META_KEYS.plan}${tentativeSuffix(meta, 'plan')}: ${meta.plan}`)
  if (meta.schedule     !== undefined) lines.push(`- @${META_KEYS.schedule}${tentativeSuffix(meta, 'schedule')}: ${meta.schedule}`)
  if (meta.due          !== undefined) lines.push(`- @${META_KEYS.due}${tentativeSuffix(meta, 'due')}: ${meta.due}`)
  if (meta.priority     !== undefined) lines.push(`- @${META_KEYS.priority}: ${meta.priority}`)
  if (meta.dependsOn    !== undefined) lines.push(`- @${META_KEYS.dependsOn}: ${meta.dependsOn.join(', ')}`)
  if (meta.tags         !== undefined) lines.push(`- @${META_KEYS.tags}: ${meta.tags.join(', ')}`)
  if (meta.repeat       !== undefined) lines.push(`- @${META_KEYS.repeat}: ${meta.repeat}`)
  if (meta.condition    !== undefined) lines.push(...serializeMultiValueMeta(META_KEYS.condition, meta.condition))
  if (meta.purpose      !== undefined) lines.push(...serializeMultiValueMeta(META_KEYS.purpose, meta.purpose))
  if (meta.savepoint    !== undefined) lines.push(...serializeMultiValueMeta(META_KEYS.savepoint, meta.savepoint))
  if (meta.special_note !== undefined) lines.push(...serializeMultiValueMeta(META_KEYS.special_note, meta.special_note))
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
