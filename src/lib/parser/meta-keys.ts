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
  // issue-phase019-markdownEditor-for-mywork-001: 標準キー → 組込別名 → ユーザー別名 の順
  return META_KEY_ALIASES[raw] ?? userAliasMap.get(raw) ?? null
}

export type UserMetaKeyAliases = Partial<Record<MetaKey, string[]>>
export interface AliasValidationResult { aliases: UserMetaKeyAliases; errors: string[] }

const userAliasMap = new Map<string, MetaKey>()

/** 不正な別名を取り除いた結果とエラーメッセージを返す（純粋関数） */
export function validateUserMetaKeyAliases(input: UserMetaKeyAliases): AliasValidationResult {
  const aliases: UserMetaKeyAliases = {}
  const errors: string[] = []
  const owner = new Map<string, MetaKey>()
  const src = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  for (const key of Object.keys(src)) {
    if (!(key in META_KEYS)) continue
    const list = src[key]
    if (!Array.isArray(list)) continue
    for (const rawAlias of list) {
      const alias = typeof rawAlias === 'string' ? rawAlias.trim() : ''
      if (alias === '') continue
      if (!/^[\p{L}\p{N}_]+$/u.test(alias)) {
        errors.push(`別名「${alias}」は使えません（文字・数字・アンダースコアのみ）。`)
      } else if (alias in META_KEYS) {
        errors.push(`別名「${alias}」は標準キー名と同じため使えません。`)
      } else if (alias in META_KEY_ALIASES) {
        errors.push(`別名「${alias}」は組込別名と同じため使えません。`)
      } else if (owner.has(alias) && owner.get(alias) !== key) {
        errors.push(`別名「${alias}」は ${owner.get(alias)} と重複しています。`)
      } else if (!owner.has(alias)) {
        owner.set(alias, key as MetaKey)
        ;(aliases[key as MetaKey] ??= []).push(alias)
      }
    }
  }
  return { aliases, errors }
}

/** 検証済みの別名表をレジストリに設定する */
export function setUserMetaKeyAliases(aliases: UserMetaKeyAliases): void {
  userAliasMap.clear()
  for (const [k, list] of Object.entries(aliases)) {
    for (const a of list ?? []) userAliasMap.set(a, k as MetaKey)
  }
}

/** canonical キーに対応する全キー名（標準名・組込別名・ユーザー別名） */
export function getMetaKeyNames(key: MetaKey): string[] {
  const names: string[] = [key]
  for (const [a, k] of Object.entries(META_KEY_ALIASES)) if (k === key) names.push(a)
  for (const [a, k] of userAliasMap) if (k === key) names.push(a)
  return names
}
