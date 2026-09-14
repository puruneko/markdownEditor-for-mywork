export { META_KEYS } from '../contract/canonical'
export type { MetaKey } from '../contract/canonical'

import type { MetaKey } from '../contract/canonical'
import { META_KEYS } from '../contract/canonical'

/** 日本語メタキー表記 → カノニカル内部キー */
export const META_KEY_ALIASES: Readonly<Record<string, MetaKey>> = {
  '想定期間': 'plan',
  '実施日時': 'schedule',
  '期限':     'due',
  '完了イメージ':   'condition',
  '目的':          'purpose',
  'セーブポイント': 'savepoint',
  '特記事項':      'special_note',
} as const

/** `@key:` の key 部分（英字キーまたは日本語エイリアス）をカノニカルな MetaKey へ正規化する。該当なしは null。 */
export function normalizeMetaKey(raw: string): MetaKey | null {
  if (raw in META_KEYS) return raw as MetaKey
  return META_KEY_ALIASES[raw] ?? null
}
