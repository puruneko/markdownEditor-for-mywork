import { afterEach, describe, expect, it } from 'vitest'
import { getMetaKeyNames, normalizeMetaKey, setUserMetaKeyAliases, validateUserMetaKeyAliases } from './meta-keys'

afterEach(() => setUserMetaKeyAliases({}))

describe('user meta key aliases (issue-phase019-001)', () => {
  it('validates each rule', () => {
    const r = validateUserMetaKeyAliases({
      schedule: ['作業時間', ' やる時間 ', '作業時間', 'a-b', 'plan', '実施日時', ''],
      due: ['作業時間', 'しめきり'],
    })
    expect(r.aliases.schedule).toEqual(['作業時間', 'やる時間'])
    expect(r.aliases.due).toEqual(['しめきり'])
    expect(r.errors).toHaveLength(4)
  })
  it('resolves and lists names', () => {
    expect(normalizeMetaKey('作業時間')).toBeNull()
    setUserMetaKeyAliases({ schedule: ['作業時間'] })
    expect(normalizeMetaKey('作業時間')).toBe('schedule')
    expect(normalizeMetaKey('実施日時')).toBe('schedule')
    expect(getMetaKeyNames('schedule')).toEqual(['schedule', '実施日時', '作業時間'])
  })
})
