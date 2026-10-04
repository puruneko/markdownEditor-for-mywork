import { browser, expect } from '@wdio/globals'
import { obsidianPage } from 'wdio-obsidian-service'
import { openFile } from './helpers/obsidian-helpers'
import { clickShadow, countShadow, waitForShadow } from './helpers/shadow-dom'

// issue-phase015-markdownEditor-005
const VIEW = 'parse-debug-view-container'

describe('Parse Debugビュー', function () {
  before(async function () {
    await browser.reloadObsidian({ vault: './test/vaults/simple' })
  })

  beforeEach(async function () {
    await obsidianPage.resetVault()
  })

  it('リボンにアイコンが表示され、クリックでビューが開く', async function () {
    await openFile('test-tasks.md')
    const icon = browser.$('.side-dock-ribbon-action[aria-label="Parse Debug を開く"]')
    await expect(icon).toExist()
    await icon.click()
    await expect(browser.$(`.${VIEW}`)).toExist()
  })

  it('開いた直後は表示されず、表示更新ボタンを押したときのみオブジェクトが表示される', async function () {
    await openFile('test-tasks.md')
    await browser.executeObsidianCommand('md-ast-editor:open-parse-debug-view')
    await waitForShadow(VIEW, 'button.refresh', { timeout: 5000, interval: 200 })
    expect(await countShadow(VIEW, 'details')).toBe(0)

    expect(await clickShadow(VIEW, 'button.refresh')).toBe(true)
    await browser.waitUntil(async () => (await countShadow(VIEW, 'details')) > 0, {
      timeout: 5000,
      interval: 200,
    })
  })
})
