# Obsidianプラグイン移行計画書

## 背景

現在のmd-ast-editorは、Svelte 5 + Vite + Monaco EditorによるスタンドアロンWebアプリとして構築されている。
このアプリケーションをObsidianプラグインとして再構築し、Obsidianエコシステム内でMarkdownベースのタスク管理・可視化機能を提供する。

### 移行の動機

- ObsidianのVault内Markdownファイルと直接連携できる
- Obsidianの既存エディタ機能を活用し、Monaco Editorの重い依存を排除できる
- Obsidianユーザーの既存ワークフローに自然に統合できる

---

## 現行アーキテクチャ

```
Markdown文字列 (Monaco Editor)
    |
    v
parseMarkdown() → Document AST
    |
    +---> AST Viewer (JSONツリー)
    +---> extractCalendarItems() → CalendarTab
    +---> extractGanttNodes() → GanttTab
    |
    v (ユーザー操作: D&D, ダイアログ編集)
patchSchedule() / patchTaskTitle()
    |
    v
Markdown文字列を更新 → エディタに反映
```

### 再利用可能なコア資産

| モジュール | パス | 再利用度 |
|---|---|---|
| Markdownパーサー | `src/lib/parser/md-to-ast.ts` | そのまま再利用 |
| ASTシリアライザー | `src/lib/parser/ast-to-md.ts` | そのまま再利用 |
| 型定義 | `src/lib/parser/types.ts` | そのまま再利用 |
| カレンダー変換 | `src/lib/calendar/ast-to-calendar.ts` | そのまま再利用 |
| Markdownパッチ | `src/lib/calendar/markdown-patch.ts` | そのまま再利用 |
| ガントチャート変換 | `src/lib/gantt/ast-to-gantt.ts` | そのまま再利用 |
| Monaco Editor | `src/lib/editor/MonacoEditor.svelte` | 削除（Obsidianエディタに置換） |
| EditorLayout | `src/lib/editor/EditorLayout.svelte` | 大幅改修 |
| CalendarTab | `src/lib/calendar/CalendarTab.svelte` | Obsidian View として再構築 |
| GanttTab | `src/lib/gantt/GanttTab.svelte` | Obsidian View として再構築 |
| シンタックスハイライト | `src/lib/highlight/task-language.ts` | CodeMirror 6拡張として再実装 |

---

## Obsidianプラグイン アーキテクチャ

### 基本構造

```
plugin/
├── manifest.json          # プラグインメタデータ
├── main.ts                # Plugin クラス（エントリポイント）
├── styles.css             # プラグインスタイル
├── esbuild.config.mjs     # ビルド設定
├── src/
│   ├── plugin.ts          # Plugin クラス本体
│   ├── settings.ts        # プラグイン設定
│   ├── views/
│   │   ├── CalendarView.ts    # カレンダー ItemView
│   │   ├── GanttView.ts      # ガントチャート ItemView
│   │   └── AstView.ts        # AST表示 ItemView
│   ├── editor/
│   │   └── task-decoration.ts # CodeMirror 6 デコレーション
│   ├── lib/                   # 現行コアロジック（移植）
│   │   ├── parser/
│   │   │   ├── types.ts
│   │   │   ├── md-to-ast.ts
│   │   │   └── ast-to-md.ts
│   │   ├── calendar/
│   │   │   ├── ast-to-calendar.ts
│   │   │   └── markdown-patch.ts
│   │   └── gantt/
│   │       └── ast-to-gantt.ts
│   └── sync/
│       └── file-sync.ts       # Obsidian Vault ↔ AST 同期
```

### データフロー（Obsidian版）

```
Obsidian Editor (CodeMirror 6)
    |
    v (editor-change イベント)
file-sync.ts: Vault.read() → parseMarkdown() → Document AST
    |
    +---> CalendarView (ItemView)
    +---> GanttView (ItemView)
    +---> AstView (ItemView)
    |
    v (ユーザー操作: D&D, 編集)
patchSchedule() / patchTaskTitle()
    |
    v
Vault.modify() → Obsidian Editorに自動反映
```

### 主な技術的変更点

1. **Monaco Editor → Obsidian内蔵エディタ（CodeMirror 6）**
   - MonacoEditorコンポーネントを完全に削除
   - Obsidianの`workspace.getActiveViewOfType(MarkdownView)`でエディタにアクセス
   - シンタックスハイライトはCodeMirror 6のViewPlugin/Decorationで再実装

