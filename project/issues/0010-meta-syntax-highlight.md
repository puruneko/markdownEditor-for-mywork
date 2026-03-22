# @メタ情報のシンタックスハイライト

## Status
proposed

## Summary
Markdown エディタ内の `@schedule:`, `@priority:` 等のメタ情報行を視覚的に区別できるようハイライトする。

## Current Direction
- Monaco のカスタムトークナイザ（Monarch）を使用する
- Markdown 言語定義を拡張し、`@key: value` パターンにマッチするルールを追加する
- キー部分とバリュー部分で色を分ける
- 対象キー: schedule, due, priority, dependsOn, tags

## TODO
* [x] Monaco `ITokensProvider` で `@key: value` ルールを定義（Monarch でなくカスタムプロバイダ）
* [x] `md-task-dark` テーマにメタ情報用の色定義を追加
* [x] `@key`（黄）/ `:` （灰）/ `value`（オレンジ）で3分割色分けを実装
* [x] 全対象キーでの表示確認（ビルド成功）

## Notes (Append Only)
* 2026-03-22 — Issue 作成
* 2026-03-22 — 実装完了。`src/lib/highlight/task-language.ts` に `registerTaskLanguage()` を実装。`md-task` カスタム言語として Monaco に登録。
