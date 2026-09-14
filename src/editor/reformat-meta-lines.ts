import { parseMarkdown } from '../lib/parser/parse-markdown'
import type { Document, Node, Section, TaskNode, ListNode } from '../lib/parser/types'

/**
 * メタ行の推奨位置（issue-phase004-005・time-meta-model.spec.md BR-021〜BR-026）:
 * タスク／グループの子要素のうち、メタ行（`- @key: value` / `- @key?: value`）を
 * 常に他の子要素（サブタスク・メモ等）より前に並べる。
 *
 * パーサーは子要素内であれば位置を問わず受理する（寛容）が、ライター側は
 * 直下（推奨位置）へ書き戻す（厳格）。本モジュールはその「書き戻し」を
 * ユーザーが明示的に呼び出すコマンドとして提供するための純関数群。
 *
 * AST を経由した全文再生成（ast-to-md）は使わない。本文の自由記述を壊す
 * リスクがあるため、既存 upsert-meta と同じ「行 splice」方式で、行の
 * テキストそのものを動かさずに並び替えるだけに留める。
 */

// 生の行が「メタ行」かどうかの判定。remark-meta-fields のキー判定と同じ
// 「@word（?）: 」の形（先頭の `- ` を除く）に整合させる。
const META_LINE_RE = /^-\s@\w+\??:/

function isMetaLine(line: string): boolean {
  return META_LINE_RE.test(line.trimStart())
}

function getIndent(line: string): number {
  return line.length - line.trimStart().length
}

interface Block {
  /** `lines` 配列に対する開始インデックス（inclusive）。 */
  start: number
  /** `lines` 配列に対する終了インデックス（exclusive）。 */
  end: number
}

/**
 * タスク行直下の「直接の子」を、各子アイテム＋その配下（さらに深いネスト）
 * ごとのブロックに分割する。ブロック内部（2階層目以降）の並び順には触れない。
 */
function collectChildBlocks(lines: string[], taskIdx: number, taskIndent: number): Block[] | null {
  let idx = taskIdx + 1
  while (idx < lines.length && lines[idx].trim() === '') idx++
  if (idx >= lines.length) return null

  const childIndent = getIndent(lines[idx])
  if (childIndent <= taskIndent) return null

  // regionEnd はブロック内の「最後の非空行」の直後に置く。末尾の空行（ファイル末尾の
  // 改行が split('\n') で生む空文字列を含む）を子領域に取り込んでしまうと、並び替え時に
  // 空行がブロックの内側に迷い込み、行が増減して見えてしまうため。
  let regionEnd = idx
  for (let i = idx; i < lines.length; i++) {
    const line = lines[i]
    if (line.trim() === '') continue
    if (getIndent(line) <= taskIndent) break
    regionEnd = i + 1
  }

  const blocks: Block[] = []
  let i = idx
  while (i < regionEnd) {
    const start = i
    i++
    while (i < regionEnd) {
      const line = lines[i]
      if (line.trim() !== '' && getIndent(line) <= childIndent) break
      i++
    }
    blocks.push({ start, end: i })
  }
  return blocks
}

function isMetaBlock(lines: string[], block: Block): boolean {
  return isMetaLine(lines[block.start])
}

/** すでに「メタブロックが全て非メタブロックより前」になっているかどうか。 */
function isAlreadySorted(lines: string[], blocks: Block[]): boolean {
  let sawNonMeta = false
  for (const block of blocks) {
    if (isMetaBlock(lines, block)) {
      if (sawNonMeta) return false
    } else {
      sawNonMeta = true
    }
  }
  return true
}

function* walkTaskAndListNodes(nodes: Node[]): Generator<TaskNode | ListNode> {
  for (const node of nodes) {
    if (node.type === 'task' || node.type === 'list') {
      yield node
      yield* walkTaskAndListNodes(node.children)
    }
  }
}

function* walkSection(section: Section): Generator<TaskNode | ListNode> {
  yield* walkTaskAndListNodes(section.children)
  for (const sub of section.subSections) yield* walkSection(sub)
}

function* walkDocument(doc: Document): Generator<TaskNode | ListNode> {
  for (const section of doc.sections) yield* walkSection(section)
}

/**
 * ドキュメント中、最初に見つかった「位置ずれ」のあるタスク／グループを1つだけ
 * 修正して返す。見つからなければ null。
 *
 * 1回の呼び出しで1タスク分だけを直す設計にしているのは、並び替えによって
 * そのタスクの子孫（ネストしたサブタスク等）の絶対行番号がずれるため。
 * 呼び出し側が再パースしながら繰り返し呼ぶことで、常に最新の行番号に基づいて
 * 安全に処理を進められる。
 */
function fixNextMisplacedTask(md: string): { result: string; moved: number } | null {
  const lines = md.split('\n')
  const doc = parseMarkdown(md)

  for (const node of walkDocument(doc)) {
    const taskIdx = node.lineNumber
    if (taskIdx < 0 || taskIdx >= lines.length) continue

    const taskIndent = getIndent(lines[taskIdx])
    const blocks = collectChildBlocks(lines, taskIdx, taskIndent)
    if (!blocks || blocks.length === 0) continue
    if (isAlreadySorted(lines, blocks)) continue

    const metaBlocks = blocks.filter(b => isMetaBlock(lines, b))
    const otherBlocks = blocks.filter(b => !isMetaBlock(lines, b))

    const reordered: string[] = []
    for (const block of [...metaBlocks, ...otherBlocks]) {
      for (let i = block.start; i < block.end; i++) reordered.push(lines[i])
    }

    const regionStart = blocks[0].start
    const regionEnd = blocks[blocks.length - 1].end
    const result = [
      ...lines.slice(0, regionStart),
      ...reordered,
      ...lines.slice(regionEnd),
    ].join('\n')

    return { result, moved: metaBlocks.length }
  }

  return null
}

/** 安全弁。通常のドキュメントでこの回数に達することはない。 */
const MAX_ITERATIONS = 10000

/**
 * ドキュメント全体のメタ行を推奨位置（各タスク／グループの直下・先頭）へ
 * 移動する。冪等: 変更の必要がないメタ行には触れず、2回連続で実行しても
 * 2回目は無変更になる。
 */
export function reformatMetaLines(md: string): { result: string; movedCount: number } {
  let current = md
  let movedCount = 0

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const fixed = fixNextMisplacedTask(current)
    if (!fixed) break
    current = fixed.result
    movedCount += fixed.moved
  }

  return { result: current, movedCount }
}

/**
 * lint（情報レベル表示）用: 位置ずれしているメタ行の行インデックス（0-based）
 * の一覧を返す。ドキュメントを変更しない。
 */
export function findMisplacedMetaLineIndices(md: string): number[] {
  const lines = md.split('\n')
  const doc = parseMarkdown(md)
  const result: number[] = []

  for (const node of walkDocument(doc)) {
    const taskIdx = node.lineNumber
    if (taskIdx < 0 || taskIdx >= lines.length) continue

    const taskIndent = getIndent(lines[taskIdx])
    const blocks = collectChildBlocks(lines, taskIdx, taskIndent)
    if (!blocks || blocks.length === 0) continue
    if (isAlreadySorted(lines, blocks)) continue

    let sawNonMeta = false
    for (const block of blocks) {
      if (isMetaBlock(lines, block)) {
        if (sawNonMeta) result.push(block.start)
      } else {
        sawNonMeta = true
      }
    }
  }

  return result
}
