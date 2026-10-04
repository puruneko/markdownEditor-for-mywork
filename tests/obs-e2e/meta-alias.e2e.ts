import { browser, expect } from '@wdio/globals'
import { obsidianPage } from 'wdio-obsidian-service'
import { openFile, writeVaultFile } from './helpers/obsidian-helpers'

/** issue-phase019-markdownEditor-for-mywork-001/003: ユーザー別名とツリーペイン幅設定の削除。 */
describe('meta key aliases', () => {
  before(async function () {
    await browser.reloadObsidian({ vault: './test/vaults/simple' })
  })
  beforeEach(async function () {
    await obsidianPage.resetVault()
  })

  it('設定した別名の行が @schedule と同じ日付チップ装飾になる', async function () {
    // 設定タブの入力欄に別名を入れて change を発火（実ユーザー操作と同じ経路）
    await browser.execute(() => {
      const w = window as any
      const tab = w.app.setting.pluginTabs.find((t: any) => t.id === 'md-ast-editor')
      tab.display()
      const row = Array.from(tab.containerEl.querySelectorAll('.setting-item')).find(
        (e: any) => e.querySelector('.setting-item-name')?.textContent === 'schedule',
      ) as HTMLElement
      const input = row.querySelector('input') as HTMLInputElement
      input.value = '作業時間、やる時間'
      input.dispatchEvent(new Event('change'))
    })
    await browser.pause(500)
    await writeVaultFile('alias.md', '- [ ] タスク\n  - @作業時間: 2026-10-07T10:00/12:00\n')
    await openFile('alias.md')
    await browser.waitUntil(async () => (await browser.$$('.metatag-date-chip')).length > 0, {
      timeout: 8000,
      interval: 200,
      timeoutMsg: '別名行に日付チップが出ない',
    })
    expect(await browser.$$('.metatag-date-chip').length).toBeGreaterThan(0)
  })

  it('設定画面にメタ情報の別名セクションがあり、ツリーペイン幅は無い', async function () {
    const text = await browser.execute(() => {
      const w = window as any
      const tab = w.app.setting.pluginTabs.find((t: any) => t.id === 'md-ast-editor')
      tab.display()
      return (tab.containerEl as HTMLElement).textContent ?? ''
    })
    expect(text).toContain('メタ情報の別名')
    expect(text).toContain('special_note')
    expect(text).not.toContain('ツリーペイン幅')
  })
})
