import type { CardData, LaneDefinition, KanbanBoardConfig, FieldDefinition, GroupDefinition } from 'svelte-kanban-lib'
import { resolveGroupId } from 'svelte-kanban-lib'
import type { Document, Section, Node, TaskNode } from '../parser/types'

// ----------------------------------------------------------------
// KanbanCard — CardData with typed fields
// ----------------------------------------------------------------

export type KanbanCard = CardData & {
  id: string
  title: string
  status: string        // 'todo' | 'doing' | 'done' | 'blocked' | 'hold'
  /** セクション階層パス。ライブラリの groupBy: 'section' + sectionDepth で使用する。
   *  例: ["Heading A", "List B"] */
  section: string[]
  /** 後方互換・フィルタ用。section[0] と等価 */
  sectionTitle: string
  /** 後方互換・フィルタ用。section の末尾要素と等価 */
  groupTitle: string
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
  { key: 'section', label: 'セクション', type: 'array' },
  { key: 'sectionTitle', label: '親セクション', type: 'string' },
  { key: 'priority', label: '優先度', type: 'number' },
  { key: 'due', label: '期限', type: 'date' },
  { key: 'schedule', label: 'スケジュール', type: 'string' },
  { key: 'depth', label: 'ネスト深さ', type: 'number' },
]

// ----------------------------------------------------------------
// Node traversal — builds flat KanbanCard[] from Document AST
// ----------------------------------------------------------------

function taskToCard(node: TaskNode, sectionPath: string[]): KanbanCard {
  const sectionTitle = sectionPath[0] ?? ''
  const groupTitle = sectionPath[sectionPath.length - 1] ?? ''
  const card: KanbanCard = {
    id: node.id,
    title: node.text,
    status: node.status,
    section: [...sectionPath],
    sectionTitle,
    groupTitle,
    depth: node.depth,
  }
  if (node.meta?.schedule !== undefined) card.schedule = node.meta.schedule
  if (node.meta?.due !== undefined) card.due = node.meta.due
  if (node.meta?.priority !== undefined) card.priority = node.meta.priority
  if (node.meta?.tags !== undefined) card.tags = node.meta.tags
  return card
}

function extractFromNodes(nodes: Node[], sectionPath: string[], result: KanbanCard[]): void {
  for (const node of nodes) {
    if (node.type === 'quote') continue
    if (node.type === 'task') {
      result.push(taskToCard(node, sectionPath))
      if (node.children.length > 0) {
        extractFromNodes(node.children, sectionPath, result)
      }
    } else if (node.type === 'list') {
      if (node.children.length > 0) {
        extractFromNodes(node.children, [...sectionPath, node.text], result)
      }
    }
  }
}

function extractFromSection(section: Section, parentPath: string[], result: KanbanCard[]): void {
  // 無名セクション（lineNumber=-1, title=""）はパスに追加しない
  const sectionPath = section.title ? [...parentPath, section.title] : [...parentPath]
  extractFromNodes(section.children, sectionPath, result)
  for (const sub of section.subSections) {
    extractFromSection(sub, sectionPath, result)
  }
}

// ----------------------------------------------------------------
// Public API
// ----------------------------------------------------------------

export function extractKanbanCards(doc: Document): KanbanCard[] {
  const result: KanbanCard[] = []
  for (const section of doc.sections) {
    extractFromSection(section, [], result)
  }
  return result
}

/**
 * ライブラリの section 配列フィールドと sectionDepth を使った階層グルーピング設定を生成する。
 * groups にカードの Markdown 出現順の order を付与することで、表示順を Markdown 記述順に固定する。
 */
export function createKanbanConfig(
  cards: KanbanCard[],
  groupByField: string = 'section',
  sectionDepth: number = 2,
): KanbanBoardConfig {
  const groupOrderMap = new Map<string, number>()
  for (const card of cards) {
    const val = card[groupByField as keyof KanbanCard]
    const gid = resolveGroupId(val, sectionDepth)
    if (!groupOrderMap.has(gid)) groupOrderMap.set(gid, groupOrderMap.size)
  }
  const groups: GroupDefinition[] = [...groupOrderMap.entries()].map(([id, order]) => {
    const parts = id.split(' / ')
    return { id, order, label: parts[parts.length - 1] }
  })

  return {
    ...DEFAULT_KANBAN_CONFIG,
    groupBy: groupByField,
    sectionDepth,
    groups,
  }
}
