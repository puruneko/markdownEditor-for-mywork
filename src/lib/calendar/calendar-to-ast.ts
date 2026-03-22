import { DateTime } from 'luxon'
import type { Document, Section, Node, TaskNode } from '../parser/types'

// ----------------------------------------------------------------
// Schedule string formatter
// ----------------------------------------------------------------

function formatSchedule(start: DateTime, end: DateTime): string {
  const fmt = (dt: DateTime) => dt.toFormat("yyyy-MM-dd'T'HH:mm")
  return `${fmt(start)}/${fmt(end)}`
}

// ----------------------------------------------------------------
// Immutable node updater
// ----------------------------------------------------------------

type NodeUpdater = (node: TaskNode) => TaskNode

function updateNodesById(nodes: Node[], id: string, updater: NodeUpdater): Node[] {
  return nodes.map(node => {
    if (node.type === 'quote') return node

    if (node.id === id && node.type === 'task') {
      return updater(node)
    }

    if ((node.type === 'task' || node.type === 'list') && node.children.length > 0) {
      const newChildren = updateNodesById(node.children, id, updater)
      return { ...node, children: newChildren } as Node
    }

    return node
  })
}

function updateSectionById(section: Section, id: string, updater: NodeUpdater): Section {
  return {
    ...section,
    children: updateNodesById(section.children, id, updater),
    subSections: section.subSections.map(sub => updateSectionById(sub, id, updater)),
  }
}

function updateDocumentNode(doc: Document, nodeId: string, updater: NodeUpdater): Document {
  return {
    ...doc,
    sections: doc.sections.map(section => updateSectionById(section, nodeId, updater)),
  }
}

// ----------------------------------------------------------------
// Public API
// ----------------------------------------------------------------

/** Update meta.schedule of a task node identified by nodeId */
export function updateNodeSchedule(
  doc: Document,
  nodeId: string,
  start: DateTime,
  end: DateTime,
): Document {
  const schedule = formatSchedule(start, end)
  return updateDocumentNode(doc, nodeId, node => ({
    ...node,
    meta: { ...(node.meta ?? {}), schedule },
  }))
}

/** Update the text of a task node identified by nodeId */
export function updateNodeText(doc: Document, nodeId: string, newText: string): Document {
  return updateDocumentNode(doc, nodeId, node => ({
    ...node,
    text: newText,
  }))
}
