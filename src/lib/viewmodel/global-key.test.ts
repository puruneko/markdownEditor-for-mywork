import { describe, it, expect } from 'vitest'
import { makeGlobalKey, parseGlobalKey } from './global-key'

describe('makeGlobalKey', () => {
  it('パスとローカルIDを :: で結合する', () => {
    expect(makeGlobalKey('notes/todo.md', 's1.n0')).toBe('notes/todo.md::s1.n0')
  })

  it('ルートパスも正しく結合する', () => {
    expect(makeGlobalKey('root.md', 'section-0')).toBe('root.md::section-0')
  })

  it('空の localId も許容する', () => {
    expect(makeGlobalKey('a.md', '')).toBe('a.md::')
  })
})

describe('parseGlobalKey', () => {
  it('globalKey を filePath と localId に分割する', () => {
    const result = parseGlobalKey('notes/todo.md::s1.n0')
    expect(result.filePath).toBe('notes/todo.md')
    expect(result.localId).toBe('s1.n0')
  })

  it('makeGlobalKey との往復が一致する', () => {
    const path = 'folder/sub/note.md'
    const localId = 's2.n3.n0'
    const key = makeGlobalKey(path, localId)
    const parsed = parseGlobalKey(key)
    expect(parsed.filePath).toBe(path)
    expect(parsed.localId).toBe(localId)
  })

  it('localId に . を含む場合も正しく分割する', () => {
    const result = parseGlobalKey('a.md::s0.n0.q1')
    expect(result.filePath).toBe('a.md')
    expect(result.localId).toBe('s0.n0.q1')
  })

  it('最後の :: で分割する（localId より後を localId にする）', () => {
    // localId 部分に :: は通常含まれないが、パスに :: があった場合のガード
    const key = 'path::with::colon::localId'
    const result = parseGlobalKey(key)
    expect(result.filePath).toBe('path::with::colon')
    expect(result.localId).toBe('localId')
  })

  it(':: を含まない文字列はエラーを投げる', () => {
    expect(() => parseGlobalKey('invalid-key')).toThrow()
  })

  it('空文字列はエラーを投げる', () => {
    expect(() => parseGlobalKey('')).toThrow()
  })
})

describe('makeGlobalKey + parseGlobalKey 一意性', () => {
  it('同一テキストでも異なるファイルなら異なる globalKey になる', () => {
    const k1 = makeGlobalKey('fileA.md', 's1.n0')
    const k2 = makeGlobalKey('fileB.md', 's1.n0')
    expect(k1).not.toBe(k2)
  })

  it('同一ファイルで異なる localId は異なる globalKey になる', () => {
    const k1 = makeGlobalKey('file.md', 's1.n0')
    const k2 = makeGlobalKey('file.md', 's1.n1')
    expect(k1).not.toBe(k2)
  })
})
