import { browser, expect } from '@wdio/globals'
import { obsidianPage } from 'wdio-obsidian-service'
import { openFile } from './helpers/obsidian-helpers'
import { waitForShadow, getShadowText } from './helpers/shadow-dom'

const VIEW = 'unscheduled-tray-view'

describe('未予定トレイ', function () {
  before(async function () {
    await browser.reloadObsidian({ vault: './test/vaults/simple' })
  })

  beforeEach(async function () {
    await obsidianPage.resetVault()
  })

  it('@schedule のないタスクだけがトレイに載る', async function () {
    await openFile('test-tasks.md')
    await browser.executeObsidianCommand('md-ast-editor:open-unscheduled-tray')
    await waitForShadow(VIEW, '.tray-item', { timeout: 10000 })

    const list = await getShadowText(VIEW, '.tray-list')
    // フィクスチャの「スケジュールなし」タスクは載る
    expect(list).toContain('スケジュールなし')
    // @schedule 済みタスクは載らない
    expect(list).not.toContain('要件ヒアリング')
  })
})
