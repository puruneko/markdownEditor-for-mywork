import { browser, expect } from '@wdio/globals'
import { obsidianPage } from 'wdio-obsidian-service'
import { openFile } from './helpers/obsidian-helpers'

describe('ガントビュー', function () {
  before(async function () {
    await browser.reloadObsidian({ vault: './test/vaults/simple' })
  })

  beforeEach(async function () {
    await obsidianPage.resetVault()
  })

  it('コマンドパレットからガントビューを開ける', async function () {
    await openFile('test-tasks.md')
    await browser.executeObsidianCommand('md-ast-editor:open-gantt-view')
    const ganttView = browser.$('.gantt-view')
    await expect(ganttView).toExist()
  })

  it('ガントビューにツリー行が表示される', async function () {
    await openFile('test-tasks.md')
    await browser.executeObsidianCommand('md-ast-editor:open-gantt-view')
    await browser.waitUntil(
      async () => {
        const rows = await browser.$$('.gantt-view .gantt-tree-row')
        return rows.length > 0
      },
      { timeout: 10000, interval: 500 },
    )
    const rows = await browser.$$('.gantt-view .gantt-tree-row')
    expect(rows.length).toBeGreaterThan(0)
  })

  it('ガントタイムラインにタスクバーが描画される', async function () {
    await openFile('test-tasks.md')
    await browser.executeObsidianCommand('md-ast-editor:open-gantt-view')
    await browser.waitUntil(
      async () => {
        const bars = await browser.$$('.gantt-view .gantt-timeline rect')
        return bars.length > 0
      },
      { timeout: 10000, interval: 500 },
    )
    const bars = await browser.$$('.gantt-view .gantt-timeline rect')
    expect(bars.length).toBeGreaterThan(0)
  })

  it('バードラッグで @schedule が更新される', async function () {
    await openFile('test-tasks.md')
    await browser.executeObsidianCommand('md-ast-editor:open-gantt-view')

    // バーが描画されるまで待つ
    await browser.waitUntil(
      async () => {
        const bars = await browser.$$('.gantt-view .gantt-timeline rect[class*="gantt-bar--task"]')
        return bars.length > 0
      },
      { timeout: 10000, interval: 500 },
    )

    // ドラッグ前の @schedule を記録
    const beforeContent = await browser.execute(() => {
      const app = (window as any).app
      const file = app.vault.getAbstractFileByPath('test-tasks.md')
      return file ? app.vault.read(file) : null
    })
    expect(beforeContent).toBeTruthy()

    // バーをスクロールして表示領域内に入れてからドラッグをJSで発火
    // SVGバーはスクロール外にある場合があるため、スクロールコンテナを調整してから操作する
    const dragged = await browser.execute((dayWidthPx: number) => {
      const bar = document.querySelector('.gantt-view .gantt-timeline rect[class*="gantt-bar--task"]') as SVGElement | null
      if (!bar) return false

      // スクロールコンテナがあれば先頭に戻してバーを表示範囲に入れる
      const container = bar.closest('.gantt-timeline-container') as HTMLElement | null
      if (container) container.scrollLeft = 0

      const r = bar.getBoundingClientRect()
      const cx = r.x + r.width / 2
      const cy = r.y + r.height / 2

      // マウスイベントを直接 dispatch してドラッグをシミュレート
      bar.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: cx, clientY: cy }))
      window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: cx + dayWidthPx, clientY: cy }))
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: cx + dayWidthPx, clientY: cy }))

      return true
    }, 30)

    // ファイル書き込みを待つ
    await browser.pause(800)

    // @schedule が更新されたことを確認
    const afterContent = await browser.execute(() => {
      const app = (window as any).app
      const file = app.vault.getAbstractFileByPath('test-tasks.md')
      return file ? app.vault.read(file) : null
    })
    expect(afterContent).toBeTruthy()
    expect(afterContent).not.toBe(beforeContent)
  })
})
