import type { ListItem, List, Blockquote, BlockContent } from 'mdast'
import { toString } from 'mdast-util-to-string'
import type { Node, TaskNode, ListNode, QuoteNode, Meta } from './types'

// ----------------------------------------------------------------
// ID generation — 構造上の位置インデックスをそのまま連結する。
// 同一テキストの兄弟・重複サブツリーでも衝突しない。
// ----------------------------------------------------------------

/** posPath の要素を '.' で連結した位置ベース id を生成する。 */
export function generateId(posPath: string[]): string {
  return posPath.join('.')
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

export function convertBlockquote(
  node: Blockquote,
  lineNumber: number,
  posPath: string[],
  siblingIndex: number,
): QuoteNode {
  const raw = node.children
    .map(child => toString(child))
    .join('\n')

  return {
    type: 'quote',
    id: generateId([...posPath, `q${siblingIndex}`]),
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
  parentPath: string[],   // テキストパス（表示・path フィールド用）
  posPath: string[],      // 位置パス（id 生成用）
  siblingIndex: number,
): TaskNode | ListNode {
  // Text: prefer cleaned text from remark-task-status, else first paragraph
  const firstPara = item.children.find(c => c.type === 'paragraph')
  const rawText = item.data?.taskText ?? (firstPara ? toString(firstPara) : '')
  const text = rawText.trim()

  const lineNumber = (item.position?.start.line ?? 1) - 1  // 0-based

  // 位置パス: 各階層の兄弟インデックスを連ねる
  const nodePosPath = [...posPath, `n${siblingIndex}`]
  const id = generateId(nodePosPath)

  // テキストパス: 表示・calendar の parents 用
  const nodePath = [...parentPath, `${text}[${siblingIndex}]`]

  // Process non-paragraph block children (lists and blockquotes)
  const { nodes: children, memo } = convertBlockChildren(
    item.children.filter(c => c.type !== 'paragraph') as BlockContent[],
    depth + 1,
    nodePath,
    nodePosPath,
  )

  const hasTD = hasTaskDescendant(children)
  const rawMeta = item.data?.meta
  // issue-phase010-markdownEditor-006: 直下の引用（`>`）本文を meta.memo として畳み込む。
  // QuoteNode（children 内）の生成は置き換えない（併存させる）。
  const meta: Meta | undefined = (rawMeta !== undefined || memo !== undefined)
    ? { ...(rawMeta ?? {}), ...(memo !== undefined ? { memo } : {}) }
    : undefined
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

/**
 * issue-phase010-markdownEditor-006: 直下（子リストの中ではなく直接の子）の引用（`>`）本文を
 * `memo` として返す。複数ある場合は空行で連結する。`QuoteNode` の生成（`nodes` への追加）は
 * 置き換えず、`memo` は併存する派生値として返す。
 */
function convertBlockChildren(
  blocks: BlockContent[],
  depth: number,
  parentPath: string[],
  posPath: string[],
): { nodes: Node[]; memo?: string } {
  const nodes: Node[] = []
  const memoParts: string[] = []
  let siblingIndex = 0

  for (const block of blocks) {
    if (block.type === 'list') {
      for (const item of (block as List).children) {
        nodes.push(convertListItem(item, depth, parentPath, posPath, siblingIndex))
        siblingIndex++
      }
    } else if (block.type === 'blockquote') {
      const lineNumber = (block.position?.start.line ?? 1) - 1
      const quoteNode = convertBlockquote(block as Blockquote, lineNumber, posPath, siblingIndex)
      nodes.push(quoteNode)
      memoParts.push(quoteNode.raw)
      siblingIndex++
    }
  }

  return { nodes, memo: memoParts.length > 0 ? memoParts.join('\n\n') : undefined }
}

// ----------------------------------------------------------------
// Top-level section content: list of block-level nodes
// ----------------------------------------------------------------

/**
 * issue-phase010-markdownEditor-006: 見出し直下（子リストの中ではなく直接の子）の引用（`>`）
 * 本文を `memo` として返す。複数ある場合は空行で連結する。`QuoteNode` の生成は置き換えない。
 */
export function convertSectionContent(
  blocks: BlockContent[],
  depth: number,
  sectionTitle: string,
  posPfx: string[],
): { nodes: Node[]; memo?: string } {
  const nodes: Node[] = []
  const memoParts: string[] = []
  let siblingIndex = 0
  const parentPath = sectionTitle ? [sectionTitle] : []

  for (const block of blocks) {
    if (block.type === 'list') {
      for (const item of (block as List).children) {
        nodes.push(convertListItem(item, depth, parentPath, posPfx, siblingIndex))
        siblingIndex++
      }
    } else if (block.type === 'blockquote') {
      const lineNumber = (block.position?.start.line ?? 1) - 1
      const quoteNode = convertBlockquote(block as Blockquote, lineNumber, posPfx, siblingIndex)
      nodes.push(quoteNode)
      memoParts.push(quoteNode.raw)
      siblingIndex++
    }
  }

  return { nodes, memo: memoParts.length > 0 ? memoParts.join('\n\n') : undefined }
}
