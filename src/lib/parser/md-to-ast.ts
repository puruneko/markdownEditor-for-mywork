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

// Obsidian (CodeMirror 6) inserts real tab characters when Tab is pressed.
// Expand leading tabs using tab-stop semantics so indent comparisons work
// regardless of the user's visual "Tab size" setting.
const TAB_WIDTH = 4

function expandLeadingTabs(line: string): string {
  let col = 0
  let i = 0
  while (i < line.length) {
    const ch = line[i]
    if (ch === '\t') {
      col += TAB_WIDTH - (col % TAB_WIDTH)
      i++
    } else if (ch === ' ') {
      col++
      i++
    } else {
      break
    }
  }
  return ' '.repeat(col) + line.slice(i)
}

function tokenize(text: string): RawLine[] {
  return text
    .split('\n')
    .map((line, idx) => {
      const expanded = expandLeadingTabs(line)
      return {
        indent: expanded.match(/^( *)/)?.[1].length ?? 0,
        content: expanded.trimStart(),
        lineIndex: idx,
      }
    })
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

/**
 * Parse a flat list of RawLines into a Node tree.
 *
 * Design principles:
 * - No `baseIndent` parameter. Instead the sibling-level indent is derived
 *   from the minimum indent in `rawLines`. This makes the parser
 *   indent-relative rather than indent-absolute, so it handles any
 *   consistent indent width (2sp, 4sp, 8sp, tabs) without special-casing,
 *   and also tolerates files where indent widths are mixed (e.g. serializer
 *   output uses 2sp while Obsidian's Tab key produces 4sp-equivalent).
 *
 * - @meta items that "captured" children due to mixed indentation are still
 *   extracted as metadata; their captured children are re-injected into the
 *   containing node's children list.
 */
function parseNodes(
  rawLines: RawLine[],
  depth: number,
  parentPath: string[],
): Node[] {
  if (rawLines.length === 0) return []

  // Determine sibling indent: the minimum indent present in rawLines.
  // All lines at this indent are siblings; lines more indented are children.
  let siblingIndent = rawLines[0].indent
  for (const l of rawLines) {
    if (l.indent < siblingIndent) siblingIndent = l.indent
  }

  const nodes: Node[] = []
  let i = 0
  let siblingIndex = 0

  while (i < rawLines.length) {
    const line = rawLines[i]

    // Lines at a deeper indent than siblingIndent were already consumed as
    // children of the preceding sibling. If any remain here it means they
    // had no parent sibling to attach to — skip them gracefully.
    if (line.indent !== siblingIndent) {
      i++
      continue
    }

    const content = line.content

    // ---- Blockquote ----
    if (content.startsWith('>')) {
      const firstLineIndex = line.lineIndex
      const rawParts: string[] = []
      // Only collect consecutive '>' lines at the SAME indent level.
      // Lines at a different indent are either a separate blockquote
      // (deeper, child context) or a sibling at a different level.
      while (i < rawLines.length && rawLines[i].indent === siblingIndent && rawLines[i].content.startsWith('>')) {
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

      // Collect all child lines: every line more indented than siblingIndent
      // up to (but not including) the next sibling.
      const childLines: RawLine[] = []
      while (i < rawLines.length && rawLines[i].indent > siblingIndent) {
        childLines.push(rawLines[i])
        i++
      }

      const nodePath = [...parentPath, `${text.trim()}[${siblingIndex}]`]
      const rawChildren = parseNodes(childLines, depth + 1, nodePath)

      // Extract @meta items from children.
      //
      // Normally an @meta item is a leaf list node matching "- @key: value".
      // However, in files with mixed indentation (e.g. 2-space serializer
      // output + Obsidian Tab input), sibling tasks can end up indented
      // under an @meta line. We still extract the @meta value and re-inject
      // those accidentally-nested children back into this node's children.
      const meta: Partial<Meta> = {}
      const children: Node[] = []
      for (const child of rawChildren) {
        if (child.type === 'list') {
          const metaMatch = child.text.match(/^@(\w+):\s*(.*)$/)
          if (metaMatch) {
            parseMeta(meta, metaMatch[1], metaMatch[2])
            // Re-inject any children the @meta item captured due to mixed indent
            if (child.children.length > 0) {
              children.push(...child.children)
            }
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
    const children = parseNodes(lines, 1, [])
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
    const children = parseNodes(preLines, 1, [])
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
    const children = parseNodes(contentLines, 1, [heading.title])
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
