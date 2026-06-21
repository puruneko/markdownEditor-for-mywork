import { browser, expect } from '@wdio/globals'
import { obsidianPage } from 'wdio-obsidian-service'
import { openFile } from './helpers/obsidian-helpers'

describe('ASTビュー', function () {
  before(async function () {
    await browser.reloadObsidian({ vault: './test/vaults/simple' })
  })

  beforeEach(async function () {
    await obsidianPage.resetVault()
  })

  it('コマンドパレットからASTビューを開ける', async function () {
    await openFile('test-tasks.md')
    await browser.executeObsidianCommand('md-ast-editor:open-ast-view')
    const astView = browser.$('.ast-view')
    await expect(astView).toExist()
  })

  it('アクティブファイルのASTにsectionsが含まれる', async function () {
    await openFile('test-tasks.md')
    await browser.executeObsidianCommand('md-ast-editor:open-ast-view')
    // ASTが描画されるまで待つ（FileSync の debounce 300ms + 余裕）。
    await browser.waitUntil(
      async () => {
        const text = await browser.$('.ast-view pre').getText()
        return text.includes('sections')
      },
      { timeout: 5000, interval: 200 },
    )
    const text = await browser.$('.ast-view pre').getText()
    expect(text).toContain('sections')
  })

  it('QuoteNodeがタスクとして解釈されていない', async function () {
    await openFile('test-tasks.md')
    await browser.executeObsidianCommand('md-ast-editor:open-ast-view')
    await browser.waitUntil(
      async () => {
        const text = await browser.$('.ast-view pre').getText()
        return text.includes('"quote"')
      },
      { timeout: 5000, interval: 200 },
    )
    const text = await browser.$('.ast-view pre').getText()
    // QuoteNode は type: "quote" で解析される。
    expect(text).toContain('"quote"')
  })
})
