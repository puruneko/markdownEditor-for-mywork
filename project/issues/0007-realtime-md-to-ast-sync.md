# MD 編集時のリアルタイム AST 同期（左→右）

## Status
proposed

## Summary
左ペインの Markdown エディタでテキストを変更した際、右ペインの AST 表示をリアルタイムで更新する。

## Current Direction
- Monaco の `onDidChangeModelContent` イベントを監視する
- デバウンス（300ms 程度）を入れてパーサ呼び出し頻度を制御する
- パーサの出力（AST JSON）を右ペインの Monaco に `setValue` で反映する
- AST 更新中は右ペインからの逆方向同期を抑制する（ループ防止）

## TODO
* [x] 左 Monaco の変更イベント監視を実装
* [x] デバウンス付きパーサ呼び出しを実装（300ms）
* [x] 右 Monaco への AST JSON 反映を実装
* [x] 同期ループ防止の仕組みを実装（`syncing` フラグ + MonacoEditor の `suppressUpdate`）
* [x] 動作確認（ビルド成功）

## Notes (Append Only)
* 2026-03-22 — Issue 作成
* 2026-03-22 — 実装完了。Phase 1+2 の EditorLayout.svelte に先行実装。
