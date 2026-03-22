# ガントチャートタブへの GanttChart 表示統合

## Status

done

---

## Summary

GanttTab.svelte に GanttChart コンポーネントを組み込み、ASTから変換したGanttNode[]を表示する。

---

## Current Direction

- GanttTab.svelte に GanttChart コンポーネントを配置する
- `extractGanttNodes(doc)` で AST → GanttNode[] に変換して渡す
- `$derived` で doc の変更を自動追従する
- GanttConfig の初期設定（mode: 'controlled'）を適用する
- E2Eテストでガントチャートの表示を確認する

---

## TODO

* [x] GanttTab.svelte にGanttChartコンポーネントを配置する
* [x] extractGanttNodes(doc) を $derived で呼び出す
* [x] GanttConfig の設定（mode: 'controlled', zoomLevel: 3）を適用する
* [x] EditorLayout.svelte からGanttTab に mdValue, doc, onMdChange を渡す
* [x] E2Eテストでガントチャート表示を確認する（JSエラーなし）

---

## Notes (Append Only)

* 2026-03-22 -- Issue作成。#0020（タブUI）と#0022（変換ロジック）に依存。

## History

### 2026-03-22 19:30

- User Instruction:
  - ガントチャート統合の実装計画・issue作成依頼

- Change:
  - Issue新規作成

- Rationale:
  - カレンダータブ（CalendarTab.svelte）と同じパターンで実装する
