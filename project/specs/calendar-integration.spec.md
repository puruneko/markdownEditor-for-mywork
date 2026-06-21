title: カレンダー統合機能
status: active
owner: human
created: 2026-03-22
updated: 2026-03-22
related_issues: [0012, 0013, 0014, 0015, 0016, 0017, 0018]
related_decisions: []

---

## 1. 目的

ASTから日時情報を持つタスクを抽出し、カレンダー上に表示する。
カレンダー上での操作はMarkdown文字列に反映され、Markdownが唯一の正の情報源となる。

---

## 2. 定義

- **スケジュールタスク**: `meta.schedule` フィールドを持つ `TaskNode`
- **CalendarItem**: カレンダーライブラリ（svelte-calendar-lib）のデータ型
- **schedule文字列**: `YYYY-MM-DDTHH:mm/YYYY-MM-DDTHH:mm` 形式の文字列（開始/終了）

---

## 3. タブUI

BR-001 右パネルはタブUIを持たなければならない。タブは「AST」と「Calendar」の2種類である。

BR-002 ASTタブ選択時は、JSON形式のASTをMonaco Editorで表示しなければならない。

BR-003 Calendarタブ選択時は、CalendarViewコンポーネントを表示しなければならない。

BR-004 タブの切り替えは、現在の表示コンテンツを即座に切り替えなければならない。

---

## 4. AST → CalendarItem 変換

BR-005 `meta.schedule` を持つ `TaskNode` のみ、CalendarItemとして変換しなければならない。

BR-006 `meta.schedule` を持たないノードはCalendarItemに変換してはならない。

BR-007 `QuoteNode` 内のコンテンツはCalendarItemに変換してはならない。

BR-008 CalendarItem の `id` はASTノードの `id` と同一でなければならない。

BR-009 CalendarItem の `title` はASTノードの `text` と同一でなければならない。

BR-010 CalendarItem の `temporal` は `meta.schedule` の形式に応じて以下のルールで決定しなければならない。
  - 日付のみ形式（`YYYY-MM-DD/YYYY-MM-DD`）のときは `CalendarDateRange` を生成しなければならない。
  - 時刻付き同一日形式（`YYYY-MM-DDTHH:mm/YYYY-MM-DDTHH:mm` で start と end が同一日）のときは `CalendarDateTimeRange` を生成しなければならない。
  - 時刻付き複数日形式（start と end が異なる日）のときは `CalendarDateRange` を生成しなければならない。

BR-011 schedule文字列のパース形式は `YYYY-MM-DDTHH:mm/YYYY-MM-DDTHH:mm`（時刻付き）または `YYYY-MM-DD/YYYY-MM-DD`（日付のみ）でなければならない。

BR-012 schedule文字列が不正な場合、そのノードはCalendarItemに変換してはならない。

BR-013 CalendarItem の `type` は `'task'` でなければならない。

BR-014 CalendarItem の `status` はASTノードの `status` から以下のルールでマッピングしなければならない:
  - todo → 'todo'
  - doing → 'doing'
  - done → 'done'
  - blocked → 'todo'（カレンダーに blocked なし）
  - hold → 'todo'（カレンダーに hold なし）

BR-015 CalendarItem の `parents` はASTノードの `path` の最後の要素を除いた配列から、インデックス部分（`[N]`）を除去した文字列の配列でなければならない。

---

## 5. カレンダー → Markdown 更新（Markdownが唯一の正の情報源）

BR-016 カレンダー上での操作（移動・リサイズ・編集）はMarkdown文字列を更新しなければならない。

BR-017 CalendarItem の `id` を用いてASTの対応ノードを特定しなければならない。

BR-018 対応ノードが見つからない場合、操作は無視しなければならない。

BR-019 アイテムの移動・リサイズ時は、対応ノードの `meta.schedule` を新しい時間で更新しなければならない。

BR-020 schedule文字列の形式は `YYYY-MM-DDTHH:mm/YYYY-MM-DDTHH:mm` でなければならない（分単位、秒なし）。

BR-021 アイテムの編集ダイアログでのタイトル変更時は、対応ノードの `text` を更新しなければならない。

BR-022 アイテムの編集ダイアログでの時間変更時は、対応ノードの `meta.schedule` を更新しなければならない。

BR-023 AST更新後は必ず `serializeAst()` でMarkdown文字列に変換し、Markdownエディタの値を更新しなければならない。

BR-024 Markdown文字列の更新後は `parseMarkdown()` で再パースし、AST表示を更新しなければならない。

---

## 6. リアルタイム同期

BR-025 Markdown編集時はカレンダー表示を自動更新しなければならない。

BR-026 カレンダータブが非表示の間にMarkdownが編集された場合も、タブ切り替え時に最新のカレンダーを表示しなければならない。

---

## 7. エッジケース

BR-027 scheduleを持つタスクが存在しない場合、カレンダーは空の状態を表示しなければならない。

BR-028 schedule文字列のstart >= end の場合、そのノードはCalendarItemに変換してはならない。

---

## 8. 検証方法

- `extractCalendarItems()` のユニットテスト
- `updateNodeSchedule()` / `updateNodeText()` のユニットテスト
- カレンダー表示の目視確認
- DnD/編集後のMarkdown文字列の目視確認
