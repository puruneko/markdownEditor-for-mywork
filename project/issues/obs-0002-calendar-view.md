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

## History

### 2026-03-25

- User Instruction:
  - CalendarView / GanttView をObsidianで開いてもサイドバーは表示されるが内容が空白になるバグのデバッグ継続

- Change:
  - ステータスを Closed → Open に再オープン
  - 根本原因を特定・修正方針を決定

- Rationale:
  - エラー: `lifecycle_function_unavailable — mount(...) is not available on the server`
  - `esbuild.config.mjs` の `svelteLibSourcePlugin` が `require.resolve('svelte')` を使ってSvelteを解決している
  - Node.js CJSコンテキストでは Svelte 5 package.json の `"default"` 条件（`src/index-server.js`）が選ばれる
  - esbuildが本来使うべき `"browser"` 条件（`src/index-client.js`）が無視されていた
  - 修正: bare `'svelte'` インポートに限り `src/index-client.js` を直接指定する

### 2026-03-25 (2)

- User Instruction:
  - カレンダービューを開くと `ReferenceError: WeekView is not defined` が発生する問題を調査

- Change:
  - 根本原因を特定: `svelte-preprocess` がTypeScript処理時にテンプレート専用コンポーネントimport（WeekView, MonthView, EventEditDialog）を「未使用」として除去している
  - 独立したビルドツールチェーン問題として obs-0007 を起票
  - 本Issueは obs-0007 の解決に依存する

- Rationale:
  - 原因はカレンダー機能固有ではなく、ビルド設定（svelte-preprocess + Svelte 5の非互換性）に起因するアーキテクチャ問題であるため、別Issueとして管理する
