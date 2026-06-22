# obs-0004: エディタ拡張

## ステータス

Closed

## 概要

Obsidianエディタ内でタスク記法のシンタックスハイライト・支援機能を提供する。

## 対応フェーズ

Phase 4

## 計画書参照

`project/plan/obsidian-plugin-migration-plan.md` — Phase 4: エディタ拡張

## 前提Issue

- obs-0001（プラグイン基盤構築）が完了していること

## TODO

- [ ] CodeMirror 6 ViewPlugin/Decorationによるタスクステータスハイライト
- [ ] @schedule, @due等メタ情報のハイライト
- [ ] タスクステータストグルコマンドの追加

## 完了条件

- `[ ]`, `[>]`, `[x]`, `[!]`, `[-]` にそれぞれ異なるハイライトが適用される
- `@schedule:`, `@due:`, `@priority:`, `@tags:` がハイライトされる
- ブロッククォート内の `[ ]` にはタスクハイライトが適用されない
- Layer 1〜3 全テストパス

## related_specs

- `project/instructions/Markdownベース_タスク管理記法_仕様.md`
