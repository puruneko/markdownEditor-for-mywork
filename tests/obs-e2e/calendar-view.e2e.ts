import { browser, expect } from '@wdio/globals'
import { obsidianPage } from 'wdio-obsidian-service'
import { openFile } from './helpers/obsidian-helpers'

describe('カレンダービュー', function () {
  before(async function () {
    await browser.reloadObsidian({ vault: './test/vaults/simple' })
  })

  beforeEach(async function () {
    await obsidianPage.resetVault()
  })

  it('コマンドパレットからカレンダービューを開ける', async function () {
    await openFile('test-tasks.md')
    await browser.executeObsidianCommand('md-ast-editor:open-calendar-view')
    const calendarView = browser.$('.calendar-view')
    await expect(calendarView).toExist()
  })

  it('カレンダービューにカレンダーコンポーネントが表示される', async function () {
    await openFile('test-tasks.md')
    await browser.executeObsidianCommand('md-ast-editor:open-calendar-view')
    await browser.waitUntil(
      async () => {
        const el = await browser.$('.calendar-view')
        return el.isExisting()
      },
      { timeout: 5000, interval: 200 },
    )
    const calendarView = browser.$('.calendar-view')
    await expect(calendarView).toExist()
  })

  it('カレンダービューにアイテムまたはallday要素が表示される', async function () {
    await openFile('test-tasks.md')
    await browser.executeObsidianCommand('md-ast-editor:open-calendar-view')
    // WeekView が描画されるまで待つ
    await browser.waitUntil(
      async () => {
        const weekView = await browser.$('.calendar-view .week-view')
        return weekView.isExisting()
      },
      { timeout: 10000, interval: 500 },
    )
    const weekView = browser.$('.calendar-view .week-view')
    await expect(weekView).toExist()
  })
})