2. **Svelte UIコンポーネント → Obsidian ItemView**
   - Obsidianの`ItemView`を継承したカスタムビュー
   - Svelteコンポーネントは各View内のcontainerElにマウント可能
   - またはVanilla JS/HTMLで再構築（依存削減のため検討）

3. **インメモリ文字列 → Obsidian Vault API**
   - `app.vault.read(file)` / `app.vault.modify(file, content)` を使用
   - `app.vault.on('modify')` でファイル変更を監視
   - `app.workspace.on('active-leaf-change')` でアクティブファイル切替を検知

4. **ビルドシステム: Vite → esbuild**
   - Obsidianプラグイン標準のesbuildでバンドル
   - 出力: `main.js`（単一ファイル）

---

## フェーズ計画

### Phase 1: プラグイン基盤構築

**目標:** Obsidianプラグインとして起動し、アクティブファイルのAST表示ができる

- [ ] `manifest.json`, `main.ts`, esbuildビルド設定の作成
- [ ] Pluginクラスの実装（onload / onunload）
- [ ] AstView（ItemView）の実装 — アクティブファイルのAST JSONを表示
- [ ] コアライブラリ（parser, types）の移植
- [ ] Vault API経由のファイル読み取り・変更監視の実装
- [ ] アクティブファイル切替時のAST自動更新

### Phase 2: カレンダービュー統合

**目標:** カレンダータブでスケジュール付きタスクを表示・操作できる

- [ ] CalendarView（ItemView）の実装
- [ ] ast-to-calendar変換ロジックの統合
- [ ] svelte-calendar-libの統合方針決定（Svelte mount or 代替ライブラリ）
- [ ] カレンダー上でのD&D → Vault.modify()によるMarkdown更新
- [ ] 編集ダイアログの実装

### Phase 3: ガントチャートビュー統合

**目標:** ガントチャートタブで階層的タスクタイムラインを表示・操作できる

- [ ] GanttView（ItemView）の実装
- [ ] ast-to-gantt変換ロジックの統合
- [ ] svelte-gantt-libの統合方針決定
- [ ] バードラッグ → Vault.modify()によるMarkdown更新

### Phase 4: エディタ拡張

**目標:** Obsidianエディタ内でタスク記法のシンタックスハイライト・支援機能を提供

- [ ] CodeMirror 6 ViewPlugin/Decorationによるタスクステータスハイライト
- [ ] @schedule, @due等メタ情報のハイライト
- [ ] タスクステータストグルコマンドの追加

### Phase 5: 設定・仕上げ

**目標:** プラグインとして公開可能な品質にする

- [ ] プラグイン設定画面（SettingTab）の実装
- [ ] コマンドパレット統合
- [ ] テストの移植・追加
- [ ] ドキュメント整備

---

## 技術的課題と検討事項

### 1. UIライブラリの選択

**課題:** 現行のsvelte-calendar-lib, svelte-gantt-libはSvelteコンポーネント。ObsidianプラグインでSvelteを使うか。

**選択肢:**

| 方式 | メリット | デメリット |
|---|---|---|
| A. Svelte維持 | 既存コンポーネント再利用可能 | バンドルサイズ増加、Obsidian非標準 |
| B. Vanilla JS再構築 | 軽量、Obsidian標準に準拠 | 開発コスト大 |
| C. 別ライブラリ採用 | 成熟したObsidian向けソリューション | 学習コスト、挙動差異 |

**推奨:** A（Svelte維持）— Obsidianプラグインでは実績があり、既存資産を最大限活用できる。

### 2. 外部ライブラリの依存

**課題:** svelte-calendar-lib, svelte-gantt-libはローカルパス参照（`../calendar-for-mywork`等）。

**対応:** esbuildでバンドル時にインライン化する。ローカルパスをworkspace内で解決可能にする。

### 3. ファイル同期の競合

**課題:** ObsidianエディタとプラグインViewが同時にファイルを変更する場合の競合。

**対応:** Vault.modify()を使用し、Obsidianのイベントシステム経由で変更を検知。debounce処理で連続変更に対応。

### 4. 複数ファイル対応

**課題:** 現行はシングルドキュメント前提。Obsidianでは複数ファイルを切り替える。

**対応:** アクティブファイルの変更を監視し、View切替時にASTを再構築する。

---

## テスト戦略

