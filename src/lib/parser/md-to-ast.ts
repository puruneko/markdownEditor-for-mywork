import type { Document, Section, Node, TaskNode, ListNode, QuoteNode, Status, Meta } from './types'
import { normalizeSchedule, normalizeDue } from './schedule-normalize'

// ----------------------------------------------------------------
// Tokenizer
// ----------------------------------------------------------------

interface RawLine {
  indent: number
  content: string
  lineIndex: number  // 0-based absolute line index in original markdown
}

function tokenize(text: string): RawLine[] {
  return text
    .split('\n')
    .map((line, idx) => ({
      indent: line.match(/^( *)/)?.[1].length ?? 0,
      content: line.trimStart(),
      lineIndex: idx,
    }))
    .filter(l => l.content !== '')
}

// ----------------------------------------------------------------
// ID generation
// ----------------------------------------------------------------

function generateId(path: string[]): string {
  const str = path.join('/')
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return `n${Math.abs(hash).toString(36)}`
}

// ----------------------------------------------------------------
// Meta parsing
// ----------------------------------------------------------------

function parseMeta(meta: Partial<Meta>, key: string, value: string): void {
  switch (key) {
    case 'schedule':
      meta.schedule = normalizeSchedule(value)
      break
    case 'due':
      meta.due = normalizeDue(value)
      break
    case 'priority':
      meta.priority = parseInt(value, 10)
      break
    case 'dependsOn':
      meta.dependsOn = value.split(',').map(s => s.trim())
      break
    case 'tags':
      meta.tags = value.split(',').map(s => s.trim())
      break
  }
}

// ----------------------------------------------------------------
// Derived field computation
// ----------------------------------------------------------------

function computeHasTaskDescendant(children: Node[]): boolean {
  return children.some(c => {
    if (c.type === 'task') return true
    if (c.type === 'list') return c.hasTaskDescendant
    return false
  })
}

// ----------------------------------------------------------------
// Node parser
// ----------------------------------------------------------------

function parseNodes(
  rawLines: RawLine[],
  baseIndent: number,
  depth: number,
  parentPath: string[],
): Node[] {
  const nodes: Node[] = []
  let i = 0
  let siblingIndex = 0

  while (i < rawLines.length) {
    const line = rawLines[i]

    // Skip lines not at this exact indent level (should not happen in normal input)
    if (line.indent !== baseIndent) {
      i++
      continue
    }

    const content = line.content

    // ---- Blockquote ----
    if (content.startsWith('>')) {
      const firstLineIndex = line.lineIndex
      const rawParts: string[] = []
      while (i < rawLines.length && rawLines[i].content.startsWith('>')) {
        rawParts.push(rawLines[i].content.replace(/^>\s?/, ''))
        i++
      }
      const path = [...parentPath, `quote[${siblingIndex}]`]
      const node: QuoteNode = {
        type: 'quote',
        id: generateId(path),
        raw: rawParts.join('\n'),
        lineNumber: firstLineIndex,
        hasTaskDescendant: false,
        isGroup: false,
        isMemo: true,
      }
      nodes.push(node)
      siblingIndex++
      continue
    }

    // ---- List item ----
    if (content.startsWith('- ')) {
      const itemLineIndex = line.lineIndex
      const itemContent = content.slice(2)
      let taskStatus: Status | null = null
      let text = itemContent

      // Match checkbox: [ ], [x], [X], [>], [!], [-]
      const taskMatch = itemContent.match(/^\[([xX>!\- ])\] (.+)$/)
      if (taskMatch) {
        const marker = taskMatch[1]
        text = taskMatch[2]
        if (marker === ' ') taskStatus = 'todo'
        else if (marker === 'x' || marker === 'X') taskStatus = 'done'
        else if (marker === '>') taskStatus = 'doing'
        else if (marker === '!') taskStatus = 'blocked'
        else if (marker === '-') taskStatus = 'hold'
      }

      i++

      // Collect all child lines (sub-list @meta items and comments are included).
      const childLines: RawLine[] = []

      while (i < rawLines.length && rawLines[i].indent > baseIndent) {
        childLines.push(rawLines[i])
        i++
      }

      // Detect child indent level from the first child line instead of assuming
      // baseIndent + 2. This allows any indent width >= 2 (e.g. 2, 4, 8 spaces).
      const childBaseIndent = childLines.length > 0 ? childLines[0].indent : baseIndent + 2

      const nodePath = [...parentPath, `${text.trim()}[${siblingIndex}]`]
      const rawChildren = parseNodes(childLines, childBaseIndent, depth + 1, nodePath)

      // Extract @meta items: list items matching "- @key: value" with no own children
      // are pulled out as structured metadata and removed from the children array.
      const meta: Partial<Meta> = {}
      const children: Node[] = []
      for (const child of rawChildren) {
        if (child.type === 'list' && child.children.length === 0) {
          const metaMatch = child.text.match(/^@(\w+):\s*(.*)$/)
          if (metaMatch) {
            parseMeta(meta, metaMatch[1], metaMatch[2])
            continue
          }
        }
        children.push(child)
      }

      const hasTD = computeHasTaskDescendant(children)
      const nodeId = generateId(nodePath)
      const hasMeta = Object.keys(meta).length > 0

      if (taskStatus !== null) {
        const node: TaskNode = {
          type: 'task',
          id: nodeId,
          text: text.trim(),
          status: taskStatus,
          children,
          ...(hasMeta ? { meta: meta as Meta } : {}),
          lineNumber: itemLineIndex,
          hasTaskDescendant: hasTD,
          isGroup: hasTD && children.length > 0,
          isLeafTask: children.length === 0,
          isMemo: false,
          depth,
          path: nodePath,
        }
        nodes.push(node)
      } else {
        const node: ListNode = {
          type: 'list',
          id: nodeId,
          text: text.trim(),
          children,
          ...(hasMeta ? { meta: meta as Meta } : {}),
          lineNumber: itemLineIndex,
          hasTaskDescendant: hasTD,
          isGroup: hasTD && children.length > 0,
          isMemo: !hasTD,
          depth,
          path: nodePath,
        }
        nodes.push(node)
      }
      siblingIndex++
      continue
    }

    i++
  }

  return nodes
}

