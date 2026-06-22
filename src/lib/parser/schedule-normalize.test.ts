import { describe, it, expect } from 'vitest'
import { normalizeSchedule, normalizeDue } from './schedule-normalize'

describe('normalizeSchedule', () => {
  // ---- already-canonical passthrough ----

  it('passes through full datetime range unchanged', () => {
    expect(normalizeSchedule('2026-01-01T10:00/2026-01-01T11:30'))
      .toBe('2026-01-01T10:00/2026-01-01T11:30')
  })

  it('passes through full date range unchanged', () => {
    expect(normalizeSchedule('2026-06-01/2026-06-05'))
      .toBe('2026-06-01/2026-06-05')
  })

  // ---- 2-digit year ----

  it('expands 2-digit year in both halves', () => {
    expect(normalizeSchedule('26-01-01T10:00/26-01-01T11:30'))
      .toBe('2026-01-01T10:00/2026-01-01T11:30')
  })

  it('expands 2-digit year in date-only range', () => {
    expect(normalizeSchedule('26-06-01/26-06-05'))
      .toBe('2026-06-01/2026-06-05')
  })

  // ---- omitted minutes ----

  it('expands omitted minutes in start', () => {
    expect(normalizeSchedule('2026-01-01T10/2026-01-01T11:30'))
      .toBe('2026-01-01T10:00/2026-01-01T11:30')
  })

  it('expands omitted minutes in end', () => {
    expect(normalizeSchedule('2026-01-01T10:00/2026-01-01T11'))
      .toBe('2026-01-01T10:00/2026-01-01T11:00')
  })

  it('expands omitted minutes in both halves', () => {
    expect(normalizeSchedule('26-01-01T10/26-01-01T11'))
      .toBe('2026-01-01T10:00/2026-01-01T11:00')
  })

  // ---- time-only continuation ----

  it('expands time-only end (HH:mm)', () => {
    expect(normalizeSchedule('26-01-01T10:00/11:30'))
      .toBe('2026-01-01T10:00/2026-01-01T11:30')
  })

  it('expands time-only end with omitted minutes', () => {
    expect(normalizeSchedule('26-01-01T10/11'))
      .toBe('2026-01-01T10:00/2026-01-01T11:00')
  })

  it('expands time-only end when start has 4-digit year', () => {
    expect(normalizeSchedule('2026-01-01T10:00/11:30'))
      .toBe('2026-01-01T10:00/2026-01-01T11:30')
  })

  // ---- day-only continuation ----

  it('expands day-only end (2-digit, zero-padded)', () => {
    expect(normalizeSchedule('26-01-01/02'))
      .toBe('2026-01-01/2026-01-02')
  })

  it('expands day-only end (1-digit)', () => {
    expect(normalizeSchedule('26-01-01/2'))
      .toBe('2026-01-01/2026-01-02')
  })

  it('expands day-only end when start has 4-digit year', () => {
    expect(normalizeSchedule('2026-01-01/02'))
      .toBe('2026-01-01/2026-01-02')
  })

  // ---- combined ----

  it('combines 2-digit year + time continuation', () => {
    expect(normalizeSchedule('26-06-27T08:00/12:00'))
      .toBe('2026-06-27T08:00/2026-06-27T12:00')
  })

  it('combines 2-digit year + omit minutes + time continuation', () => {
    expect(normalizeSchedule('26-06-27T08/12'))
      .toBe('2026-06-27T08:00/2026-06-27T12:00')
  })

  it('combines 2-digit year + day continuation', () => {
    expect(normalizeSchedule('26-06-01/05'))
      .toBe('2026-06-01/2026-06-05')
  })

  // ---- no slash (single date) ----

  it('expands single date with 2-digit year', () => {
    expect(normalizeSchedule('26-06-15'))
      .toBe('2026-06-15')
  })
})

describe('normalizeDue', () => {
  it('passes through full date unchanged', () => {
    expect(normalizeDue('2026-06-15')).toBe('2026-06-15')
  })

  it('expands 2-digit year', () => {
    expect(normalizeDue('26-06-15')).toBe('2026-06-15')
  })

  it('trims surrounding whitespace', () => {
    expect(normalizeDue('  26-06-15  ')).toBe('2026-06-15')
  })
})
