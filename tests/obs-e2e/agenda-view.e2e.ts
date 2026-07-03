import { browser, expect } from '@wdio/globals'
import { obsidianPage } from 'wdio-obsidian-service'
import { openFile, writeVaultFile } from './helpers/obsidian-helpers'
import { countShadow, waitForShadow, getShadowText } from './helpers/shadow-dom'

const VIEW = 'agenda-view'

function dateFromToday(offsetDays = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

describe('アジェンダビュー', function () {
  before(async function () {
    await browser.reloadObsidian({ vault: './test/vaults/simple' })
  })

  beforeEach(async function () {
    await obsidianPage.resetVault()
  })

  it('期限超過タスクが overdue バケットに表示される', async function () {
    // test-tasks.md の @due: 2026-04-05（未完 [>]）は常に期限超過
    await openFile('test-tasks.md')
    await browser.executeObsidianCommand('md-ast-editor:open-agenda-view')
    await waitForShadow(VIEW, '.bucket-overdue .task-row', { timeout: 10000 })
    const rows = await countShadow(VIEW, '.bucket-overdue .task-row')
    expect(rows).toBeGreaterThan(0)
  })

  it('今日のタスクが today バケットに表示される', async function () {
    // 「今日」は実行日に依存するため、フィクスチャではなく実行時生成する
    const d = dateFromToday()
    await writeVaultFile(
      'agenda-today.md',
      [
        '# アジェンダテスト',
        '',
        '- [ ] 今日締切のタスク',
        `  - @due: ${d}`,
      ].join('\n'),
    )
    await openFile('agenda-today.md')
    await browser.executeObsidianCommand('md-ast-editor:open-agenda-view')
    await waitForShadow(VIEW, '.bucket-today .task-row', { timeout: 10000 })
    const text = await getShadowText(VIEW, '.bucket-today')
    expect(text).toContain('今日締切のタスク')
  })
})