// ----------------------------------------------------------------
// Section parser
// ----------------------------------------------------------------

function parseSections(lines: RawLine[]): Section[] {
  // Find heading positions
  const headings: { pos: number; depth: number; title: string }[] = []
  lines.forEach((line, idx) => {
    const match = line.content.match(/^(#{1,6})\s+(.+)$/)
    if (match && line.indent === 0) {
      headings.push({ pos: idx, depth: match[1].length, title: match[2].trim() })
    }
  })

  const flatSections: Section[] = []

  if (headings.length === 0) {
    // No headings → single anonymous section
    const children = parseNodes(lines, 0, 1, [])
    flatSections.push({
      type: 'section',
      id: 'section-0',
      depth: 0,
      title: '',
      lineNumber: -1,
      children,
      subSections: [],
    })
    return flatSections
  }

  // Content before first heading (if any)
  if (headings[0].pos > 0) {
    const preLines = lines.slice(0, headings[0].pos)
    const children = parseNodes(preLines, 0, 1, [])
    flatSections.push({
      type: 'section',
      id: 'section-0',
      depth: 0,
      title: '',
      lineNumber: -1,
      children,
      subSections: [],
    })
  }

  headings.forEach((heading, hi) => {
    const nextPos = hi + 1 < headings.length ? headings[hi + 1].pos : lines.length
    const contentLines = lines.slice(heading.pos + 1, nextPos)
    const children = parseNodes(contentLines, 0, 1, [heading.title])
    flatSections.push({
      type: 'section',
      id: `section-${hi + 1}`,
      depth: heading.depth,
      title: heading.title,
      lineNumber: lines[heading.pos].lineIndex,
      children,
      subSections: [],
    })
  })

  return nestSections(flatSections)
}

function nestSections(sections: Section[]): Section[] {
  const result: Section[] = []
  const stack: Section[] = []

  for (const section of sections) {
    // Pop stack until we find a shallower parent
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

// ----------------------------------------------------------------
// Public API
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

export function parseMarkdown(markdown: string): Document {
  const lines = tokenize(markdown)
  const sections = parseSections(lines)
  const nodeLineMap = buildNodeLineMap(sections)
  return { type: 'document', sections, nodeLineMap }
}
