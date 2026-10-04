import { describe, it, expect } from 'vitest'
import { DateTime } from 'luxon'
import { mergeInitialGanttConfig, mergePersistedGanttConfig } from './gantt-config-merge'
import { buildTreeCellEditPatcher, formatTreeCellDateValue, formatTreeCellPickerInitialValue } from './tree-cell-edit'
import { upsertPlan } from '../patch/upsert-meta'

const node = (text = 'A', status = 'ready') => ({ lineNumber: 0, text, status }) as never

describe('gantt-config-merge', () => {
  it('保存値で上書きするが mode/dayWidth/defaultDurationMinutes は除外', () => {
    const r = mergeInitialGanttConfig(
      { mode: 'controlled', dayWidth: 30, defaultDurationMinutes: 60 },
      { rowHeight: 40, mode: 'uncontrolled', dayWidth: 99, defaultDurationMinutes: 5 } as never,
    )
    expect(r).toEqual({ mode: 'controlled', dayWidth: 30, defaultDurationMinutes: 60, rowHeight: 40 })
  })
  it('保存対象キーのみ既存へマージ', () => {
    const r = mergePersistedGanttConfig({ rowHeight: 40 }, { fontSize: 14, dayWidth: 10, mode: 'controlled' } as never)
    expect(r).toEqual({ rowHeight: 40, fontSize: 14 })
  })
})

describe('tree-cell-edit', () => {
  const s = DateTime.fromISO('2026-07-10T10:00')
  const e = DateTime.fromISO('2026-07-10T11:00')
  it('書式化', () => {
    expect(formatTreeCellDateValue({ start: s, end: e })).toBe('2026-07-10T10:00/2026-07-10T11:00')
    expect(formatTreeCellDateValue(s)).toBe('2026-07-10T10:00')
  })
  it('name は patchTaskTitle', () => {
    const p = buildTreeCellEditPatcher({ nodeId: 'k', key: 'name', value: 'B' })!
    expect(p('- [ ] A', {} as never, node())).toBe('- [ ] B')
  })
  it('plan は挿入・? 保持', () => {
    const p = buildTreeCellEditPatcher({ nodeId: 'k', key: 'plan', value: s })!
    expect(p('- [ ] A', {} as never, node())).toBe('- [ ] A\n  - @plan: 2026-07-10T10:00')
    expect(upsertPlan('- [ ] A\n  - @plan?: x', node(), 'y')).toBe('- [ ] A\n  - @plan?: y')
  })
  it('due/schedule', () => {
    const d = buildTreeCellEditPatcher({ nodeId: 'k', key: 'due', value: s })!
    expect(d('- [ ] A', {} as never, node())).toContain('@due: 2026-07-10T10:00')
    const sc = buildTreeCellEditPatcher({ nodeId: 'k', key: 'schedule', value: { start: s, end: e } })!
    expect(sc('- [ ] A', {} as never, node())).toContain('@schedule: 2026-07-10T10:00/2026-07-10T11:00')
  })
})

describe('formatTreeCellPickerInitialValue', () => {
  const a = DateTime.fromISO('2026-10-03T09:00')
  const b = DateTime.fromISO('2026-10-03T10:00')
  it('null → 空 / 単一 / 期間', () => {
    expect(formatTreeCellPickerInitialValue(null, null)).toBe('')
    expect(formatTreeCellPickerInitialValue(a, null)).toBe('2026-10-03T09:00')
    expect(formatTreeCellPickerInitialValue(a, b)).toBe('2026-10-03T09:00/2026-10-03T10:00')
  })
})
