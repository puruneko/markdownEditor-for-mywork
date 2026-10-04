# Gantt ツリーでのセル編集（タスク名・schedule・plan・due）を Markdown へ書き戻す

## 背景
- リポジトリ: `markdownEditor-for-mywork`（ライブラリ側の前提: `ganttchart-for-mywork` の `onTreeCellEdit`）。
- 要望原文（ganttchart 向け）:
  > タスクツリーに新列を作成し、タスクのメタ情報を表示できるようにして。（中略）
  > 　このツリーで文字列や日時を編集できるようにして
- ganttchart はセル編集結果を `handlers.onTreeCellEdit(event)` で通知するだけで、データは書き換えない。Obsidian 上で編集を有効にするには、Markdown 本文への書き戻しが必要。本 issue はその書き戻しを扱う。

## 目的
Gantt ビューのツリーで編集したタスク名・schedule・plan・due が、元の Markdown ファイルの該当タスクに反映される。

## 現状
- `src/lib/gantt/GanttTab.svelte`: `handlers` で `onBarDragEnd` → `onNodePatch(nodeId, patcher)` により書き戻している（`nodeId` は globalKey）。`onSchedule` も同様に `upsertSchedule` を使用。
- 書き戻し用の関数:
  - `src/lib/calendar/markdown-patch.ts` 9行 `formatSchedule(start, end)` → `yyyy-MM-ddTHH:mm/yyyy-MM-ddTHH:mm`、80行 `patchScheduleForNode`、136行 `patchTaskTitle(md, status, oldTitle, newTitle)`（CalendarTab.svelte 164行で使用例あり）。
  - `src/lib/patch/upsert-meta.ts` 17行 `upsertMeta(md, node, metaKey: 'schedule' | 'due', value)`、68行 `upsertSchedule`、72行 `upsertDue`。`plan` には未対応。
- ganttchart のイベント（依存 issue で追加）:
  ```ts
  interface GanttTreeCellEditEvent {
    nodeId: string;                              // = globalKey
    key: 'name' | 'schedule' | 'plan' | 'due';
    value: string | DateTime | { start: DateTime; end: DateTime };
  }
  ```

## 実装内容
1. `upsert-meta.ts`: `upsertMeta` の `metaKey` に `'plan'` を追加し、`upsertPlan(md, node, value)` を追加する。既存メタ行に仮置き記号 `?`（`@schedule?:` 等）が付いている場合は、置換後も `?` を保持する（現状で保持されない場合は修正する）。
2. 日時値の書式化（新規ヘルパー。`markdown-patch.ts` か `src/lib/gantt/` 配下）:
   - `{start,end}` → `formatSchedule(start, end)`（schedule・plan・due 範囲で共通）。
   - `DateTime`（due 単一）→ 既存の due の書式（`yyyy-MM-ddTHH:mm`。既存パーサが受け付ける形式であることを確認して合わせる）。
3. `GanttTab.svelte` の `handlers.onTreeCellEdit`:
   - `name` → `onNodePatch(nodeId, (md, _doc, node) => patchTaskTitle(md, node.status, node.text, value))`
   - `schedule` → `upsertSchedule`、`plan` → `upsertPlan`、`due` → `upsertDue`（それぞれ上記の書式化を通す）。
4. 書き戻し後は、既存の仕組み（ファイル変更 → AST 再構築 → `ganttNodes` 再計算）でツリー・チャートが更新されることを確認する。
5. `npm run build`（`libs:update` で最新 ganttchart を取り込む）→ Obsidian で確認。

変更ファイル: `src/lib/patch/upsert-meta.ts`, `src/lib/calendar/markdown-patch.ts`（または新規ヘルパー）, `src/lib/gantt/GanttTab.svelte`, テスト

## 完了条件
- ツリーでタスク名を編集すると、Markdown のタスク行のタイトルが変わる。
- schedule/plan/due を編集すると、該当メタ行が置換される。メタ行が無ければタスク直下に追加される。
- 仮置き `?` 付きのメタを編集しても `?` が残る。
- 書き戻し後、ツリーとチャートが新しい値で再描画される。
- 既存のバードラッグ書き戻し・外部ドロップは従来どおり動く。

## テスト
- 単体 `upsertPlan`: 置換・挿入・`?` 保持。
- 単体 書式化ヘルパー: 範囲・単一。
- 単体 `onTreeCellEdit` の振り分け（key ごとに正しい patcher が使われる。patcher を純粋関数に切り出して検証）。
- 手動: Obsidian の Gantt ビューで4種類を編集し、Markdown を目視確認。

## 依存関係
- `ganttchart-for-mywork` の issue-phase017-ganttchart-for-mywork-006__tree-cell-inline-edit.md

## 対象外
- status・任意メタの編集と書き戻し。
- 値の削除（メタ行の削除）。
- 同名タスクが同一ファイルに複数ある場合の `patchTaskTitle` の挙動改善（既存関数の仕様のまま）。

## 要確認
- `patchTaskTitle` は行文字列の一致で置換するため、同じタイトル・同じ状態のタスクが同じファイルに複数あると、両方が変わる可能性がある。問題になる場合は別 issue で行番号ベースに改める。

## History

### 2026-10-03

- User Instruction:
  - phase017 の issue を順に実装

- Change:
  - 実装済み（単体テスト・ビルド green）。Obsidian 実機確認とクローズ承認は未実施のため Open のまま。

- Rationale:
  - WORKFLOW §6: ユーザー承認なしに closure しない。
