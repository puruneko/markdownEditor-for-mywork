import { browser, expect } from '@wdio/globals'
import { obsidianPage } from 'wdio-obsidian-service'
import { openFile, writeVaultFile } from './helpers/obsidian-helpers'
import { waitForShadow, countShadow, clickShadow, getShadowText } from './helpers/shadow-dom'

/**
 * issue-phase012-markdownEditor-002: リロードボタンが機能しない不具合の再現確認と原因の切り分け。
 * この issue は調査のみを目的とし、コードの修正は行わない（結果は本ファイルの History に記録する）。
 */
describe('リロードボタンの再現確認・原因の切り分け（issue-phase012-markdownEditor-002・調査のみ）', function () {
  before(async function () {
    await browser.reloadObsidian({ vault: './test/vaults/simple' })
  })

  beforeEach(async function () {
    await obsidianPage.resetVault()
  })

  it('H3判定: Calendar タブで、ディスク上の変更後にリロードボタンを押すと最新内容が反映される', async function () {
    const fileName = 'reload-calendar.md'
    const d = new Date().toISOString().slice(0, 10)
    await writeVaultFile(fileName, `- [ ] 元のタスク\n  - @schedule: ${d}T09:00/${d}T10:00\n`)
    await openFile(fileName)
    await browser.executeObsidianCommand('md-ast-editor:open-calendar-view')
    await waitForShadow('calendar-view', '.week-view, .month-view', { timeout: 10000 })

    // ディスク上の内容を直接書き換える（app.vault.modify 相当。エディタは経由しない）。
    await writeVaultFile(
      fileName,
      `- [ ] 元のタスク\n  - @schedule: ${d}T09:00/${d}T10:00\n- [ ] 新しいタスクH3\n  - @schedule: ${d}T11:00/${d}T12:00\n`,
    )

    const clicked = await clickShadow('calendar-view', '.reload-btn')
    expect(clicked).toBe(true)

    await browser.waitUntil(
      async () => {
        const html = await browser.execute((vc: string) => {
          const host = document.querySelector(`.${vc} .view-shadow-host`)
          return host?.shadowRoot?.innerHTML ?? ''
        }, 'calendar-view')
        return html.includes('新しいタスクH3')
      },
      { timeout: 5000, interval: 200, timeoutMsg: 'リロード後も新しいタスクがCalendarに反映されない（H3の可能性）' },
    )
  })

  it('H3判定: Gantt タブで、ディスク上の変更後にリロードボタンを押すと最新内容が反映される', async function () {
    const fileName = 'reload-gantt.md'
    await writeVaultFile(fileName, '- [ ] 元のタスク\n  - @schedule: 2026-04-01T09:00/2026-04-01T10:00\n')
    await openFile(fileName)
    await browser.executeObsidianCommand('md-ast-editor:open-gantt-view')
    await waitForShadow('gantt-view', '.gantt-tree-row', { timeout: 10000 })

    await writeVaultFile(
      fileName,
      '- [ ] 元のタスク\n  - @schedule: 2026-04-01T09:00/2026-04-01T10:00\n- [ ] 新しいタスクH3gantt\n  - @schedule: 2026-04-02T09:00/2026-04-02T10:00\n',
    )

    const clicked = await clickShadow('gantt-view', '.reload-btn')
    expect(clicked).toBe(true)

    await browser.waitUntil(
      async () => (await countShadow('gantt-view', '.gantt-tree-row')) >= 2,
      { timeout: 5000, interval: 200, timeoutMsg: 'リロード後も新しいタスクがGanttに反映されない（H3の可能性）' },
    )
  })

  it('H3判定: Kanban タブで、ディスク上の変更後にリロードボタンを押すと最新内容が反映される', async function () {
    const fileName = 'reload-kanban.md'
    await writeVaultFile(fileName, '- [ ] 元のタスク\n')
    await openFile(fileName)
    await browser.executeObsidianCommand('md-ast-editor:open-kanban-view')
    await waitForShadow('kanban-view', '[data-card-id]', { timeout: 10000 })

    await writeVaultFile(fileName, '- [ ] 元のタスク\n- [ ] 新しいタスクH3kanban\n')

    const clicked = await clickShadow('kanban-view', '.reload-btn')
    expect(clicked).toBe(true)

    await browser.waitUntil(
      async () => (await countShadow('kanban-view', '[data-card-id]')) >= 2,
      { timeout: 5000, interval: 200, timeoutMsg: 'リロード後も新しいタスクがKanbanに反映されない（H3の可能性）' },
    )
  })

  it('H1判定: エディタで未保存の編集がある状態でリロードを押すと、ディスク上の（編集前の）内容のまま表示される', async function () {
    const fileName = 'reload-unsaved.md'
    await writeVaultFile(fileName, '- [ ] 保存済みタスク\n')
    await openFile(fileName)
    await browser.executeObsidianCommand('md-ast-editor:open-kanban-view')
    await waitForShadow('kanban-view', '[data-card-id]', { timeout: 10000 })

    // ディスクへ保存せず、エディタのバッファのみを書き換える（vault.modify を呼ばない）。
    await browser.execute(() => {
      const app = (window as any).app
      const editor = app.workspace.activeEditor.editor
      const lastLine = editor.lastLine()
      editor.replaceRange('- [ ] 未保存タスクH1\n', { line: lastLine + 1, ch: 0 }, { line: lastLine + 1, ch: 0 })
    })

    // 未保存の変更がエディタ上に存在することを確認する（前提の検証）。
    const editorContent = await browser.execute(() => {
      const app = (window as any).app
      return app.workspace.activeEditor.editor.getValue()
    })
    expect(editorContent).toContain('未保存タスクH1')

    // リロード直後は、ディスク上の内容（未保存タスクを含まない）のままであることを期待する。
    await clickShadow('kanban-view', '.reload-btn')

    // 反映されないことの確認のため、十分な猶予を与えた上で判定する。
    await browser.pause(1000)
    const hasUnsavedTaskInView = await browser.execute((vc: string) => {
      const host = document.querySelector(`.${vc} .view-shadow-host`)
      return (host?.shadowRoot?.innerHTML ?? '').includes('未保存タスクH1')
    }, 'kanban-view')

    // このアサーションが失敗する（＝未保存の内容が反映される）ようであれば、H1 は原因ではない。
    expect(hasUnsavedTaskInView).toBe(false)
  })

  it('H2判定: リロードボタンをクリックしても、処理中・完了を示す視覚的フィードバック要素が存在しない', async function () {
    const fileName = 'reload-feedback.md'
    await writeVaultFile(fileName, '- [ ] タスク\n')
    await openFile(fileName)
    await browser.executeObsidianCommand('md-ast-editor:open-kanban-view')
    await waitForShadow('kanban-view', '[data-card-id]', { timeout: 10000 })

    await clickShadow('kanban-view', '.reload-btn')

    // クリック直後・直前でリロードボタン自体の見た目（クラス・テキスト）が変化しないことを確認する
    // （spinner・disabled 状態・完了メッセージ等、フィードバックを示す仕組みが無いことの傍証）。
    const textAfter = await getShadowText('kanban-view', '.reload-btn')
    expect(textAfter).toBe('⟳')
    const hasLoadingIndicator = await browser.execute((vc: string) => {
      const host = document.querySelector(`.${vc} .view-shadow-host`)
      const root = host?.shadowRoot
      if (!root) return false
      return !!(
        root.querySelector('[aria-busy="true"]') ||
        root.querySelector('.loading') ||
        root.querySelector('.spinner')
      )
    }, 'kanban-view')
    expect(hasLoadingIndicator).toBe(false)
  })

  it('H4判定: Dashboard タブにはリロードボタン（FilterBar）自体が存在しない', async function () {
    await openFile('test-tasks.md')
    await browser.executeObsidianCommand('md-ast-editor:open-dashboard-view')
    await waitForShadow('dashboard-view', '.dashboard-mount', { timeout: 10000 })

    const reloadBtnCount = await countShadow('dashboard-view', '.reload-btn')
    expect(reloadBtnCount).toBe(0)
  })
})
