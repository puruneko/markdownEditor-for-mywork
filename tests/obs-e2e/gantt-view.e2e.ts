import { browser, expect } from '@wdio/globals'
import { obsidianPage } from 'wdio-obsidian-service'
import { openFile, readVaultFile, waitForFileContentChange } from './helpers/obsidian-helpers'
import { countShadow, waitForShadow } from './helpers/shadow-dom'
import { dispatchMouseDrag } from './helpers/drag'

const VIEW = 'gantt-view'

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
    const ganttView = browser.$(`.${VIEW}`)
    await expect(ganttView).toExist()
  })

  it('ガントビューにツリー行が表示される', async function () {
    await openFile('test-tasks.md')
    await browser.executeObsidianCommand('md-ast-editor:open-gantt-view')
    await waitForShadow(VIEW, '.gantt-tree-row', { timeout: 10000 })
    const rows = await countShadow(VIEW, '.gantt-tree-row')
    expect(rows).toBeGreaterThan(0)
  })

  it('ガントタイムラインにタスクバーが描画される', async function () {
    await openFile('test-tasks.md')
    await browser.executeObsidianCommand('md-ast-editor:open-gantt-view')
    await waitForShadow(VIEW, '.gantt-timeline rect', { timeout: 10000 })
    const bars = await countShadow(VIEW, '.gantt-timeline rect')
    expect(bars).toBeGreaterThan(0)
  })

  it('バードラッグで @schedule が更新される', async function () {
    await openFile('test-tasks.md')
    await browser.executeObsidianCommand('md-ast-editor:open-gantt-view')

    // バーが描画されるまで待つ
    await waitForShadow(VIEW, '.gantt-timeline rect[class*="gantt-bar--task"]', { timeout: 10000 })

    // ドラッグ前の @schedule を記録
    const beforeContent = await readVaultFile('test-tasks.md')
    expect(beforeContent).toBeTruthy()

    // shadow root 内のバーへ MouseEvent ドラッグ（mousedown=バー、move/up=window）
    const dragged = await dispatchMouseDrag(
      VIEW,
      '.gantt-timeline rect[class*="gantt-bar--task"]',
      30, // 約1日分
    )
    expect(dragged).toBe(true)

    // ファイル書き戻しをポーリングで待つ（固定 pause は使わない）
    const afterContent = await waitForFileContentChange('test-tasks.md', beforeContent!)
    expect(afterContent).not.toBe(beforeContent)
    expect(afterContent).toContain('@schedule:')
  })
})
