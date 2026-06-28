import { describe, it, expect } from 'vitest'
import { lintLine } from './notation-lint'

// ──────────────────────────────────────────────────────
// Helper
// ──────────────────────────────────────────────────────

function lint(text: string) {
  return lintLine(text, 0)
}

function lintAt(text: string, lineFrom: number) {
  return lintLine(text, lineFrom)
}

// ──────────────────────────────────────────────────────
// Rule 1 — @schedule missing end (no /)
// ──────────────────────────────────────────────────────

describe('Rule 1: @schedule missing end (no /)', () => {
  it('warns when @schedule has no slash', () => {
    const results = lint('  - @schedule: 2026-06-01T10:00')
    expect(results).toHaveLength(1)
    expect(results[0].message).toMatch(/終了が設定されていない/)
    expect(results[0].actions).toBeUndefined()
  })

  it('warns for date-only @schedule without slash', () => {
    const results = lint('  - @schedule: 2026-06-01')
    expect(results).toHaveLength(1)
    expect(results[0].message).toMatch(/終了が設定されていない/)
  })

  it('no warning when @schedule has valid slash', () => {
    const results = lint('  - @schedule: 2026-06-01T10:00/2026-06-01T11:00')
    expect(results).toHaveLength(0)
  })
})

// ──────────────────────────────────────────────────────
// Rule 2 — non-ISO date
// ──────────────────────────────────────────────────────

describe('Rule 2: non-ISO date format', () => {
  it('warns on @due with slash-separated date', () => {
    const results = lint('  - @due: 2026/06/30')
    expect(results).toHaveLength(1)
    expect(results[0].message).toMatch(/@due/)
    expect(results[0].actions).toBeUndefined()
  })

  it('warns on @due with date that normalizes to non-ISO', () => {
    const results = lint('  - @due: not-a-date')
    expect(results).toHaveLength(1)
    expect(results[0].message).toMatch(/@due/)
  })

  it('no warning for @due with valid ISO date', () => {
    expect(lint('  - @due: 2026-06-30')).toHaveLength(0)
  })

  it('no warning for @due with 2-digit year (parser normalizes)', () => {
    expect(lint('  - @due: 26-06-30')).toHaveLength(0)
  })

  it('warns when @schedule start part is non-ISO after normalization', () => {
    const results = lint('  - @schedule: foo/2026-06-01T11:00')
    expect(results.some(r => r.message.includes('開始日時'))).toBe(true)
  })

  it('warns when @schedule end part is non-ISO after normalization', () => {
    const results = lint('  - @schedule: 2026-06-01T10:00/bar')
    expect(results.some(r => r.message.includes('終了日時'))).toBe(true)
  })
})

// ──────────────────────────────────────────────────────
// Rule 3 — @meta on same line as task
// ──────────────────────────────────────────────────────

describe('Rule 3: @meta on same line as task', () => {
  it('warns when @due is on the task checkbox line', () => {
    const results = lint('- [ ] タスク @due: 2026-06-30')
    expect(results).toHaveLength(1)
    expect(results[0].message).toMatch(/子リスト/)
    expect(results[0].actions).toBeUndefined()
  })

  it('warns when @schedule is on the task checkbox line', () => {
    const results = lint('- [ ] タスク @schedule: 2026-06-01T10:00/11:00')
    expect(results).toHaveLength(1)
    expect(results[0].message).toMatch(/@schedule/)
  })

  it('warns with indented task checkbox', () => {
    const results = lint('  - [x] Done @due: 2026-01-01')
    expect(results).toHaveLength(1)
  })

  it('no warning on task line without inline @meta', () => {
    expect(lint('- [ ] タスク')).toHaveLength(0)
    expect(lint('- [x] Done')).toHaveLength(0)
  })
})

// ──────────────────────────────────────────────────────
// Rule 4 — wrong separator (〜 / ～ / から / ／)
// ──────────────────────────────────────────────────────

describe('Rule 4: wrong separator', () => {
  it('warns on WAVE DASH 〜 with quickfix', () => {
    const results = lint('  - @schedule: 2026-06-01T10:00〜11:00')
    expect(results.length).toBeGreaterThanOrEqual(1)
    const sep = results.find(r => r.actions?.length)
    expect(sep).toBeDefined()
    expect(sep!.actions![0].name).toBe('/ に修正')
    expect(sep!.actions![0].replacement).toBe('/')
  })

  it('warns on FULLWIDTH TILDE ～ with quickfix', () => {
    const results = lint('  - @schedule: 2026-06-01T10:00～11:00')
    const sep = results.find(r => r.actions?.length)
    expect(sep).toBeDefined()
    expect(sep!.actions![0].replacement).toBe('/')
  })

  it('warns on から with quickfix', () => {
    const results = lint('  - @schedule: 2026-06-01T10:00から11:00')
    const sep = results.find(r => r.actions?.length)
    expect(sep).toBeDefined()
    expect(sep!.actions![0].replacement).toBe('/')
  })

  it('warns on fullwidth slash ／ with quickfix', () => {
    const results = lint('  - @schedule: 2026-06-01T10:00／11:00')
    const sep = results.find(r => r.actions?.length)
    expect(sep).toBeDefined()
    expect(sep!.actions![0].replacement).toBe('/')
  })

  it('quickfix range covers only the wrong separator character', () => {
    const line = '  - @schedule: 2026-06-01T10:00〜11:00'
    const valueStart = line.indexOf('2026')
    const sepIndex = line.indexOf('〜')
    const results = lint(line)
    const sep = results.find(r => r.actions?.length)!
    expect(sep.from).toBe(sepIndex)
    expect(sep.to).toBe(sepIndex + '〜'.length)
  })
})

