/**
 * Normalizes abbreviated schedule/due strings to canonical ISO format.
 *
 * Supported abbreviations (applied in order):
 *   1. Continuation  — end part omits the same prefix as start
 *        26-01-01T10:00/11:30  →  26-01-01T10:00/26-01-01T11:30  (time-only end)
 *        26-01-01/02           →  26-01-01/26-01-02               (day-only end)
 *   2. 2-digit year  — leading YY expands to 20YY
 *        26-01-01  →  2026-01-01
 *   3. Omitted minutes — THH appends :00
 *        2026-01-01T10  →  2026-01-01T10:00
 */

/** Normalize a @schedule value: "start/end" with optional abbreviations. */
export function normalizeSchedule(raw: string): string {
  const slashIdx = raw.indexOf('/')
  if (slashIdx === -1) return expandDateStr(raw.trim())

  const rawStart = raw.slice(0, slashIdx).trim()
  let rawEnd = raw.slice(slashIdx + 1).trim()

  // Step 1: continuation expansion — end has no '-' means it is a partial suffix
  if (!rawEnd.includes('-')) {
    if (rawStart.includes('T')) {
      // Time-only end: borrow the date part from start
      const datePart = rawStart.split('T')[0]
      rawEnd = `${datePart}T${rawEnd}`
    } else {
      // Day-only end: borrow year-month from start
      const parts = rawStart.split('-')
      if (parts.length === 3) {
        rawEnd = `${parts[0]}-${parts[1]}-${rawEnd.padStart(2, '0')}`
      }
    }
  }

  // Steps 2 & 3 applied to both halves
  return `${expandDateStr(rawStart)}/${expandDateStr(rawEnd)}`
}

/** Normalize a @due value (single date). */
export function normalizeDue(raw: string): string {
  return expandDateStr(raw.trim())
}

/** Expand 2-digit year and omitted minutes in a single date/datetime string. */
function expandDateStr(s: string): string {
  // 2-digit year: "26-..." → "2026-..."
  s = s.replace(/^(\d{2})-/, '20$1-')
  // Omitted minutes: "T10" → "T10:00"
  s = s.replace(/T(\d{2})$/, 'T$1:00')
  return s
}
