# Markdown → AST パーサの実装

## Status
proposed

## Summary
Markdown テキストを受け取り、仕様に基づく AST（JSON）に変換するパーサを実装する。
エディタとは独立したピュアロジックとして実装する。

## Current Direction
- `unified` / `remark-parse` を使って Markdown を MDAST に変換する
- MDAST から独自 AST（Document / Section / TaskNode / ListNode / QuoteNode）に変換する
- カスタムチェックボックス記法（`[>]`, `[!]`, `[-]`）はテキストレベルで解析する
- `@key: value` メタ情報の抽出ロジックを含める
- `hasTaskDescendant`, `isGroup`, `isLeafTask`, `isMemo` の計算ロジックを実装する
- ID 生成は兄弟インデックス付きパスのハッシュとする

## TODO
* [x] AST 型定義（`types.ts`）を作成
* [x] remark-parse 不使用 — 独自ラインベースパーサで実装（カスタム記法との統合が容易なため）
* [x] MDAST → 独自AST 変換ロジックを実装
* [x] カスタムチェックボックス記法（`[>]`, `[!]`, `[-]`）の解析を実装
* [x] `@meta` 行の抽出と `meta` フィールドへの格納を実装
* [x] `hasTaskDescendant` / `isGroup` / `isLeafTask` / `isMemo` の計算を実装
* [x] Section のネスト関係（`parentSectionId`, `subSections`）を実装
* [x] ID 生成ロジックを実装（兄弟インデックス付きパスのハッシュ）
* [x] 仕様の完全例（Webアプリ開発）で変換結果を検証するテストを作成（12テスト全通過）

## Notes (Append Only)
* 2026-03-22 — Issue 作成
* 2026-03-22 — 実装完了。unified/remark-parse 不使用。インデントベースの独自パーサを実装。バグ修正: 祖先ノードが孫レベルの @meta を横取りする問題を `cl.indent === baseIndent + 2` 条件で解決。
