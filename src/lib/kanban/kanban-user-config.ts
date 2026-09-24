import type { LaneDefinition } from 'svelte-kanban-lib'

/**
 * KanbanTab のユーザー調整可能な設定（レーン・グルーピング等）。
 * 設定ハブ（ViewSettingsHub）の 'kanban' 名前空間へ永続化される単位
 * （issue-phase010-markdownEditor-005）。
 */
export interface KanbanUserConfig {
  lanes: LaneDefinition[]
  groupBy: string
  headingLevel: number
  showUnits: boolean
  allowCrossGroupMove: boolean
  cardTitleMultiline: boolean
}
