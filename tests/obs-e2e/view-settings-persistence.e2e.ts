import { browser, expect } from '@wdio/globals'

/** issue-phase018-markdownEditor-for-mywork-005: ビュー設定の保存と、プラグイン再読み込み後の復元。 */
describe('view settings persistence', () => {
  before(async function () {
    await browser.reloadObsidian({ vault: './test/vaults/simple' })
  })

  it('Gantt / Calendar / Kanban の設定が data.json に保存され、プラグイン再読み込み後に復元される', async function () {
    await browser.executeAsync(async (done: () => void) => {
      // @ts-expect-error app は Obsidian 実行環境のグローバル
      const hub = app.plugins.plugins['md-ast-editor'].settingsHub
      hub.set('gantt', { rowHeight: 44, showWeekend: false, treeColumns: [{ key: 'name', width: 222 }] })
      hub.set('calendar', { weekSettings: { startHour: 7 } })
      hub.set('kanban', { cardDensity: 'compact' })
      // @ts-expect-error 同上
      await app.plugins.plugins['md-ast-editor'].saveSettings()
      done()
    })
    // 再起動に相当するプラグインの無効化→有効化。
    await browser.executeAsync(async (done: () => void) => {
      // @ts-expect-error 非公開API
      await app.plugins.disablePlugin('md-ast-editor')
      // @ts-expect-error 非公開API
      await app.plugins.enablePlugin('md-ast-editor')
      done()
    })
    await browser.waitUntil(
      async () => browser.execute(() => !!(window as any).app.plugins.plugins['md-ast-editor']?.settingsHub),
      { timeout: 5000, timeoutMsg: 'プラグインが再有効化されない' },
    )
    const restored = await browser.execute(() => {
      // @ts-expect-error app は Obsidian 実行環境のグローバル
      const hub = app.plugins.plugins['md-ast-editor'].settingsHub
      return { gantt: hub.get('gantt'), calendar: hub.get('calendar'), kanban: hub.get('kanban') }
    })
    expect(restored.gantt).toEqual({ rowHeight: 44, showWeekend: false, treeColumns: [{ key: 'name', width: 222 }] })
    expect(restored.calendar).toEqual({ weekSettings: { startHour: 7 } })
    expect(restored.kanban).toEqual({ cardDensity: 'compact' })
  })

  it('設定タブに Gantt/Calendar/Kanban セクションがあり、ツリーペイン幅は表示されない（issue-phase019-003）', async function () {
    // 設定モーダルは E2E 環境で開けないため、設定タブを直接 display() して描画内容を確認する。
    const info = await browser.execute(() => {
      const w = window as any
      const tab = w.app.setting.pluginTabs.find((t: any) => t.id === 'md-ast-editor')
      tab.display()
      const root = tab.containerEl as HTMLElement
      const titles = Array.from(root.querySelectorAll('h3')).map(e => e.textContent)
      const row = Array.from(root.querySelectorAll('.setting-item')).find(e => e.textContent?.includes('ツリーペイン幅'))
      return { titles, hasTreeWidth: !!row }
    })
    expect(info.titles).toEqual(expect.arrayContaining(['Gantt 表示設定', 'Calendar 表示設定', 'Kanban 表示設定']))
    expect(info.hasTreeWidth).toBe(false)
  })
})
