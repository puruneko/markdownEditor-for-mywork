import type { Document, Section, Node, TaskNode, Status } from '../parser/types'

export type FilterQuery = {
  status?: Status[]
  tags?: string[]
  priorityMax?: number
  dueBefore?: string
  dueAfter?: string
  hasSchedule?: boolean
  hasDate?: boolean
  text?: string
  sectionPath?: string[]
}

export type FilterOptions = {
  keepAncestors?: boolean
}

export function filterNodes(
  doc: Document,
  query: FilterQuery,
  opts?: FilterOptions,
): Document {
  if (isEmptyQuery(query)) return doc

  const keepAncestors = opts?.keepAncestors ?? true

  const filteredSections = doc.sections
    .map(sec => filterSection(sec, query, keepAncestors, []))
    .filter((sec): sec is Section => sec !== null)

  const nodeLineMap = new Map<string, number>()
  for (const sec of filteredSections) {
    collectSectionLineMap(sec, doc.nodeLineMap, nodeLineMap)
  }

  return { type: 'document', sections: filteredSections, nodeLineMap }
}

function isEmptyQuery(query: FilterQuery): boolean {
  return (
    query.status === undefined &&
    query.tags === undefined &&
    query.priorityMax === undefined &&
    query.dueBefore === undefined &&
    query.dueAfter === undefined &&
    query.hasSchedule === undefined &&
    query.hasDate === undefined &&
    query.text === undefined &&
    query.sectionPath === undefined
  )
}

function taskMatches(node: TaskNode, query: FilterQuery, sectionPath: string[]): boolean {
  if (query.status !== undefined && !query.status.includes(node.status)) return false

  if (query.tags !== undefined) {
    const nodeTags = node.meta?.tags ?? []
    if (!query.tags.some(t => nodeTags.includes(t))) return false
  }

  if (query.priorityMax !== undefined) {
    const p = node.meta?.priority
    if (p === undefined || p > query.priorityMax) return false
  }

  if (query.dueBefore !== undefined) {
    const due = node.meta?.due
    if (!due || due > query.dueBefore) return false
  }

  if (query.dueAfter !== undefined) {
    const due = node.meta?.due
    if (!due || due < query.dueAfter) return false
  }

  if (query.hasSchedule !== undefined) {
    const has = node.meta?.schedule !== undefined
    if (has !== query.hasSchedule) return false
  }

  if (query.hasDate !== undefined) {
    const has = node.meta?.schedule !== undefined || node.meta?.due !== undefined
    if (has !== query.hasDate) return false
  }

  if (query.text !== undefined) {
    if (!node.text.toLowerCase().includes(query.text.toLowerCase())) return false
  }

  if (query.sectionPath !== undefined) {
    const sp = query.sectionPath
    if (sectionPath.length < sp.length) return false
    for (let i = 0; i < sp.length; i++) {
      if (sectionPath[i] !== sp[i]) return false
    }
  }

  return true
}

// keepAncestors: true — 合致タスクの祖先 ListNode/TaskNode を保持しながら再帰フィルタ。
function filterNodesKeepAncestors(nodes: Node[], query: FilterQuery, sectionPath: string[]): Node[] {
  const result: Node[] = []
  for (const node of nodes) {
    if (node.type === 'quote') continue
    if (node.type === 'task') {
      const filteredChildren = filterNodesKeepAncestors(node.children, query, sectionPath)
      if (taskMatches(node, query, sectionPath) || filteredChildren.length > 0) {
        result.push({ ...node, children: filteredChildren })
      }
    } else {
      const filteredChildren = filterNodesKeepAncestors(node.children, query, sectionPath)
      if (filteredChildren.length > 0) {
        result.push({ ...node, children: filteredChildren })
      }
    }
  }
  return result
}

// keepAncestors: false — 合致 TaskNode のみ収集してフラットに返す。ListNode 祖先は保持しない。
function collectMatchingTasks(nodes: Node[], query: FilterQuery, sectionPath: string[]): Node[] {
  const result: Node[] = []
  for (const node of nodes) {
    if (node.type === 'quote') continue
    if (node.type === 'task') {
      if (taskMatches(node, query, sectionPath)) {
        const filteredChildren = collectMatchingTasks(node.children, query, sectionPath)
        result.push({ ...node, children: filteredChildren })
      } else {
        result.push(...collectMatchingTasks(node.children, query, sectionPath))
      }
    } else {
      result.push(...collectMatchingTasks(node.children, query, sectionPath))
    }
  }
  return result
}

function filterSection(
  section: Section,
  query: FilterQuery,
  keepAncestors: boolean,
  currentPath: string[],
): Section | null {
  const sectionPath = [...currentPath, section.title]

  const filteredChildren = keepAncestors
    ? filterNodesKeepAncestors(section.children, query, sectionPath)
    : collectMatchingTasks(section.children, query, sectionPath)

  const filteredSubSections = section.subSections
    .map(sub => filterSection(sub, query, keepAncestors, sectionPath))
    .filter((sub): sub is Section => sub !== null)

  if (filteredChildren.length === 0 && filteredSubSections.length === 0) return null

  return { ...section, children: filteredChildren, subSections: filteredSubSections }
}

function collectSectionLineMap(
  section: Section,
  src: Map<string, number>,
  dst: Map<string, number>,
): void {
  const line = src.get(section.id)
  if (line !== undefined) dst.set(section.id, line)
  for (const node of section.children) collectNodeLineMap(node, src, dst)
  for (const sub of section.subSections) collectSectionLineMap(sub, src, dst)
}

function collectNodeLineMap(
  node: Node,
  src: Map<string, number>,
  dst: Map<string, number>,
): void {
  if (node.type === 'quote') return
  const line = src.get(node.id)
  if (line !== undefined) dst.set(node.id, line)
  for (const child of node.children) collectNodeLineMap(child, src, dst)
}
