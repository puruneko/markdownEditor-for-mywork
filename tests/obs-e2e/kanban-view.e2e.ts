import { browser, expect } from '@wdio/globals'
import { obsidianPage } from 'wdio-obsidian-service'
import { openFile, readVaultFile, writeVaultFile, waitForFileContentChange } from './helpers/obsidian-helpers'
import {
  countShadow,
  waitForShadow,
  getShadowOrder,
  getShadowRect,
  clickShadow,
  setShadowSelectValue,
  setShadowInputValue,
} from './helpers/shadow-dom'
import { dragKanbanCard, dispatchPointerDrag } from './helpers/drag'
import { captureView } from './helpers/screenshot'

const VIEW = 'kanban-view'

// テスト対象ファイルは実行時生成する。
// 静的フィクスチャを DnD で変更すると、resetVault の復元経路（base64→atob）に
// 上流バグがあり UTF-8（日本語）が Latin-1 化けする。実行時生成ファイルは
// リセット時に「削除」されるだけなので化けない。
const BOARD_FILE = 'kanban-live.md'
const BOARD_MD = [
  '# カンバンテスト',
  '',
  '## 案件X',
  '',
  '- [ ] タスクA',
  '  - [ ] サブa',
  '  - [>] サブb',
  '    - [ ] 孫x',
  '    - [ ] 孫y',
  '  - [ ] サブc',
  '- [>] タスクB',
  '- [x] タスクC',
  '- [!] タスクD',
  '',
  '## 案件Y',
  '',
  '- 準備ユニット',
  '  - [ ] タスクF',
  '  - [ ] タスクG',
  '- [-] タスクE',
].join('\n')

/**
 * カードタイトルから data-card-id（globalKey）を解決する。node.id は自動生成のためハードコードできない。
 * カードグループ要素の textContent は子カードのタイトルも含むため、
 * 「data-card-id を子孫に持たない最内カード」を優先して選ぶ。
 */
async function getCardIdByTitle(title: string): Promise<string | null> {
  return browser.execute(
    (vc: string, t: string) => {
      const host = document.querySelector(`.${vc} .view-shadow-host`)
      const root = host?.shadowRoot
      if (!root) return null
      const matches = Array.from(root.querySelectorAll('[data-card-id]')).filter((el) =>
        (el.textContent ?? '').includes(t),
      )
      const innermost = matches.find((el) => !el.querySelector('[data-card-id]'))
      const chosen = innermost ?? matches[0]
      return chosen ? chosen.getAttribute('data-card-id') : null
    },
    VIEW,
    title,
  )
}

/** グルーピングを「なし」（ステータスレーン）へ切り替え、切替の成立を確認する。 */
async function switchToStatusLanes(): Promise<void> {
  const ok = await setShadowSelectValue(VIEW, 'select.kanban-groupby-select', '')
  expect(ok).toBe(true)
  await browser.waitUntil(
    async () => {
      const lanes = await getShadowOrder(VIEW, '.kanban-board', '.kanban-lane[data-lane-id]', 'data-lane-id')
      return lanes.includes('ready') && lanes.includes('in_progress') && lanes.includes('done')
    },
    { timeout: 10000, interval: 500, timeoutMsg: 'ステータスレーンへの切替が反映されない' },
  )
}

