import { browser, expect } from '@wdio/globals'
import { obsidianPage } from 'wdio-obsidian-service'
import { openFile, readVaultFile, writeVaultFile } from './helpers/obsidian-helpers'

/** issue-phase018-markdownEditor-for-mywork-003: メタ項目ごとの折りたたみ。 */
describe('meta item fold', () => {
  before(async function () {
    await browser.reloadObsidian({ vault: './test/vaults/simple' })
  })
  beforeEach(async function () {
    await obsidianPage.resetVault()
  })

  it('子行を持つメタ行にだけボタンが出て、押すと子行が隠れ、本文は変わらない', async function () {
    const content = ['- [ ] タスク', '  - @memo', '    - 子A', '    - 子B', '  - @due: 2026-10-03', '- [ ] 次'].join('\n') + '\n'
    await writeVaultFile('meta-fold.md', content)
    await openFile('meta-fold.md')
    await browser.waitUntil(async () => (await browser.$$('.metatag-fold-toggle')).length > 0, {
      timeout: 5000,
      interval: 200,
      timeoutMsg: '折りたたみボタンが表示されない',
    })
    expect((await browser.$$('.metatag-fold-toggle')).length).toBe(1)
    expect(await browser.$('.metatag-fold-toggle').getText()).toBe('▾')

    const visibleBefore = await browser.execute(() => document.body.innerText.includes('子B'))
    expect(visibleBefore).toBe(true)

    await browser.execute(() => {
      const el = document.querySelector('.metatag-fold-toggle') as HTMLElement
      el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
    })
    await browser.waitUntil(async () => (await browser.$('.metatag-fold-toggle').getText()) === '▸', { timeout: 3000 })
    const hiddenAfter = await browser.execute(() => {
      const lines = Array.from(document.querySelectorAll('.cm-content .cm-line')).map(l => l.textContent ?? '')
      return { hasChild: lines.some(t => t.includes('子B')), hasDue: lines.some(t => t.includes('due')), hasNext: lines.some(t => t.includes('次')) }
    })
    expect(hiddenAfter.hasChild).toBe(false)
    expect(hiddenAfter.hasNext).toBe(true)
    expect(await readVaultFile('meta-fold.md')).toBe(content)

    await browser.execute(() => {
      const el = document.querySelector('.metatag-fold-toggle') as HTMLElement
      el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
    })
    await browser.waitUntil(async () => (await browser.$('.metatag-fold-toggle').getText()) === '▾', { timeout: 3000 })
  })
})
