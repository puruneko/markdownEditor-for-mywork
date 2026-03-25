import { browser, expect } from '@wdio/globals'
import { obsidianPage } from 'wdio-obsidian-service'

/** Vault内のMarkdownファイルをObsidian APIで開く。 */
async function openFile(path: string): Promise<void> {
  await browser.execute((filePath: string) => {
    const app = (window as any).app
    const file = app.vault.getAbstractFileByPath(filePath)
    if (file) {
      void app.workspace.getLeaf(false).openFile(file)
    }
  }, path)
  await browser.pause(500)
}

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

  it('ガントビューにガントコンポーネントが表示される', async function () {
    await openFile('test-tasks.md')
    await browser.executeObsidianCommand('md-ast-editor:open-gantt-view')
    await browser.waitUntil(
      async () => {
        const el = await browser.$('.gantt-view')
        return el.isExisting()
      },
      { timeout: 5000, interval: 200 },
    )
    const ganttView = browser.$('.gantt-view')
    await expect(ganttView).toExist()
  })
})
