import { describe, it, expect } from 'vitest'
import { DateTime } from 'luxon'
import { parseRepeat, buildRepeat, describeRepeat } from './repeat-format'
import { expandOccurrences } from '../recurrence/expand'

describe('repeat-format', () => {
  it.each([
    'FREQ=YEARLY',
    'FREQ=MONTHLY;BYDAY=1FR',
    'FREQ=MONTHLY;BYDAY=-1FR',
    'FREQ=MONTHLY;BYMONTHDAY=15',
    'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;UNTIL=20261231',
    'FREQ=DAILY;COUNT=10',
  ])('往復: %s', (v) => {
    const f = parseRepeat(v)!
    expect(f).not.toBeNull()
    expect(buildRepeat(f)).toBe(v)
  })
  it('INTERVAL=1 は省略される', () => {
    expect(buildRepeat(parseRepeat('FREQ=DAILY;INTERVAL=1')!)).toBe('FREQ=DAILY')
  })
  it.each(['', 'FOO', 'FREQ=HOURLY', 'FREQ=MONTHLY;BYSETPOS=1;BYDAY=MO', 'FREQ=WEEKLY;BYDAY=1MO', 'FREQ=DAILY;COUNT=2;UNTIL=20261231', 'FREQ=MONTHLY;BYDAY=MO,TU'])(
    '非対応は null: %s',
    (v) => expect(parseRepeat(v)).toBeNull(),
  )
  it('describeRepeat', () => {
    expect(describeRepeat('FREQ=DAILY')).toBe('毎日')
    expect(describeRepeat('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE')).toBe('2週間ごと 月・水')
    expect(describeRepeat('FREQ=MONTHLY;BYDAY=1FR')).toBe('毎月 第1金曜')
    expect(describeRepeat('FREQ=MONTHLY;BYMONTHDAY=15')).toBe('毎月 15日')
    expect(describeRepeat('FREQ=YEARLY')).toBe('毎年')
    expect(describeRepeat('FREQ=DAILY;COUNT=10')).toBe('毎日、10回まで')
    expect(describeRepeat('FREQ=DAILY;UNTIL=20261231')).toBe('毎日、2026/12/31まで')
    expect(describeRepeat('FREQ=MONTHLY;BYSETPOS=1;BYDAY=MO')).toBe('FREQ=MONTHLY;BYSETPOS=1;BYDAY=MO')
  })
  it('buildRepeat の出力が expand で展開できる', () => {
    const repeat = buildRepeat(parseRepeat('FREQ=WEEKLY;BYDAY=MO,WE;COUNT=4')!)
    const occ = expandOccurrences(
      { schedule: '2026-10-05T10:00/2026-10-05T11:00', repeat } as never,
      DateTime.fromISO('2026-10-01'),
      DateTime.fromISO('2026-12-31'),
    )
    expect(occ).toHaveLength(4)
  })
})
