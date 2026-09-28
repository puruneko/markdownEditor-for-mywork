import { describe, it, expect, vi } from 'vitest'
import { matchMetaKeyTrigger, MetaKeySuggest } from './metatag-suggest'

describe('matchMetaKeyTrigger', () => {
  it('リスト先頭の「@」のみ（インデントなし）でマッチする', () => {
    expect(matchMetaKeyTrigger('- @')).toEqual({ indent: '', query: '' })
  })

  it('リスト先頭の「@」+入力済み文字列でマッチする', () => {
    expect(matchMetaKeyTrigger('- @pl')).toEqual({ indent: '', query: 'pl' })
  })

  it('インデントありのリスト先頭でマッチする', () => {
    expect(matchMetaKeyTrigger('  - @sch')).toEqual({ indent: '  ', query: 'sch' })
  })

  it('タスク行（チェックボックス記法）はマッチしない', () => {
    expect(matchMetaKeyTrigger('- [ ] @')).toBeNull()
  })

  it('文中（先頭以外）の「@」はマッチしない', () => {
    expect(matchMetaKeyTrigger('- text @')).toBeNull()
  })

  it('大文字を含む場合はマッチしない（[a-z]のみ許容）', () => {
    expect(matchMetaKeyTrigger('- @Plan')).toBeNull()
  })

  it('「@」が無い行はマッチしない', () => {
    expect(matchMetaKeyTrigger('- plan')).toBeNull()
  })

  it('末尾がコロン等の場合はマッチしない（クエリはa-zのみ）', () => {
    expect(matchMetaKeyTrigger('- @plan:')).toBeNull()
  })
})

describe('MetaKeySuggest（issue-phase014-markdownEditor-002: Tabキー決定）', () => {
  it('コンストラクタでTabキーを`scope`に登録し、押下時に内部の`suggestions.useSelectedItem`を呼ぶ', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const suggest = new MetaKeySuggest({} as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scope = (suggest as any).scope as { register: ReturnType<typeof vi.fn> }
    expect(scope.register).toHaveBeenCalledWith([], 'Tab', expect.any(Function))

    const tabHandler = scope.register.mock.calls[0][2] as (evt: unknown) => unknown
    const useSelectedItem = vi.fn()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(suggest as any).suggestions = { useSelectedItem }
    const fakeEvent = {}
    const result = tabHandler(fakeEvent)

    expect(useSelectedItem).toHaveBeenCalledWith(fakeEvent)
    expect(result).toBe(false)
  })

  it('`suggestions`が未初期化（サジェスト非表示）でもエラーにならない', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const suggest = new MetaKeySuggest({} as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scope = (suggest as any).scope as { register: ReturnType<typeof vi.fn> }
    const tabHandler = scope.register.mock.calls[0][2] as (evt: unknown) => unknown

    expect(() => tabHandler({})).not.toThrow()
  })
})
