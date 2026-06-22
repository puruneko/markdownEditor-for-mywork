# obs-0011: テストシステムの品質保証能力強化

## ステータス

Closed

## 概要

テストが全パスするにもかかわらず Obsidian コンソールにはエラーが表示される。obs-0007〜obs-0010 のバグはすべて既存テストをすり抜けた。テストシステムが Obsidian プラグインの品質を正しく担保できていない。

## 根本原因

### 原因1: obs-e2e テストがコンソールエラーを検知しない

WebdriverIO の obs-e2e テストは `browser.getLogs('browser')` を使用しておらず、Chrome DevTools コンソールに出力されるエラーを一切検知しない。テスト自体のアサーションが通ればテスト成功と判定される。

### 原因2: 描画内容を検証しない

カレンダー・ガントの obs-e2e テストはコンテナ要素（`.calendar-view`、`.gantt-view`）の存在のみ確認し、アイテムが実際に表示されたかを検証しない。obs-0008（アイテム非表示バグ）はこの検証欠如のためにテストをすり抜けた。

### 原因3: テストデータにエッジケースがない

テスト用 vault の `test-tasks.md` には日付のみスケジュール、不正形式スケジュールが含まれておらず、obs-0010（複数日スパンエラー）を再現できなかった。

### 原因4: 新しい parseSchedule() 戻り値型のユニットテストがない

obs-0010 で `parseSchedule()` の戻り値を union 型（`dateTimeRange` | `dateRange`）に変更したが、対応するユニットテストが追加されていない。

## TODO

- [x] `tests/obs-e2e/helpers/console-guard.ts` を新規作成する（コンソールエラーガード）
- [x] `tests/obs-e2e/helpers/obsidian-helpers.ts` を新規作成する（共通 `openFile` ヘルパー）
- [x] `wdio.conf.mts` に `afterTest` フックを追加し、全テスト後にコンソールエラーチェックを自動実行する
- [x] `tests/obs-e2e/calendar-view.e2e.ts` にアイテム描画検証テストを追加する
- [x] `tests/obs-e2e/gantt-view.e2e.ts` にバー描画検証テストを追加する
- [x] 全 obs-e2e テストファイルを共通ヘルパー使用に切り替える
- [x] `test/vaults/simple/test-tasks.md` にエッジケーステストデータを追加する
- [x] `src/lib/calendar/ast-to-calendar.test.ts` に parseSchedule union 型テストを追加する
- [x] `src/lib/gantt/ast-to-gantt.test.ts` に日付のみスケジュールテストを追加する
- [x] 全テスト実行・パス確認（90テスト全パス、ビルドエラーなし）

## 完了条件

- obs-e2e テストがコンソールエラー発生時にテスト失敗と判定すること
- カレンダービューにアイテムが表示されることをテストで検証していること
- ガントビューにバーが表示されることをテストで検証していること
- テスト vault に日付のみ・複数日・不正形式スケジュールが含まれていること
- parseSchedule() の dateRange / dateTimeRange 分岐がユニットテストでカバーされていること
- 全テストパス

## related_specs

- `project/specs/calendar-integration.spec.md`
- `project/specs/gantt-integration.spec.md`

## 関連Issue

- obs-0007（テストをすり抜けた svelte-preprocess ビルドエラー）
- obs-0008（テストをすり抜けたアイテム非表示バグ）
- obs-0009（テストをすり抜けた luxon instanceof エラー）
- obs-0010（テストをすり抜けた複数日スパンエラー）

## History

- 2026-03-25: 実装完了・Closed
  - `wdio.conf.mts` に `afterTest` コンソールエラーガードを追加
  - `tests/obs-e2e/helpers/console-guard.ts`、`obsidian-helpers.ts` を新規作成
  - 全 obs-e2e テストを共通ヘルパー使用に切り替え・描画検証テスト追加
  - `test/vaults/simple/test-tasks.md` にエッジケースセクション追加
  - `ast-to-calendar.test.ts` に parseSchedule union 型テスト追加（dateRange / dateTimeRange / 各種エラーケース）
  - `ast-to-gantt.test.ts` に日付のみスケジュールテスト追加
  - 全90ユニットテストパス確認