// ──────────────────────────────────────────────────────
// Valid forms — no false positives
// ──────────────────────────────────────────────────────

describe('Valid forms — no warnings', () => {
  it('full datetime range', () => {
    expect(lint('  - @schedule: 2026-06-01T10:00/2026-06-01T11:00')).toHaveLength(0)
  })

  it('date-only range', () => {
    expect(lint('  - @schedule: 2026-06-01/2026-06-05')).toHaveLength(0)
  })

  it('time-only continuation (short form)', () => {
    expect(lint('  - @schedule: 2026-06-01T10:00/11:00')).toHaveLength(0)
  })

  it('2-digit year with time continuation', () => {
    expect(lint('  - @schedule: 26-06-01T10:00/11:00')).toHaveLength(0)
  })

  it('2-digit year date range', () => {
    expect(lint('  - @schedule: 26-06-01/26-06-05')).toHaveLength(0)
  })

  it('day-only continuation', () => {
    expect(lint('  - @schedule: 2026-06-01/05')).toHaveLength(0)
  })

  it('@due with valid ISO date', () => {
    expect(lint('  - @due: 2026-06-30')).toHaveLength(0)
  })

  it('@priority line — no schedule/due check', () => {
    expect(lint('  - @priority: 1')).toHaveLength(0)
  })

  it('@tags line — no schedule/due check', () => {
    expect(lint('  - @tags: work, urgent')).toHaveLength(0)
  })

  it('regular markdown line', () => {
    expect(lint('This is a normal paragraph.')).toHaveLength(0)
  })

  it('heading', () => {
    expect(lint('## Section title')).toHaveLength(0)
  })
})

// ──────────────────────────────────────────────────────
// Exclusion — blockquote
// ──────────────────────────────────────────────────────

describe('Exclusion: blockquote lines', () => {
  it('no warning for @schedule in blockquote', () => {
    expect(lint('> - @schedule: 2026-06-01T10:00')).toHaveLength(0)
  })

  it('no warning for task checkbox in blockquote', () => {
    expect(lint('> - [ ] タスク @due: 2026-06-30')).toHaveLength(0)
  })

  it('no warning for meta with wrong separator in blockquote', () => {
    expect(lint('> - @schedule: 2026-06-01T10:00〜11:00')).toHaveLength(0)
  })
})

// ──────────────────────────────────────────────────────
// Offset correctness
// ──────────────────────────────────────────────────────

describe('Offset correctness', () => {
  it('from/to are doc-absolute when lineFrom is non-zero', () => {
    const lineFrom = 100
    const line = '  - @schedule: 2026-06-01T10:00'
    const results = lintAt(line, lineFrom)
    expect(results).toHaveLength(1)
    // value starts after "  - @schedule: "
    const valueStart = lineFrom + line.indexOf('2026')
    expect(results[0].from).toBe(valueStart)
    expect(results[0].to).toBe(valueStart + '2026-06-01T10:00'.length)
  })

  it('inline meta from/to points at the @key: token', () => {
    const line = '- [ ] タスク @due: 2026-06-30'
    const results = lint(line)
    expect(results).toHaveLength(1)
    const atIdx = line.indexOf('@due:')
    expect(results[0].from).toBe(atIdx)
    expect(results[0].to).toBe(atIdx + '@due:'.length)
  })
})

// ──────────────────────────────────────────────────────
// Action replacement produces canonical form
// ──────────────────────────────────────────────────────

describe('Quickfix produces canonical form after replacement', () => {
  it('replacing 〜 with / makes the value valid', () => {
    const line = '  - @schedule: 2026-06-01T10:00〜11:00'
    const results = lint(line)
    const sep = results.find(r => r.actions?.length)!
    const fixed =
      line.slice(0, sep.from) + sep.actions![0].replacement + line.slice(sep.to)
    // After fix, re-linting should produce no separator warning
    const fixedResults = lint(fixed)
    expect(fixedResults.find(r => r.actions?.length)).toBeUndefined()
  })
})
