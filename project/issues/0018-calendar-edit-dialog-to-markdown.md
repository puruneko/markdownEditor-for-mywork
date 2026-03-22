# カレンダー編集ダイアログからのMarkdown更新

## Status

done

---

## Summary

カレンダーの編集ダイアログでアイテム情報（タイトル・時間等）が変更された場合、Markdown文字列に反映する。

---

## Current Direction

- `onItemUpdate` コールバック: 編集ダイアログで保存時に更新後のCalendarItemを受け取る
- CalendarItem.id → ASTノードのID で対応ノードを特定する
- タイトル変更 → ASTノードの `text` を更新する
- 時間変更 → ASTノードの `meta.schedule` を更新する
- タイトル・時間の変更箇所のみ文字列置換で更新する（ASTからの再生成は行わない）
- `onItemDelete` は現段階ではMarkdown行の削除を伴うため、対象外とする（将来Issue）

---

## TODO

* [x] `calendar-to-ast.ts` に `updateNodeText(doc, nodeId, newText)` を実装する
* [x] CalendarTab.svelte に `handleItemUpdate` コールバックを実装する
* [x] タイトル変更のAST反映を実装する（updateNodeText）
* [x] 時間変更のAST反映を実装する（updateNodeSchedule を再利用）
* [x] テストで updateNodeText の動作確認済み

---

## Notes (Append Only)

* 2026-03-22 -- Issue作成。#0016（カレンダー表示）に依存。#0017と並行実装可能。
* 2026-03-22 -- 実装完了。handleItemUpdate は updateNodeText + updateNodeSchedule を両方適用する設計。

## History

### 2026-03-22 14:30

- User Instruction:
  - Phase1-4 全実装の依頼

- Change:
  - calendar-to-ast.ts に updateNodeText 実装
  - CalendarTab.svelte に handleItemUpdate 実装（タイトル + 時間の両方を更新）

- Rationale:
  - タイトルと時間は常に更新することで、変更検知の比較ロジックを不要にした

### 2026-03-22 19:00

- User Instruction:
  - markdownへの変更は必要最低限の箇所にして（#0017と同じ方針）

- Change:
  - CalendarTab.svelte の handleItemUpdate を書き換え: updateNodeText/updateNodeSchedule/serializeAst 廃止
  - findNodeById で旧ノードのtext/scheduleを取得し、変更がある場合のみ patchTaskTitle/patchSchedule を呼ぶ
  - 変更なければ onMdChange を呼ばない（不要な更新を抑制）

- Rationale:
  - ASTからの再生成を廃止し、変更があった行のみを最小限に置換することでユーザ編集を保護する
