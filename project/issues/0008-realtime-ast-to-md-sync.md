# AST 編集時のリアルタイム MD 同期（右→左）

## Status
proposed

## Summary
右ペインの AST（JSON）を直接編集した際、左ペインの Markdown を自動更新する。

## Current Direction
- 右 Monaco の `onDidChangeModelContent` イベントを監視する
- JSON パースが成功した場合のみシリアライザを呼び出す（不正 JSON は無視）
- デバウンス（500ms 程度）を入れる（JSON 編集は途中状態が多いため長めにする）
- シリアライザの出力を左ペインの Monaco に反映する
- MD 更新中は左ペインからの逆方向同期を抑制する（ループ防止）

## TODO
* [x] 右 Monaco の変更イベント監視を実装
* [x] JSON バリデーション付きデバウンスを実装（500ms、JSON.parse 失敗時は無視）
* [x] シリアライザ呼び出しと左 Monaco への反映を実装
* [x] 同期ループ防止の仕組みを #0007 と共通化（`syncing` フラグ共有）
* [x] 動作確認（ビルド成功）

## Notes (Append Only)
* 2026-03-22 — Issue 作成
* 2026-03-22 — 実装完了。また $effect を使った初期同期でのループバグを修正（astValue を INITIAL_MD から静的初期化に変更）。
