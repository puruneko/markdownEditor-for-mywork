/**
 * issue-phase017-markdownEditor-for-mywork-004: Gantt 設定の保存・復元用の純粋関数。
 */
import type { GanttConfig } from 'svelte-gantt-lib'

/** 保存しないキー（mode / defaultDurationMinutes はホストが決める。dayWidth はズーム由来で対象外）。 */
const NON_PERSISTED_KEYS = ['mode', 'defaultDurationMinutes', 'dayWidth']

/** 既定値に保存値を上書きマージする。保存対象外キーは保存値で上書きしない。 */
export function mergeInitialGanttConfig(defaults: GanttConfig, saved: Partial<GanttConfig> | undefined): GanttConfig {
  const result: Record<string, unknown> = { ...defaults }
  for (const [k, v] of Object.entries(saved ?? {})) {
    if (NON_PERSISTED_KEYS.includes(k) || v === undefined) continue
    result[k] = v
  }
  return result as unknown as GanttConfig
}

/** onConfigChange の更新から保存対象のキーだけを取り出し、既存保存値へマージする。JSON 化できない値は捨てる。 */
export function mergePersistedGanttConfig(
  existing: Partial<GanttConfig>,
  updates: Partial<GanttConfig>,
): Partial<GanttConfig> {
  const result: Record<string, unknown> = { ...existing }
  for (const [k, v] of Object.entries(updates)) {
    if (NON_PERSISTED_KEYS.includes(k)) continue
    if (v === undefined || typeof v === 'function' || typeof v === 'symbol') continue
    if (typeof v === 'object' && v !== null && !isPlainJson(v)) continue
    result[k] = v
  }
  return result as Partial<GanttConfig>
}

function isPlainJson(v: object): boolean {
  try {
    return JSON.stringify(v) === JSON.stringify(JSON.parse(JSON.stringify(v)))
  } catch {
    return false
  }
}
