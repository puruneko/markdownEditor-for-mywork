import { RRule } from 'rrule'
import { DateTime } from 'luxon'
import type { Meta } from '../parser/types'

export type OccurrenceRange = { start: DateTime; end: DateTime }

/**
 * @schedule 開始を起点に @repeat RRULE を展開し、
 * [rangeStart, rangeEnd] 内に収まるオカレンスの start/end 配列を返す。
 * @repeat が無い・不正・@schedule が無い場合は空配列を返す。
 * 各オカレンスの duration は @schedule 初回の duration を維持する。
 */
export function expandOccurrences(
  meta: Meta,
  rangeStart: DateTime,
  rangeEnd: DateTime,
): OccurrenceRange[] {
  if (!meta.repeat || !meta.schedule) return []

  const parts = meta.schedule.split('/')
  if (parts.length !== 2) return []

  const scheduleStart = DateTime.fromISO(parts[0].trim())
  const scheduleEnd = DateTime.fromISO(parts[1].trim())

  if (!scheduleStart.isValid || !scheduleEnd.isValid) return []
  if (scheduleStart >= scheduleEnd) return []

  const durationMs = scheduleEnd.toMillis() - scheduleStart.toMillis()

  try {
    const rule = RRule.fromString(`DTSTART:${scheduleStart.toUTC().toFormat("yyyyMMdd'T'HHmmss'Z'")}\nRRULE:${meta.repeat}`)
    const occurrences = rule.between(
      rangeStart.toJSDate(),
      rangeEnd.toJSDate(),
      true,
    )
    return occurrences.map(jsDate => {
      const start = DateTime.fromJSDate(jsDate, { zone: scheduleStart.zone })
      return { start, end: start.plus(durationMs) }
    })
  } catch {
    return []
  }
}
