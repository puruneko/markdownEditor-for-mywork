import { describe, it, expect } from 'vitest'
import { EditorState } from '@codemirror/state'
import { findFoldableMetaItems, metaFoldField, toggleMetaFold, foldAllMeta, unfoldAllMeta } from './meta-fold'

const L = (s: string) => s.split('\n')

describe('findFoldableMetaItems', () => {
  it('1行メタは対象外', () => {
    expect(findFoldableMetaItems(L('- [ ] A\n  - @plan: 2026-07-10\n  - @due: 2026-07-11'))).toEqual([])
  })
  it('子行ありは対象。範囲は深いインデントが続く間', () => {
    const r = findFoldableMetaItems(L('- [ ] A\n  - @memo\n    - x\n    - y\n  - @due: 2026-07-11'))
    expect(r).toEqual([{ metaLine: 1, keyEnd: 9, firstChildLine: 2, lastChildLine: 3 }])
  })
  it('空行で終了', () => {
    const r = findFoldableMetaItems(L('- [ ] A\n  - @memo\n    - x\n\n    - y'))
    expect(r[0]).toMatchObject({ firstChildLine: 2, lastChildLine: 2 })
  })
  it('keyEnd は ? を含む位置', () => {
    const r = findFoldableMetaItems(L('- [ ] A\n  - @memo?: v\n    - x'))
    expect(r[0].keyEnd).toBe('  - @memo?'.length)
  })
  it('タスク配下でないメタ行は対象外', () => {
    expect(findFoldableMetaItems(L('- item\n  - @memo\n    - x'))).toEqual([])
  })
})

describe('metaFoldField', () => {
  const doc = '- [ ] A\n  - @memo\n    - x\n- [ ] B\n  - @note\n    - y'
  const bPos = doc.indexOf('  - @note')
  const mk = () => EditorState.create({ doc, extensions: [metaFoldField] })
  it('toggle / foldAll / unfoldAll', () => {
    const aPos = doc.indexOf('  - @memo')
    let s = mk().update({ effects: toggleMetaFold.of(aPos) }).state
    expect(s.field(metaFoldField)).toEqual([aPos])
    s = s.update({ effects: toggleMetaFold.of(aPos) }).state
    expect(s.field(metaFoldField)).toEqual([])
    s = s.update({ effects: foldAllMeta.of(null) }).state
    expect(s.field(metaFoldField).length).toBe(2)
    s = s.update({ effects: unfoldAllMeta.of(null) }).state
    expect(s.field(metaFoldField)).toEqual([])
  })
  it('文書変更で位置がマップされる', () => {
    let s = mk().update({ effects: toggleMetaFold.of(bPos) }).state
    s = s.update({ changes: { from: 0, insert: 'xx\n' } }).state
    expect(s.field(metaFoldField)).toEqual([bPos + 3])
  })
  it('カーソルが子行に入ると自動展開、メタ行上では維持', () => {
    let s = mk().update({ effects: toggleMetaFold.of(bPos) }).state
    s = s.update({ selection: { anchor: bPos + 3 } }).state
    expect(s.field(metaFoldField)).toEqual([bPos])
    s = s.update({ selection: { anchor: doc.length } }).state
    expect(s.field(metaFoldField)).toEqual([])
  })
})
