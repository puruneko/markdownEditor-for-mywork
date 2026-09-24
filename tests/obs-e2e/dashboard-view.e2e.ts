import { browser, expect } from '@wdio/globals'
import { obsidianPage } from 'wdio-obsidian-service'
import { openFile } from './helpers/obsidian-helpers'
import { countShadow, waitForShadow } from './helpers/shadow-dom'
import { captureView } from './helpers/screenshot'

const VIEW = 'dashboard-view'

describe('ダッシュボードビュー', function () {
  before(async function () {
    await browser.reloadObsidian({ vault: './test/vaults/simple' })
  })

  beforeEach(async function () {
    await obsidianPage.resetVault()
  })

  it('コマンドパレットからダッシュボードビューを開ける', async function () {
    await openFile('test-tasks.md')
    await browser.executeObsidianCommand('md-ast-editor:open-dashboard-view')
    const view = browser.$(`.${VIEW}`)
    await expect(view).toExist()
  })

  it('タブバーと5パネルの切り替えボタンが表示される', async function () {
    await openFile('test-tasks.md')
    await browser.executeObsidianCommand('md-ast-editor:open-dashboard-view')
    await waitForShadow(VIEW, '.dashboard-root', { timeout: 10000 })
    await waitForShadow(VIEW, '.tabs .tab', { timeout: 10000 })
    const tabs = await countShadow(VIEW, '.tabs .tab')
    expect(tabs).toBe(5)

    // 目視レビュー用の証跡
    await captureView('dashboard-view-initial')
  })
})
