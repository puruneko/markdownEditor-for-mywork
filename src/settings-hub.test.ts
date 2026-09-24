import { describe, it, expect, vi } from 'vitest'
import { ViewSettingsHub } from './settings-hub'

function makeMockPlugin() {
  return {
    settings: { viewSettings: {} as Record<string, unknown> },
    saveSettings: vi.fn().mockResolvedValue(undefined),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

describe('ViewSettingsHub', () => {
  it('未保存の namespace は空オブジェクトを返す', () => {
    const plugin = makeMockPlugin()
    const hub = new ViewSettingsHub(plugin)
    expect(hub.get('calendar')).toEqual({})
  })

  it('set() で namespace ごとに値を保存し、get() で読み戻せる', () => {
    const plugin = makeMockPlugin()
    const hub = new ViewSettingsHub(plugin)

    hub.set('kanban', { headingLevel: 3 })

    expect(hub.get('kanban')).toEqual({ headingLevel: 3 })
    expect(plugin.settings.viewSettings.kanban).toEqual({ headingLevel: 3 })
  })

  it('set() は data.json への保存（plugin.saveSettings）を呼ぶ', () => {
    const plugin = makeMockPlugin()
    const hub = new ViewSettingsHub(plugin)

    hub.set('calendar', { weekSettings: { startHour: 8 } })

    expect(plugin.saveSettings).toHaveBeenCalledTimes(1)
  })

  it('異なる namespace は互いに独立している', () => {
    const plugin = makeMockPlugin()
    const hub = new ViewSettingsHub(plugin)

    hub.set('calendar', { a: 1 })
    hub.set('kanban', { b: 2 })

    expect(hub.get('calendar')).toEqual({ a: 1 })
    expect(hub.get('kanban')).toEqual({ b: 2 })
  })
})
