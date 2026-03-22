import type { Document, Section, Node, TaskNode, ListNode, QuoteNode, Status, Meta } from './types'

// ----------------------------------------------------------------
// Tokenizer
// ----------------------------------------------------------------

interface RawLine {
  indent: number
  content: string
}

function tokenize(text: string): RawLine[] {
  return text
    .split('\n')
    .map(line => ({
      indent: line.match(/^( *)/)?.[1].length ?? 0,
      content: line.trimStart(),
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
      meta.schedule = value
      break
    case 'due':
      meta.due = value
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

      // Collect child lines and meta lines.
      // @meta lines at exactly baseIndent+2 belong to THIS item.
      // @meta lines deeper than baseIndent+2 belong to a descendant — pass through as childLines.
      const childLines: RawLine[] = []
      const meta: Partial<Meta> = {}

      while (i < rawLines.length && rawLines[i].indent > baseIndent) {
        const cl = rawLines[i]
        const isDirectMeta =
          cl.indent === baseIndent + 2 && cl.content.startsWith('@')
        if (isDirectMeta) {
          const metaMatch = cl.content.match(/^@(\w+):\s*(.*)$/)
          if (metaMatch) parseMeta(meta, metaMatch[1], metaMatch[2])
          i++
        } else {
          childLines.push(cl)
          i++
        }
      }

      const nodePath = [...parentPath, `${text.trim()}[${siblingIndex}]`]
      const children = parseNodes(childLines, baseIndent + 2, depth + 1, nodePath)
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

export function parseMarkdown(markdown: string): Document {
  const lines = tokenize(markdown)
  const sections = parseSections(lines)
  return { type: 'document', sections }
}
