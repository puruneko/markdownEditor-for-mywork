import type { CardData, LaneDefinition, KanbanBoardConfig, FieldDefinition, GroupDefinition, HierarchySegment } from 'svelte-kanban-lib'
import { resolveHierarchyGroupId, HIERARCHY_GROUP_BY } from 'svelte-kanban-lib'
import type { Document, Section, Node, TaskNode } from '../parser/types'
import type { SourceEntry } from '../viewmodel/contract'
import { makeGlobalKey } from '../viewmodel/global-key'

// ----------------------------------------------------------------
// KanbanCard — CardData with typed fields
// ----------------------------------------------------------------

export type KanbanCard = CardData & {
  id: string            // globalKey（{#each} キー・クリック・書き戻しで使用）
  title: string
  status: string        // 'todo' | 'doing' | 'done' | 'blocked' | 'hold'
  /** 順序付き階層パス。ライブラリの groupBy: HIERARCHY_GROUP_BY（階層グルーピング）と
   *  headingLevel / showUnits で使用する。heading（見出し）は level を持ち、
   *  リスト由来のグループは unit として扱う。 */
  hierarchy: HierarchySegment[]
  /** 親カードの globalKey。カードグループ（サブカードのインライン展開）で使用する。
   *  親がタスクでない（リスト等）場合は未設定。 */
  parentId?: string
  /** 後方互換・フィルタ用。hierarchy の name 配列。例: ["Heading A", "List B"] */
  section: string[]
  /** 後方互換・フィルタ用。section[0] と等価 */
  sectionTitle: string
  /** 後方互換・フィルタ用。section の末尾要素と等価 */
  groupTitle: string
  depth: number
  sourcePath: string    // どのファイルのカードか（書き戻し先の特定に使用）
  description?: string
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
  { key: 'description', label: '説明', type: 'string' },
  { key: 'priority', label: '優先度', type: 'number' },
  { key: 'due', label: '期限', type: 'date' },
  { key: 'schedule', label: 'スケジュール', type: 'string' },
  { key: 'depth', label: 'ネスト深さ', type: 'number' },
]

// ----------------------------------------------------------------
// Node traversal — builds flat KanbanCard[] from Document AST
// ----------------------------------------------------------------

function extractDescription(children: Node[]): string | undefined {
  const parts: string[] = []
  for (const child of children) {
    if (child.type === 'quote') {
      parts.push(child.raw)
    } else if (child.type === 'list' && child.isMemo) {
      parts.push(child.text)
    }
  }
  return parts.length > 0 ? parts.join('\n') : undefined
}

function taskToCard(
  node: TaskNode,
  hierarchy: HierarchySegment[],
  sourcePath: string,
  ancestorTaskId: string | undefined,
): KanbanCard {
  const section = hierarchy.map(seg => seg.name)
  const sectionTitle = section[0] ?? ''
  const groupTitle = section[section.length - 1] ?? ''
  const card: KanbanCard = {
    id: makeGlobalKey(sourcePath, node.id),
    title: node.text,
    status: node.status,
    hierarchy: [...hierarchy],
    section,
    sectionTitle,
    groupTitle,
    depth: node.depth,
    sourcePath,
  }
  // カードグループ：最も近い祖先タスクの globalKey を親として張る。
  // リスト（ユニット）はカード化されないため、祖先タスクの localId まで遡った値が渡ってくる。
  if (ancestorTaskId !== undefined) card.parentId = makeGlobalKey(sourcePath, ancestorTaskId)
  const description = extractDescription(node.children)
  if (description !== undefined) card.description = description
  if (node.meta?.schedule !== undefined) card.schedule = node.meta.schedule
  if (node.meta?.due !== undefined) card.due = node.meta.due
  if (node.meta?.priority !== undefined) card.priority = node.meta.priority
  if (node.meta?.tags !== undefined) card.tags = node.meta.tags
  return card
}

