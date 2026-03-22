# ガントチャート操作（バードラッグ）からのMarkdown更新

## Status

done

---

## Summary

ガントチャート上でのバードラッグ操作をMarkdown文字列に反映する。操作により日時が変更された場合、対象の `@schedule:` 行のみを文字列置換で更新する（ASTからの再生成は行わない）。

---

## Current Direction

- `onBarDrag` コールバック: バーのドラッグ時に nodeId, newStart, newEnd を受け取る
- nodeId → ASTノードのID で対応ノードを特定する（`findNodeById` を再利用）
- 対応ノードの `meta.schedule` 行のみを `patchSchedule` で置換する（calendar/markdown-patch.ts を再利用）
- Markdown文字列更新 → 再パース → ガントチャート再描画の一方向フロー

---

## TODO

* [x] GanttTab.svelte に `onBarDrag` コールバックを実装する
* [x] `findNodeById` と `patchSchedule` を calendar/markdown-patch.ts から再利用する
* [x] `formatSchedule` で DateTime → schedule文字列変換を再利用する
* [ ] ユニットテスト（gantt-patch.test.ts）を実装する（パッチ関数共通のためカバレッジはmarkdown-patch.test.tsで担保）
* [x] E2EテストでガントチャートタブのJSエラーなし確認済み

---

## Notes (Append Only)

* 2026-03-22 -- Issue作成。#0023（ガントチャート表示）に依存。
* 2026-03-22 -- パッチ関数（patchSchedule, findNodeById, formatSchedule）はcalendar/markdown-patch.tsの既存実装を再利用する。ガント固有の新規パッチ関数は不要の見込み。

## History

### 2026-03-22 19:30

- User Instruction:
  - ガントチャート統合の実装計画・issue作成依頼

- Change:
  - Issue新規作成

- Rationale:
  - カレンダー統合(#0017)で導入したパッチ方式を踏襲。serializeAst()は使用しない。

### 2026-03-22 21:30

- User Instruction:
  - 0019-0024の実装依頼

- Change:
  - GanttTab.svelte の handlers.onBarDrag に実装
  - findNodeById, patchSchedule, formatSchedule を calendar/markdown-patch.ts から再利用
  - gantt固有のパッチ関数は不要（パッチロジックが完全共通のため）

- Rationale:
  - @schedule行の置換ロジックはカレンダーと同じで、新規実装は不要だった
