import { describe, it, expect } from 'vitest'
import { DateTime } from 'luxon'
import { expandOccurrences } from './expand'
import type { Meta } from '../parser/types'

const rangeStart = DateTime.fromISO('2026-04-01T00:00')
const rangeEnd = DateTime.fromISO('2026-04-30T23:59')

function meta(schedule: string, repeat: string): Meta {
  return { schedule, repeat }
}

describe('expandOccurrences', () => {
  it('WEEKLY;BYDAY=FR: 4月の金曜4件を返す', () => {
    const result = expandOccurrences(
      meta('2026-04-03T10:00/2026-04-03T11:00', 'FREQ=WEEKLY;BYDAY=FR'),
      rangeStart, rangeEnd,
    )
    expect(result).toHaveLength(4)
    result.forEach(occ => {
      // 金曜 = weekday 5
      expect(occ.start.weekday).toBe(5)
    })
  })

  it('各オカレンスの duration が初回 @schedule と一致する', () => {
    const result = expandOccurrences(
      meta('2026-04-03T09:00/2026-04-03T12:00', 'FREQ=WEEKLY;BYDAY=FR'),
      rangeStart, rangeEnd,
    )
    result.forEach(occ => {
      const durationMs = occ.end.toMillis() - occ.start.toMillis()
      expect(durationMs).toBe(3 * 60 * 60 * 1000)
    })
  })

  it('MONTHLY: 毎月1日、範囲内1件', () => {
    const result = expandOccurrences(
      meta('2026-04-01T10:00/2026-04-01T11:00', 'FREQ=MONTHLY;BYMONTHDAY=1'),
      rangeStart, rangeEnd,
    )
    expect(result).toHaveLength(1)
    expect(result[0].start.day).toBe(1)
  })

  it('INTERVAL=2: 隔週金曜', () => {
    const result = expandOccurrences(
      meta('2026-04-03T10:00/2026-04-03T11:00', 'FREQ=WEEKLY;BYDAY=FR;INTERVAL=2'),
      rangeStart, rangeEnd,
    )
    // 4/3, 4/17 の2件
    expect(result).toHaveLength(2)
  })

  it('@repeat がない場合は空配列', () => {
    expect(expandOccurrences({ schedule: '2026-04-03T10:00/2026-04-03T11:00' }, rangeStart, rangeEnd)).toEqual([])
  })

  it('@schedule がない場合は空配列', () => {
    expect(expandOccurrences({ repeat: 'FREQ=WEEKLY;BYDAY=FR' }, rangeStart, rangeEnd)).toEqual([])
  })

  it('不正な RRULE は例外を投げず空配列', () => {
    expect(() => expandOccurrences(
      meta('2026-04-03T10:00/2026-04-03T11:00', 'INVALID_RULE'),
      rangeStart, rangeEnd,
    )).not.toThrow()
    expect(expandOccurrences(
      meta('2026-04-03T10:00/2026-04-03T11:00', 'INVALID_RULE'),
      rangeStart, rangeEnd,
    )).toEqual([])
  })

  it('不正な @schedule は空配列', () => {
    expect(expandOccurrences(
      meta('invalid-schedule', 'FREQ=WEEKLY;BYDAY=FR'),
      rangeStart, rangeEnd,
    )).toEqual([])
  })

  it('start >= end の @schedule は空配列', () => {
    expect(expandOccurrences(
      meta('2026-04-03T12:00/2026-04-03T10:00', 'FREQ=WEEKLY;BYDAY=FR'),
      rangeStart, rangeEnd,
    )).toEqual([])
  })

  it('範囲外のオカレンスは含まない', () => {
    const result = expandOccurrences(
      meta('2026-04-03T10:00/2026-04-03T11:00', 'FREQ=WEEKLY;BYDAY=FR'),
      DateTime.fromISO('2026-04-10T00:00'),
      DateTime.fromISO('2026-04-17T23:59'),
    )
    // 4/10, 4/17 の2件のみ
    expect(result).toHaveLength(2)
  })
})