function extractFromNodes(
  nodes: Node[],
  hierarchy: HierarchySegment[],
  sourcePath: string,
  result: KanbanCard[],
  ancestorTaskId: string | undefined,
): void {
  for (const node of nodes) {
    if (node.type === 'quote') continue
    if (node.type === 'task') {
      result.push(taskToCard(node, hierarchy, sourcePath, ancestorTaskId))
      if (node.children.length > 0) {
        // 子の祖先タスクは「このタスク自身」
        extractFromNodes(node.children, hierarchy, sourcePath, result, node.id)
      }
    } else if (node.type === 'list') {
      if (node.children.length > 0) {
        // リストグループは unit 段として階層に追加する（カード化しないので祖先タスクは透過）
        extractFromNodes(node.children, [...hierarchy, { type: 'unit', name: node.text }], sourcePath, result, ancestorTaskId)
      }
    }
  }
}

function extractFromSection(
  section: Section,
  parentHierarchy: HierarchySegment[],
  sourcePath: string,
  result: KanbanCard[],
): void {
  // 無名セクション（lineNumber=-1, title=""）は階層に追加しない。
  // section.depth は Markdown 見出しレベル（# = 1, ## = 2, ...）。
  const hierarchy: HierarchySegment[] = section.title
    ? [...parentHierarchy, { type: 'heading', level: section.depth, name: section.title }]
    : [...parentHierarchy]
  extractFromNodes(section.children, hierarchy, sourcePath, result, undefined)
  for (const sub of section.subSections) {
    extractFromSection(sub, hierarchy, sourcePath, result)
  }
}

/** パスからファイル名（拡張子なし）を取り出す */
function fileBaseName(path: string): string {
  const name = path.split('/').pop() ?? path
  return name.replace(/\.md$/i, '')
}

function extractFromDocument(doc: Document, sourcePath: string, initialHierarchy: HierarchySegment[], result: KanbanCard[]): void {
  for (const section of doc.sections) {
    extractFromSection(section, initialHierarchy, sourcePath, result)
  }
}

// ----------------------------------------------------------------
// Public API
// ----------------------------------------------------------------

/**
 * 複数ソース（ファイルパスと Document のペア）から KanbanCard[] を生成する。
 * 各カードの id は globalKey（sourcePath::localId）で、全体でユニーク。
 * 単一ファイルの場合は要素 1 の配列として渡す。
 * 複数ファイルの場合はセクション階層の先頭にファイル名を追加する。
 */
export function extractKanbanCards(sources: SourceEntry[]): KanbanCard[] {
  const result: KanbanCard[] = []
  const multiSource = sources.length > 1
  for (const { path, doc } of sources) {
    // 複数ファイル時はファイル名を最上位の heading 段（level 0）として階層に追加する
    const initialHierarchy: HierarchySegment[] = multiSource
      ? [{ type: 'heading', level: 0, name: fileBaseName(path) }]
      : []
    extractFromDocument(doc, path, initialHierarchy, result)
  }
  return result
}

/**
 * ライブラリの階層グルーピング（groupBy: HIERARCHY_GROUP_BY）設定を生成する。
 * headingLevel / showUnits で採用する階層段を決め、カードの Markdown 出現順の order を
 * groups に付与することで、グループの表示順を Markdown 記述順に固定する。
 *
 * @param headingLevel 先頭から採用する heading 段数（最小 1、既定 2）
 * @param showUnits    採用した最後の heading 以降の unit 段もグループ化に含めるか（既定 false）
 */
export function createKanbanConfig(
  cards: KanbanCard[],
  headingLevel: number = 2,
  showUnits: boolean = false,
): KanbanBoardConfig {
  const groupOrderMap = new Map<string, number>()
  for (const card of cards) {
    const gid = resolveHierarchyGroupId(card.hierarchy, headingLevel, showUnits)
    if (!groupOrderMap.has(gid)) groupOrderMap.set(gid, groupOrderMap.size)
  }
  const groups: GroupDefinition[] = [...groupOrderMap.entries()].map(([id, order]) => {
    const parts = id.split(' / ')
    return { id, order, label: parts[parts.length - 1] }
  })

  return {
    ...DEFAULT_KANBAN_CONFIG,
    groupBy: HIERARCHY_GROUP_BY,
    headingLevel,
    showUnits,
    groups,
  }
}
