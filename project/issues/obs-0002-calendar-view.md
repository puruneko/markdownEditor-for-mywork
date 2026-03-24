# obs-0002: カレンダービュー統合

## ステータス

Open

## 概要

カレンダータブでスケジュール付きタスクを表示・操作できるようにする。

## 対応フェーズ

Phase 2

## 計画書参照

`project/plan/obsidian-plugin-migration-plan.md` — Phase 2: カレンダービュー統合

## 前提Issue

- obs-0001（プラグイン基盤構築）が完了していること

## TODO

- [ ] CalendarView（ItemView）の実装
- [ ] ast-to-calendar変換ロジックの統合
- [ ] svelte-calendar-libの統合方針決定（Svelte mount or 代替ライブラリ）
- [ ] カレンダー上でのD&D → Vault.modify()によるMarkdown更新
- [ ] 編集ダイアログの実装

## 完了条件

- @scheduleを持つタスクがカレンダー上に表示される
- D&Dでスケジュール変更がMarkdownファイルに自動反映される
- 編集ダイアログでタイトル変更がMarkdownに反映される
- エディタでの@schedule手動編集がカレンダーにリアルタイム反映される
- Layer 1〜3 全テストパス

## related_specs

- `project/specs/calendar-integration.spec.md`
