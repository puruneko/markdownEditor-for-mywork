# obs-0001: プラグイン基盤構築

## ステータス

Closed

## 概要

Obsidianプラグインとして起動し、アクティブファイルのAST表示ができる状態を構築する。

## 対応フェーズ

Phase 1

## 計画書参照

`project/plan/obsidian-plugin-migration-plan.md` — Phase 1: プラグイン基盤構築

## TODO

- [ ] `manifest.json`, `main.ts`, esbuildビルド設定の作成
- [ ] Pluginクラスの実装（onload / onunload）
- [ ] AstView（ItemView）の実装 — アクティブファイルのAST JSONを表示
- [ ] コアライブラリ（parser, types）の移植
- [ ] Vault API経由のファイル読み取り・変更監視の実装
- [ ] アクティブファイル切替時のAST自動更新

## 完了条件

- プラグインがObsidianで有効化できる
- Markdownファイルを開くとASTビューにJSON ASTが表示される
- ファイル編集時にASTがリアルタイム更新される
- ファイル切替時にASTが切り替わる
- Layer 1（ユニットテスト）全パス
- Layer 2（統合テスト）全パス
- Layer 3（E2E: `npm run test:obs:e2e`）ASTビュー関連テスト全パス

## related_specs

- `project/specs/system-baseline.spec.md`
- `project/instructions/AST仕様とロジックルール（構造定義込み）.md`
- `project/instructions/Markdownベース_タスク管理記法_仕様.md`
