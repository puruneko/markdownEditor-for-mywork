title: ガントチャート統合機能
status: active
owner: human
created: 2026-03-22
updated: 2026-03-22
related_issues: [0019, 0020, 0021, 0022, 0023, 0024]
related_decisions: []

---

## 1. 目的

ASTから階層構造と日時情報を抽出し、ガントチャート上に表示する。
ガントチャート上での操作はMarkdown文字列に反映され、Markdownが唯一の正の情報源となる。

---

## 2. 定義

- **スケジュールタスク**: `meta.schedule` フィールドを持つ `TaskNode`
- **GanttNode**: ガントチャートライブラリ（svelte-gantt-lib）のデータ型
- **schedule文字列**: `YYYY-MM-DDTHH:mm/YYYY-MM-DDTHH:mm` 形式の文字列（開始/終了）

---

## 3. タブUI

GR-001 右パネルは「AST」「Calendar」「Gantt」の3タブを持たなければならない。

GR-002 Ganttタブ選択時は、GanttChartコンポーネントを表示しなければならない。

GR-003 タブの切り替えは、現在の表示コンテンツを即座に切り替えなければならない。

---

## 4. AST → GanttNode 変換

### 4.1 ノードのマッピング

GR-004 AST の `Section` (depth=1) は GanttNode `type: 'project'` にマッピングしなければならない。

GR-005 AST の `Section` (depth>=2) は GanttNode `type: 'section'` にマッピングしなければならない。

GR-006 AST の `ListNode`（子にタスクを含む場合）は GanttNode `type: 'subsection'` にマッピングしなければならない。

GR-007 AST の `TaskNode` で `meta.schedule` を持つものは GanttNode `type: 'task'` にマッピングしなければならない。

GR-008 AST の `TaskNode` で `meta.schedule` を持たず、子にスケジュール付きタスクを持つものは GanttNode `type: 'subsection'` にマッピングしなければならない。

GR-009 `QuoteNode` はGanttNodeに変換してはならない。

GR-010 `meta.schedule` を持たず、子孫にもスケジュール付きタスクを持たないノードはGanttNodeに変換してはならない。

### 4.2 フィールドマッピング

GR-011 GanttNode の `id` はASTノードの `id` と同一でなければならない。

GR-012 GanttNode の `name` は、Section の場合は `title`、TaskNode/ListNode の場合は `text` でなければならない。

GR-013 GanttNode の `parentId` はAST上の親ノードの `id` でなければならない。ルートレベルの場合は `null`。

GR-014 GanttNode の `start`/`end` は `meta.schedule` をパースした DateTime でなければならない。

GR-015 schedule文字列のパース形式は `YYYY-MM-DDTHH:mm/YYYY-MM-DDTHH:mm` でなければならない。

GR-016 schedule文字列が不正な場合、そのノードのstart/endは未設定としなければならない。

GR-017 schedule文字列のstart >= end の場合、そのノードのstart/endは未設定としなければならない。

GR-018 `meta.schedule` を持たないセクション/グループノードの `start`/`end` は設定しない（ライブラリが子から自動計算）。

### 4.3 metadata

GR-019 GanttNode の `metadata` に元のASTノードの `status` と `meta.schedule` を格納しなければならない。

---

## 5. ガントチャート → Markdown 更新（Markdownが唯一の正の情報源）

GR-020 ガントチャート上でのバードラッグ操作はMarkdown文字列の対象行のみを更新しなければならない。

GR-021 ASTからの再構成（serializeAst）は行ってはならない。

GR-022 `onBarDrag` コールバックの `nodeId` を用いてASTの対応ノードを特定しなければならない。

GR-023 対応ノードが見つからない場合、操作は無視しなければならない。

GR-024 対応ノードの `meta.schedule` 行のみを新しい時間で文字列置換しなければならない。

GR-025 schedule文字列の形式は `YYYY-MM-DDTHH:mm/YYYY-MM-DDTHH:mm` でなければならない（分単位、秒なし）。

---

## 6. リアルタイム同期

GR-026 Markdown編集時はガントチャート表示を自動更新しなければならない。

GR-027 Ganttタブが非表示の間にMarkdownが編集された場合も、タブ切り替え時に最新のガントチャートを表示しなければならない。

---

## 7. エッジケース

GR-028 scheduleを持つタスクが存在しない場合、ガントチャートは空の状態を表示しなければならない。

---

## 8. 検証方法

- `extractGanttNodes()` のユニットテスト
- `patchSchedule` の再利用（calendar/markdown-patch.ts と共有）
- ガントチャート表示の目視確認
- バードラッグ後のMarkdown文字列の目視確認
- E2Eテスト
