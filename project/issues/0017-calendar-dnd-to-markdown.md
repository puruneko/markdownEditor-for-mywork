# カレンダー操作（移動・リサイズ）からのMarkdown更新

## Status

done

---

## Summary

カレンダー上でのドラッグ移動・リサイズ操作をMarkdown文字列に反映する。操作によりCalendarItemの時間が変更された場合、対象の `@schedule:` 行のみを文字列置換で更新する（ASTからの再生成は行わない）。

---

## Current Direction

- `onItemMove` コールバック: アイテムのドラッグ移動時に新しいstart/endを受け取る
- `onItemResize` コールバック: アイテムのリサイズ時に新しいstart/endを受け取る
- CalendarItem.id → ASTノードのID で対応ノードを特定する
- 対応ノードの `meta.schedule` を新しい時間で更新する
- 更新後のASTをserializeしてMarkdown文字列を再生成する
- Markdown文字列更新 → 再パース → AST/カレンダー再描画の一方向フロー

---

## TODO

* [x] `calendar-to-ast.ts` に `updateNodeSchedule(doc, nodeId, start, end)` を実装する
* [x] `formatSchedule()` で DateTime → `YYYY-MM-DDTHH:mm/YYYY-MM-DDTHH:mm` 変換を実装する
* [x] CalendarTab.svelte に `handleItemMove` コールバックを実装する
* [x] CalendarTab.svelte に `handleItemResize` コールバックを実装する
* [x] onCalendarMdChange で Markdown → 再パース → 再描画フローを実装する
* [x] テストで updateNodeSchedule の動作確認済み

---

## Notes (Append Only)

* 2026-03-22 -- Issue作成。#0016（カレンダー表示）に依存。
* 2026-03-22 -- 実装完了。handleItemMove と handleItemResize は同じ updateNodeSchedule を呼ぶ。

## History

### 2026-03-22 14:30

- User Instruction:
  - Phase1-4 全実装の依頼

- Change:
  - calendar-to-ast.ts に updateNodeSchedule 実装
  - CalendarTab.svelte に handleItemMove / handleItemResize 実装
  - EditorLayout に onCalendarMdChange コールバック実装

- Rationale:
  - 移動とリサイズは両方とも「時間範囲の変更」なので同一関数を共有

### 2026-03-22 19:00

- User Instruction:
  - カレンダー移動でMarkdownの空行が消える問題の修正依頼
  - 「markdownへの変更は必要最低限の箇所にして。またASTから再構成などはやめて」

- Change:
  - markdown-patch.ts を新規作成（patchSchedule, patchTaskTitle, findNodeById, formatSchedule）
  - CalendarTab.svelte を書き換え: serializeAst/updateNodeSchedule 廃止 → patchSchedule 使用
  - handleItemMove/handleItemResize: item.temporal の旧時間 → patchSchedule で1行置換のみ

- Rationale:
  - serializeAst() はAST全体からMarkdownを再生成するため、ユーザが手入力した空白行・改行が失われる
  - ターゲット行のみ置換することでMarkdown内の他の行を完全に保持する
