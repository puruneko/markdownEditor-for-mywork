import { describe, it, expect } from 'vitest'
import { toDebugTree } from './debug-tree'
import { parseMarkdown } from '../parser/parse-markdown'

describe('toDebugTree', () => {
  it('プリミティブを種別と表記に変換する', () => {
    expect(toDebugTree('a', 'k')).toEqual({ key: 'k', kind: 'string', summary: '"a"' })
    expect(toDebugTree(1)).toMatchObject({ kind: 'number', summary: '1' })
    expect(toDebugTree(false)).toMatchObject({ kind: 'boolean', summary: 'false' })
    expect(toDebugTree(null)).toMatchObject({ kind: 'null' })
    expect(toDebugTree(undefined)).toMatchObject({ kind: 'undefined' })
  })

  it('Map を件数付きで展開する', () => {
    const t = toDebugTree(new Map<string, unknown>([['a', 1], ['b', { x: 2 }]]))
    expect(t.kind).toBe('map')
    expect(t.summary).toBe('Map(2)')
    expect(t.children?.map((c) => c.key)).toEqual(['a', 'b'])
    expect(t.children?.[1].children?.[0]).toMatchObject({ key: 'x', summary: '2' })
  })

  it('配列とオブジェクトを件数付きで展開する', () => {
    expect(toDebugTree([1, 2])).toMatchObject({ kind: 'array', summary: 'Array(2)' })
    expect(toDebugTree({ a: 1 })).toMatchObject({ kind: 'object', summary: 'Object{1}' })
  })

  it('循環参照で無限再帰しない', () => {
    const a: Record<string, unknown> = {}
    a.self = a
    expect(toDebugTree(a).children?.[0].summary).toBe('[Circular]')
  })

  it('同一オブジェクトを兄弟で共有していても循環扱いにしない', () => {
    const shared = { v: 1 }
    const t = toDebugTree({ a: shared, b: shared })
    expect(t.children?.[1].summary).toBe('Object{1}')
  })

  it('parseMarkdown の Document を変換できる', () => {
    const t = toDebugTree(parseMarkdown('# H\n- [ ] タスク\n'))
    expect(t.children?.map((c) => c.key)).toEqual(['type', 'sections', 'nodeLineMap'])
    expect(t.children?.[2].kind).toBe('map')
  })
})
