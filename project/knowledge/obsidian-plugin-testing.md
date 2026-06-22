# Obsidian プラグインのテスト手法

## 1. テストアーキテクチャ（3層構造）

本プロジェクトでは以下の3層でテストを実施する。

| 層 | 名称 | フレームワーク | 実行コマンド | 対象 |
|---|---|---|---|---|
| Layer 1 | ユニットテスト | Vitest | `npm run test:unit` | パーサー、変換関数、パッチ関数など純粋ロジック |
| Layer 2 | 統合テスト | Vitest + Obsidian API モック | `npm run test:unit` | プラグインライフサイクル（onload / onunload） |
| Layer 3 | E2E テスト | WebdriverIO + wdio-obsidian-service | `npm run test:obs:e2e` | Obsidian 実環境でのプラグイン動作 |

全層一括実行: `npm run test`（= unit → build → obs:e2e）

---

## 2. 環境構築

### 2.1 必要パッケージ

```bash
npm install -D \
  vitest \
  @wdio/cli @wdio/globals @wdio/local-runner @wdio/mocha-framework \
  wdio-obsidian-service wdio-obsidian-reporter \
  mocha @types/mocha
```

### 2.2 WebdriverIO 設定（`wdio.conf.mts`）

```typescript
export const config: WebdriverIO.Config = {
  runner: 'local',
  framework: 'mocha',
  specs: ['./tests/obs-e2e/**/*.e2e.ts'],
  maxInstances: 1,  // Obsidian は単一インスタンスのみ

  capabilities: [{
    browserName: 'obsidian',
    browserVersion: 'latest',
    'wdio:obsidianOptions': {
      installerVersion: 'earliest',
      plugins: [path.resolve(__dirname, '.')],       // プラグインルート
      vault: path.resolve(__dirname, 'test/vaults/simple'),  // テスト用 Vault
    },
    'goog:chromeOptions': {
      args: ['--headless=new', '--disable-gpu', '--no-sandbox'],
    },
  }],

  services: ['obsidian'],
  reporters: ['obsidian'],
  cacheDir: path.resolve(__dirname, '.obsidian-cache'),

  mochaOpts: {
    ui: 'bdd',
    timeout: 60000,  // プラグインロード + 描画待ちに十分な時間
  },
}
```

**設定のポイント:**

- `maxInstances: 1` は必須。Obsidian は複数同時起動に対応しない。
- `browserName: 'obsidian'` を指定すると `wdio-obsidian-service` が Obsidian アプリを自動ダウンロード・起動する。
- `installerVersion: 'earliest'` はキャッシュ済みの最古バージョンを使用する（ダウンロード時間を短縮）。
- `plugins` にはプラグインの**ルートディレクトリ**（`manifest.json` と `main.js` がある場所）を指定する。
- `cacheDir` を設定すると Obsidian バイナリがキャッシュされ、再ダウンロードが不要になる。
- `--headless=new` で Chrome を GUI なしで実行する（CI 環境でも動作する）。

### 2.3 テスト用 Vault

`test/vaults/simple/` にテストデータを配置する。

```
test/vaults/simple/
└── test-tasks.md    # テスト対象の Markdown ファイル
```

テストデータには以下のケースを網羅する:

- 基本タスク: `[ ]`（todo）、`[>]`（進行中）、`[x]`（完了）
- `@schedule` 付きタスク（時刻付き、日付のみ）
- メタデータ付きタスク（`@priority`、`@due`、`@tags`、`@dependsOn`）
- ブロッククォート内のタスク記法（ハイライト対象外の検証用）
- エッジケース: 不正スケジュール（逆順、不正フォーマット）、スケジュールなし

### 2.4 ビルド前提

E2E テストを実行するには事前にプラグインをビルドする必要がある。

```bash
npm run build:dev   # main.js を生成
npm run test:obs:e2e
```

`npm run test` はこの順序を自動で実行する（unit → build → obs:e2e）。