Obsidianプラグインでは、スタンドアロンWebアプリと異なりブラウザ上でのE2Eテストが直接実行できない。
テストを以下の3層に分離し、AIが自動実行できる範囲と、ユーザーが手動確認する範囲を明確に定義する。

### テスト層の全体構成

| 層 | 実行者 | ツール | 対象 |
|---|---|---|---|
| Layer 1: ユニットテスト | AI（自動） | Vitest | 純粋ロジック（パーサー、変換、パッチ） |
| Layer 2: 統合テスト | AI（自動） | Vitest + Obsidian APIモック | View生成、同期ロジック、イベント処理 |
| Layer 3: E2Eテスト | AI（自動） | WebdriverIO + wdio-obsidian-service | Obsidian実アプリ上でのプラグイン動作 |
| Layer 4: 手動確認テスト | ユーザー（手動） | Obsidian実機 | 操作感、レイアウト、パフォーマンス体感 |

---

### Layer 1: ユニットテスト（AI自動実行）

**実行コマンド:** `npm run test:unit`（Vitest）

Obsidian APIに依存しない純粋関数のテスト。現行テストをそのまま移植し、追加テストを書く。

**移植対象（既存テスト）:**

| テストファイル | 内容 |
|---|---|
| `md-to-ast.test.ts` | Markdown → AST パース |
| `ast-to-md.test.ts` | AST → Markdown シリアライズ |
| `ast-to-calendar.test.ts` | AST → CalendarItem 変換 |
| `markdown-patch.test.ts` | スケジュール・タイトルのパッチ処理 |
| `ast-to-gantt.test.ts` | AST → GanttNode 変換 |

**追加テスト:**

- `file-sync.test.ts` — Vault APIモックを使ったファイル読み書きロジック
- `active-file-tracker.test.ts` — アクティブファイル切替時のAST再構築ロジック

**AI実行ルール:**
- コード変更後、`npm run test:unit` を必ず実行する
- 全テストがパスするまで実装完了としない
- テストを弱めて通すことは禁止（TESTING_STANDARD準拠）

---

### Layer 2: 統合テスト（AI自動実行）

**実行コマンド:** `npm run test:unit`（Vitest、同一テストランナー）

Obsidian APIをモックした上で、プラグイン固有のロジックをテストする。

**Obsidian APIモック方針:**

```typescript
// tests/mocks/obsidian.ts
// Obsidianモジュール全体をモック化し、Vitest の vi.mock() で注入

export class Plugin {
  app: any
  async onload() {}
  async onunload() {}
  addCommand(cmd: any) {}
  registerView(type: string, factory: any) {}
}

export class ItemView {
  containerEl: HTMLElement
  constructor() { this.containerEl = document.createElement('div') }
  getViewType() { return '' }
  getDisplayText() { return '' }
}

export class TFile {
  path: string
  basename: string
  extension: string
  constructor(path: string) {
    this.path = path
    this.basename = path.split('/').pop()?.replace('.md', '') ?? ''
    this.extension = 'md'
  }
}

export const mockVault = {
  read: vi.fn(),
  modify: vi.fn(),
  on: vi.fn(),
}

export const mockWorkspace = {
  getActiveViewOfType: vi.fn(),
  on: vi.fn(),
  getLeavesOfType: vi.fn(() => []),
  revealLeaf: vi.fn(),
  detachLeavesOfType: vi.fn(),
  getRightLeaf: vi.fn(),
}
```

**テスト対象:**

| テストファイル | 検証内容 |
|---|---|
| `plugin.test.ts` | onload時にView登録・コマンド登録が正しく呼ばれる |
| `calendar-view.test.ts` | AST変換結果がCalendarViewのcontainerElに正しくマウントされる |
| `gantt-view.test.ts` | AST変換結果がGanttViewのcontainerElに正しくマウントされる |
| `ast-view.test.ts` | アクティブファイルのAST JSONが正しく表示される |
| `vault-sync.test.ts` | Vault.modify()呼び出しとイベント発火の連携 |
| `debounce-sync.test.ts` | 連続変更時のdebounce処理が正しく動作する |

**AI実行ルール:**
- Obsidian APIの実際の挙動に依存するテストは書かない
- モックはインターフェース準拠のみ検証し、内部実装は検証しない
- ViewのDOM構造テストはcontainerEl内の要素存在確認に留める

---

### Layer 3: E2Eテスト（AI自動実行 — wdio-obsidian-service）

