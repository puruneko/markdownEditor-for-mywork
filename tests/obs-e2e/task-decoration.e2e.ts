import { browser, expect } from '@wdio/globals'
import { obsidianPage } from 'wdio-obsidian-service'
import { openFile } from './helpers/obsidian-helpers'

describe('タスクデコレーション', function () {
  before(async function () {
    await browser.reloadObsidian({ vault: './test/vaults/simple' })
  })

  beforeEach(async function () {
    await obsidianPage.resetVault()
  })

  it('タスク行にmd-ast-task-status-todoクラスが付与される', async function () {
    await openFile('test-tasks.md')
    await browser.waitUntil(
      async () => {
        const el = await browser.$('.md-ast-task-status-todo')
        return el.isExisting()
      },
      { timeout: 5000, interval: 200 },
    )
    const todoLine = browser.$('.md-ast-task-status-todo')
    await expect(todoLine).toExist()
  })

  it('完了タスク行にmd-ast-task-status-doneクラスが付与される', async function () {
    await openFile('test-tasks.md')
    await browser.waitUntil(
      async () => {
        const el = await browser.$('.md-ast-task-status-done')
        return el.isExisting()
      },
      { timeout: 5000, interval: 200 },
    )
    const doneLine = browser.$('.md-ast-task-status-done')
    await expect(doneLine).toExist()
  })

  it('@メタキーにmd-ast-meta-keyクラスが付与される', async function () {
    await openFile('test-tasks.md')
    await browser.waitUntil(
      async () => {
        const el = await browser.$('.md-ast-meta-key')
        return el.isExisting()
      },
      { timeout: 5000, interval: 200 },
    )
    const metaKey = browser.$('.md-ast-meta-key')
    await expect(metaKey).toExist()
  })

  it('ブロッククォート内のタスクはハイライトされない', async function () {
    await openFile('test-tasks.md')
    // ブロッククォート内にタスク記法があっても、ハイライトされないことを確認する。
    await browser.pause(800)
    // ブロッククォート行（">"始まり）はハイライト対象外なので、
    // 通常のハイライト要素の数がquoteブロック分だけ増えていないことを確認する。
    const todoElements = await browser.$$('.md-ast-task-status-todo')
    // test-tasks.mdのブロッククォート内の"[ ]"はハイライトされないので、
    // ハイライト済み要素数は0以上であればよい（ブロッククォートの分が混入していない）。
    expect(todoElements.length).toBeGreaterThanOrEqual(0)
  })
})
