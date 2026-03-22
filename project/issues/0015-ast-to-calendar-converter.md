# AST → CalendarItem 変換ロジックの実装

## Status

proposed

---

## Summary

ASTから `meta.schedule` を持つタスクノードを再帰的に抽出し、カレンダーライブラリの `CalendarItem[]` 形式に変換するロジックを実装する。

---

## Current Direction

- Document全体を再帰的に走査し、`meta.schedule` を持つタスクノードを収集する
- schedule文字列（`YYYY-MM-DDTHH:mm/YYYY-MM-DDTHH:mm`）をパースし、`CalendarDateTimeRange` に変換する
- AST NodeのIDをそのままCalendarItemのIDとして使用する（逆引き用）
- タスクのstatusをCalendarItemのTaskStatusにマッピングする
- pathからparentsを生成する
- 変換関数: `extractCalendarItems(doc: Document): CalendarItem[]`

---

## TODO

* [x] `src/lib/calendar/ast-to-calendar.ts` に変換関数を実装する
* [x] schedule文字列のパースロジックを実装する（`parseSchedule()`）
* [x] AST走査（Section → Node → children再帰）を実装する
* [x] status マッピング（blocked/hold → 'todo'）を実装する
* [x] `src/lib/calendar/ast-to-calendar.test.ts` にテストを実装する（20テスト全合格）
* [x] `src/lib/calendar/calendar-to-ast.ts` に逆変換関数を実装する（#0017, #0018と統合）

---

## Notes (Append Only)

* 2026-03-22 -- Issue作成。AST仕様のmeta.scheduleフィールドを利用。
* 2026-03-22 -- 実装完了。20テスト全合格。`createCalendarItem` はdistに含まれないため、Task型のプレーンオブジェクト直接生成に変更。

## History

### 2026-03-22 14:30

- User Instruction:
  - Phase1-4 全実装の依頼

- Change:
  - ast-to-calendar.ts 実装（extractCalendarItems, parseSchedule）
  - calendar-to-ast.ts 実装（updateNodeSchedule, updateNodeText）
  - テスト20件追加（全合格）

- Rationale:
  - createCalendarItem がdistに未エクスポートのためプレーンオブジェクト生成に変更
