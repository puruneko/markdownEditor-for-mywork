import { browser, expect } from '@wdio/globals'
import { obsidianPage } from 'wdio-obsidian-service'
import { openFile, writeVaultFile, waitForFileContentChange } from './helpers/obsidian-helpers'

/**
 * issue-phase013-markdownEditor-002: リスト先頭の「@」でschedule/plan/dueをサジェストし、
 * 選択時に日付ピッカーを自動的に開く機能のobs-e2eテスト。
 *
 * ObsidianのEditorSuggestは実際のユーザー入力イベントに対してのみトリガーされ、
 * `Editor.replaceRange` によるプログラム的な変更では発火しない（issue-phase014-markdownEditor-002
 * の調査で判明）。そのため、実際のキー入力（`browser.keys`）で1文字ずつ入力するヘルパーを使う。
 */
async function typeAtEndOfLine(lineIndex: number, text: string): Promise<void> {
  await browser.execute((line: number) => {
    const app = (window as any).app
    const editor = app.workspace.activeEditor.editor
    editor.setCursor({ line, ch: editor.getLine(line).length })
    editor.focus()
  }, lineIndex)
  await browser.keys(text.split(''))
}

describe('リスト先頭「@」サジェスト（issue-phase013-markdownEditor-002）', function () {
  before(async function () {
    await browser.reloadObsidian({ vault: './test/vaults/simple' })
  })

  beforeEach(async function () {
    await obsidianPage.resetVault()
  })

  it('リスト先頭で「@」を入力するとschedule/plan/dueの3候補が表示される', async function () {
    const fileName = 'metatag-suggest-open.md'
    await writeVaultFile(fileName, ['- [ ] タスク', '  - '].join('\n'))
    await openFile(fileName)

    await typeAtEndOfLine(1, '@')

    await browser.waitUntil(async () => (await browser.$$('.suggestion-item')).length === 3, {
      timeout: 3000,
      interval: 100,
      timeoutMsg: '「@」入力で3件の候補（schedule/plan/due）が表示されない',
    })
  })

  it('リストの先頭以外（文中）で「@」を入力してもサジェストは表示されない', async function () {
    const fileName = 'metatag-suggest-midline.md'
    await writeVaultFile(fileName, ['- [ ] タスク', '  - text '].join('\n'))
    await openFile(fileName)

    await typeAtEndOfLine(1, '@')
    await browser.pause(300)
    expect((await browser.$$('.suggestion-item')).length).toBe(0)
  })

  it('候補にない文字列（@memo）を入力するとサジェストが表示されない（自由入力できる）', async function () {
    const fileName = 'metatag-suggest-memo.md'
    const before = ['- [ ] タスク', '  - '].join('\n') + '\n'
    await writeVaultFile(fileName, before)
    await openFile(fileName)

    await typeAtEndOfLine(1, '@memo')
    await browser.pause(300)
    expect((await browser.$$('.suggestion-item')).length).toBe(0)

    const after = await waitForFileContentChange(fileName, before)
    expect(after).toBe(['- [ ] タスク', '  - @memo'].join('\n') + '\n')
  })

  it('候補からplanを選択すると @plan: が挿入され、日付ピッカーが自動的に開く', async function () {
    const fileName = 'metatag-suggest-select.md'
    await writeVaultFile(fileName, ['- [ ] タスク', '  - '].join('\n'))
    await openFile(fileName)

    await typeAtEndOfLine(1, '@pl')
    await browser.waitUntil(async () => (await browser.$$('.suggestion-item')).length >= 1, {
      timeout: 3000,
      interval: 100,
      timeoutMsg: '「@pl」入力で候補（plan）が表示されない',
    })
    await browser.$('.suggestion-item').click()

    await browser.waitUntil(async () => (await browser.$('.metatag-picker-popup')).isExisting(), {
      timeout: 3000,
      interval: 100,
      timeoutMsg: '候補選択後にピッカーが自動的に開かない',
    })

    const lineText = await browser.execute(() => {
      const app = (window as any).app
      const editor = app.workspace.activeEditor.editor
      return editor.getLine(1) as string
    })
    expect(lineText).toBe('  - @plan:')
  })

  it('issue-phase014-markdownEditor-002: Tabキーでも選択中の候補が決定され、日付ピッカーが自動的に開く', async function () {
    const fileName = 'metatag-suggest-tab.md'
    await writeVaultFile(fileName, ['- [ ] タスク', '  - '].join('\n'))
    await openFile(fileName)

    await typeAtEndOfLine(1, '@pl')
    await browser.waitUntil(async () => (await browser.$$('.suggestion-item')).length >= 1, {
      timeout: 3000,
      interval: 100,
      timeoutMsg: '「@pl」入力で候補（plan）が表示されない',
    })

    await browser.keys(['Tab'])

    await browser.waitUntil(async () => (await browser.$('.metatag-picker-popup')).isExisting(), {
      timeout: 3000,
      interval: 100,
      timeoutMsg: 'Tabキーでの決定後にピッカーが自動的に開かない',
    })

    const lineText = await browser.execute(() => {
      const app = (window as any).app
      const editor = app.workspace.activeEditor.editor
      return editor.getLine(1) as string
    })
    expect(lineText).toBe('  - @plan:')
  })

  it('issue-phase014-markdownEditor-002: サジェスト非表示中はTabキーが従来通りインデント操作として機能する', async function () {
    const fileName = 'metatag-suggest-tab-regression.md'
    await writeVaultFile(fileName, ['- [ ] タスク', '  - text'].join('\n'))
    await openFile(fileName)

    // サジェストが表示されていないことを確認した上で、行末にカーソルを置きTabキーを押す。
    expect((await browser.$$('.suggestion-item')).length).toBe(0)
    await browser.execute(() => {
      const app = (window as any).app
      const editor = app.workspace.activeEditor.editor
      editor.setCursor({ line: 1, ch: editor.getLine(1).length })
      editor.focus()
    })
    await browser.keys(['Tab'])

    await browser.waitUntil(
      async () => {
        const lineText = await browser.execute(() => {
          const app = (window as any).app
          const editor = app.workspace.activeEditor.editor
          return editor.getLine(1) as string
        })
        // Obsidianの標準Tab挙動は行頭にタブ文字を1つ追加するインデントであり、
        // スペースへの変換は行わない。
        return lineText === '\t  - text'
      },
      { timeout: 3000, interval: 100, timeoutMsg: 'サジェスト非表示時にTabキーがインデント操作として機能しない' },
    )
  })
})
