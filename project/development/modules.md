# モジュール・コンポーネント構成

## ディレクトリツリーと役割

### `src/`

#### `plugin.ts` （メインプラグインクラス）

Obsidianプラグインのエントリポイント。

**主要メンバー**:
- `fileSync: FileSync` - ファイル追跡・同期
- `astIndex: AstIndex` - 複数ファイル索引
- `editorEventBus: EditorEventBus` - イベント中継
- `settingsHub: ViewSettingsHub` - ビュー別設定管理
- `settings: MdAstEditorSettings` - プラグイン設定

**主要メソッド**:
- `onload()` - プラグイン起動時の初期化
- `registerView()` - ビュータイプ登録
- `addCommand()` - コマンド登録

#### `settings.ts` / `settings-hub.ts`

**settings.ts**:
- `MdAstEditorSettings` - 設定インターフェース
- `MdAstEditorSettingTab` - Obsidian設定パネルUI
- `migrateSettings()` - レガシー設定対応
- `parseFrequentMetaKeys()` - よく使うメタキー解析

**settings-hub.ts**:
- `ViewSettingsHub` - ビュー別に独立した設定を管理
- 各ビューが独自の設定形状を管理できる機構

#### `sync/` （ファイル同期・索引）

**file-sync.ts**:
- `FileSync` - 現在のMarkdownファイルを追跡
- `debounceMs` による遅延処理
- `onFileChange` イベント発火

**ast-index.ts**:
- `AstIndex` - 複数ファイルのAST索引化
- `indexScope` による範囲制御（Vault全体 / フォルダ指定）
- Document キャッシュ管理
- `forceReparse()` - 再解析強制実行

**editor-event-bus.ts**:
- `EditorEventBus` - ビューとエディタ間のイベント中継
- `onFocusLine()` - カーソル移動イベント

#### `views/` （ビュー実装）

各ビューは `ShadowItemView` を継承し、Shadow DOM内でSvelteコンポーネントをマウント。

| ファイル | クラス | 役割 |
|---------|--------|------|
| `ShadowItemView.ts` | `ShadowItemView` | ビュー基盤クラス |
| `AstView.ts` | `AstView` | AST可視化（開発者向け） |
| `CalendarView.ts` | `CalendarView` | 日付ベース表示 |
| `GanttView.ts` | `GanttView` | スケジュール・依存関係表示 |
| `KanbanView.ts` | `KanbanView` | ステータス列表示 |
| `DashboardView.ts` | `DashboardView` | メトリクス表示 |
| `ParseDebugView.ts` | `ParseDebugView` | パーサーデバッグ表示 |
| `*Mount.svelte` | Svelteコンポーネント | UI実装 |
| `query-block.ts` | - | クエリブロック処理 |

#### `editor/` （CodeMirror 6 拡張）

各モジュールはCodeMirror 6の拡張フレームワークに基づいています。

| モジュール | 機能 |
|----------|------|
| `meta-fold.ts` | メタ情報の折りたたみ制御 |
| `metatag-decoration.ts` | メタ情報のシンタックスハイライト・チップ表示 |
| `metatag-picker.ts` | 日付ピッカー UI |
| `metatag-suggest.ts` | オートコンプリート提案 |
| `notation-lint.ts` | バリデーション（lint） |
| `task-decoration.ts` | タスク行の装飾 |
| `task-drag-source.ts` | ドラッグ&ドロップペイロード |
| `repeat-picker.ts` | 繰り返しスケジュール入力UI |
| `reformat-meta-lines.ts` | メタ行の整形・並べ替え |

#### `lib/` （ビジネスロジック層）

