import { describe, it, expect, afterEach } from 'vitest'
import { mount, unmount, flushSync } from 'svelte'
import ParseDebugViewMount from './ParseDebugViewMount.svelte'
import { parseMarkdown } from '../lib/parser/parse-markdown'
import type { SourceEntry } from '../lib/viewmodel/contract'

const src = (path: string, md: string): SourceEntry => ({ path, doc: parseMarkdown(md) })

describe('ParseDebugViewMount（issue-phase015-markdownEditor-005）', () => {
  let target: HTMLElement
  let comp: Record<string, unknown> | null = null

  function setup(initial: SourceEntry[]) {
    target = document.createElement('div')
    document.body.appendChild(target)
    let updater: ((s: SourceEntry[]) => void) | null = null
    comp = mount(ParseDebugViewMount, {
      target,
      props: { sources: initial, registerUpdater: (fn: (s: SourceEntry[]) => void) => { updater = fn } },
    })
    return { push: (s: SourceEntry[]) => { updater!(s); flushSync() } }
  }

  afterEach(() => {
    if (comp) unmount(comp)
    comp = null
    target?.remove()
  })

  it('開いた直後はオブジェクトを表示せず、案内文のみ表示する', () => {
    setup([src('a.md', '- [ ] A\n')])
    expect(target.querySelector('.hint')).not.toBeNull()
    expect(target.querySelector('details')).toBeNull()
  })

  it('表示更新ボタンを押したときのみ表示する', () => {
    setup([src('a.md', '- [ ] A\n')])
    ;(target.querySelector('button.refresh') as HTMLButtonElement).click()
    flushSync()
    expect(target.querySelector('details')).not.toBeNull()
    expect(target.textContent).toContain('a.md')
  })

  it('ホストが更新を通知しても、ボタンを押すまで表示は変わらない', () => {
    const { push } = setup([src('a.md', '- [ ] A\n')])
    ;(target.querySelector('button.refresh') as HTMLButtonElement).click()
    flushSync()
    const before = target.textContent

    push([src('b.md', '- [ ] B\n')])
    expect(target.textContent).toBe(before)
    expect(target.textContent).not.toContain('b.md')

    ;(target.querySelector('button.refresh') as HTMLButtonElement).click()
    flushSync()
    expect(target.textContent).toContain('b.md')
    expect(target.textContent).not.toContain('a.md')
  })
})
