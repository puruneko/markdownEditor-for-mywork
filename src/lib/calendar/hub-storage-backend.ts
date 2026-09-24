import type { StorageBackend, CalendarStorageData } from 'svelte-calendar-lib'
import type { ViewSettingsHub } from '../../settings-hub'

const NAMESPACE = 'calendar'

/**
 * `CalendarStorage` の永続化先を、ブラウザ `localStorage` ではなく設定ハブ
 * （Obsidian の `data.json`）へ委譲する `StorageBackend` 実装
 * （issue-phase010-markdownEditor-005）。`CalendarStorage` は `load()`/`save()`
 * を差し替え可能な設計であり、`deepMerge` により保存値と overrides が自動マージされるため、
 * calendar 側（svelte-calendar-lib）の改修は不要。
 */
export function createHubStorageBackend(hub: ViewSettingsHub): StorageBackend {
  return {
    load: () => hub.get<CalendarStorageData>(NAMESPACE),
    save: (data: CalendarStorageData) => hub.set<CalendarStorageData>(NAMESPACE, data),
  }
}
