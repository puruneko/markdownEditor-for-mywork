import { filterNodes } from '../query/filter'
import type { Document, Section, TaskNode, Status } from '../parser/types'
import type { SourceEntry } from '../viewmodel/contract'

export interface TrayItem {
  sourcePath: string
  nodeId: string
  lineNumber: number
  text: string
}

const TRAY_STATUSES: Status[] = ['todo', 'doing', 'blocked', 'hold']

const TRAY_QUERY = {
  status: TRAY_STATUSES,
  hasDate: false,
}

export function extractUnscheduledTasks(sources: SourceEntry[]): TrayItem[] {
  const items: TrayItem[] = []
  for (const { path, doc } of sources) {
    const filtered = filterNodes(doc, TRAY_QUERY, { keepAncestors: false })
    collectFromDocument(filtered, path, items)
  }
  return items
}

function collectFromDocument(doc: Document, sourcePath: string, acc: TrayItem[]): void {
  for (const section of doc.sections) {
    collectFromSection(section, sourcePath, doc.nodeLineMap, acc)
  }
}

function collectFromSection(
  section: Section,
  sourcePath: string,
  lineMap: Map<string, number>,
  acc: TrayItem[],
): void {
  for (const node of section.children) {
    if (node.type === 'task') collectFromTask(node, sourcePath, lineMap, acc)
  }
  for (const sub of section.subSections) {
    collectFromSection(sub, sourcePath, lineMap, acc)
  }
}

function collectFromTask(
  node: TaskNode,
  sourcePath: string,
  lineMap: Map<string, number>,
  acc: TrayItem[],
): void {
  const lineNumber = lineMap.get(node.id) ?? -1
  acc.push({ sourcePath, nodeId: node.id, lineNumber, text: node.text })
  for (const child of node.children) {
    if (child.type === 'task') collectFromTask(child, sourcePath, lineMap, acc)
  }
}
