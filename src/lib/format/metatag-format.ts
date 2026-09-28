/**
 * 日付系メタ（@plan / @schedule / @due）の表示整形・パース・組み立て。
 *
 * issue-phase003-008（2026-09-17 増分）: wysiwyg（Live Preview）表示用の
 * 「メタタグ表示」（yyyy省略・T区切り除去）を生成する単一の情報源。
 * 入力は schedule-normalize.ts が生成する正規形（YYYY-MM-DD または
 * YYYY-MM-DDTHH:mm、`/` 区切りの範囲を許容）を前提とする。
 */

export type DateMetaKey = 'plan' | 'schedule' | 'due'

/** wysiwygチップの先頭に表示するキーラベル（日本語・表示専用）。 */
export const META_DATE_KEY_LABEL: Readonly<Record<DateMetaKey, string>> = {
  plan: '計画',
  schedule: '予定',
  due: '期限',
}

export function isDateMetaKey(key: string): key is DateMetaKey {
  return key === 'plan' || key === 'schedule' || key === 'due'
}

type DatePart = { date: string; time: string | null }

function splitDateTime(part: string): DatePart {
  const tIdx = part.indexOf('T')
  if (tIdx === -1) return { date: part, time: null }
  return { date: part.slice(0, tIdx), time: part.slice(tIdx + 1) }
}

/** "YYYY-MM-DD" → "M/D"（year省略・ゼロ埋めなし）。不正な形式はそのまま返す。 */
function formatDate(date: string): string {
  const m = date.match(/^\d{4}-(\d{2})-(\d{2})$/)
  if (!m) return date
  return `${parseInt(m[1], 10)}/${parseInt(m[2], 10)}`
}

/** 単一の日付/日時部分を表示形式へ整形する（"M/D" または "M/D HH:mm"）。 */
function formatSinglePart(part: string): string {
  const { date, time } = splitDateTime(part)
  const formattedDate = formatDate(date)
  return time ? `${formattedDate} ${time}` : formattedDate
}

/**
 * 正規形の日付系メタ値を、wysiwyg表示用の人間可読な文字列へ整形する。
 * yyyyを省略し、`T`区切りを半角スペースに置き換え、範囲の同日圧縮を行う。
 */
export function formatMetaDateValue(value: string): string {
  const slashIdx = value.indexOf('/')
  if (slashIdx === -1) return formatSinglePart(value)

  const startRaw = value.slice(0, slashIdx)
  const endRaw = value.slice(slashIdx + 1)
  const start = splitDateTime(startRaw)
  const end = splitDateTime(endRaw)

  if (start.date === end.date) {
    if (start.time && end.time) {
      return `${formatDate(start.date)} ${start.time}〜${end.time}`
    }
    // 終日どうしの同日範囲は単一日付表示にする。
    return formatDate(start.date)
  }

  return `${formatSinglePart(startRaw)}〜${formatSinglePart(endRaw)}`
}

export type ParsedMetaDate = {
  startDate: string
  /** null = 終日（時刻未指定） */
  startTime: string | null
  isRange: boolean
  endDate: string | null
  endTime: string | null
}

/** 正規形の日付系メタ値をピッカーの初期値へパースする。 */
export function parseMetaDateValue(value: string): ParsedMetaDate {
  const slashIdx = value.indexOf('/')
  if (slashIdx === -1) {
    const { date, time } = splitDateTime(value)
    return { startDate: date, startTime: time, isRange: false, endDate: null, endTime: null }
  }
  const start = splitDateTime(value.slice(0, slashIdx))
  const end = splitDateTime(value.slice(slashIdx + 1))
  return {
    startDate: start.date,
    startTime: start.time,
    isRange: true,
    endDate: end.date,
    endTime: end.time,
  }
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function toDateTimeParts(dt: Date): { date: string; time: string } {
  return {
    date: `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`,
    time: `${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`,
  }
}

/** 分を5分単位へ切り上げる（秒未満の端数があれば0分でも切り上げる）。日跨ぎ・月末・年末をまたぐ場合もDateの繰り上がりに委ねる。 */
function roundUpDate5Min(dt: Date): Date {
  const rounded = new Date(dt.getTime())
  const remainder = rounded.getMinutes() % 5
  const hasSubMinuteFraction = rounded.getSeconds() > 0 || rounded.getMilliseconds() > 0
  if (remainder !== 0 || hasSubMinuteFraction) {
    rounded.setMinutes(rounded.getMinutes() + (5 - remainder))
  }
  rounded.setSeconds(0, 0)
  return rounded
}

/** "YYYY-MM-DD" と "HH:mm" を受け取り、5分単位に切り上げた日付・時刻を返す。 */
export function roundUpTo5Min(date: string, time: string): { date: string; time: string } {
  const [y, mo, d] = date.split('-').map(Number)
  const [h, mi] = time.split(':').map(Number)
  return toDateTimeParts(roundUpDate5Min(new Date(y, mo - 1, d, h, mi)))
}

/** 現在時刻（Date）を受け取り、5分単位に切り上げた日付・時刻を返す。 */
export function nowRounded(now: Date): { date: string; time: string } {
  return toDateTimeParts(roundUpDate5Min(now))
}

/**
 * issue-phase014-markdownEditor-003: プラグイン設定「5分単位」がOFFのときの
 * nowボタン用。丸めを行わず、現在時刻をそのまま（分単位）返す。
 */
export function nowExact(now: Date): { date: string; time: string } {
  return toDateTimeParts(now)
}

/** ピッカー入力から正規形の日付系メタ値を組み立てる。 */
export function buildMetaDateValue(parsed: {
  startDate: string
  startTime: string | null
  isRange: boolean
  endDate: string | null
  endTime: string | null
}): string {
  const startPart = parsed.startTime ? `${parsed.startDate}T${parsed.startTime}` : parsed.startDate
  if (!parsed.isRange || !parsed.endDate) return startPart
  const endPart = parsed.endTime ? `${parsed.endDate}T${parsed.endTime}` : parsed.endDate
  return `${startPart}/${endPart}`
}
