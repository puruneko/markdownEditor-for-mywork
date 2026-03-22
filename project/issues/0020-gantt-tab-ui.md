# 右パネルのタブにGanttタブ追加

## Status

done

---

## Summary

右パネルのタブUI（現在AST/Calendarの2タブ）にGanttタブを追加し、3タブの切替を可能にする。

---

## Current Direction

- EditorLayout.svelte の `RightTab` 型に `'gantt'` を追加する
- タブヘッダに「Gantt」ボタンを追加する
- Ganttタブ選択時は GanttTab コンポーネントを表示する（この時点ではプレースホルダーでもよい）
- 既存のAST/Calendarタブは一切変更しない

---

## TODO

* [x] `RightTab` 型に `'gantt'` を追加する
* [x] タブヘッダにGanttボタンを追加する
* [x] GanttTab.svelte のプレースホルダーを作成する
* [x] EditorLayout.svelte でGanttタブ表示分岐を追加する

---

## Notes (Append Only)

* 2026-03-22 -- Issue作成。#0013（タブUI基盤）の拡張。

## History

### 2026-03-22 19:30

- User Instruction:
  - ガントチャート統合の実装計画・issue作成依頼

- Change:
  - Issue新規作成

- Rationale:
  - 既存のタブUI基盤（#0013）を最小限に拡張するのみ

### 2026-03-22 21:30

- User Instruction:
  - 0019-0024の実装依頼

- Change:
  - EditorLayout.svelte の RightTab 型に 'gantt' を追加
  - タブヘッダに Gantt ボタンを追加
  - GanttTab.svelte を新規作成
  - E2Eテスト (gantt-tab.spec.ts) を追加、全14件パス

- Rationale:
  - CalendarTab と同じパターンで最小限の変更で追加
