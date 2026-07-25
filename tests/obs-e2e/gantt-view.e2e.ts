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
  // leaf.detach() の反映が非同期のため、既存 leaf が完全に消えるまで待つ。
  // 未完了のまま次の open-gantt-view コマンドを実行すると、detach 中の古い
  // leaf が existing-leaf 判定に引っかかり、新規 leaf が作られず古い内容が
  // 表示され続けることがある。
  await browser.waitUntil(
    async () =>
      browser.execute(
        (viewType: string) => {
          // @ts-expect-error app は Obsidian 実行環境のグローバル
          return app.workspace.getLeavesOfType(viewType).length === 0
        },
        GANTT_VIEW_TYPE,
      ),
    { timeout: 5000, interval: 100, timeoutMsg: 'Gantt View leaf の detach が完了しない' },
  )
}

/**
 * 指定したタスク名がツリーペイン・タイムラインの両方に現れるまで Gantt View を開き直す。
 *
 * Obsidian の leaf 破棄・AstIndex の反映タイミングには実行環境依存のばらつきがあり、
 * 稀に開き直した View が直前の内容のまま更新されない、あるいはツリーペインのみ
 * 更新されタイムラインの再描画が追いつかないことがある（本体・ライブラリのロジックには
 * 依存しない、実機特有のタイミング事象）。確実性を優先し、一定時間内に目的の内容が
 * 両ペインに現れなければ leaf を作り直してリトライする。
 */
