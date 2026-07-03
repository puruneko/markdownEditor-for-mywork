# Obsidian プラグインのテスト手法 — 実機 E2E チュートリアル

このドキュメントは「実機（本物の Obsidian）で動くことを確認するテスト」を**自分で書けるようになる**ためのガイド。
2026-07-03 全面改訂（issue-phase000-002）：shadow DOM 対応・ヘルパ整備・日付依存テストの方針を反映。

## 1. テストアーキテクチャ（3層構造）

| 層 | 名称 | フレームワーク | 実行コマンド | 対象 |
|---|---|---|---|---|
| Layer 1 | ユニットテスト | Vitest | `npm run test:unit` | パーサー、変換関数、パッチ関数など純粋ロジック |
| Layer 2 | 統合テスト | Vitest + Obsidian API モック | `npm run test:unit` | プラグインライフサイクル（onload / onunload） |
| Layer 3 | E2E テスト | WebdriverIO + wdio-obsidian-service | `npm run test:obs:e2e` | **Obsidian 実環境**でのプラグイン動作 |

全層一括実行: `npm run test`（= unit → obs:e2e。obs:e2e が build を内包）

---

## 2. 環境の仕組み — wdio-obsidian-service は何をしているか

`npm run test:obs:e2e` の裏側：

1. **本物の Obsidian をダウンロード**して `.obsidian-cache/` に保存する
   （`browserVersion: 'latest'` → アプリ本体、`installerVersion: 'earliest'` → Electron インストーラ。両者は別物）。
2. テスト用 Vault（`test/vaults/simple/`）を**一時ディレクトリへコピー**して開く。
3. リポジトリルートの `manifest.json` + `main.js` を**プラグインとして実インストール**する。
4. Electron 用 chromedriver で Obsidian を駆動し、WebdriverIO の API でテストを実行する。

つまりこれは「本物の Obsidian に本物のプラグインを入れて動かす」テストであり、実機確認と同じ環境である。

**最重要の帰結：`main.js` が古いと古いコードをテストする。**
`npm run test:obs:e2e` はビルドを内包するが、`test:obs:e2e:run`（内側ループ）はビルドしない。
ソースを変更したら必ずビルドを挟むこと。

### 実行コマンド一覧

| コマンド | 用途 |
|---|---|
| `npm run test:obs:e2e` | ビルド → 全 E2E 実行（通常はこれ） |
| `npm run test:obs:e2e:run` | ビルドなしで実行（**スペックだけ**変更した時の高速ループ） |
| `npm run test:obs:e2e:run -- --spec tests/obs-e2e/kanban-view.e2e.ts` | 単一スペックのみ実行 |
| `npm run test:obs:e2e:headed` | ヘッドレス解除。WSLg 上に Obsidian ウィンドウが表示され、テストの動きを**目視できる** |

失敗したテストは自動でスクリーンショットが `tests/obs-e2e/screenshots/FAILED_*.png` に保存される（.gitignore 済み）。

---

## 3. Shadow DOM の注意（最重要・ハマりどころ第1位）

全ビュー（Calendar / Gantt / Kanban / Agenda / Health / Tray / AST）は
`ShadowItemView` が作る **shadow root の内側**に描画される。

```
.workspace-leaf
└ .gantt-view                ← ビュークラスは shadow の「外側」コンテナに付く
   └ .view-shadow-host
      └ #shadow-root (open)
         └ .gantt-tree-row 等 ← 中身は全部この内側
```

**ルール：**

- `browser.$('.gantt-view')` — ○ 外側コンテナなので見える
- `browser.$('.gantt-view .gantt-tree-row')` — **× shadow 境界を越えられず、永遠に見つからない**
- `browser.execute(() => document.querySelector('.gantt-tree-row'))` — **× 同上**
- shadow 内は必ず `helpers/shadow-dom.ts` を使う — ○

2026-07-03 のベースライン検証では、**shadow DOM 導入時に既存 E2E の大半が静かに壊れていた**
（`.calendar-view .week-view` 等の複合セレクタが全て timeout）。「E2E が不安定・信用できない」の正体はこれ。

### helpers/shadow-dom.ts の API

| 関数 | 用途 |
|---|---|
| `waitForShadow(view, sel)` | shadow 内に要素が現れるまで待つ（describe 冒頭の定番） |
| `countShadow(view, sel)` | 件数カウント（「コンテナだけ」アサートの禁止に使う） |
| `getShadowText(view, sel)` | textContent 取得 |
| `getShadowRect(view, sel)` | getBoundingClientRect（**位置**のアサート・SVG にも有効） |
| `getShadowOrder(view, containerSel, itemSel, attr)` | 属性値を DOM 順で返す（**表示順**のアサート） |
| `clickShadow(view, sel)` | shadow 内のボタン・チェックボックスをクリック |
| `setShadowSelectValue(view, sel, value)` | `<select>` 変更＋change 発火 |
| `setShadowInputValue(view, sel, value)` | `<input>` 変更＋input 発火（Svelte bind:value 対応） |