**実行コマンド:** `npm run test:obs:e2e`（WebdriverIO + wdio-obsidian-service）

wdio-obsidian-serviceは、Obsidianの実アプリをサンドボックス環境で自動起動し、
WebdriverIOでブラウザテストと同じ感覚でE2Eテストを実行できるフレームワークである。
AIがコマンド一つで実Obsidian上のE2Eテストを自動実行できる。

#### wdio-obsidian-service の仕組み

1. 指定バージョンのObsidianアプリをキャッシュディレクトリに自動ダウンロード
2. テスト用Vaultのサンドボックスコピーをテストインスタンスごとに作成
3. WebDriverプロトコルを有効にしてObsidianを起動
4. 設定で指定したプラグインを自動的にロード
5. ブラウザ自動化インターフェース経由でUI操作を実行

#### セットアップ

**パッケージインストール:**

```bash
npm init wdio@latest .
npm install --save-dev wdio-obsidian-service wdio-obsidian-reporter mocha @types/mocha
```

**tsconfig.json に追加:**

```json
{
  "compilerOptions": {
    "types": [
      "@wdio/globals/types",
      "@wdio/mocha-framework",
      "wdio-obsidian-service"
    ]
  }
}
```

**wdio.conf.mts 設定:**

```typescript
import * as path from "path";

export const config: WebdriverIO.Config = {
  runner: 'local',
  framework: 'mocha',
  specs: ['./test/e2e/**/*.e2e.ts'],
  maxInstances: 4,

  capabilities: [{
    browserName: 'obsidian',
    browserVersion: "latest",
    'wdio:obsidianOptions': {
      installerVersion: "earliest",
      plugins: ["."],              // カレントディレクトリのプラグインを自動ロード
      vault: "test/vaults/simple", // テスト用Vault
    },
  }],

  services: ["obsidian"],
  reporters: ['obsidian'],
  cacheDir: path.resolve(".obsidian-cache"),
  mochaOpts: {
    ui: 'bdd',
    timeout: 60000,
  },
  logLevel: "warn",
};
```

**テスト用Vaultディレクトリ:**

```
test/
├── vaults/
│   └── simple/          # テスト用Vault（Markdownファイル配置）
│       └── test-tasks.md
└── e2e/
    ├── ast-view.e2e.ts
    ├── calendar-view.e2e.ts
    └── gantt-view.e2e.ts
```

#### E2Eテスト例

```typescript
import { browser } from '@wdio/globals'
import { obsidianPage } from 'wdio-obsidian-service'

describe('ASTビュー', function () {
  before(async function () {
    await browser.reloadObsidian({ vault: "./test/vaults/simple" });
  })

  beforeEach(async function () {
    await obsidianPage.resetVault();
  })

  it('コマンドパレットからASTビューを開ける', async () => {
    await browser.executeObsidianCommand("md-ast-editor:open-ast-view");
    const astPanel = browser.$(".ast-view");
    await expect(astPanel).toExist();
  })

  it('アクティブファイルのASTが表示される', async () => {
    await browser.executeObsidianCommand("md-ast-editor:open-ast-view");
    const astContent = browser.$(".ast-view .ast-json");
    await expect(astContent).toHaveTextContaining("sections");
  })
})

describe('カレンダービュー', function () {
  before(async function () {
    await browser.reloadObsidian({ vault: "./test/vaults/simple" });
  })

  it('コマンドパレットからカレンダービューを開ける', async () => {
    await browser.executeObsidianCommand("md-ast-editor:open-calendar-view");
    const calendarPanel = browser.$(".calendar-view");
    await expect(calendarPanel).toExist();
  })

  it('スケジュール付きタスクがカレンダーに表示される', async () => {
    await browser.executeObsidianCommand("md-ast-editor:open-calendar-view");
    const calendarItem = browser.$(".calendar-view .calendar-item");
    await expect(calendarItem).toExist();
  })
})

describe('ガントチャートビュー', function () {
  before(async function () {
    await browser.reloadObsidian({ vault: "./test/vaults/simple" });
  })

  it('コマンドパレットからガントチャートビューを開ける', async () => {
    await browser.executeObsidianCommand("md-ast-editor:open-gantt-view");
    const ganttPanel = browser.$(".gantt-view");
    await expect(ganttPanel).toExist();
  })
})
```

#### 主要API

