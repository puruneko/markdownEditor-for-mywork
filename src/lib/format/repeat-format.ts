/**
 * issue-phase020-markdownEditor-for-mywork-004: `@repeat` 値（RRULE 文字列、`RRULE:` なし）と
 * 入力支援フォーム値の相互変換・日本語要約。純粋関数のみ（DOM/CM6 非依存）。
 */
export type RepeatFreq = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'
export type Weekday = 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU'

export const WEEKDAYS: readonly Weekday[] = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']
const WEEKDAY_JA: Record<Weekday, string> = { MO: '月', TU: '火', WE: '水', TH: '木', FR: '金', SA: '土', SU: '日' }

export interface RepeatForm {
  freq: RepeatFreq
  interval: number
  /** WEEKLY 用。空なら BYDAY を出力しない（schedule の曜日に従う）。 */
  byWeekday: Weekday[]
  /** MONTHLY 用。'monthday' = 毎月 N 日、'nth-weekday' = 第 N X 曜日。 */
  monthlyMode: 'monthday' | 'nth-weekday'
  byMonthDay: number
  /** 1〜4、または -1（最終）。 */
  nth: number
  nthWeekday: Weekday
  end: 'none' | 'count' | 'until'
  count: number
  /** YYYY-MM-DD */
  until: string
}

export function defaultRepeatForm(): RepeatForm {
  return {
    freq: 'WEEKLY', interval: 1, byWeekday: [], monthlyMode: 'monthday', byMonthDay: 1,
    nth: 1, nthWeekday: 'MO', end: 'none', count: 10, until: '',
  }
}

const FREQS: readonly string[] = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']

/** フォームで表せる RRULE ならフォーム値、それ以外は null。 */
export function parseRepeat(value: string): RepeatForm | null {
  const v = value.trim().replace(/^RRULE:/i, '')
  if (!v) return null
  const form = defaultRepeatForm()
  const seen = new Set<string>()
  for (const part of v.split(';')) {
    const m = /^([A-Z]+)=(.+)$/.exec(part.trim())
    if (!m) return null
    const [, k, val] = m
    if (seen.has(k)) return null
    seen.add(k)
    switch (k) {
      case 'FREQ':
        if (!FREQS.includes(val)) return null
        form.freq = val as RepeatFreq
        break
      case 'INTERVAL': {
        if (!/^\d+$/.test(val) || Number(val) < 1) return null
        form.interval = Number(val)
        break
      }
      case 'BYDAY':
        // 後段で freq を見て解釈する
        break
      case 'BYMONTHDAY': {
        if (!/^\d+$/.test(val)) return null
        const n = Number(val)
        if (n < 1 || n > 31) return null
        form.byMonthDay = n
        form.monthlyMode = 'monthday'
        break
      }
      case 'COUNT': {
        if (!/^\d+$/.test(val) || Number(val) < 1) return null
        form.end = 'count'
        form.count = Number(val)
        break
      }
      case 'UNTIL': {
        const u = /^(\d{4})(\d{2})(\d{2})$/.exec(val)
        if (!u) return null
        form.end = 'until'
        form.until = `${u[1]}-${u[2]}-${u[3]}`
        break
      }
      default:
        return null
    }
  }
  if (!seen.has('FREQ')) return null
  if (seen.has('COUNT') && seen.has('UNTIL')) return null
  const byday = /(?:^|;)BYDAY=([^;]+)/.exec(v)?.[1]
  if (byday !== undefined) {
    if (form.freq === 'WEEKLY') {
      const days = byday.split(',')
      if (!days.every((d) => (WEEKDAYS as readonly string[]).includes(d))) return null
      form.byWeekday = WEEKDAYS.filter((d) => days.includes(d))
    } else if (form.freq === 'MONTHLY') {
      const m = /^(-1|[1-4])(MO|TU|WE|TH|FR|SA|SU)$/.exec(byday)
      if (!m || seen.has('BYMONTHDAY')) return null
      form.monthlyMode = 'nth-weekday'
      form.nth = Number(m[1])
      form.nthWeekday = m[2] as Weekday
    } else {
      return null
    }
  }
  if (seen.has('BYMONTHDAY') && form.freq !== 'MONTHLY') return null
  return form
}

/** フォーム値から RRULE 文字列を作る。INTERVAL=1 は省略、UNTIL は YYYYMMDD。 */
export function buildRepeat(form: RepeatForm): string {
  const parts = [`FREQ=${form.freq}`]
  if (form.interval > 1) parts.push(`INTERVAL=${form.interval}`)
  if (form.freq === 'WEEKLY' && form.byWeekday.length > 0) {
    parts.push(`BYDAY=${WEEKDAYS.filter((d) => form.byWeekday.includes(d)).join(',')}`)
  }
  if (form.freq === 'MONTHLY') {
    if (form.monthlyMode === 'monthday') parts.push(`BYMONTHDAY=${form.byMonthDay}`)
    else parts.push(`BYDAY=${form.nth}${form.nthWeekday}`)
  }
  if (form.end === 'count') parts.push(`COUNT=${form.count}`)
  else if (form.end === 'until' && form.until) parts.push(`UNTIL=${form.until.replace(/-/g, '')}`)
  return parts.join(';')
}

/** 日本語の要約。フォーム非対応の値はそのまま返す。 */
export function describeRepeat(value: string): string {
  const f = parseRepeat(value)
  if (!f) return value
  const n = f.interval
  let s: string
  switch (f.freq) {
    case 'DAILY': s = n > 1 ? `${n}日ごと` : '毎日'; break
    case 'WEEKLY': {
      s = n > 1 ? `${n}週間ごと` : '毎週'
      if (f.byWeekday.length) s += ' ' + f.byWeekday.map((d) => WEEKDAY_JA[d]).join('・')
      break
    }
    case 'MONTHLY': {
      s = n > 1 ? `${n}か月ごと` : '毎月'
      s += f.monthlyMode === 'monthday'
        ? ` ${f.byMonthDay}日`
        : ` ${f.nth === -1 ? '最終' : `第${f.nth}`}${WEEKDAY_JA[f.nthWeekday]}曜`
      break
    }
    default: s = n > 1 ? `${n}年ごと` : '毎年'
  }
  if (f.end === 'count') s += `、${f.count}回まで`
  else if (f.end === 'until') s += `、${f.until.replace(/-/g, '/')}まで`
  return s
}