`view` はビュークラス名（`'kanban-view'` 等、先頭ドットなし）。

### ビュークラス名一覧

| ビュー | クラス | コマンド ID |
|---|---|---|
| AST | `ast-view-container` | `md-ast-editor:open-ast-view` |
| Calendar | `calendar-view` | `md-ast-editor:open-calendar-view` |
| Gantt | `gantt-view` | `md-ast-editor:open-gantt-view` |
| Kanban | `kanban-view` | `md-ast-editor:open-kanban-view` |
| Agenda | `agenda-view` | `md-ast-editor:open-agenda-view` |
| Health | `health-view` | `md-ast-editor:open-health-view` |
| Tray | `unscheduled-tray-view` | `md-ast-editor:open-unscheduled-tray` |

※ クラス名の「正」は各 `src/views/*View.ts` の `getViewClass()`。リネームしたらスペックも直すこと
（ast-view は過去のリネームでスペックが壊れたまま放置されていた）。

---

## 4. スペックの書き方

### 4.1 基本構造

```typescript
import { browser, expect } from '@wdio/globals'
import { obsidianPage } from 'wdio-obsidian-service'
import { openFile } from './helpers/obsidian-helpers'
import { waitForShadow, countShadow } from './helpers/shadow-dom'

describe('◯◯ビュー', function () {
  before(async function () {
    await browser.reloadObsidian({ vault: './test/vaults/simple' })
  })

  beforeEach(async function () {
    await obsidianPage.resetVault()   // Vault を初期状態へ（実行時生成ファイルも消える）
  })

  it('中身が描画される', async function () {
    await openFile('test-tasks.md')
    await browser.executeObsidianCommand('md-ast-editor:open-kanban-view')
    await waitForShadow('kanban-view', '[data-card-id]')      // コンテナではなく中身を待つ
    expect(await countShadow('kanban-view', '[data-card-id]')).toBeGreaterThan(0)
  })
})
```

### 4.2 アサートの原則（obs-0008 の教訓）

- **コンテナの存在だけをアサートしない。** 中身（カード・バー・行）の件数・テキスト・位置を検証する。
- **書き戻し系は「markdown の変化」と「DOM の変化」の両方をアサートする。**
  片方だけだと「ステータスは書き戻るが表示が動かない」型のバグ（issue-phase000-003）を見逃す。
  お手本: `tests/obs-e2e/kanban-view.e2e.ts` の DnD テスト。

### 4.3 待機戦略 — `browser.pause()` 禁止

固定 pause はタイミング競合（flaky）の温床。必ず条件をポーリングする。

| 待ちたいもの | 使うもの |
|---|---|
| shadow 内の要素出現 | `waitForShadow(view, sel)` |
| ファイル書き戻し | `waitForFileContentChange(path, before)` |
| ファイルオープン | `openFile()`（内部で active file をポーリング済み） |
| その他任意条件 | `browser.waitUntil(async () => ..., { timeout, interval, timeoutMsg })` |

`timeoutMsg` は必ず書く（タイムアウト時に「何を待っていたか」がログに残る）。

### 4.4 日付依存テストはフィクスチャではなく実行時生成

カレンダー週表示は「今週」、アジェンダは「今日」を表示するため、
固定日付のフィクスチャは時間が経つと**必ず腐る**。

```typescript
import { writeVaultFile } from './helpers/obsidian-helpers'

const d = new Date().toISOString().slice(0, 10)   // 今日
await writeVaultFile('today-tasks.md', [
  '# テスト',
  '- [ ] 今日のタスク',
  `  - @schedule: ${d}T10:00/${d}T11:00`,
].join('\n'))
await openFile('today-tasks.md')
```

`resetVault()` が毎テスト後に掃除するので後始末は不要。
曜日依存にも注意（例：毎日 @repeat を「今日開始」にすると日曜実行で週内 1 件になる → 開始を数日前にずらす）。

**書き戻し（ファイル変更）を伴うテストも実行時生成ファイルを使うこと（ハマりどころ第2位）。**
wdio-obsidian-service の `resetVault()` は「変更された静的フィクスチャ」を base64→`atob()` 経路で復元するが、
この経路には **UTF-8（日本語）が Latin-1 に化ける上流バグ**がある（`atob` はバイナリ文字列を返すのに
そのまま `vault.modify` に渡している。さらに `readFile().buffer` 由来の余剰バイト混入もある）。
結果、「テスト A がフィクスチャを変更 → リセット → 同一スペック内の後続テストで日本語が化ける」。
実行時生成ファイルはリセット時に**削除**されるだけ（復元されない）ため、この問題を踏まない。
静的フィクスチャは**読み取り専用のテストだけ**に使う。

