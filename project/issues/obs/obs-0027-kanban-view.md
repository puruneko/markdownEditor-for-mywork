# obs-0027: カンバンビューでタスクDBを表示

## ステータス

Closed

## 概要

タスクDBの内容をカンバンボードに表示する。
カレンダー・ガントと同様に、Obsidian拡張機能では右サイドパネル、ブラウザではタブとして表示する。

## 背景・動機

カレンダー（日程ベース）・ガント（進捗ベース）のビューに加え、
ステータス別のカンバンビューを追加することで、タスク全体の状態を俯瞰できるようにする。
カードのドラッグ&ドロップでステータスを変更し、Markdownに書き戻す。

## 実装方針

### カンバンデータモデル

- AST `TaskNode` → `KanbanCard` に変換（`svelte-kanban-lib` の `CardData` 準拠）
- レーンは `status` フィールドでフィルタリング（todo / doing / blocked / hold / done）
- カードにはタスクの `id`, `title`, `status`, `sectionTitle`, `depth` と
  meta フィールド（`schedule`, `due`, `priority`, `tags`）を含む

### ドラッグ&ドロップ → Markdown 書き戻し

- `onCardMove` イベントで `updatedCard.status` を取得（`updateRules` により変更済み）
- `findNodeById(doc, card.id)` でノードを特定し `patchNodeStatus(md, node, newStatus)` を呼ぶ
- `patchNodeStatus` は `node.lineNumber` で対象行を直接パッチする（`markdown-patch.ts` に追加）

### Obsidianサイドパネル

3層構造（GanttView と同じパターン）:
1. `KanbanView.ts` — `ItemView` 継承・Svelte マウント
2. `KanbanViewMount.svelte` — 状態管理・`registerUpdater`
3. `KanbanTab.svelte` — 変換・イベント配線・`KanbanBoard` レンダリング

アイコン: `layout-grid`

### ブラウザタブ

`EditorLayout.svelte` の右パネルに `'kanban'` タブを追加。
`KanbanTab.svelte` を直接レンダリング。

## TODO

- [x] `src/lib/kanban/ast-to-kanban.ts`: `extractKanbanCards()` / `DEFAULT_KANBAN_CONFIG` / `KANBAN_FIELD_DEFINITIONS`
- [x] `src/lib/kanban/ast-to-kanban.test.ts`: 変換ロジックのユニットテスト
- [x] `src/lib/calendar/markdown-patch.ts`: `patchNodeStatus()` を追加
- [x] `src/lib/kanban/KanbanTab.svelte`: メインタブコンポーネント
- [x] `src/views/KanbanView.ts`: Obsidian `ItemView`
- [x] `src/views/KanbanViewMount.svelte`: Svelte マウントラッパー
- [x] `src/plugin.ts`: KanbanView 登録・コマンド・リボンアイコン追加
- [x] `src/lib/editor/EditorLayout.svelte`: Kanban タブ追加

## 完了条件

- ブラウザで「Kanban」タブを選択するとステータス別レーンにタスクが表示されること
- Obsidian で「Kanban View を開く」コマンドまたはリボンアイコンからサイドパネルが開くこと
- カードをレーン間でドラッグ&ドロップするとMarkdownのステータスが更新されること
- カードをクリックするとエディタの対応行にカーソルが移動すること
- 全既存テストが引き続きパスすること

## History

- 2026-06-21: イシュー作成・実装
  - `ast-to-kanban.ts`: `extractKanbanCards()` / `createKanbanConfig()` / `DEFAULT_KANBAN_CONFIG` / `KANBAN_FIELD_DEFINITIONS`
  - `markdown-patch.ts`: `patchNodeStatus()` 追加（node.lineNumber で直接行パッチ）
  - `KanbanTab.svelte`: KanbanBoard レンダリング、カスタムカードスニペット、カードクリック→onNodeClick、ドラッグ→patchNodeStatus
  - `KanbanView.ts` / `KanbanViewMount.svelte`: Obsidian サイドパネル（GanttView と同パターン）
  - `plugin.ts`: KanbanView 登録・コマンド・リボンアイコン（layout-grid）追加
  - `EditorLayout.svelte`: Kanban タブ追加
  - テスト: 19テスト追加（ast-to-kanban: extractKanbanCards・createKanbanConfig）、合計112テストパス
- 2026-06-22: カンバンライブラリ更新対応・CSS修正
  - `ast-to-kanban.ts`: `GroupDefinition` / `createKanbanConfig()` 追加（groupBy: 'sectionTitle'でセクション別グルーピング）
  - `KanbanTab.svelte`: 動的config（userLanes + allowCrossGroupMove + セクショングループ）・CSS変数を `var(--obsidian-var, dark-fallback)` 形式に統一
  - `styles.css`: Obsidianプラグイン用スタイルシート新規作成（ビューコンテナレイアウト・ボタン補正）

## 関連ファイル

- `src/lib/kanban/ast-to-kanban.ts`（新規）
- `src/lib/kanban/ast-to-kanban.test.ts`（新規）
- `src/lib/kanban/KanbanTab.svelte`（新規）
- `src/views/KanbanView.ts`（新規）
- `src/views/KanbanViewMount.svelte`（新規）
- `src/lib/calendar/markdown-patch.ts`（patchNodeStatus 追加）
- `src/plugin.ts`
- `src/lib/editor/EditorLayout.svelte`
- `src/lib/parser/types.ts`（変更なし）
- `src/sync/editor-event-bus.ts`（変更なし）
