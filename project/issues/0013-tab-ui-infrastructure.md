# 右パネルのタブUI基盤実装

## Status

proposed

---

## Summary

右パネル（現在はAST JSON表示のみ）にタブUIを追加し、ASTタブとカレンダータブを切り替えられるようにする。

---

## Current Direction

- 右パネルのヘッダ部分にタブ（「AST」「Calendar」）を配置する
- ASTタブ選択時は現状のMonaco JSON Editorをそのまま表示する
- Calendarタブ選択時はカレンダーコンポーネント用のプレースホルダを表示する（実体は#0016で実装）
- タブ状態はEditorLayout内で管理する

---

## TODO

* [x] EditorLayout.svelte の右パネルヘッダにタブUIを追加する
* [x] タブ切り替え状態管理を実装する（`let rightTab: RightTab = $state('ast')`）
* [x] ASTタブ選択時の既存表示を維持する
* [x] Calendarタブ選択時に CalendarTab を表示する（#0016と同時実装）
* [x] ビルド確認済み

---

## Notes (Append Only)

* 2026-03-22 -- Issue作成。右パネルタブUIの基盤実装。
* 2026-03-22 -- 実装完了。EditorLayout.svelte にタブヘッダ追加。タブボタンはアクティブ時に緑（#4ec9b0）ハイライト付き。#0015〜#0018と同時実装。

## History

### 2026-03-22 14:30

- User Instruction:
  - Phase1-4 全実装の依頼

- Change:
  - EditorLayout.svelte に tab-header スタイルを追加
  - `rightTab: 'ast' | 'calendar'` の状態管理追加
  - CalendarTab コンポーネントとの接続追加（#0016と統合実装）

- Rationale:
  - プレースホルダを経由せず直接 CalendarTab に接続する方が最小実装として適切と判断