### 4.5 DnD（ドラッグ&ドロップ）の 2 パターン

WebdriverIO の `browser.action('pointer')` は shadow 内・スクロール外の要素で
`move target out of bounds` になるため、**イベント直接 dispatch** を使う（`helpers/drag.ts`）。

| パターン | 対象 | 仕組み |
|---|---|---|
| `dragKanbanCard(cardId, { laneId })` / `dispatchPointerDrag` | **Kanban** | PointerEvent を dispatch。Kanban の DnD は pointerdown/move/up＋6px しきい値で動くため、しきい値超えの中間 move を挟む。合成イベントでは `setPointerCapture` が InvalidPointerId で失敗するため、一時的に no-op 化して回避 |
| `dispatchMouseDrag(view, sel, dx)` | **Gantt** | MouseEvent を dispatch。mousedown は要素へ、mousemove/mouseup は **window** へ（drag-handler がグローバルリスナーのため） |

カードの `data-card-id` は globalKey（`path::nodeId`）で nodeId は自動生成のため、
**タイトルから実行時に解決**する（`kanban-view.e2e.ts` の `getCardIdByTitle` 参照）。

### 4.6 位置・表示順のアサート

```typescript
// doing レーン内のカード ID を表示順で取得
const order = await getShadowOrder(
  'kanban-view',
  '.kanban-lane[data-lane-id="doing"] .kanban-lane-body',
  '[data-card-id]', 'data-card-id')
expect(order).toContain(cardId)

// 位置（座標）で検証したい場合
const rect = await getShadowRect('kanban-view', `[data-card-id="${cardId}"]`)
const lane = await getShadowRect('kanban-view', '.kanban-lane[data-lane-id="doing"]')
expect(rect!.x).toBeGreaterThan(lane!.x)
```

### 4.7 スクリーンショット（目視確認の証跡）

- 失敗時は自動保存される（`wdio.conf.mts` の afterTest）。
- 成功時でも見た目を人間がレビューしたい箇所では `captureView('name')`（`helpers/screenshot.ts`）を呼ぶ。
- 発展（未実装のレシピ）：`pixelmatch` + `pngjs` を devDependency に加え、
  `tests/obs-e2e/__screenshots__/` にベースラインを置いて差分比較すれば簡易ビジュアルリグレッションになる。
  flaky になりやすいのでテスト単位のオプトインとし、更新は `OBS_E2E_UPDATE_BASELINE=1` のような env で行うこと。

### 4.8 Vault ファイルの読み書き

```typescript
import { readVaultFile, writeVaultFile, waitForFileContentChange } from './helpers/obsidian-helpers'

const before = await readVaultFile('kanban-board.md')
// ... 操作 ...
const after = await waitForFileContentChange('kanban-board.md', before!)  // 変化をポーリング
expect(after).toContain('- [>] タスクF')
```

### 4.9 フィクスチャ Vault の追加方法

- 静的データ（日付非依存）: `test/vaults/simple/*.md` にファイルを追加する。既存 `test-tasks.md` は
  既存スペックが依存しているため**変更禁止**（追加は新ファイルで）。
- **注意：デフォルト設定は `indexScope: 'vault'`** — 全ビューに Vault 内全ファイルのタスクが載る。
  件数の完全一致アサートは他フィクスチャの影響を受けるため、タイトルで対象を特定するか「>= 期待数」にする。

---

## 5. コンソールエラーの自動検知（console guard）

`wdio.conf.mts` の `afterTest` により、テストが**パスしても** Chrome コンソールにエラーがあれば失敗になる。

検知対象: `SEVERE` 全件＋ `WARNING` のうち `ReferenceError` / `TypeError` / `Invalid CalendarItem` / `is not defined` / `Uncaught`。

obs-0011 で導入。obs-0007（svelte-preprocess の import 削除→ReferenceError）や
obs-0009（luxon 重複インスタンス→TypeError）型のバグはこれで検出される。

---

## 6. 統合テスト（Layer 2）の書き方

`tests/mocks/obsidian.ts` の Obsidian API モックを `vi.mock('obsidian')` で差し替える。

```typescript
vi.mock('obsidian', async () => await import('../mocks/obsidian'))

it('onload() でビューが登録される', async () => {
  const { MdAstEditorPlugin } = await import('../../src/plugin')
  const plugin = new MdAstEditorPlugin(app as any, null as any)
  await plugin.onload()
  expect(plugin.registerView).toHaveBeenCalledWith('md-ast-editor-ast-view', expect.any(Function))
  await plugin.onunload()
})
```

