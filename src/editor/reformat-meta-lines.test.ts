import { describe, it, expect } from 'vitest'
import { reformatMetaLines, findMisplacedMetaLineIndices } from './reformat-meta-lines'

describe('reformatMetaLines — メタが既に直下（変更なし）', () => {
  it('すでに直下にあるメタ行は動かさない', () => {
    const md = '- [ ] タスクA\n  - @schedule: 2026-07-10T10:00/2026-07-10T11:00\n  - サブタスク\n'
    const { result, movedCount } = reformatMetaLines(md)
    expect(result).toBe(md)
    expect(movedCount).toBe(0)
  })

  it('メタ行が存在しないタスクは変更しない', () => {
    const md = '- [ ] タスクA\n  - サブタスク1\n  - サブタスク2\n'
    const { result, movedCount } = reformatMetaLines(md)
    expect(result).toBe(md)
    expect(movedCount).toBe(0)
  })
})

describe('reformatMetaLines — サブタスクの後', () => {
  it('サブタスクの後にあるメタ行を直下へ移動する', () => {
    const md = [
      '- [ ] タスクA',
      '  - サブタスク',
      '  - @schedule: 2026-07-10T10:00/2026-07-10T11:00',
    ].join('\n') + '\n'
    const { result, movedCount } = reformatMetaLines(md)
    expect(result).toBe([
      '- [ ] タスクA',
      '  - @schedule: 2026-07-10T10:00/2026-07-10T11:00',
      '  - サブタスク',
    ].join('\n') + '\n')
    expect(movedCount).toBe(1)
  })

  it('ネストしたサブタスクの後にあるメタ行も直下へ移動する', () => {
    const md = [
      '- [ ] タスクA',
      '  - [ ] サブタスク',
      '    - @due: 2026-07-01',
      '  - @schedule: 2026-07-10T10:00/2026-07-10T11:00',
    ].join('\n') + '\n'
    const { result } = reformatMetaLines(md)
    const lines = result.split('\n')
    expect(lines[1]).toBe('  - @schedule: 2026-07-10T10:00/2026-07-10T11:00')
    expect(lines[2]).toBe('  - [ ] サブタスク')
    // サブタスク自身の子（@due）はサブタスクの直下のまま動かない
    expect(lines[3]).toBe('    - @due: 2026-07-01')
  })
})

describe('reformatMetaLines — メモを挟む', () => {
  it('メモの後にあるメタ行を直下へ移動する', () => {
    const md = [
      '- [ ] タスクA',
      '  - メモ',
      '  - @due: 2026-07-15',
    ].join('\n') + '\n'
    const { result, movedCount } = reformatMetaLines(md)
    expect(result).toBe([
      '- [ ] タスクA',
      '  - @due: 2026-07-15',
      '  - メモ',
    ].join('\n') + '\n')
    expect(movedCount).toBe(1)
  })
})

describe('reformatMetaLines — 複数メタ', () => {
  it('複数のメタ行を相対順序を保ったまま直下へまとめる', () => {
    const md = [
      '- [ ] タスクA',
      '  - サブタスク',
      '  - @schedule: 2026-07-10T10:00/2026-07-10T11:00',
      '  - メモ',
      '  - @due: 2026-07-15',
    ].join('\n') + '\n'
    const { result, movedCount } = reformatMetaLines(md)
    expect(result).toBe([
      '- [ ] タスクA',
      '  - @schedule: 2026-07-10T10:00/2026-07-10T11:00',
      '  - @due: 2026-07-15',
      '  - サブタスク',
      '  - メモ',
    ].join('\n') + '\n')
    expect(movedCount).toBe(2)
  })

  it('複数タスクを1回のコマンドですべて整形する', () => {
    const md = [
      '- [ ] タスクA',
      '  - サブタスク',
      '  - @due: 2026-07-01',
      '- [ ] タスクB',
      '  - メモ',
      '  - @due: 2026-07-02',
    ].join('\n') + '\n'
    const { result, movedCount } = reformatMetaLines(md)
    const lines = result.split('\n')
    expect(lines[1]).toBe('  - @due: 2026-07-01')
    expect(lines[4]).toBe('  - @due: 2026-07-02')
    expect(movedCount).toBe(2)
  })
})

describe('reformatMetaLines — 冪等性', () => {
  it('2回連続で実行しても2回目は無変更', () => {
    const md = [
      '- [ ] タスクA',
      '  - サブタスク',
      '  - @schedule: 2026-07-10T10:00/2026-07-10T11:00',
      '  - メモ',
      '  - @due: 2026-07-15',
    ].join('\n') + '\n'
    const once = reformatMetaLines(md)
    const twice = reformatMetaLines(once.result)
    expect(twice.result).toBe(once.result)
    expect(twice.movedCount).toBe(0)
  })
})

describe('reformatMetaLines — 本文の非メタ行は変更しない', () => {
  it('本文テキストやチェック状態は一切変更しない', () => {
    const md = [
      '- [ ] タスクA',
      '  - サブタスク1',
      '  - @schedule: 2026-07-10T10:00/2026-07-10T11:00',
      '  - [x] サブタスク2',
    ].join('\n') + '\n'
    const { result } = reformatMetaLines(md)
    expect(result).toContain('- サブタスク1')
    expect(result).toContain('- [x] サブタスク2')
  })
})

describe('findMisplacedMetaLineIndices', () => {
  it('位置ずれのないメタ行は検出しない', () => {
    const md = '- [ ] タスクA\n  - @schedule: 2026-07-10T10:00/2026-07-10T11:00\n  - サブタスク\n'
    expect(findMisplacedMetaLineIndices(md)).toEqual([])
  })

  it('サブタスクの後のメタ行の行インデックスを返す', () => {
    const md = [
      '- [ ] タスクA',
      '  - サブタスク',
      '  - @schedule: 2026-07-10T10:00/2026-07-10T11:00',
    ].join('\n') + '\n'
    expect(findMisplacedMetaLineIndices(md)).toEqual([2])
  })
})
