# obs-0006: テスト基盤構築

## ステータス

Closed

## 概要

Obsidianプラグイン用のテスト基盤（Layer 1〜3）を構築する。
ユニットテスト（Vitest）、統合テスト（Vitest + Obsidian APIモック）、E2Eテスト（wdio-obsidian-service）の3層を整備する。

## 対応フェーズ

Phase 1 と並行して実施

## 計画書参照

`project/plan/obsidian-plugin-migration-plan.md` — テスト戦略

## TODO

- [ ] Vitest設定の移植（`test:unit` スクリプト）
- [ ] Obsidian APIモック（`tests/mocks/obsidian.ts`）の作成
- [ ] wdio-obsidian-serviceのセットアップ（`wdio.conf.mts`）
- [ ] `test:obs:e2e` スクリプトの設定
- [ ] テスト用Vault（`test/vaults/simple/`）の作成
- [ ] テストデータ（`test-tasks.md`）の配置
- [ ] 既存ユニットテスト5ファイルの移植確認
- [ ] CI/CD用GitHub Actionsワークフローの作成

## 完了条件

- `npm run test:unit` でLayer 1 + Layer 2のテストが実行できる
- `npm run test:obs:e2e` でLayer 3のE2Eテストが実行できる
- テスト用VaultにObsidianが自動起動し、プラグインがロードされる
- 既存ユニットテスト5ファイルが全パスする

## related_specs

- `project/governance/TESTING_STANDARD.md`