**parser/** - マークダウン解析

```
parser/
  ├── meta-keys.ts           # メタキー定義・別名
  ├── plugins/
  │   ├── remark-meta-fields.ts    # メタ行抽出
  │   ├── remark-task-status.ts    # タスクステータス
  │   └── ...
  ├── parse-markdown.ts       # トップレベルパーサー
  └── parse-markdown.test.ts
```

**contract/** - データ構造定義

```
contract/
  ├── canonical.ts            # メタキー・ステータスの正規定義
  ├── document.ts             # Document / Section / Node 構造
  └── meta.ts                 # Meta フィールド定義
```

**viewmodel/** - ビュー用データ変換

各ビュー用の ViewModel を生成。

```
viewmodel/
  ├── calendar-viewmodel.ts
  ├── gantt-viewmodel.ts
  ├── kanban-viewmodel.ts
  ├── dashboard-viewmodel.ts
  └── ...
```

**calendar/** - カレンダー用ロジック

- `calendar-grid.ts` - グリッド計算
- `time-range.ts` - 時間範囲処理

**gantt/** - ガント用ロジック

- `gantt-layout.ts` - レイアウト計算
- `dependency-resolver.ts` - 依存関係解決

**kanban/** - かんばん用ロジック

- `kanban-column.ts` - ステータス列定義
- `card-grouping.ts` - カードグループ分け

**query/** - クエリエンジン

- `query-parser.ts` - クエリ文法パース
- `query-executor.ts` - クエリ実行

**recurrence/** - 繰り返しスケジュール

- `recurrence-expander.ts` - iCalendar RRULEの展開
- `recurrence-calc.ts` - 計算ロジック

**format/** - フォーマット・変換

- `date-formatter.ts` - 日付表示フォーマット
- `markdown-formatter.ts` - Markdown 生成

**highlight/** - シンタックスハイライト

- `task-highlight.ts` - タスク行の色付け

**debug/** - デバッグビュー用

- `parse-debug.ts` - パーサー動作確認

**test-helpers.ts**:
- テスト用ユーティリティ関数

### `styles/`

- `styles.css` - 全体スタイル
- `app.css` - アプリケーションレベルCSS

### `test/` / `tests/`

```
test/
  ├── vitest/              # Vitest 設定
  └── ...

tests/
  ├── playwright/          # Playwright E2E
  ├── wdio/                # WebdriverIO (Obsidian)
  └── ...
```

## コンポーネント間の依存関係

```
plugin.ts
├── settings.ts
├── settings-hub.ts
├── sync/file-sync.ts
├── sync/ast-index.ts ────→ lib/parser/
├── sync/editor-event-bus.ts
└── views/
    ├── ShadowItemView.ts
    ├── CalendarView.ts ──→ lib/viewmodel/calendar-viewmodel.ts
    │                   ──→ lib/calendar/
    ├── GanttView.ts ─────→ lib/viewmodel/gantt-viewmodel.ts
    │                   ──→ lib/gantt/
    ├── KanbanView.ts ────→ lib/viewmodel/kanban-viewmodel.ts
    │                   ──→ lib/kanban/
    └── DashboardView.ts ─→ lib/viewmodel/dashboard-viewmodel.ts

editor/
├── metatag-suggest.ts ────→ lib/parser/meta-keys.ts
├── notation-lint.ts ──────→ lib/parser/
├── repeat-picker.ts ──────→ lib/recurrence/
└── reformat-meta-lines.ts ─→ lib/format/

lib/
├── parser/ ──────────────→ lib/contract/
├── viewmodel/ ───────────→ lib/contract/
├── query/ ────────────────→ lib/contract/
└── recurrence/ ──────────→ luxon, rrule (npm)
```

## 主要なインターフェース

### FileSync イベント

```typescript
interface FileSync {
  getCurrentFile(): TFile | null
  onFileChange: (callback: (file: TFile) => void) => void
}
```

### AstIndex イベント

```typescript
interface AstIndex {
  getDocument(file: TFile): Document | null
  getAllDocuments(): Map<string, Document>
  onIndexUpdate: (callback: () => void) => void
}
```

### EditorEventBus

```typescript
interface EditorEventBus {
  onFocusLine: (callback: (lineNumber: number) => void) => void
  focusLine: (lineNumber: number) => void
}
```

### Document 構造

```typescript
interface Document {
  file: TFile
  sections: Section[]
  nodes: Node[]
}

interface Section {
  level: number      // 1-6 (#-######)
  title: string
  children: Node[]
  close?: boolean
}

interface Node {
  type: 'task' | 'list' | 'quote'
  text: string
  status?: TaskStatus
  meta: Meta
  children: Node[]
  line: number      // ソース行番号
  localId: string   // ファイル内一意識別子
}
```

### Meta 構造

```typescript
interface Meta {
  schedule?: TimeRange
  plan?: DateRange
  due?: Date
  priority?: number
  tags?: string[]
  dependsOn?: string[]     // globalKey[]
  condition?: string
  purpose?: string
  savepoint?: string
  special_note?: string
  memo?: string
  repeat?: string          // RRULE
  [customKey: string]: unknown
}
```

## パッケージスクリプト

```json
{
  "dev": "npm run libs:update && vite",
  "build": "npm run libs:update && esbuild.config.mjs production",
  "build:dev": "npm run libs:update && esbuild.config.mjs",
  "test:unit": "vitest run",
  "test:e2e": "playwright test",
  "test:obs:e2e": "wdio run wdio.conf.mts",
  "test": "npm run test:unit && npm run test:obs:e2e"
}
```

## 外部コンポーネント（npm packages）

- `svelte-calendar-lib` - CalendarView 用UI
- `svelte-gantt-lib` - GanttView 用UI
- `svelte-kanban-lib` - KanbanView 用UI
- `svelte-dashboard-lib` - DashboardView 用UI

これらは `npm run libs:update` で更新されます。
