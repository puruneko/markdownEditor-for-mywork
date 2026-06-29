import { describe, it, expect } from 'vitest'
import { parseQueryDsl } from './parse-query'

describe('parseQueryDsl', () => {
  it('空テキストは空クエリを返す', () => {
    const { query, scope } = parseQueryDsl('')
    expect(query).toEqual({})
    expect(scope).toBe('vault')
  })

  it('コメント行(#)と空行を無視する', () => {
    const { query } = parseQueryDsl('# コメント\n\n  \n# 別コメント')
    expect(query).toEqual({})
  })

  it('status: todo,doing をパースする', () => {
    const { query } = parseQueryDsl('status: todo,doing')
    expect(query.status).toEqual(['todo', 'doing'])
  })

  it('不正なステータス値は除外して有効値のみ取る', () => {
    const { query } = parseQueryDsl('status: todo,invalid,done')
    expect(query.status).toEqual(['todo', 'done'])
  })

  it('すべて不正なステータスの場合は status を設定しない', () => {
    const { query } = parseQueryDsl('status: invalid,garbage')
    expect(query.status).toBeUndefined()
  })

  it('tag: と tags: 両方を受け付ける', () => {
    const { query: q1 } = parseQueryDsl('tag: 総務,清掃')
    const { query: q2 } = parseQueryDsl('tags: 総務,清掃')
    expect(q1.tags).toEqual(['総務', '清掃'])
    expect(q2.tags).toEqual(['総務', '清掃'])
  })

  it('due: <=2026-07-05 は dueBefore に変換', () => {
    const { query } = parseQueryDsl('due: <=2026-07-05')
    expect(query.dueBefore).toBe('2026-07-05')
    expect(query.dueAfter).toBeUndefined()
  })

  it('due: >=2026-07-01 は dueAfter に変換', () => {
    const { query } = parseQueryDsl('due: >=2026-07-01')
    expect(query.dueAfter).toBe('2026-07-01')
    expect(query.dueBefore).toBeUndefined()
  })

  it('priority: <=2 は priorityMax に変換', () => {
    const { query } = parseQueryDsl('priority: <=2')
    expect(query.priorityMax).toBe(2)
  })

  it('text: 見積 は text に変換', () => {
    const { query } = parseQueryDsl('text: 見積')
    expect(query.text).toBe('見積')
  })

  it('scope: vault はデフォルト vault を維持', () => {
    const { scope } = parseQueryDsl('scope: vault')
    expect(scope).toBe('vault')
  })

  it('scope: folder は folder に変換', () => {
    const { scope } = parseQueryDsl('scope: folder')
    expect(scope).toBe('folder')
  })

  it('scope: current は current-file に変換', () => {
    const { scope } = parseQueryDsl('scope: current')
    expect(scope).toBe('current-file')
  })

  it('複数条件を複合パース', () => {
    const dsl = [
      'status: todo,doing',
      'tag: urgent',
      'due: <=2026-12-31',
      'due: >=2026-01-01',
      'priority: <=3',
      'text: 設計',
      'scope: current',
    ].join('\n')
    const { query, scope } = parseQueryDsl(dsl)
    expect(query.status).toEqual(['todo', 'doing'])
    expect(query.tags).toEqual(['urgent'])
    expect(query.dueBefore).toBe('2026-12-31')
    expect(query.dueAfter).toBe('2026-01-01')
    expect(query.priorityMax).toBe(3)
    expect(query.text).toBe('設計')
    expect(scope).toBe('current-file')
  })

  it('不正な行（コロンなし）は無視して続行する', () => {
    const dsl = 'invalid line\nstatus: todo'
    const { query } = parseQueryDsl(dsl)
    expect(query.status).toEqual(['todo'])
  })

  it('不正な日付形式は設定しない', () => {
    const { query } = parseQueryDsl('due: <=2026/07/05')
    expect(query.dueBefore).toBeUndefined()
  })

  it('不正な priority は設定しない', () => {
    const { query } = parseQueryDsl('priority: <=abc')
    expect(query.priorityMax).toBeUndefined()
  })

  it('大文字小文字混在のステータスを正規化', () => {
    const { query } = parseQueryDsl('status: TODO,Done')
    expect(query.status).toEqual(['todo', 'done'])
  })

  it('前後の空白を無視する', () => {
    const { query } = parseQueryDsl('  status  :  todo , doing  ')
    expect(query.status).toEqual(['todo', 'doing'])
  })

  it('due に <=/ >= 以外の書式は無視', () => {
    const { query } = parseQueryDsl('due: 2026-07-05')
    expect(query.dueBefore).toBeUndefined()
    expect(query.dueAfter).toBeUndefined()
  })
})