---

## 3. E2E テストの書き方

### 3.1 基本構造

```typescript
import { browser, expect } from '@wdio/globals'
import { obsidianPage } from 'wdio-obsidian-service'
import { openFile } from './helpers/obsidian-helpers'

describe('機能名', function () {
  before(async function () {
    // テストスイート開始時に Vault を再読み込み
    await browser.reloadObsidian({ vault: './test/vaults/simple' })
  })

  beforeEach(async function () {
    // 各テスト前に Vault を初期状態にリセット
    await obsidianPage.resetVault()
  })

  it('テストケース名', async function () {
    await openFile('test-tasks.md')
    // テスト操作 ...
  })
})
```

### 3.2 wdio-obsidian-service が提供する API

| API | 用途 |
|---|---|
| `browser.reloadObsidian({ vault })` | Obsidian を再起動して指定 Vault を開く |
| `obsidianPage.resetVault()` | Vault を初期状態にリセット（ファイル変更を元に戻す） |
| `browser.executeObsidianCommand('plugin-id:command-id')` | コマンドパレットのコマンドを実行 |
| `browser.execute(fn)` | ブラウザコンテキストで任意の JS を実行（`window.app` にアクセス可能） |
| `browser.getLogs('browser')` | Chrome DevTools のコンソールログを取得 |
| `browser.$('.selector')` | CSS セレクタで単一要素を取得 |
| `browser.$$('.selector')` | CSS セレクタで複数要素を取得 |

### 3.3 ヘルパー関数

#### ファイルを開く（`helpers/obsidian-helpers.ts`）

```typescript
export async function openFile(path: string): Promise<void> {
  await browser.execute((filePath: string) => {
    const app = (window as any).app
    const file = app.vault.getAbstractFileByPath(filePath)
    if (file) {
      void app.workspace.getLeaf(false).openFile(file)
    }
  }, path)
  await browser.pause(500)  // 描画待ち
}
```

#### コンソールエラー検証（`helpers/console-guard.ts`）

テスト内で手動呼び出しするためのヘルパー。`wdio.conf.mts` の `afterTest` フックでも自動実行される。

```typescript
export async function assertNoConsoleErrors(): Promise<void> {
  const logs = await browser.getLogs('browser')
  const errors = logs.filter(log => {
    if (log.level === 'SEVERE') return true
    if (log.level === 'WARNING') {
      return WARNING_PATTERNS.some(p => p.test(log.message))
    }
    return false
  })
  if (errors.length > 0) {
    throw new Error(`コンソールエラーを検出:\n${messages}`)
  }
}
```

---

## 4. テスト実装のポイント

### 4.1 非同期描画の待機

Obsidian のプラグインビューは非同期で描画される。`waitUntil` を使用して要素の出現を待つ。

```typescript
await browser.waitUntil(
  async () => {
    const el = await browser.$('.target-element')
    return el.isExisting()
  },
  { timeout: 10000, interval: 500 },
)
```

**タイムアウトの目安:**

| 待機対象 | timeout | interval | 理由 |
|---|---|---|---|
| ビュー表示 | 5000ms | 200ms | コマンド実行 + mount |
| コンテンツ描画 | 10000ms | 500ms | FileSync debounce (300ms) + AST 変換 + 描画 |
| ファイル書き込み反映 | 800〜1000ms | — | `browser.pause()` で待機 |

### 4.2 コンソールエラーの自動検知

`wdio.conf.mts` の `afterTest` フックにより、テスト自体がパスしても Chrome コンソールにエラーがあればテスト失敗になる。

検知対象:
- `SEVERE` レベルのログ（全件）
- `WARNING` レベルのうち以下のパターン:
  - `ReferenceError`
  - `TypeError`
  - `Invalid CalendarItem`
  - `is not defined`
  - `Uncaught`