describe('カンバンビュー', function () {
  before(async function () {
    await browser.reloadObsidian({ vault: './test/vaults/simple' })
  })

  beforeEach(async function () {
    await obsidianPage.resetVault()
    await writeVaultFile(BOARD_FILE, BOARD_MD)
    await openFile(BOARD_FILE)
    await browser.executeObsidianCommand('md-ast-editor:open-kanban-view')
    // コンテナではなくカード本体が描画されるまで待つ（obs-0008 対策）
    await browser.waitUntil(
      async () => (await getCardIdByTitle('タスクA')) !== null,
      { timeout: 10000, interval: 500, timeoutMsg: '生成したボードのカードが描画されない' },
    )
  })

  it('カンバンにフィクスチャのカードが表示される', async function () {
    // indexScope=vault のため全ファイルのカードが載る。タイトルで対象カードを特定する
    for (const title of ['タスクA', 'タスクB', 'タスクC', 'タスクF']) {
      const id = await getCardIdByTitle(title)
      expect(id).not.toBeNull()
      expect(id).toContain('kanban-live.md::')
    }
  })

  it('グルーピングをステータスに切り替えるとレーン構成が変わる', async function () {
    await switchToStatusLanes()
    const lanes = await getShadowOrder(VIEW, '.kanban-board', '.kanban-lane[data-lane-id]', 'data-lane-id')
    for (const laneId of ['planning', 'ready', 'in_progress', 'waiting', 'deferred', 'done', 'cancelled']) {
      expect(lanes).toContain(laneId)
    }
  })

  it('カードDnDでステータスが書き戻され、かつカードが移動先レーンに表示される', async function () {
    await switchToStatusLanes()

    const cardId = await getCardIdByTitle('タスクF')
    expect(cardId).not.toBeNull()

    // ドラッグ前の状態を確認：ready レーンに存在し、markdown は "- [ ] タスクF"
    const before = await readVaultFile('kanban-live.md')
    expect(before).toContain('- [ ] タスクF')
    const readyBefore = await getShadowOrder(
      VIEW, '.kanban-lane[data-lane-id="ready"] .kanban-lane-body', '[data-card-id]', 'data-card-id')
    expect(readyBefore).toContain(cardId!)

    // in_progress レーンへドラッグ
    const dragged = await dragKanbanCard(cardId!, { laneId: 'in_progress' })
    expect(dragged).toBe(true)

    // ① markdown への書き戻し
    const after = await waitForFileContentChange('kanban-live.md', before!)
    expect(after).toContain('- [>] タスクF')

    // ② DOM 上の表示位置：in_progress レーンに現れ、ready レーンから消える
    //    （書き戻しだけ検証すると「表示が動かない」バグを見逃す — issue-phase000-003 の教訓）
    await browser.waitUntil(
      async () => {
        const inProgress = await getShadowOrder(
          VIEW, '.kanban-lane[data-lane-id="in_progress"] .kanban-lane-body', '[data-card-id]', 'data-card-id')
        return inProgress.includes(cardId!)
      },
      { timeout: 10000, interval: 500, timeoutMsg: 'カードが in_progress レーンに表示されない' },
    )
    const readyAfter = await getShadowOrder(
      VIEW, '.kanban-lane[data-lane-id="ready"] .kanban-lane-body', '[data-card-id]', 'data-card-id')
    expect(readyAfter).not.toContain(cardId!)

    // 目視レビュー用の証跡
    await captureView('kanban-after-dnd')
  })

  // TODO(issue-phase000-003): サブカードグループ DnD の表示位置バグ修正後に skip を外す
  // 補足: グループ内のコンパクトカードは pointerdown ハンドラを持たず、掴むと親グループごと
  // ドラッグされる（ライブラリ仕様）。ユーザー報告の「サブカードグループの DnD」は
  // ネストしたカードグループ（ここでは 孫x/孫y を持つ「サブb」）のドラッグとして再現する。
  it.skip('サブカードグループのDnDで表示位置が更新される', async function () {
    await switchToStatusLanes()

    // カードグループ表示を ON → 全展開（ネストしたグループを描画させる）
    const toggled = await clickShadow(VIEW, '.kanban-cardgroup-controls input[type="checkbox"]')
    expect(toggled).toBe(true)
    await waitForShadow(VIEW, '.kanban-card-group', { timeout: 10000 })
    await clickShadow(VIEW, '.kanban-cardgroup-controls .depth-btn:nth-of-type(1)') // 全展開
    // ネストしたサブグループ「サブb」が描画されるまで待ち、その id を解決する
    let groupId: string | null = null
    await browser.waitUntil(
      async () => {
        groupId = await browser.execute(
          (vc: string, t: string) => {
            const host = document.querySelector(`.${vc} .view-shadow-host`)
            const root = host?.shadowRoot
            if (!root) return null
            for (const el of Array.from(root.querySelectorAll('[data-card-group-id]'))) {
              const title = el.querySelector('.kanban-card-group-title')
              if ((title?.textContent ?? '').includes(t)) return el.getAttribute('data-card-group-id')
            }
            return null
          },
          VIEW, 'サブb')
        return groupId !== null
      },
      { timeout: 10000, interval: 500, timeoutMsg: 'ネストしたカードグループ「サブb」が描画されない' },
    )

    const before = await readVaultFile('kanban-live.md')
    expect(before).toContain('- [>] サブb')

    // サブカードグループを done レーンへドラッグ
    const laneRect = await getShadowRect(VIEW, '.kanban-lane[data-lane-id="done"] .kanban-lane-body')
    expect(laneRect).not.toBeNull()
    const dragged = await dispatchPointerDrag(
      VIEW,
      `[data-card-group-id="${groupId}"]`,
      { x: laneRect!.x + laneRect!.width / 2, y: laneRect!.y + Math.min(laneRect!.height / 2, 40) },
    )
    expect(dragged).toBe(true)

    // ① markdown への書き戻し（ユーザー報告ではここまでは成功する）
    const after = await waitForFileContentChange('kanban-live.md', before!)
    expect(after).toContain('- [x] サブb')

    // ② DOM 上の表示位置（既知バグ：ここが失敗する — 表示位置が元のまま）
    await browser.waitUntil(
      async () => {
        const doneCards = await getShadowOrder(
          VIEW, '.kanban-lane[data-lane-id="done"] .kanban-lane-body', '[data-card-id], [data-card-group-id]', 'data-card-id')
        const doneGroups = await getShadowOrder(
          VIEW, '.kanban-lane[data-lane-id="done"] .kanban-lane-body', '[data-card-group-id]', 'data-card-group-id')
        return doneCards.includes(groupId!) || doneGroups.includes(groupId!)
      },
      { timeout: 10000, interval: 500, timeoutMsg: 'サブカードグループの表示位置が更新されない（issue-phase000-003）' },
    )
  })

  it('フィルタバーでカードが絞り込まれる', async function () {
    const totalBefore = await countShadow(VIEW, '[data-card-id]')
    expect(totalBefore).toBeGreaterThan(0)

    // フィルタパネルを開き、テキスト条件で絞る
    const opened = await clickShadow(VIEW, '.filter-chip')
    expect(opened).toBe(true)
    await waitForShadow(VIEW, '.filter-panel', { timeout: 5000 })
    // 3 番目のフィールドが「テキスト」（ステータス・タグ・テキスト…の順）
    const set = await setShadowInputValue(
      VIEW, '.filter-panel .filter-field:nth-of-type(3) input', 'タスクB')
    expect(set).toBe(true)

    await browser.waitUntil(
      async () => (await countShadow(VIEW, '[data-card-id]')) < totalBefore,
      { timeout: 10000, interval: 500, timeoutMsg: 'フィルタでカード数が減らない' },
    )
    // 絞り込み後もタスクB は表示されている
    const id = await getCardIdByTitle('タスクB')
    expect(id).not.toBeNull()
  })
})
