import type { CardData, LaneDefinition, KanbanBoardConfig, FieldDefinition, GroupDefinition } from 'svelte-kanban-lib'
import type { Document, Section, Node, TaskNode } from '../parser/types'

// ----------------------------------------------------------------
// KanbanCard — CardData with typed fields
// ----------------------------------------------------------------

export type KanbanCard = CardData & {
  id: string
  title: string
  status: string        // 'todo' | 'doing' | 'done' | 'blocked' | 'hold'
  sectionTitle: string
  depth: number
  schedule?: string
  due?: string
  priority?: number
  tags?: string[]
}

// ----------------------------------------------------------------
// Default lane configuration (one lane per status)
// ----------------------------------------------------------------

export const DEFAULT_KANBAN_CONFIG: KanbanBoardConfig = {
  lanes: [
    {
      id: 'todo',
      title: 'Todo',
      filter: { logic: 'and', conditions: [{ key: 'status', operator: 'eq', value: 'todo' }] },
      updateRules: [{ type: 'set', key: 'status', value: 'todo' }],
      order: 0,
    },
    {
      id: 'doing',
      title: 'Doing',
      filter: { logic: 'and', conditions: [{ key: 'status', operator: 'eq', value: 'doing' }] },
      updateRules: [{ type: 'set', key: 'status', value: 'doing' }],
      order: 1,
    },
    {
      id: 'blocked',
      title: 'Blocked',
      filter: { logic: 'and', conditions: [{ key: 'status', operator: 'eq', value: 'blocked' }] },
      updateRules: [{ type: 'set', key: 'status', value: 'blocked' }],
      order: 2,
    },
    {
      id: 'hold',
      title: 'Hold',
      filter: { logic: 'and', conditions: [{ key: 'status', operator: 'eq', value: 'hold' }] },
      updateRules: [{ type: 'set', key: 'status', value: 'hold' }],
      order: 3,
    },
    {
      id: 'done',
      title: 'Done',
      filter: { logic: 'and', conditions: [{ key: 'status', operator: 'eq', value: 'done' }] },
      updateRules: [{ type: 'set', key: 'status', value: 'done' }],
      order: 4,
    },
  ] satisfies LaneDefinition[],
}

export const KANBAN_FIELD_DEFINITIONS: FieldDefinition[] = [
  {
    key: 'status',
    label: 'ステータス',
    type: 'string',
    options: ['todo', 'doing', 'done', 'blocked', 'hold'],
  },
  { key: 'sectionTitle', label: 'セクション', type: 'string' },
  { key: 'priority', label: '優先度', type: 'number' },
  { key: 'due', label: '期限', type: 'date' },
  { key: 'schedule', label: 'スケジュール', type: 'string' },
  { key: 'depth', label: 'ネスト深さ', type: 'number' },
]

// ----------------------------------------------------------------
// Node traversal — builds flat KanbanCard[] from Document AST
// ----------------------------------------------------------------

function taskToCard(node: TaskNode, sectionTitle: string): KanbanCard {
  const card: KanbanCard = {
    id: node.id,
    title: node.text,
    status: node.status,
    sectionTitle,
    depth: node.depth,
  }
  if (node.meta?.schedule !== undefined) card.schedule = node.meta.schedule
  if (node.meta?.due !== undefined) card.due = node.meta.due
  if (node.meta?.priority !== undefined) card.priority = node.meta.priority
  if (node.meta?.tags !== undefined) card.tags = node.meta.tags
  return card
}

function extractFromNodes(nodes: Node[], sectionTitle: string, result: KanbanCard[]): void {
  for (const node of nodes) {
    if (node.type === 'quote') continue
    if (node.type === 'task') {
      result.push(taskToCard(node, sectionTitle))
      if (node.children.length > 0) {
        extractFromNodes(node.children, sectionTitle, result)
      }
    } else if (node.type === 'list') {
      if (node.children.length > 0) {
        extractFromNodes(node.children, sectionTitle, result)
      }
    }
  }
}

function extractFromSection(section: Section, result: KanbanCard[]): void {
  extractFromNodes(section.children, section.title, result)
  for (const sub of section.subSections) {
    extractFromSection(sub, result)
  }
}

// ----------------------------------------------------------------
// Public API
// ----------------------------------------------------------------

export function extractKanbanCards(doc: Document): KanbanCard[] {
  const result: KanbanCard[] = []
  for (const section of doc.sections) {
    extractFromSection(section, result)
  }
  return result
}

/**
 * カードに含まれるセクションタイトルの出現順で GroupDefinition[] を生成する。
 * groupBy: 'sectionTitle' と組み合わせてカードをセクション別にグルーピングする。
 */
export function createKanbanConfig(cards: KanbanCard[]): KanbanBoardConfig {
  const seen = new Set<string>()
  const groups: GroupDefinition[] = []

  for (const card of cards) {
    if (!seen.has(card.sectionTitle)) {
      seen.add(card.sectionTitle)
      groups.push({
        id: card.sectionTitle,
        label: card.sectionTitle || '（未分類）',
        order: groups.length,
      })
    }
  }

  return {
    ...DEFAULT_KANBAN_CONFIG,
    groupBy: 'sectionTitle',
    groups,
  }
}
