import type { Root, Heading, BlockContent, RootContent, List } from 'mdast'
import { toString } from 'mdast-util-to-string'
import type { Section, Node, Meta, SectionMeta } from './types'
import { convertSectionContent } from './mdast-to-nodes'
import { extractMetaFromList } from './plugins/remark-meta-fields'

// ----------------------------------------------------------------
// issue-phase010-markdownEditor-006: 見出しタイトル末尾の #タグ 抽出
// ----------------------------------------------------------------

/** タイトル末尾に連続する `#tag` 形式のトレーリングタグを抽出し、タイトルから分離する。 */
const TRAILING_HASHTAGS_RE = /(?:\s+#[\w-]+)+$/

function splitTitleTags(rawTitle: string): { title: string; tags: string[] } {
  const match = rawTitle.match(TRAILING_HASHTAGS_RE)
  if (!match) return { title: rawTitle, tags: [] }
  const tags = [...match[0].matchAll(/#([\w-]+)/g)].map(m => m[1])
  const title = rawTitle.slice(0, match.index).trimEnd()
  return { title, tags }
}

// ----------------------------------------------------------------
// issue-phase010-markdownEditor-006: 見出し直下のトップレベルメタ抽出（DEC-04）
// ----------------------------------------------------------------

/**
 * 「見出し直下のトップレベルメタ」= 見出し行の直後から、次の見出しまたは非リストブロックが
 * 現れるまでの、トップレベルの `- @key: value` リスト項目（DEC-04）。
 * 先頭から連続するリストブロックにのみ `extractMetaFromList` を適用し、非リストブロックに
 * 到達した時点で以降のブロックはすべてそのまま素通りさせる。
 */
function extractLeadingSectionMeta(blocks: BlockContent[]): { meta: Partial<Meta>; blocks: BlockContent[] } {
  const meta: Partial<Meta> = {}
  const resultBlocks: BlockContent[] = []
  let stillLeading = true

  for (const block of blocks) {
    if (stillLeading && block.type === 'list') {
      const { kept, injected } = extractMetaFromList(block as List, meta)
      if (kept.length > 0) {
        resultBlocks.push({ ...block, children: kept } as List)
      }
      for (const blockGroup of injected) {
        resultBlocks.push(...blockGroup)
      }
    } else {
      stillLeading = false
      resultBlocks.push(block)
    }
  }

  return { meta, blocks: resultBlocks }
}

/**
 * 見出し（または匿名セクション）直下のコンテンツから、タイトルタグ分離・トップレベルメタ抽出・
 * ノード変換・直下引用の memo 化までを一括して行う（issue-phase010-markdownEditor-006）。
 */
function buildSectionContent(
  blocks: BlockContent[],
  depth: number,
  rawTitle: string,
  posPfx: string[],
): { title: string; close: boolean; meta?: SectionMeta; children: Node[] } {
  const { title, tags } = splitTitleTags(rawTitle)
  const { meta: extractedMeta, blocks: processedBlocks } = extractLeadingSectionMeta(blocks)
  const { nodes: children, memo } = convertSectionContent(processedBlocks, depth, title, posPfx)

  const close = tags.includes('close') || extractedMeta.close === true
  const { close: _closeField, ...restMeta } = extractedMeta
  const sectionMeta: SectionMeta = { ...restMeta, ...(memo !== undefined ? { memo } : {}) }
  const hasMeta = Object.keys(sectionMeta).length > 0

  return { title, close, children, ...(hasMeta ? { meta: sectionMeta } : {}) }
}

// ----------------------------------------------------------------
// Section building from mdast root
// ----------------------------------------------------------------

function buildNodeLineMap(sections: Section[]): Map<string, number> {
  const map = new Map<string, number>()

  function walkNode(node: Node): void {
    map.set(node.id, node.lineNumber)
    if (node.type !== 'quote') {
      for (const child of node.children) walkNode(child)
    }
  }

  function walkSection(section: Section): void {
    if (section.lineNumber >= 0) map.set(section.id, section.lineNumber)
    for (const child of section.children) walkNode(child)
    for (const sub of section.subSections) walkSection(sub)
  }

  for (const section of sections) walkSection(section)
  return map
}

function nestSections(sections: Section[]): Section[] {
  const result: Section[] = []
  const stack: Section[] = []

  for (const section of sections) {
    while (stack.length > 0 && stack[stack.length - 1].depth >= section.depth) {
      stack.pop()
    }
    if (stack.length === 0) {
      result.push(section)
    } else {
      const parent = stack[stack.length - 1]
      section.parentSectionId = parent.id
      parent.subSections.push(section)
    }
    stack.push(section)
  }

  return result
}

export function buildSectionsFromRoot(root: Root): { sections: Section[]; nodeLineMap: Map<string, number> } {
  const children = root.children as RootContent[]
  const flatSections: Section[] = []

  // Collect heading positions and content between them
  type HeadingEntry = { index: number; depth: number; title: string; lineNumber: number }
  const headings: HeadingEntry[] = []

  children.forEach((child, idx) => {
    if (child.type === 'heading') {
      const h = child as Heading
      const lineNumber = (h.position?.start.line ?? 1) - 1
      const title = toString(h)
      headings.push({ index: idx, depth: h.depth, title, lineNumber })
    }
  })

  if (headings.length === 0) {
    // No headings → single anonymous section
    const blocks = children.filter(c => c.type !== 'heading') as BlockContent[]
    const sectionPosPfx = ['s0']
    const built = buildSectionContent(blocks, 1, '', sectionPosPfx)
    flatSections.push({
      type: 'section',
      id: 'section-0',
      depth: 0,
      title: built.title,
      lineNumber: -1,
      children: built.children,
      subSections: [],
      close: built.close,
      ...(built.meta ? { meta: built.meta } : {}),
    })
  } else {
    // Content before first heading
    if (headings[0].index > 0) {
      const preBlocks = children.slice(0, headings[0].index).filter(c => c.type !== 'heading') as BlockContent[]
      const prePosPfx = ['s0']
      const built = buildSectionContent(preBlocks, 1, '', prePosPfx)
      if (built.children.length > 0) {
        flatSections.push({
          type: 'section',
          id: 'section-0',
          depth: 0,
          title: built.title,
          lineNumber: -1,
          children: built.children,
          subSections: [],
          close: built.close,
          ...(built.meta ? { meta: built.meta } : {}),
        })
      }
    }

    headings.forEach((heading, hi) => {
      const nextIndex = hi + 1 < headings.length ? headings[hi + 1].index : children.length
      const contentBlocks = children.slice(heading.index + 1, nextIndex).filter(c => c.type !== 'heading') as BlockContent[]
      // 位置プレフィックス: セクション番号を先頭に付与してノード id の名前空間を分ける
      const sectionPosPfx = [`s${hi + 1}`]
      const built = buildSectionContent(contentBlocks, 1, heading.title, sectionPosPfx)

      flatSections.push({
        type: 'section',
        id: `section-${hi + 1}`,
        depth: heading.depth,
        title: built.title,
        lineNumber: heading.lineNumber,
        children: built.children,
        subSections: [],
        close: built.close,
        ...(built.meta ? { meta: built.meta } : {}),
      })
    })
  }

  const sections = nestSections(flatSections)
  const nodeLineMap = buildNodeLineMap(sections)

  return { sections, nodeLineMap }
}
