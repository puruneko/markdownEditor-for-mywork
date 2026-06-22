# obs-0026: カレンダー/ガントクリック → エディタカーソル同期

## ステータス

Closed

## 概要

カレンダーやガントのアイテムをクリックしたとき、Obsidian エディタの対応するタスク行にカーソルを移動してフォーカスする。

## 背景・動機

現在はカレンダー/ガントビューとエディタが独立しており、アイテムをクリックしてもエディタ側は無反応。  
タスクを特定したあとソースMDへ素早く移動できると編集体験が大きく向上する。

## 実装方針

### フェーズ 1: パーサーに行番号を追加

- `TaskNode` / `ListNode` / `QuoteNode` に `lineNumber: number` フィールドを追加する
- `md-to-ast.ts` の `parseNodes()` でセクション内の相対行インデックスを記録し、  
  セクション先頭行（絶対行番号）を足した絶対行番号（0-based）を設定する
- `Document` に `nodeLineMap: Map<string, number>` を持たせ、  
  `nodeId → lineNumber` を高速に引けるようにする

### フェーズ 2: エディタイベントバスの整備

- `src/sync/editor-event-bus.ts` を新設する
  - `requestFocusLine(lineNumber: number): void` — 外部から呼ぶ
  - `onFocusLine(cb: (line: number) => void): () => void` — エディタ側が登録
- `FileSync` は不変。plugin.ts でエディタとビューをつなぐ

### フェーズ 3: Obsidianエディタへの接続

- `plugin.ts` 内で `editorEventBus.onFocusLine(line => { ... })` を登録
- コールバック内で `app.workspace.getActiveViewOfType(MarkdownView)?.editor.setCursor({ line, ch: 0 })` を呼ぶ
- エディタが非アクティブな場合は `app.workspace.revealLeaf` でMarkdownViewを前面に出してからジャンプ

### フェーズ 4: カレンダー/ガントタブへの配線

- `CalendarTab.svelte` / `GanttTab.svelte` に `onNodeClick?: (nodeId: string) => void` プロパティを追加
- クリックイベント発火時に `onNodeClick(nodeId)` を呼ぶ
- `GanttView.ts` / `CalendarView.ts` の `onOpen()` でコールバックを渡す
  - `nodeId` を `doc` の `nodeLineMap` で引いて `editorEventBus.requestFocusLine(line)` を実行

## TODO

- [x] `src/lib/parser/types.ts`: `TaskNode` / `ListNode` / `QuoteNode` に `lineNumber: number` を追加
- [x] `src/lib/parser/types.ts`: `Document` に `nodeLineMap: Map<string, number>` を追加
- [x] `src/lib/parser/md-to-ast.ts`: `parseNodes()` で行番号を計算・設定し `nodeLineMap` を構築
- [x] `src/lib/parser/md-to-ast.test.ts`: 行番号が正しく付与されるテストを追加
- [x] `src/sync/editor-event-bus.ts`: `requestFocusLine` / `onFocusLine` の実装
- [x] `src/plugin.ts`: `editorEventBus.onFocusLine` を登録し `editor.setCursor()` を呼ぶ
- [x] `src/lib/gantt/GanttTab.svelte`: `onNodeClick` プロパティ追加・クリック時に呼び出し
- [x] `src/lib/calendar/CalendarTab.svelte`: `onNodeClick` プロパティ追加・クリック時に呼び出し
- [x] `src/views/GanttView.ts`: `onNodeClick` コールバックを `GanttTab` へ渡す
- [x] `src/views/CalendarView.ts`: `onNodeClick` コールバックを `CalendarTab` へ渡す
- [x] `tests/integration/editor-event-bus.test.ts`: イベントバスの単体テスト

## 完了条件

- カレンダーのアイテムをクリックするとエディタの対応タスク行にカーソルが移動すること
- ガントのアイテムをクリックするとエディタの対応タスク行にカーソルが移動すること
- エディタが非表示の場合はMarkdownViewが前面に出てからジャンプすること
- `lineNumber` が全ノードに正しく付与されていること（ユニットテストで確認）
- イベントバスの登録・解除が正しく機能すること（ユニットテストで確認）
- 全既存テストが引き続きパスすること

## 関連ファイル

- `src/lib/parser/types.ts`
- `src/lib/parser/md-to-ast.ts`
- `src/lib/parser/md-to-ast.test.ts`
- `src/sync/editor-event-bus.ts`（新規）
- `src/plugin.ts`
- `src/lib/gantt/GanttTab.svelte`
- `src/lib/calendar/CalendarTab.svelte`
- `src/views/GanttView.ts`
- `src/views/CalendarView.ts`
- `tests/integration/editor-event-bus.test.ts`（新規）

## History

- 2026-06-21: イシュー作成・実装完了・Closed
  - `types.ts`: lineNumber を全 Node 型・Section 型に追加、Document.nodeLineMap 追加
  - `md-to-ast.ts`: RawLine.lineIndex 追加、各ノードに lineNumber 設定、buildNodeLineMap 追加
  - `editor-event-bus.ts`: requestFocusLine / onFocusLine の pub/sub 実装
  - `plugin.ts`: EditorEventBus 生成、fileSync.getCurrentFile() で対象タブを特定してカーソル移動
  - `GanttView.ts` / `CalendarView.ts`: editorEventBus 受け取り、onNodeClick コールバック配線
  - `GanttViewMount.svelte` / `CalendarViewMount.svelte`: onNodeClick prop 追加・GanttTab/CalendarTab へ渡す
  - `GanttTab.svelte`: onBarClick → onNodeClick?.(nodeId)
  - `CalendarTab.svelte`: onItemClick → onNodeClick?.(nodeId)
  - `MonacoEditor.svelte`: registerReveal prop 追加（ブラウザ用 Monaco スクロール）
  - `EditorLayout.svelte`: handleNodeClick → nodeLineMap → revealInEditor で Monaco スクロール
  - テスト: lineNumber・nodeLineMap の単体テスト追加、EditorEventBus テスト新設
  - 仕様書: `project/specs/editor-cursor-sync.spec.md` 作成
  - 93 テストパス
