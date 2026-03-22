# AST → Markdown シリアライザの実装

## Status
proposed

## Summary
独自 AST（JSON）を受け取り、元の Markdown テキストに復元するシリアライザを実装する。
AST 側の編集を Markdown に反映するために必要。

## Current Direction
- AST のツリーを再帰的に走査し、Markdown テキストを生成する
- TaskNode: ステータスに応じたチェックボックス記法（`[ ]`, `[>]`, `[x]`, `[!]`, `[-]`）を出力する
- ListNode: プレーンなリスト項目として出力する
- QuoteNode: `>` 付きで `raw` をそのまま出力する
- Section: 見出し（`#` x depth）を出力する
- `meta` フィールドは `@key: value` 形式で復元する
- インデントは深さに応じて2スペースとする

## TODO
* [x] AST → Markdown 変換関数を実装
* [x] TaskNode のステータス → チェックボックス記法変換を実装
* [x] meta フィールドの `@key: value` 復元を実装
* [x] Section の見出し出力を実装
* [x] QuoteNode の raw 出力を実装
* [x] パーサとの往復変換テスト（MD → AST → MD）を作成（7テスト全通過）

## Notes (Append Only)
* 2026-03-22 — Issue 作成
* 2026-03-22 — 実装完了。再帰的ノード走査でMarkdown出力。全テスト通過。
