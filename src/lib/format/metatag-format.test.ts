import { describe, it, expect } from 'vitest'
import {
  formatMetaDateValue,
  parseMetaDateValue,
  buildMetaDateValue,
  roundUpTo5Min,
  nowRounded,
  nowExact,
} from './metatag-format'

describe('formatMetaDateValue', () => {
  it('日付のみ（終日）はyyyyを省略した M/D になる', () => {
    expect(formatMetaDateValue('2026-09-17')).toBe('9/17')
  })

  it('日時は yyyy を省略し T をスペースに置き換える', () => {
    expect(formatMetaDateValue('2026-09-17T14:00')).toBe('9/17 14:00')
  })

  it('同日範囲は日付を1回だけ表示し時刻を〜で繋ぐ', () => {
    expect(formatMetaDateValue('2026-09-17T14:00/2026-09-17T16:00')).toBe('9/17 14:00〜16:00')
  })

  it('日付が異なる範囲は両端を完全表示する', () => {
    expect(formatMetaDateValue('2026-09-17T22:00/2026-09-18T01:00')).toBe('9/17 22:00〜9/18 01:00')
  })

  it('終日どうしの範囲（日付のみ）は M/D〜M/D になる', () => {
    expect(formatMetaDateValue('2026-09-17/2026-09-19')).toBe('9/17〜9/19')
  })

  it('終日どうしの同日範囲は単一の M/D になる', () => {
    expect(formatMetaDateValue('2026-09-17/2026-09-17')).toBe('9/17')
  })

  it('1桁月日はゼロ埋めしない', () => {
    expect(formatMetaDateValue('2026-01-05')).toBe('1/5')
  })
})

describe('parseMetaDateValue / buildMetaDateValue の往復', () => {
  it('日付のみ（終日）', () => {
    const parsed = parseMetaDateValue('2026-09-17')
    expect(parsed).toEqual({
      startDate: '2026-09-17',
      startTime: null,
      isRange: false,
      endDate: null,
      endTime: null,
    })
    expect(buildMetaDateValue(parsed)).toBe('2026-09-17')
  })

  it('日時', () => {
    const parsed = parseMetaDateValue('2026-09-17T14:00')
    expect(parsed.startTime).toBe('14:00')
    expect(buildMetaDateValue(parsed)).toBe('2026-09-17T14:00')
  })

  it('範囲（日時）', () => {
    const parsed = parseMetaDateValue('2026-09-17T14:00/2026-09-17T16:00')
    expect(parsed).toEqual({
      startDate: '2026-09-17',
      startTime: '14:00',
      isRange: true,
      endDate: '2026-09-17',
      endTime: '16:00',
    })
    expect(buildMetaDateValue(parsed)).toBe('2026-09-17T14:00/2026-09-17T16:00')
  })

  it('範囲（終日のみ）', () => {
    const parsed = parseMetaDateValue('2026-09-17/2026-09-19')
    expect(buildMetaDateValue(parsed)).toBe('2026-09-17/2026-09-19')
  })

  it('buildMetaDateValue: isRangeがtrueでもendDateがnullなら単一値を返す', () => {
    expect(
      buildMetaDateValue({ startDate: '2026-09-17', startTime: null, isRange: true, endDate: null, endTime: null }),
    ).toBe('2026-09-17')
  })
})

describe('roundUpTo5Min', () => {
  it(':00 はそのまま', () => {
    expect(roundUpTo5Min('2026-09-17', '10:00')).toEqual({ date: '2026-09-17', time: '10:00' })
  })

  it(':01 は :05 へ切り上げ', () => {
    expect(roundUpTo5Min('2026-09-17', '10:01')).toEqual({ date: '2026-09-17', time: '10:05' })
  })

  it(':55 はそのまま（既に5分単位）', () => {
    expect(roundUpTo5Min('2026-09-17', '10:55')).toEqual({ date: '2026-09-17', time: '10:55' })
  })

  it(':58 は翌時0分へ切り上げ', () => {
    expect(roundUpTo5Min('2026-09-17', '10:58')).toEqual({ date: '2026-09-17', time: '11:00' })
  })

  it('23:58 は日をまたいで翌日00:00へ切り上げ', () => {
    expect(roundUpTo5Min('2026-09-17', '23:58')).toEqual({ date: '2026-09-18', time: '00:00' })
  })

  it('月末23:58は翌月1日00:00へ切り上げ', () => {
    expect(roundUpTo5Min('2026-09-30', '23:58')).toEqual({ date: '2026-10-01', time: '00:00' })
  })

  it('年末23:58は翌年1月1日00:00へ切り上げ', () => {
    expect(roundUpTo5Min('2026-12-31', '23:58')).toEqual({ date: '2027-01-01', time: '00:00' })
  })
})

describe('nowRounded', () => {
  it('秒未満の端数があれば5分単位に切り上げる', () => {
    expect(nowRounded(new Date(2026, 8, 17, 10, 32, 10))).toEqual({ date: '2026-09-17', time: '10:35' })
  })

  it('ちょうど5分単位・秒0なら切り上げない', () => {
    expect(nowRounded(new Date(2026, 8, 17, 10, 30, 0))).toEqual({ date: '2026-09-17', time: '10:30' })
  })

  it('年末23:58台は翌年1月1日00:00へ切り上げる', () => {
    expect(nowRounded(new Date(2026, 11, 31, 23, 58, 30))).toEqual({ date: '2027-01-01', time: '00:00' })
  })
})

describe('nowExact（issue-phase014-markdownEditor-003: 5分単位OFF時のnowボタン用）', () => {
  it('丸めずに現在時刻をそのまま（分単位）返す', () => {
    expect(nowExact(new Date(2026, 8, 17, 10, 32, 10))).toEqual({ date: '2026-09-17', time: '10:32' })
  })

  it('秒が0でもそのまま（境界での丸め上げが起きない）', () => {
    expect(nowExact(new Date(2026, 8, 17, 10, 31, 0))).toEqual({ date: '2026-09-17', time: '10:31' })
  })
})