| API | 用途 |
|---|---|
| `browser.executeObsidianCommand(id)` | Obsidianコマンドを実行（プラグインコマンド含む） |
| `browser.reloadObsidian({vault})` | 別のテストVaultでObsidianをリロード |
| `obsidianPage.resetVault()` | Vaultを初期状態にリセット |
| `obsidianPage.resetVault(path)` | 別のVaultからファイルをコピーしてリセット |
| `browser.$(selector)` | DOM要素の取得（標準WebdriverIO） |

#### CI/CD対応（GitHub Actions）

wdio-obsidian-serviceはLinux/macOS/Windowsで動作し、GitHub Actionsでヘッドレス実行可能。

```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build
      - run: npm run test:unit
      - run: npm run test:obs:e2e
```

#### 制約事項

- Obsidianのダウンロードにネットワーク接続が必要（初回のみ、キャッシュされる）
- WSL2環境ではGUI表示にXサーバー（VcXsrv等）またはWSLg（Windows 11）が必要
- ベータ版テストにはObsidianアカウント認証情報が必要
- iOSテストは非対応

**AI実行ルール:**
- E2Eテストはプラグインビルド後に実行する（`npm run build && npm run test:obs:e2e`）
- テスト用Vaultにはテストデータを事前配置する
- テスト失敗時はスクリーンショット・ログを確認して原因を特定する

---

### Layer 4: ユーザー手動確認テスト

Layer 1〜3の自動テストでカバーできない、体感的な品質確認をユーザーが行う。
D&Dの操作感、レイアウト崩れ、パフォーマンス体感など。

#### 事前準備

1. テスト用Vaultを作成する（既存Vaultとは分離）
2. テスト用Markdownファイルを配置する（下記テストデータ参照）
3. プラグインをビルドする: `npm run build`
4. ビルド成果物（`main.js`, `manifest.json`, `styles.css`）をVaultの `.obsidian/plugins/md-ast-editor/` にコピーする
5. Obsidianを起動し、設定 → コミュニティプラグイン → md-ast-editor を有効化する

#### テストデータ（テスト用Markdownファイル）

以下の内容で `test-tasks.md` をテスト用Vaultに作成する:

```markdown
# プロジェクトA

## フェーズ1

- 要件整理
  - [ ] 要件ヒアリング
    @schedule: 2026-04-01T09:00/2026-04-01T12:00
    @priority: high
  - [>] 要件ドキュメント作成
    @schedule: 2026-04-02T10:00/2026-04-02T17:00
    @due: 2026-04-05
  - [x] キックオフミーティング
    @schedule: 2026-03-28T13:00/2026-03-28T14:00

## フェーズ2

- 設計
  - [ ] アーキテクチャ設計
    @schedule: 2026-04-07T09:00/2026-04-08T18:00
    @tags: design, architecture
  - [ ] DB設計
    @schedule: 2026-04-09T09:00/2026-04-10T18:00
    @dependsOn: アーキテクチャ設計

> これはメモブロックです。タスクとして解釈されてはならない。
> - [ ] これはタスクではない
```

#### Phase 1 確認手順（ASTビュー）

| # | 操作 | 期待結果 |
|---|---|---|
| 1-1 | `test-tasks.md` を開く | エディタにMarkdownが表示される |
| 1-2 | コマンドパレット → "AST View を開く" | 右サイドパネルにAST JSONが表示される |
| 1-3 | AST JSONの内容を確認する | セクション階層（プロジェクトA > フェーズ1, フェーズ2）が正しい |
| 1-4 | タスクノードを確認する | status, meta（schedule, priority等）が正しくパースされている |
| 1-5 | QuoteNodeを確認する | ブロッククォート内の `[ ]` がタスクとして解釈されていない |
| 1-6 | エディタでタスクを1行追加する | AST Viewがリアルタイムで更新される |
| 1-7 | 別のMarkdownファイルに切り替える | AST Viewが新しいファイルの内容に切り替わる |
| 1-8 | Markdown以外のファイルを開く | AST Viewが空またはメッセージ表示になる |

#### Phase 2 確認手順（カレンダービュー）

