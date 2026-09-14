/**
 * 統一Markdownデータ仕様（issue-phase005-001）: カノニカルな型・語彙テーブルの単一の情報源。
 * 本リポジトリ内で状態・メタキーの語彙を参照する箇所は、すべてこのファイルを import する。
 * 原本: __workspace/unified-markdown-data-spec-proposal.md（2026-09-14 ユーザー承認）。
 */

// ----------------------------------------------------------------
// タスク状態（7値）
// ----------------------------------------------------------------

/** 統一Markdownデータ仕様: タスク状態（7値） */
export type Status =
  | 'planning'
  | 'ready'
  | 'in_progress'
  | 'waiting'
  | 'deferred'
  | 'done'
  | 'cancelled'

/** Markdown のチェックボックス内文字 → Status */
export const STATUS_BY_MARKER: Readonly<Record<string, Status>> = {
  '?': 'planning',
  ' ': 'ready',
  '>': 'in_progress',
  '!': 'waiting',
  '/': 'deferred',
  'x': 'done',
  '-': 'cancelled',
} as const

/** Status → Markdown のチェックボックス表記（書き戻し用） */
export const MARKER_BY_STATUS: Readonly<Record<Status, string>> = {
  planning:    '[?]',
  ready:       '[ ]',
  in_progress: '[>]',
  waiting:     '[!]',
  deferred:    '[/]',
  done:        '[x]',
  cancelled:   '[-]',
} as const

/** 未完了とみなす状態（done・cancelled 以外） */
export const INCOMPLETE_STATUSES: readonly Status[] =
  ['planning', 'ready', 'in_progress', 'waiting', 'deferred'] as const

// ----------------------------------------------------------------
// メタキー（11キー）
// ----------------------------------------------------------------

export const META_KEYS = {
  plan: 'plan',
  schedule: 'schedule',
  due: 'due',
  priority: 'priority',
  dependsOn: 'dependsOn',
  tags: 'tags',
  repeat: 'repeat',
  condition: 'condition',
  purpose: 'purpose',
  savepoint: 'savepoint',
  special_note: 'special_note',
} as const
export type MetaKey = keyof typeof META_KEYS

export type Meta = {
  plan?: string
  schedule?: string
  due?: string
  priority?: number
  dependsOn?: string[]
  tags?: string[]
  repeat?: string
  /** @完了イメージ。単一行なら string、子リストなら string[]（優先度C） */
  condition?: string | string[]
  /** @目的。単一行なら string、子リストなら string[]（優先度C） */
  purpose?: string | string[]
  /** @セーブポイント。単一行なら string、子リストなら string[]（優先度C） */
  savepoint?: string | string[]
  /** @特記事項。単一行なら string、子リストなら string[]（優先度C） */
  special_note?: string | string[]
  /** `?` 修飾子（仮置き）が付与されたメタキー。plan/schedule/due にのみ意味を持つ。 */
  tentative?: {
    plan?: true
    schedule?: true
    due?: true
  }
}
