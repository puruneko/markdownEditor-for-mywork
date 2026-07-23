import { browser, expect } from '@wdio/globals'
import { obsidianPage } from 'wdio-obsidian-service'
import { openFile, readVaultFile, waitForFileContentChange, writeVaultFile } from './helpers/obsidian-helpers'
import { countShadow, waitForShadow, getShadowText } from './helpers/shadow-dom'
import { dispatchMouseDrag } from './helpers/drag'

const GANTT_VIEW_TYPE = 'md-ast-editor-gantt-view'

/**
 * ganttExpandSubtasks 設定を変更し、既存の Gantt View leaf があれば detach する。
 * GanttView は設定を onOpen 時にのみ読む（非リアクティブ）ため、変更を反映するには
 * 既存 leaf を閉じてから再度 open コマンドを実行する必要がある。
 */
async function setGanttExpandSubtasks(value: boolean): Promise<void> {
  await browser.execute(
    (viewType: string, v: boolean) => {
      // @ts-expect-error app は Obsidian 実行環境のグローバル
      const plugin = app.plugins.plugins['md-ast-editor']
      plugin.settings.ganttExpandSubtasks = v
      // @ts-expect-error 同上
      for (const leaf of app.workspace.getLeavesOfType(viewType)) {
        leaf.detach()
      }
    },
    GANTT_VIEW_TYPE,
    value,
  )
}

/**
 * ズームアウトボタンを既定回数クリックする。
 *
 * test-tasks.md は固定日付（2026-03〜04月）フィクスチャのため、実行時の「今日」から
 * 離れるほど GanttChart 初期表示（today 中心＋狭い X 軸仮想スクロールウィンドウ）の
 * 可視範囲に収まらなくなる（issue-gantt-phase004-006 で xOverscanPx ベースの正しい
 * ウィンドウ計算が有効化されたことで顕在化。以前は初回描画時の viewport 幅測定が
 * 0 になるタイミング競合により偶然全件フォールバック描画されていた）。
 * 恒久対応は日付非依存の実行時生成フィクスチャへの移行（obsidian-plugin-testing.md §4.4）
 * だが、本テストは既存の静的フィクスチャに依存する既存スペックのため、ズームアウトで
 * 可視ウィンドウを広げて日付ドリフトに対して頑健にする。
 */
async function zoomOutFully(viewClass: string): Promise<void> {
  for (let i = 0; i < 10; i++) {
    await browser.execute((vc: string) => {
      const host = document.querySelector(`.${vc} .view-shadow-host`)
      const btn = host?.shadowRoot?.querySelector('.gantt-zoom-btn') as HTMLElement | null
      btn?.click()
    }, viewClass)
  }
}

