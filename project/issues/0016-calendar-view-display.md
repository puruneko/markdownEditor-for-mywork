# カレンダータブへの CalendarView 表示統合

## Status

proposed

---

## Summary

カレンダータブ選択時に、ASTから抽出した `CalendarItem[]` を `CalendarView` コンポーネントで表示する。Markdown編集時にカレンダー表示がリアルタイムで更新される。

---

## Current Direction

- `CalendarTab.svelte` コンポーネントを新規作成する
- EditorLayout内のカレンダータブに `CalendarTab` を組み込む
- Markdown変更 → AST再パース → CalendarItem[]再抽出 → CalendarView再描画のフローを実装する
- CalendarViewの週表示/月表示切替はカレンダーライブラリのUI機能をそのまま使用する

---

## TODO

* [x] `src/lib/calendar/CalendarTab.svelte` を作成する
* [x] CalendarView に CalendarItem[] を渡して表示する（`$derived` で自動更新）
* [x] EditorLayout.svelte のカレンダータブに CalendarTab を組み込む
* [x] Markdown変更時のカレンダー自動更新を実装する（`currentDoc = $derived(parseMarkdown(mdValue))`）
* [x] ビルド確認済み

---

## Notes (Append Only)

* 2026-03-22 -- Issue作成。#0013（タブUI）と#0015（変換ロジック）に依存。
* 2026-03-22 -- 実装完了。EditorLayout で `currentDoc: Document = $derived(parseMarkdown(mdValue))` を計算し CalendarTab に渡す設計。

## History

### 2026-03-23 19:15

- User Instruction:
  - カレンダー設定UIで設定変更が反映されない問題の調査・修正依頼

- Change:
  - `CalendarStorage` と `LocalStorageBackend` を `svelte-calendar-lib` からインポート追加
  - `CalendarTab.svelte` で `CalendarStorage` インスタンスを生成し `CalendarView` に `storage` propとして渡すよう修正

- Rationale:
  - `CalendarView` に `storage` propが渡されていなかったため、`WeekView`/`MonthView` が常に `DEFAULT_WEEK_SETTINGS`/`DEFAULT_MONTH_SETTINGS` にフォールバックしていた
  - 設定UIの変更ハンドラ（`storage?.update()`）も `storage` が `undefined` のため無言でスキップされていた
  - `LocalStorageBackend` を使用することで設定がリロード後も保持される

### 2026-03-22 14:30

- User Instruction:
  - Phase1-4 全実装の依頼

- Change:
  - CalendarTab.svelte 作成
  - EditorLayout に currentDoc ($derived) 追加
  - calendarItems = $derived(extractCalendarItems(doc)) でリアルタイム更新

- Rationale:
  - $derived を使うことでMarkdown変更が自動的にカレンダーに反映される