この仕組みは obs-0011 で導入された。これにより、以前すり抜けていた以下のバグが自動検出可能になった:
- obs-0007: svelte-preprocess がコンポーネント import を削除 → `ReferenceError`
- obs-0009: luxon の重複インスタンス → `TypeError`

### 4.3 描画内容の検証（コンテナではなく中身を確認する）

**悪い例:**
```typescript
// コンテナの存在だけ確認 → 中身が空でもパスしてしまう
const view = browser.$('.gantt-view')
await expect(view).toExist()
```

**良い例:**
```typescript
// 実際に描画された要素を確認する
await browser.waitUntil(
  async () => {
    const bars = await browser.$$('.gantt-view .gantt-timeline rect')
    return bars.length > 0
  },
  { timeout: 10000, interval: 500 },
)
const bars = await browser.$$('.gantt-view .gantt-timeline rect')
expect(bars.length).toBeGreaterThan(0)
```

obs-0008（アイテム非表示バグ）は、コンテナのみ検証していたためにすり抜けた。

### 4.4 SVG 要素の操作

SVG 要素は通常の HTML 要素と異なり、WebdriverIO の `getRect()` が使えない場合がある。`browser.execute()` で `getBoundingClientRect()` を使用する。

```typescript
const rect = await browser.execute(() => {
  const el = document.querySelector('rect.target')
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: r.x, y: r.y, width: r.width, height: r.height }
})
```

### 4.5 ドラッグ操作のシミュレーション

ガントバーのように SVG 要素やスクロール領域外の要素をドラッグする場合、WebdriverIO のポインターアクション（`browser.action('pointer')`）では `move target out of bounds` エラーが発生する。

**解決策: ブラウザコンテキスト内で MouseEvent を直接 dispatch する。**

```typescript
await browser.execute((deltaX: number) => {
  const bar = document.querySelector('rect.gantt-bar--task') as SVGElement
  if (!bar) return false

  const r = bar.getBoundingClientRect()
  const cx = r.x + r.width / 2
  const cy = r.y + r.height / 2

  bar.dispatchEvent(new MouseEvent('mousedown', {
    bubbles: true, cancelable: true, clientX: cx, clientY: cy
  }))
  window.dispatchEvent(new MouseEvent('mousemove', {
    bubbles: true, clientX: cx + deltaX, clientY: cy
  }))
  window.dispatchEvent(new MouseEvent('mouseup', {
    bubbles: true, clientX: cx + deltaX, clientY: cy
  }))

  return true
}, 30)
```

**注意点:**
- `mousedown` はバー要素に dispatch する（イベントハンドラーがバーにバインドされているため）
- `mousemove` / `mouseup` は `window` に dispatch する（`drag-handler.ts` がグローバルリスナーを使用するため）
- ドラッグ後はファイル書き込みを待つ: `await browser.pause(800)`

### 4.6 Vault ファイルの読み書き

テスト内でファイルの内容を取得・検証するには `browser.execute()` で Obsidian API を使用する。

```typescript
// ファイル内容を読み取る
const content = await browser.execute(() => {
  const app = (window as any).app
  const file = app.vault.getAbstractFileByPath('test-tasks.md')
  return file ? app.vault.read(file) : null
})

// ファイルに書き込む
await browser.execute((newContent: string) => {
  const app = (window as any).app
  const file = app.vault.getAbstractFileByPath('test-tasks.md')
  if (file) app.vault.modify(file, newContent)
}, newContent)
```

---

## 5. 統合テスト（Layer 2）の書き方

### 5.1 Obsidian API モック

`tests/mocks/obsidian.ts` に Obsidian API のモックを用意する。`vi.mock('obsidian')` で差し替える。

```typescript
vi.mock('obsidian', async () => {
  const mock = await import('../mocks/obsidian')
  return mock
})
```

### 5.2 プラグインライフサイクルのテスト

