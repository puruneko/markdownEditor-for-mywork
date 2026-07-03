import { browser, expect } from '@wdio/globals'
import { obsidianPage } from 'wdio-obsidian-service'
import { openFile } from './helpers/obsidian-helpers'
import { countShadow, waitForShadow, getShadowText } from './helpers/shadow-dom'

const VIEW = 'health-view'

describe('ヘルスチェックビュー', function () {
  before(async function () {
    await browser.reloadObsidian({ vault: './test/vaults/simple' })
  })

  beforeEach(async function () {
    await obsidianPage.resetVault()
  })

  it('検出結果（finding）が表示される', async function () {
    // test-tasks.md には不正スケジュール（malformed）・日付なし（undated）・期限超過（overdue）が含まれる
    await openFile('test-tasks.md')
    await browser.executeObsidianCommand('md-ast-editor:open-health-view')
    await waitForShadow(VIEW, '.finding-row', { timeout: 10000 })
    const findings = await countShadow(VIEW, '.finding-row')
    expect(findings).toBeGreaterThan(0)
    const groups = await countShadow(VIEW, '.rule-group')
    expect(groups).toBeGreaterThan(0)
  })

  it('既知の不正タスクが finding に含まれる', async function () {
    await openFile('test-tasks.md')
    await browser.executeObsidianCommand('md-ast-editor:open-health-view')
    await waitForShadow(VIEW, '.finding-row', { timeout: 10000 })
    const body = await getShadowText(VIEW, '.health-body')
    // フィクスチャの「スケジュールなし」タスクが undated として検出される
    expect(body).toContain('スケジュールなし')
  })
})
