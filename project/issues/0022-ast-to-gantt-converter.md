# AST → GanttNode[] 変換ロジックの実装

## Status

done

---

## Summary

パース済みASTからガントチャートライブラリの `GanttNode[]` 形式に変換するロジックを実装する。

---

## Current Direction

- `src/lib/gantt/ast-to-gantt.ts` に変換関数 `extractGanttNodes(doc: Document): GanttNode[]` を実装する
- Section → project/section、ListNode（タスク子孫あり）→ subsection、TaskNode（schedule付き）→ task にマッピング
- scheduleを持たず子孫にもスケジュール付きタスクがないノードはスキップする
- GanttNode.metadata に元のstatus, scheduleを格納する（パッチ時に使用）
- parentId による親子関係をAST構造から導出する
- ユニットテストを `ast-to-gantt.test.ts` に実装する

---

## TODO

* [x] `parseSchedule` を共通化（calendar の既存関数を再利用）するか、gantt側にコピーする
* [x] `extractGanttNodes(doc)` を実装する
* [x] Section → GanttNode (project/section) のマッピングを実装する
* [x] ListNode → GanttNode (subsection) のマッピングを実装する
* [x] TaskNode → GanttNode (task) のマッピングを実装する
* [x] scheduleのないサブツリーを除外するフィルタを実装する
* [x] ユニットテストを実装する（12件、全パス）

---

## Notes (Append Only)

* 2026-03-22 -- Issue作成。#0019（Spec）と#0021（ライブラリ導入）に依存。
* 2026-03-22 -- カレンダーの `ast-to-calendar.ts` を参考にするが、ガントはフラットな配列 + parentId で階層を表現する点が異なる。

## History

### 2026-03-22 19:30

- User Instruction:
  - ガントチャート統合の実装計画・issue作成依頼

- Change:
  - Issue新規作成

- Rationale:
  - ガントチャートライブラリはCalendarItemと異なりparentIdベースのフラット配列を要求するため、変換ロジックが新規必要

### 2026-03-22 21:30

- User Instruction:
  - 0019-0024の実装依頼

- Change:
  - src/lib/gantt/ast-to-gantt.ts を新規作成（extractGanttNodes, parseSchedule, hasScheduleDescendant, sectionHasSchedule）
  - src/lib/gantt/ast-to-gantt.test.ts を新規作成（12件、全パス）

- Rationale:
  - Section→project/section、ListNode→subsection、TaskNode→task のマッピングで階層を表現
  - scheduleのないサブツリーは完全にスキップする
