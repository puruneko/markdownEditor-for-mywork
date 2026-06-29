import type { Root, Heading, BlockContent, RootContent } from 'mdast'
import { toString } from 'mdast-util-to-string'
import type { Section, Node } from './types'
import { convertSectionContent } from './mdast-to-nodes'

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
    const sectionChildren = convertSectionContent(blocks, 1, '', sectionPosPfx)
    flatSections.push({
      type: 'section',
      id: 'section-0',
      depth: 0,
      title: '',
      lineNumber: -1,
      children: sectionChildren,
      subSections: [],
    })
  } else {
    // Content before first heading
    if (headings[0].index > 0) {
      const preBlocks = children.slice(0, headings[0].index).filter(c => c.type !== 'heading') as BlockContent[]
      const prePosPfx = ['s0']
      const preChildren = convertSectionContent(preBlocks, 1, '', prePosPfx)
      if (preChildren.length > 0) {
        flatSections.push({
          type: 'section',
          id: 'section-0',
          depth: 0,
          title: '',
          lineNumber: -1,
          children: preChildren,
          subSections: [],
        })
      }
    }

    headings.forEach((heading, hi) => {
      const nextIndex = hi + 1 < headings.length ? headings[hi + 1].index : children.length
      const contentBlocks = children.slice(heading.index + 1, nextIndex).filter(c => c.type !== 'heading') as BlockContent[]
      // 位置プレフィックス: セクション番号を先頭に付与してノード id の名前空間を分ける
      const sectionPosPfx = [`s${hi + 1}`]
      const sectionChildren = convertSectionContent(contentBlocks, 1, heading.title, sectionPosPfx)

      flatSections.push({
        type: 'section',
        id: `section-${hi + 1}`,
        depth: heading.depth,
        title: heading.title,
        lineNumber: heading.lineNumber,
        children: sectionChildren,
        subSections: [],
      })
    })
  }

  const sections = nestSections(flatSections)
  const nodeLineMap = buildNodeLineMap(sections)

  return { sections, nodeLineMap }
}