検証項目: ビュー登録 / コマンド登録 / リボン / アンロード時の detach / 設定ロード。

---

## 7. ビルド特有の注意事項

- **ソース直接コンパイル**: `svelte-*-lib` は `file:` 依存だが、ビルドは `dist/` ではなく
  `src/index.ts` を直接コンパイルする（esbuild.config.mjs の svelteLibSourcePlugin）。
  ライブラリ変更は**ビルドすれば**即反映される（＝ビルドしなければ反映されない）。
- **シンボリックリンクの実パス解決**: `realpathSync()` しないと esbuild が同一ファイルを 2 回読み、
  `ReferenceError` を引き起こす。
- **luxon の単一インスタンス化**: 重複すると `DateTime instanceof DateTime` が false になる。

---

## 8. トラブルシューティング

| 症状 | 原因 | 対処 |
|---|---|---|
| shadow 内の要素が「永遠に見つからない」（waitUntil timeout） | 複合セレクタ／`document.querySelector` は shadow を貫通しない | `helpers/shadow-dom.ts` を使う（§3） |
| ビュークラスセレクタ自体が見つからない | ビュークラス名のリネーム（例: `ast-view` → `ast-view-container`） | `src/views/*View.ts` の `getViewClass()` を確認 |
| カレンダー／アジェンダにアイテムが出ない | 固定日付フィクスチャが「今週／今日」に入っていない | 実行時生成（§4.4） |
| コード修正したのにテスト結果が変わらない | `test:obs:e2e:run` はビルドしない（古い main.js） | `npm run test:obs:e2e`（ビルド内包）を使う |
| まれに落ちる・タイミング依存 | 固定 `pause()` | `waitUntil` 系へ置換（§4.3） |
| Obsidian が起動しない／挙動が不可解 | `.obsidian-cache` の破損 | `rm -rf .obsidian-cache` して再実行（再ダウンロードが走る） |
| 起動でハングする | 前回の異常終了プロセスが残存 | `pkill -f chromedriver; pkill -f obsidian` |
| chromedriver がクラッシュする（WSL2） | 共有メモリ不足 | `wdio.conf.mts` の args に `--disable-dev-shm-usage` を追加 |
| DnD で `move target out of bounds` | `browser.action()` がスクロール外・shadow 内要素を扱えない | `helpers/drag.ts` のイベント dispatch 方式（§4.5） |
| Kanban DnD が発火しない | 6px しきい値未達／`setPointerCapture` 失敗 | `dispatchPointerDrag` を使う（対処内蔵） |
| `ReferenceError: ComponentName is not defined` | シンボリックリンク未解決 | esbuild.config.mjs の `realpathSync` を確認 |
| `DateTime instanceof` が false | luxon 重複インスタンス | esbuild.config.mjs の luxon resolve を確認 |
| 件数アサートが環境で変わる | `indexScope: 'vault'` で他フィクスチャが混ざる | タイトルで特定 or `>=` 比較（§4.9） |
| テスト途中から日本語が「ã¿ã¹ã¯」等に化ける | resetVault の復元経路の UTF-8 バグ（上流） | 変更を伴うテストは実行時生成ファイルを使う（§4.4） |

---

## 9. テストカバレッジ一覧（2026-07-03 時点）

### E2E テスト（Layer 3）

| ファイル | ケース数 | 検証内容 |
|---|---|---|
| `ast-view.e2e.ts` | 3 | ビュー表示、AST 出力内容、QuoteNode 非タスク解釈 |
| `calendar-view.e2e.ts` | 4 | ビュー表示、コンポーネント描画、今日のアイテム表示、@repeat 複数オカレンス |
| `gantt-view.e2e.ts` | 4 | ビュー表示、ツリー行、バー描画、ドラッグ→@schedule 書き戻し |
| `kanban-view.e2e.ts` | 4 (+1 skip) | カード表示、グルーピング切替、**DnD 書き戻し＋DOM 位置**、フィルタ絞り込み、（skip: サブカードグループ DnD 位置 = issue-phase000-003 の再現手順） |
| `agenda-view.e2e.ts` | 2 | overdue バケット、today バケット（実行時生成） |
| `health-view.e2e.ts` | 2 | finding 表示、既知不正タスクの検出 |
| `unscheduled-tray.e2e.ts` | 1 | 未予定タスクのみ掲載 |
| `task-decoration.e2e.ts` | 4 | ステータス／メタキーのハイライト、引用除外 |

### 統合テスト（Layer 2）

| ファイル | ケース数 | 検証内容 |
|---|---|---|
| `plugin.test.ts` | 9 | ビュー・コマンド・リボン登録、アンロード、設定ロード |

### ユニットテスト（Layer 1）

`src/**/*.test.ts`（パーサー、ast-to-*、patch、query、recurrence、health、viewmodel ほか）
