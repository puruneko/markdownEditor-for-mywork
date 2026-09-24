import { describe, it, expect } from 'vitest'
import { formatMetaDateValue, parseMetaDateValue, buildMetaDateValue } from './metatag-format'

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
