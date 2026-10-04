import { describe, it, expect, vi } from 'vitest'
vi.mock('obsidian', () => ({ Setting: class {} }))
vi.mock('svelte-calendar-lib', () => ({
  DEFAULT_STORAGE_DATA: {
    weekSettings: { startHour: 0, endHour: 24, minorTick: 15, majorTick: 60, showWeekend: true, showAllDay: true, showPlanBand: true, weekStartsOn: 1 },
    monthSettings: { maxItemsPerDay: 3, weekStartsOn: 1, showWeekend: true, showAllDay: true, showSingleDay: true, showTaskTime: false },
    businessHours: { enabled: true },
  },
}))
import { setNested, parseIntInRange } from './settings-view-sections'

describe('setNested', () => {
  it('未保存でも入れ子を作る', () => {
    expect(setNested({}, ['weekSettings', 'startHour'], 8)).toEqual({ weekSettings: { startHour: 8 } })
  })
  it('他キーを保持し元を変更しない', () => {
    const orig = { lanes: [1], weekSettings: { endHour: 20 } }
    const r = setNested(orig, ['weekSettings', 'startHour'], 8)
    expect(r).toEqual({ lanes: [1], weekSettings: { endHour: 20, startHour: 8 } })
    expect(orig.weekSettings).toEqual({ endHour: 20 })
  })
})

describe('parseIntInRange', () => {
  it('範囲内は数値', () => expect(parseIntInRange('5', 1, 10)).toBe(5))
  it('範囲外・非数値は null', () => {
    expect(parseIntInRange('0', 1, 10)).toBeNull()
    expect(parseIntInRange('abc', 1, 10)).toBeNull()
    expect(parseIntInRange('1.5', 1, 10)).toBeNull()
  })
})