const VIEW = 'gantt-view'

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
    const ganttView = browser.$(`.${VIEW}`)
    await expect(ganttView).toExist()
  })

  it('ガントビューにツリー行が表示される', async function () {
    await openFile('test-tasks.md')
    await browser.executeObsidianCommand('md-ast-editor:open-gantt-view')
    await waitForShadow(VIEW, '.gantt-tree-row', { timeout: 10000 })
    const rows = await countShadow(VIEW, '.gantt-tree-row')
    expect(rows).toBeGreaterThan(0)
  })

  it('ガントタイムラインにタスクバーが描画される', async function () {
    await openFile('test-tasks.md')
    await browser.executeObsidianCommand('md-ast-editor:open-gantt-view')
    await waitForShadow(VIEW, '.gantt-timeline rect', { timeout: 10000 })
    const bars = await countShadow(VIEW, '.gantt-timeline rect')
    expect(bars).toBeGreaterThan(0)
  })

  it('バードラッグで @schedule が更新される', async function () {
    await openFile('test-tasks.md')
    await browser.executeObsidianCommand('md-ast-editor:open-gantt-view')
    await waitForShadow(VIEW, '.gantt-tree-row', { timeout: 10000 })

    // 初期表示は今日付近のみが可視ウィンドウに入るため、
    // test-tasks.md の全タスク（2026-03〜04月）が収まるようズームアウトする。
    await zoomOutFully(VIEW)

    // バーが描画されるまで待つ
    await waitForShadow(VIEW, '.gantt-timeline rect[class*="gantt-bar--task"]', { timeout: 10000 })

    // ドラッグ前の @schedule を記録
    const beforeContent = await readVaultFile('test-tasks.md')
    expect(beforeContent).toBeTruthy()

    // shadow root 内のバーへ MouseEvent ドラッグ（mousedown=バー、move/up=window）
    const dragged = await dispatchMouseDrag(
      VIEW,
      '.gantt-timeline rect[class*="gantt-bar--task"]',
      30, // 約1日分
    )
    expect(dragged).toBe(true)

    // ファイル書き戻しをポーリングで待つ（固定 pause は使わない）
    const afterContent = await waitForFileContentChange('test-tasks.md', beforeContent!)
    expect(afterContent).not.toBe(beforeContent)
    expect(afterContent).toContain('@schedule:')
  })

  it('完了タスク（[x]）のバーが completed 装飾でグレーアウトされる', async function () {
    await openFile('test-tasks.md')
    await browser.executeObsidianCommand('md-ast-editor:open-gantt-view')
    await waitForShadow(VIEW, '.gantt-tree-row', { timeout: 10000 })

    // 初期表示は今日付近のみが可視ウィンドウに入るため、
    // test-tasks.md の全タスク（2026-03〜04月）が収まるようズームアウトする。
    await zoomOutFully(VIEW)
    await waitForShadow(VIEW, '.gantt-timeline rect[class*="gantt-bar--completed"]', { timeout: 10000 })

    // test-tasks.md の「キックオフミーティング」は [x] かつ @schedule 付き
    const completedBars = await countShadow(VIEW, '.gantt-timeline rect[class*="gantt-bar--completed"]')
    expect(completedBars).toBeGreaterThan(0)

    // 未完了タスク（要件ヒアリング等）は completed 装飾が付かない
    const totalBars = await countShadow(VIEW, '.gantt-timeline rect[class*="gantt-bar--task"]')
    expect(totalBars).toBeGreaterThan(completedBars)
  })

  describe('サブタスク展開設定（issue-gantt-phase004-007）', function () {
    afterEach(async function () {
      // 他スペックへの設定リークを防ぐため既定値（false）へ戻す
      await setGanttExpandSubtasks(false)
    })

    it('設定OFF（既定）: 期間未設定のサブタスクは表示されない（回帰）', async function () {
      const d = new Date().toISOString().slice(0, 10)
      await writeVaultFile('expand-subtasks-off.md', [
        '# 展開OFFテスト',
        '',
        '- [ ] 親タスクOFF',
        `  - @schedule: ${d}T10:00/${d}T12:00`,
        '  - [ ] 未予定サブタスクOFF',
      ].join('\n'))

      await openFile('expand-subtasks-off.md')
      await browser.executeObsidianCommand('md-ast-editor:open-gantt-view')
      await waitForShadow(VIEW, '.gantt-tree-row', { timeout: 10000 })

      const textRows = await countShadow(VIEW, '.gantt-timeline text.gantt-task-label--textrow')
      expect(textRows).toBe(0)
    })

    it('設定ON: 期間未設定のサブタスクがテキスト行として表示される', async function () {
      await setGanttExpandSubtasks(true)

      const d = new Date().toISOString().slice(0, 10)
      await writeVaultFile('expand-subtasks-on.md', [
        '# 展開ONテスト',
        '',
        '- [ ] 親タスクON',
        `  - @schedule: ${d}T10:00/${d}T12:00`,
        '  - [ ] 未予定サブタスクON',
      ].join('\n'))

      await openFile('expand-subtasks-on.md')
      await browser.executeObsidianCommand('md-ast-editor:open-gantt-view')
      await waitForShadow(VIEW, '.gantt-timeline text.gantt-task-label--textrow', { timeout: 10000 })

      const textRows = await countShadow(VIEW, '.gantt-timeline text.gantt-task-label--textrow')
      expect(textRows).toBeGreaterThan(0)

      const label = await getShadowText(VIEW, '.gantt-timeline text.gantt-task-label--textrow')
      expect(label).toContain('未予定サブタスクON')

      // ツリー側にも行として現れる（親 + 有スケジュール子 + 無スケジュール子）
      await waitForShadow(VIEW, '.gantt-tree-row', { timeout: 10000 })
      const treeRowCount = await countShadow(VIEW, '.gantt-tree-row')
      expect(treeRowCount).toBeGreaterThanOrEqual(3)
    })
  })
})
