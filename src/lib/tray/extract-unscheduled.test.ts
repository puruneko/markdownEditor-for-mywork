import { describe, it, expect } from 'vitest'
import { parseMarkdown } from '../parser/parse-markdown'
import { extractUnscheduledTasks } from './extract-unscheduled'
import type { SourceEntry } from '../viewmodel/contract'

function src(md: string, path = 'test.md'): SourceEntry[] {
  return [{ path, doc: parseMarkdown(md) }]
}

function srcs(...entries: [string, string][]): SourceEntry[] {
  return entries.map(([md, path]) => ({ path, doc: parseMarkdown(md) }))
}

describe('extractUnscheduledTasks', () => {
  // ----------------------------------------------------------------
  // 基本的な除外条件
  // ----------------------------------------------------------------

  it('done タスクは除外される', () => {
    const items = extractUnscheduledTasks(src('- [x] 完了タスク\n'))
    expect(items).toHaveLength(0)
  })

  it('未完かつ日付なしのタスクは含まれる', () => {
    const items = extractUnscheduledTasks(src('- [ ] 予定なしタスク\n'))
    expect(items).toHaveLength(1)
    expect(items[0].text).toBe('予定なしタスク')
  })

  it('@schedule があるタスクは除外される', () => {
    const items = extractUnscheduledTasks(
      src('- [ ] スケジュール済み\n  - @schedule: 2026-07-01T10:00/2026-07-01T11:00\n'),
    )
    expect(items).toHaveLength(0)
  })

  it('@due があるタスクは除外される', () => {
    const items = extractUnscheduledTasks(src('- [ ] 期限あり\n  - @due: 2026-07-01\n'))
    expect(items).toHaveLength(0)
  })

  // ----------------------------------------------------------------
  // ステータス別
  // ----------------------------------------------------------------

  it('status=doing の日付なしタスクは含まれる', () => {
    const items = extractUnscheduledTasks(src('- [>] 進行中\n'))
    expect(items).toHaveLength(1)
  })

  it('status=blocked の日付なしタスクは含まれる', () => {
    const items = extractUnscheduledTasks(src('- [!] ブロック中\n'))
    expect(items).toHaveLength(1)
  })

  it('status=hold の日付なしタスクは含まれる', () => {
    const items = extractUnscheduledTasks(src('- [-] 保留中\n'))
    expect(items).toHaveLength(1)
  })

  // ----------------------------------------------------------------
  // 複合ケース
  // ----------------------------------------------------------------

  it('日付あり・なし・done が混在すると未完・日付なしだけ返る', () => {
    const md = [
      '- [ ] タスクA',
      '- [ ] タスクB',
      '  - @schedule: 2026-07-01T10:00/2026-07-01T11:00',
      '- [x] 完了C',
      '- [ ] タスクD',
      '  - @due: 2026-07-10',
      '- [>] タスクE',
    ].join('\n')
    const items = extractUnscheduledTasks(src(md))
    const texts = items.map(i => i.text)
    expect(texts).toContain('タスクA')
    expect(texts).toContain('タスクE')
    expect(texts).not.toContain('タスクB')
    expect(texts).not.toContain('完了C')
    expect(texts).not.toContain('タスクD')
  })

  it('セクション内のタスクも抽出される', () => {
    const md = '# プロジェクト\n\n- [ ] セクション内タスク\n'
    const items = extractUnscheduledTasks(src(md))
    expect(items).toHaveLength(1)
    expect(items[0].text).toBe('セクション内タスク')
  })

  // ----------------------------------------------------------------
  // マルチファイル
  // ----------------------------------------------------------------

  it('複数ソースからタスクを集約する', () => {
    const entries = srcs(
      ['- [ ] ファイル1タスク\n', 'a.md'],
      ['- [ ] ファイル2タスク\n', 'b.md'],
    )
    const items = extractUnscheduledTasks(entries)
    expect(items).toHaveLength(2)
    expect(items.find(i => i.sourcePath === 'a.md')).toBeDefined()
    expect(items.find(i => i.sourcePath === 'b.md')).toBeDefined()
  })

  it('ソースパスが TrayItem に正しく記録される', () => {
    const items = extractUnscheduledTasks(src('- [ ] タスク\n', 'notes/work.md'))
    expect(items[0].sourcePath).toBe('notes/work.md')
  })

  // ----------------------------------------------------------------
  // ドラッグペイロード互換性（lineNumber と nodeId）
  // ----------------------------------------------------------------

  it('TrayItem の lineNumber は 0-based でマイナスにならない', () => {
    const items = extractUnscheduledTasks(src('- [ ] タスク\n'))
    expect(items[0].lineNumber).toBeGreaterThanOrEqual(0)
  })

  it('TrayItem の nodeId は空でない', () => {
    const items = extractUnscheduledTasks(src('- [ ] タスク\n'))
    expect(items[0].nodeId).toBeTruthy()
  })

  it('sourcePath・nodeId・lineNumber が issue-phase002-004 の TaskDragPayload 形状を満たす', () => {
    const items = extractUnscheduledTasks(src('- [ ] タスク\n', 'vault/work.md'))
    const { sourcePath, nodeId, lineNumber } = items[0]
    expect(typeof sourcePath).toBe('string')
    expect(typeof nodeId).toBe('string')
    expect(typeof lineNumber).toBe('number')
  })

  // ----------------------------------------------------------------
  // 空ケース
  // ----------------------------------------------------------------

  it('ソースが空配列のとき空を返す', () => {
    expect(extractUnscheduledTasks([])).toHaveLength(0)
  })

  it('全タスクが done のとき空を返す', () => {
    const items = extractUnscheduledTasks(src('- [x] 完了A\n- [x] 完了B\n'))
    expect(items).toHaveLength(0)
  })
})