```typescript
it('onload() でビューが登録される', async () => {
  const { MdAstEditorPlugin } = await import('../../src/plugin')
  const plugin = new MdAstEditorPlugin(app as any, null as any)
  await plugin.onload()

  expect(plugin.registerView).toHaveBeenCalledWith(
    'md-ast-editor-ast-view',
    expect.any(Function),
  )

  await plugin.onunload()
})
```

検証項目:
- ビュー登録（`registerView`）: AST / Calendar / Gantt
- コマンド登録（`addCommand`）: open-ast-view / open-calendar-view / open-gantt-view
- リボンアイコン登録（`addRibbonIcon`）
- アンロード時のビュー切り離し（`detachLeavesOfType`）
- デフォルト設定のロード

---

## 6. ビルド特有の注意事項

### 6.1 ソース直接コンパイル

`svelte-calendar-lib` と `svelte-gantt-lib` は `file:` 依存でリンクされているが、ビルド時は `dist/` ではなく `src/index.ts` を直接コンパイルする（`esbuild.config.mjs` の `svelteLibSourcePlugin`）。

このため、**ライブラリの変更はプラグイン側のビルドに即座に反映される**（ライブラリ側の事前ビルド不要）。

### 6.2 シンボリックリンクの実パス解決

ライブラリの `node_modules` はシンボリックリンクであるため、`realpathSync()` で実パスに変換する。これをしないと esbuild が同一ファイルを 2 回読み込み、`ReferenceError`（コンポーネント関数名の不一致）を引き起こす。

### 6.3 luxon の単一インスタンス化

プロジェクトとワークスペースライブラリが別々の `node_modules/luxon` を持つと `DateTime instanceof DateTime` が `false` になる。`esbuild.config.mjs` でメインプロジェクトの luxon に強制解決する。

---

## 7. トラブルシューティング

| 症状 | 原因 | 対処 |
|---|---|---|
| `main.js` が見つからない | ビルド未実施 | `npm run build:dev` を実行 |
| E2E テストで Obsidian が起動しない | `.obsidian-cache` の破損 | キャッシュディレクトリを削除して再実行 |
| テストパスだがコンソールにエラー表示 | `afterTest` フック未設定 | `wdio.conf.mts` の `afterTest` を確認 |
| SVG 要素のドラッグで `out of bounds` | ビューポート外の要素を操作 | `browser.execute()` で MouseEvent を直接 dispatch |
| `ReferenceError: ComponentName is not defined` | シンボリックリンクの未解決 | `esbuild.config.mjs` の `realpathSync` を確認 |
| `DateTime instanceof` が `false` | luxon の重複インスタンス | `esbuild.config.mjs` の luxon resolve を確認 |
| テストデータでエッジケースが検出されない | テスト Vault のデータ不足 | `test/vaults/simple/test-tasks.md` にケースを追加 |

---

## 8. テストカバレッジ一覧（現時点）

### E2E テスト（Layer 3）

| ファイル | テストケース数 | 検証内容 |
|---|---|---|
| `ast-view.e2e.ts` | 3 | ビュー表示、AST 出力内容、QuoteNode 解析 |
| `calendar-view.e2e.ts` | 3 | ビュー表示、コンポーネント描画、WeekView 表示 |
| `gantt-view.e2e.ts` | 4 | ビュー表示、ツリー行描画、バー描画、ドラッグ→markdown 更新 |
| `task-decoration.e2e.ts` | 4 | todo/done クラス付与、メタキークラス付与、ブロッククォート除外 |

### 統合テスト（Layer 2）

| ファイル | テストケース数 | 検証内容 |
|---|---|---|
| `plugin.test.ts` | 9 | ビュー・コマンド・リボン登録、アンロード、設定ロード |

### ユニットテスト（Layer 1）

主要なテスト対象:
- `md-to-ast`（パーサー）
- `ast-to-calendar`（カレンダー変換）
- `ast-to-gantt`（ガント変換）
- `markdown-patch`（パッチ関数: `formatSchedule` / `findNodeById` / `patchScheduleForNode`）
