import type { ListItem, List, Blockquote, BlockContent } from 'mdast'
import { toString } from 'mdast-util-to-string'
import type { Node, TaskNode, ListNode, QuoteNode } from './types'

// ----------------------------------------------------------------
// ID generation (deterministic hash of path)
// ----------------------------------------------------------------

export function generateId(path: string[]): string {
  const str = path.join('/')
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return `n${Math.abs(hash).toString(36)}`
}

// ----------------------------------------------------------------
// Derived field computation
// ----------------------------------------------------------------

function hasTaskDescendant(children: Node[]): boolean {
  return children.some(c => {
    if (c.type === 'task') return true
    if (c.type === 'list') return c.hasTaskDescendant
    return false
  })
}

// ----------------------------------------------------------------
// Blockquote → QuoteNode
// ----------------------------------------------------------------

export function convertBlockquote(node: Blockquote, lineNumber: number): QuoteNode {
  const raw = node.children
    .map(child => toString(child))
    .join('\n')

  return {
    type: 'quote',
    id: generateId([`quote@${lineNumber}`]),
    raw,
    lineNumber,
    hasTaskDescendant: false,
    isGroup: false,
    isMemo: true,
  }
}

// ----------------------------------------------------------------
// ListItem → TaskNode | ListNode
// ----------------------------------------------------------------

export function convertListItem(
  item: ListItem,
  depth: number,
  parentPath: string[],
  siblingIndex: number,
): TaskNode | ListNode {
  // Text: prefer cleaned text from remark-task-status, else first paragraph
  const firstPara = item.children.find(c => c.type === 'paragraph')
  const rawText = item.data?.taskText ?? (firstPara ? toString(firstPara) : '')
  const text = rawText.trim()

  const lineNumber = (item.position?.start.line ?? 1) - 1  // 0-based

  const nodePath = [...parentPath, `${text}[${siblingIndex}]`]
  const id = generateId(nodePath)

  // Process non-paragraph block children (lists and blockquotes)
  const children = convertBlockChildren(
    item.children.filter(c => c.type !== 'paragraph') as BlockContent[],
    depth + 1,
    nodePath,
  )

  const hasTD = hasTaskDescendant(children)
  const meta = item.data?.meta
  const hasMeta = meta !== undefined && Object.keys(meta).length > 0
  const taskStatus = item.data?.taskStatus ?? null

  if (taskStatus !== null) {
    const node: TaskNode = {
      type: 'task',
      id,
      text,
      status: taskStatus,
      children,
      ...(hasMeta ? { meta: meta! } : {}),
      lineNumber,
      hasTaskDescendant: hasTD,
      isGroup: hasTD && children.length > 0,
      isLeafTask: children.length === 0,
      isMemo: false,
      depth,
      path: nodePath,
    }
    return node
  }

  const node: ListNode = {
    type: 'list',
    id,
    text,
    children,
    ...(hasMeta ? { meta: meta! } : {}),
    lineNumber,
    hasTaskDescendant: hasTD,
    isGroup: hasTD && children.length > 0,
    isMemo: !hasTD,
    depth,
    path: nodePath,
  }
  return node
}

// ----------------------------------------------------------------
// Convert block-level children (lists / blockquotes)
// ----------------------------------------------------------------

function convertBlockChildren(
  blocks: BlockContent[],
  depth: number,
  parentPath: string[],
): Node[] {
  const nodes: Node[] = []
  let siblingIndex = 0

  for (const block of blocks) {
    if (block.type === 'list') {
      for (const item of (block as List).children) {
        nodes.push(convertListItem(item, depth, parentPath, siblingIndex))
        siblingIndex++
      }
    } else if (block.type === 'blockquote') {
      const lineNumber = (block.position?.start.line ?? 1) - 1
      nodes.push(convertBlockquote(block as Blockquote, lineNumber))
      siblingIndex++
    }
  }

  return nodes
}

// ----------------------------------------------------------------
// Top-level section content: list of block-level nodes
// ----------------------------------------------------------------

export function convertSectionContent(blocks: BlockContent[], depth: number, sectionTitle: string): Node[] {
  const nodes: Node[] = []
  let siblingIndex = 0
  const parentPath = sectionTitle ? [sectionTitle] : []

  for (const block of blocks) {
    if (block.type === 'list') {
      for (const item of (block as List).children) {
        nodes.push(convertListItem(item, depth, parentPath, siblingIndex))
        siblingIndex++
      }
    } else if (block.type === 'blockquote') {
      const lineNumber = (block.position?.start.line ?? 1) - 1
      nodes.push(convertBlockquote(block as Blockquote, lineNumber))
      siblingIndex++
    }
  }

  return nodes
}
