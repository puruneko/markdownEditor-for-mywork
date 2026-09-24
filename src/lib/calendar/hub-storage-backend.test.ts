import { describe, it, expect } from 'vitest'
import { createHubStorageBackend } from './hub-storage-backend'
import { ViewSettingsHub } from '../../settings-hub'

function makeMockPlugin() {
  return {
    settings: { viewSettings: {} as Record<string, unknown> },
    saveSettings: async () => {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

describe('createHubStorageBackend', () => {
  it('load() は設定ハブの calendar 名前空間から読み込む', () => {
    const plugin = makeMockPlugin()
    plugin.settings.viewSettings.calendar = { weekSettings: { startHour: 8 } }
    const hub = new ViewSettingsHub(plugin)
    const backend = createHubStorageBackend(hub)

    expect(backend.load()).toEqual({ weekSettings: { startHour: 8 } })
  })

  it('save() は設定ハブの calendar 名前空間へ保存し、他の名前空間に影響しない', () => {
    const plugin = makeMockPlugin()
    plugin.settings.viewSettings.kanban = { headingLevel: 3 }
    const hub = new ViewSettingsHub(plugin)
    const backend = createHubStorageBackend(hub)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    backend.save({ weekSettings: { startHour: 9 } } as any)

    expect(plugin.settings.viewSettings.calendar).toEqual({ weekSettings: { startHour: 9 } })
    expect(plugin.settings.viewSettings.kanban).toEqual({ headingLevel: 3 })
  })
})
