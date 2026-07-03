import { browser, expect } from '@wdio/globals'
import { obsidianPage } from 'wdio-obsidian-service'
import { openFile } from './helpers/obsidian-helpers'
import { getShadowText, waitForShadow } from './helpers/shadow-dom'

// ビュークラスは shadow の外側コンテナに付く（ShadowItemView）。中身は shadow root 内。
const VIEW = 'ast-view-container'

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
    const astView = browser.$(`.${VIEW}`)
    await expect(astView).toExist()
  })

  it('アクティブファイルのASTにsectionsが含まれる', async function () {
    await openFile('test-tasks.md')
    await browser.executeObsidianCommand('md-ast-editor:open-ast-view')
    // AST が描画されるまで待つ（FileSync の debounce 300ms + 余裕）
    await waitForShadow(VIEW, 'pre', { timeout: 5000, interval: 200 })
    await browser.waitUntil(
      async () => ((await getShadowText(VIEW, 'pre')) ?? '').includes('sections'),
      { timeout: 5000, interval: 200 },
    )
    const text = (await getShadowText(VIEW, 'pre')) ?? ''
    expect(text).toContain('sections')
  })

  it('QuoteNodeがタスクとして解釈されていない', async function () {
    await openFile('test-tasks.md')
    await browser.executeObsidianCommand('md-ast-editor:open-ast-view')
    await waitForShadow(VIEW, 'pre', { timeout: 5000, interval: 200 })
    await browser.waitUntil(
      async () => ((await getShadowText(VIEW, 'pre')) ?? '').includes('"quote"'),
      { timeout: 5000, interval: 200 },
    )
    const text = (await getShadowText(VIEW, 'pre')) ?? ''
    // QuoteNode は type: "quote" で解析される
    expect(text).toContain('"quote"')
  })
})
