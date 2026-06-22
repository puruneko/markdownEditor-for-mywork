# obs-0003: ガントチャートビュー統合

## ステータス

Closed

## 概要

ガントチャートタブで階層的タスクタイムラインを表示・操作できるようにする。

## 対応フェーズ

Phase 3

## 計画書参照

`project/plan/obsidian-plugin-migration-plan.md` — Phase 3: ガントチャートビュー統合

## 前提Issue

- obs-0001（プラグイン基盤構築）が完了していること

## TODO

- [ ] GanttView（ItemView）の実装
- [ ] ast-to-gantt変換ロジックの統合
- [ ] svelte-gantt-libの統合方針決定
- [ ] バードラッグ → Vault.modify()によるMarkdown更新

## 完了条件

- ガントチャートに階層構造（project > section > subsection > task）が表示される
- @scheduleの日時範囲がバーの長さに反映される
- バードラッグでスケジュール変更がMarkdownファイルに自動反映される
- エディタでの手動編集がガントチャートにリアルタイム反映される
- Layer 1〜3 全テストパス

## related_specs

- `project/specs/gantt-integration.spec.md`