async function openGanttViewUntilTaskVisible(taskName: string, maxAttempts = 5): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await setGanttExpandSubtasks(true)
    await browser.executeObsidianCommand('md-ast-editor:open-gantt-view')
    try {
      await browser.waitUntil(
        async () =>
          browser.execute(
            (vc: string, name: string) => {
              const host = document.querySelector(`.${vc} .view-shadow-host`)
              const root = host?.shadowRoot
              const inTree = [...(root?.querySelectorAll('.gantt-tree-row .gantt-node-name') ?? [])]
                .some((r) => r.textContent?.trim() === name)
              const inTimeline = [...(root?.querySelectorAll('.gantt-timeline text') ?? [])]
                .some((e) => (e.textContent ?? '').includes(name))
              return inTree && inTimeline
            },
            VIEW,
            taskName,
          ),
        { timeout: 4000, interval: 300 },
      )
      return
    } catch {
      if (attempt === maxAttempts) {
        throw new Error(`${taskName} が Gantt View に反映されない（${maxAttempts} 回リトライ後）`)
      }
    }
  }
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
      // 他スペックへの設定リークを防ぐため既定値（true。2026-07-23 に既定変更）へ戻す
      await setGanttExpandSubtasks(true)
    })

    it('設定OFF（明示的にOFFへ変更した場合）: 期間未設定のサブタスクは表示されない（回帰）', async function () {
      await setGanttExpandSubtasks(false)

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

    it('設定ON（既定）: 期間未設定のサブタスクがテキスト行として表示される', async function () {
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

  describe('期間なしサブタスクのドラッグ予定化（issue-gantt-phase004-008）', function () {
    beforeEach(async function () {
      await setGanttExpandSubtasks(true)
    })

    afterEach(async function () {
      // 既定値（true）へ戻す
      await setGanttExpandSubtasks(true)
    })

    it('テキスト行をタイムラインへドラッグすると @schedule が書き込まれ、バーが描画される', async function () {
      // タスク名は他スペックが vault に残した同名フィクスチャ（AstIndex が保持したまま
      // 一覧に残る場合がある）と衝突しないよう、この spec 専用の一意な名前にする。
      const taskName = '未予定サブタスク008DnD'
      const d = new Date().toISOString().slice(0, 10)
      await writeVaultFile('unscheduled-drag.md', [
        '# ドラッグ予定化テスト',
        '',
        '- [ ] 親タスク008DnD',
        `  - @schedule: ${d}T10:00/${d}T12:00`,
        `  - [ ] ${taskName}`,
      ].join('\n'))

      await openFile('unscheduled-drag.md')

      // Obsidian の leaf 再生成タイミングにはばらつきがあるため、対象タスクが
      // ツリーペイン・タイムラインの両方に現れるまで Gantt View を開き直す（ヘルパ内でリトライする）。
      await openGanttViewUntilTaskVisible(taskName)
      await waitForShadow(VIEW, '.gantt-timeline text.gantt-task-label--textrow', { timeout: 10000 })

      // Gantt View は既定で右サイドバー（幅が狭い）に開く。狭いままだとテキスト行が
      // 可視範囲の端に位置し、ドラッグ操作の座標が isWithinTimeline の判定で
      // 「タイムライン外」と誤判定されうる。サイドバー幅を広げ、「今日」が可視範囲に
      // 入るようズームアウトする（バードラッグのテストと同様の対処）。
      await browser.execute(() => {
        const split = document.querySelector('.workspace-split.mod-right-split') as HTMLElement | null
        if (split) split.style.width = '900px'
      })
      await browser.pause(300)
      await zoomOutFully(VIEW)

      const beforeContent = await readVaultFile('unscheduled-drag.md')
      expect(beforeContent).toBeTruthy()
      expect(beforeContent).not.toContain(`${taskName}\n    - @schedule`)

      // テキスト行を見つけてドラッグする。AstIndex は vault 全体を横断するため、
      // 他スペックが作成したフィクスチャの期間なしサブタスク行が同時に表示されうる
      // （テキスト内容の完全一致で絞り込む）。タイムラインの再描画がツリーペインより
      // 遅れることがある実機特有のタイミング事象があるため、要素が見つかるまでリトライする。
      await browser.waitUntil(
        async () =>
          browser.execute((vc: string, name: string) => {
            const host = document.querySelector(`.${vc} .view-shadow-host`)
            const root = host?.shadowRoot
            if (!root) return false
            const els = [...root.querySelectorAll('.gantt-timeline text.gantt-task-label--textrow')]
            const el = els.find((e) => e.textContent === `・${name}`) as SVGElement | undefined
            if (!el) return false

            const container = root.querySelector('.gantt-timeline-wrapper') as HTMLElement | null
            const r = el.getBoundingClientRect()
            const cx = r.x + r.width / 2
            const cy = r.y + r.height / 2

            // 右サイドバーの狭いビューポートでも isWithinTimeline の判定内に収まるよう、
            // コンテナ中心へ向かう方向（正味 1 日分弱の移動量）にドラッグする。
            let dx = 20
            if (container) {
              const cr = container.getBoundingClientRect()
              const containerCenterX = cr.x + cr.width / 2
              if (cx > containerCenterX) dx = -20
            }

            el.dispatchEvent(new MouseEvent('mousedown', {
              bubbles: true, cancelable: true, composed: true, clientX: cx, clientY: cy,
            }))
            window.dispatchEvent(new MouseEvent('mousemove', {
              bubbles: true, clientX: cx + dx, clientY: cy,
            }))
            window.dispatchEvent(new MouseEvent('mouseup', {
              bubbles: true, clientX: cx + dx, clientY: cy,
            }))
            return true
          }, VIEW, taskName),
        { timeout: 10000, interval: 300, timeoutMsg: `${taskName} のテキスト行が見つからずドラッグできない` },
      )

      // ファイル書き戻しをポーリングで待つ
      const afterContent = await waitForFileContentChange('unscheduled-drag.md', beforeContent!)
      expect(afterContent).not.toBe(beforeContent)
      expect(afterContent).toContain(taskName)
      expect(afterContent).toMatch(new RegExp(`${taskName}\\n\\s+- @schedule: \\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}/\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}`))

      // 再描画でテキスト行が消え、通常のタスクバーになる（バー描画は他コンポーネントテストでも
      // 確認済みだが、実機での書き戻し→再パース→再描画の一連の流れをここで確認する）
      await browser.waitUntil(
        async () =>
          browser.execute((vc: string, name: string) => {
            const host = document.querySelector(`.${vc} .view-shadow-host`)
            const root = host?.shadowRoot
            const els = [...(root?.querySelectorAll('.gantt-timeline text.gantt-task-label--textrow') ?? [])]
            return !els.some((e) => e.textContent === `・${name}`)
          }, VIEW, taskName),
        { timeout: 10000, interval: 300, timeoutMsg: `${taskName} のテキスト行が予定化後も残っている` },
      )
    })
  })
})
