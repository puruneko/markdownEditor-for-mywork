import { browser, expect } from '@wdio/globals'
import { obsidianPage } from 'wdio-obsidian-service'
import { openFile, writeVaultFile } from './helpers/obsidian-helpers'
import { countShadow, waitForShadow } from './helpers/shadow-dom'

const VIEW = 'calendar-view'

/** 今日から offset 日ずらした日付（YYYY-MM-DD）。週表示は「今週」を表示するため、固定日付フィクスチャでは検証できない。 */
function dateFromToday(offsetDays = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

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
    const calendarView = browser.$(`.${VIEW}`)
    await expect(calendarView).toExist()
  })

  it('カレンダービューにカレンダーコンポーネントが表示される', async function () {
    await openFile('test-tasks.md')
    await browser.executeObsidianCommand('md-ast-editor:open-calendar-view')
    // コンテナだけでなく shadow 内のコンポーネント本体を確認する（obs-0008 対策）
    await waitForShadow(VIEW, '.week-view, .month-view, .calendar-tab', { timeout: 10000 })
  })

  it('今日のタスクがカレンダーアイテムとして表示される', async function () {
    // 週表示は「今週」を表示するため、今日の日付でタスクを実行時生成する
    const d = dateFromToday()
    await writeVaultFile(
      'today-tasks.md',
      [
        '# 今日のテスト',
        '',
        '- [ ] カレンダー表示テストタスク',
        `  - @schedule: ${d}T10:00/${d}T11:00`,
      ].join('\n'),
    )
    await openFile('today-tasks.md')
    await browser.executeObsidianCommand('md-ast-editor:open-calendar-view')
    await waitForShadow(VIEW, '.week-view', { timeout: 10000 })
    await waitForShadow(VIEW, '.calendar-item, .allday-item', { timeout: 10000 })
    const items = await countShadow(VIEW, '.calendar-item, .allday-item')
    expect(items).toBeGreaterThan(0)
  })

  it('@repeat タスクが複数オカレンス表示される', async function () {
    // 開始を 3 日前にして、週のどの曜日に実行しても週表示内に 2 オカレンス以上入るようにする
    const d = dateFromToday(-3)
    await writeVaultFile(
      'repeat-tasks.md',
      [
        '# 繰り返しテスト',
        '',
        '- [ ] 毎日の定例タスク',
        `  - @schedule: ${d}T09:00/${d}T09:30`,
        '  - @repeat: FREQ=DAILY',
      ].join('\n'),
    )
    await openFile('repeat-tasks.md')
    await browser.executeObsidianCommand('md-ast-editor:open-calendar-view')
    await waitForShadow(VIEW, '.week-view', { timeout: 10000 })
    // 毎日繰り返しは週表示に複数回現れるはず（本文は 1 行のままビュー側で展開）
    await browser.waitUntil(
      async () => (await countShadow(VIEW, '.calendar-item, .allday-item')) >= 2,
      { timeout: 10000, interval: 500, timeoutMsg: '@repeat のオカレンスが複数描画されない' },
    )
  })
})
