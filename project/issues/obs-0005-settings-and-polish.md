# obs-0005: 設定・仕上げ

## ステータス

Open

## 概要

プラグインとして公開可能な品質にする。設定画面、コマンドパレット統合、テスト整備、ドキュメント。

## 対応フェーズ

Phase 5

## 計画書参照

`project/plan/obsidian-plugin-migration-plan.md` — Phase 5: 設定・仕上げ

## 前提Issue

- obs-0001〜obs-0004 が全て完了していること

## TODO

- [ ] プラグイン設定画面（SettingTab）の実装
- [ ] コマンドパレット統合
- [ ] テストの移植・追加（Layer 1〜3 全網羅）
- [ ] ドキュメント整備

## 完了条件

- 設定画面が正常に表示・保存される
- Obsidian再起動後もプラグインが正常にリロードされ、全Viewが復元される
- プラグイン無効化→有効化がエラーなく動作する
- 大きなMarkdownファイル（500行以上）でパフォーマンス劣化がない
- 3つのView（AST, Calendar, Gantt）を同時に開いて同一ファイルに連動する
- Layer 1〜3 全テストパス

## related_specs

- `project/specs/system-baseline.spec.md`