| # | 操作 | 期待結果 |
|---|---|---|
| 2-1 | `test-tasks.md` を開く | — |
| 2-2 | コマンドパレット → "Calendar View を開く" | カレンダービューが表示される |
| 2-3 | カレンダーの表示を確認する | @scheduleを持つ5つのタスクがカレンダー上に表示される |
| 2-4 | @scheduleを持たないタスクを確認する | カレンダーに表示されていない |
| 2-5 | タスクをD&Dで別の日時に移動する | Markdownファイルの@schedule行が自動更新される |
| 2-6 | D&D後のエディタ表示を確認する | 変更された@scheduleがエディタに反映されている |
| 2-7 | カレンダー上のタスクをクリックする | 編集ダイアログが表示される |
| 2-8 | ダイアログでタイトルを変更して保存する | Markdownファイルのタスクタイトルが更新される |
| 2-9 | エディタで@scheduleを手動編集する | カレンダービューがリアルタイムで更新される |
| 2-10 | エディタでタスクを削除する | カレンダーからアイテムが消える |

#### Phase 3 確認手順（ガントチャートビュー）

| # | 操作 | 期待結果 |
|---|---|---|
| 3-1 | `test-tasks.md` を開く | — |
| 3-2 | コマンドパレット → "Gantt View を開く" | ガントチャートが表示される |
| 3-3 | 階層構造を確認する | プロジェクトA（project）> フェーズ1,2（section）> カテゴリ（subsection）> タスク |
| 3-4 | タスクバーの期間を確認する | @scheduleの日時範囲がバーの長さに反映されている |
| 3-5 | タスクバーをドラッグで移動する | Markdownファイルの@schedule行が自動更新される |
| 3-6 | ドラッグ後のエディタ表示を確認する | 変更された@scheduleがエディタに反映されている |
| 3-7 | エディタで@scheduleを手動編集する | ガントチャートビューがリアルタイムで更新される |
| 3-8 | QuoteNode内を確認する | ブロッククォートがタスクバーとして表示されていない |

#### Phase 4 確認手順（エディタ拡張）

| # | 操作 | 期待結果 |
|---|---|---|
| 4-1 | `test-tasks.md` を開く | — |
| 4-2 | タスクステータスの表示を確認する | `[ ]`, `[>]`, `[x]`, `[!]`, `[-]` にそれぞれ異なるハイライトが適用されている |
| 4-3 | メタ情報の表示を確認する | `@schedule:`, `@due:`, `@priority:`, `@tags:` がハイライトされている |
| 4-4 | ブロッククォート内を確認する | クォート内の `[ ]` にタスクハイライトが適用されていない |

#### Phase 5 確認手順（設定・総合）

| # | 操作 | 期待結果 |
|---|---|---|
| 5-1 | 設定 → md-ast-editor を開く | プラグイン設定画面が表示される |
| 5-2 | Obsidianを再起動する | プラグインが正常にリロードされ、全Viewが復元される |
| 5-3 | プラグインを無効化→有効化する | エラーなく再起動する |
| 5-4 | 大きなMarkdownファイル（500行以上）を開く | パフォーマンス劣化なくAST/Calendar/Ganttが表示される |
| 5-5 | 3つのView（AST, Calendar, Gantt）を同時に開く | 全てが同一ファイルに連動してリアルタイム更新される |

---

### テスト実行フロー（まとめ）

```
AIがコードを変更
    |
    v
AI: npm run test:unit（Layer 1 + Layer 2）を自動実行
    |
    +-- 失敗 → AIが修正して再実行
    |
    +-- 全パス
          |
          v
AI: npm run build && npm run test:obs:e2e（Layer 3）を自動実行
    |
    +-- 失敗 → スクリーンショット・ログ確認 → AIが修正して再実行
    |
    +-- 全パス → フェーズ完了を宣言
                    |
                    v
              ユーザー: Obsidian実機で Layer 4 手動確認テスト実行
                    |
                    +-- 問題発見 → Issue更新 → AIが修正
                    |
                    +-- 全パス → Issueクローズ承認
```

### npm scripts 構成

```json
{
  "scripts": {
    "build": "esbuild src/main.ts --bundle --outfile=main.js ...",
    "test:unit": "vitest run",
    "test:obs:e2e": "wdio run wdio.conf.mts",
    "test": "npm run test:unit && npm run build && npm run test:obs:e2e"
  }
}
```

---

## 参照ドキュメント

- `project/specs/calendar-integration.spec.md` — カレンダー統合仕様
- `project/specs/gantt-integration.spec.md` — ガントチャート統合仕様
- `project/instructions/Markdownベース_タスク管理記法_仕様.md` — タスク記法仕様
- `project/instructions/AST仕様とロジックルール（構造定義込み）.md` — AST仕様
- Obsidian Plugin API: https://docs.obsidian.md/
