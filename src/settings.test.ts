import { describe, it, expect } from 'vitest'
import { migrateSettings, parseFrequentMetaKeys } from './settings'

describe('migrateSettings', () => {
  it.each([
    [{ roundMinuteStep: true }, 15],
    [{ roundMinuteStep: false }, 1],
    [{}, 15],
    [{ minuteStep: 5 }, 5],
    [{ minuteStep: 20 }, 20],
    [{ minuteStep: 7 }, 15],
    [null, 15],
  ])('%j → %i', (raw, expected) => {
    const r = migrateSettings(raw)
    expect(r.minuteStep).toBe(expected)
    expect('roundMinuteStep' in r).toBe(false)
  })
})

describe('frequentMetaKeys（issue-phase020-003）', () => {
  it('undefined/不正値 → [memo]、[] は尊重', () => {
    expect(migrateSettings({}).frequentMetaKeys).toEqual(['memo'])
    expect(migrateSettings({ frequentMetaKeys: 5 }).frequentMetaKeys).toEqual(['memo'])
    expect(migrateSettings({ frequentMetaKeys: [] }).frequentMetaKeys).toEqual([])
    expect(migrateSettings({ frequentMetaKeys: ['a'] }).frequentMetaKeys).toEqual(['a'])
  })
  it('parseFrequentMetaKeys: 空・重複・日付系を除外', () => {
    expect(parseFrequentMetaKeys('memo, , memo、due, 場所, schedule')).toEqual(['memo', '場所'])
  })
})
