# アジェンダ／ヘルスチェック／トレイの廃止（元ID: I-01 ／ 対応 preIssue: MARKDOWN-001 ／ Phase: 1）

## 1. Background（背景）

`修正したい箇所.md` の markdownEditor 節に「アジェンダ、ヘるスチェック、トレイは廃止」とある（原文ママ。「ヘるスチェック」は「ヘルスチェック」の誤記と解釈する）。

対応する preIssue は MARKDOWN-001。Phase 1・依存なしで最初に実施すべき作業と位置づけられている。本 issue は「後続作業の対象ファイル数を確実に減らす唯一の作業で、失敗リスクがほぼゼロ」であるため、他の markdownEditor 側 issue に先立って最初に行うべきである。

## 2. Objective（目的）

アジェンダ・ヘルスチェック・トレイの3機能をプラグインから完全に削除し、以後の他 issue の対象ファイル数を減らす。

## 3. Scope（スコープ）

- 3機能本体（ビュー・コンポーネント）の削除
- プラグイン登録・設定定義からの該当行の削除
- 対応する単体テスト・E2E テストの削除
- 削除後もビルドが通り、他機能が使う共有コードは残すこと

## 4. Implementation requirements（実装要件）

- **削除対象**:
  - `src/lib/{agenda,health,tray}/*`
  - `src/views/{Agenda,Health,UnscheduledTray}View.ts` と対応する `*ViewMount.svelte`
  - `src/plugin.ts` / `src/settings.ts` の該当行（`healthStaleDays` / `healthRules` の定義と設定 UI）
  - 対応する単体テスト
  - `tests/obs-e2e/{agenda,health,unscheduled-tray}-view.e2e.ts`
- **残すもの（削除禁止）**:
  - `src/editor/task-drag-source.ts`（`MD_TASK_MIME`）— Tray 専用ではなく Calendar / Gantt / Kanban も使う共有コードのため
  - `src/editor/notation-lint.ts` — `runHealthChecks` が `lintLine` を利用しているだけで逆依存は無い。Health 削除で利用元が1つ減るだけで、`notation-lint.ts` 自体は残す
- **事前確認**: `tests/obs-e2e/helpers/*` がリボンアイコンの個数等、3機能の存在を前提とする記述を持っていないか確認する。`manifest.json` / README に3機能の記載が無いか確認する
- **マイグレーション**: 不要。`data.json` に残る `healthStaleDays` / `healthRules` は `Object.assign({}, DEFAULT_SETTINGS, loadData())` の性質上、無視されるだけで実害なし。マイグレーション処理を新設しないこと

## 5. Files / components likely to be changed（変更が見込まれるファイル／コンポーネント）

- `src/lib/agenda/*`
- `src/lib/health/*`
- `src/lib/tray/*`
- `src/views/AgendaView.ts`, `src/views/HealthView.ts`, `src/views/UnscheduledTrayView.ts`
- 対応する `*ViewMount.svelte`（Agenda/Health/UnscheduledTray）
- `src/plugin.ts`（機能登録箇所）
- `src/settings.ts`（`healthStaleDays` / `healthRules` の定義と設定 UI）
- `tests/obs-e2e/agenda-view.e2e.ts`, `tests/obs-e2e/health-view.e2e.ts`, `tests/obs-e2e/unscheduled-tray-view.e2e.ts`
- `tests/obs-e2e/helpers/*`（前提確認のみ、必要なら修正）

## 6. Dependencies（依存関係）

- 先行 Issue: なし（Phase 1・依存なし）
- 後続への効果: 本 issue の後に着手する全 markdownEditor issue（例: `issue-phase010-markdownEditor-002__shadow-theme-lockdown-light.md` 等）の対象ファイル数が減る。順序として最初に実施することが推奨されている
- 他リポジトリへの影響: なし

## 7. Acceptance criteria（受け入れ基準）

- ビルドが通る
- `agenda` `health` `tray` への残存参照が grep で0件
- 既存の単体・E2E テストが通る

## 8. Test requirements（テスト要件）

- 削除対象の単体テスト・E2E テストをすべて削除する
- 削除後、grep で `agenda` `health` `tray` の残存参照が0件であることを確認する
- 既存の残存テスト（削除対象以外）がすべて通ることを確認する

## 9. Out of scope（対象外）

- `src/editor/task-drag-source.ts`、`src/editor/notation-lint.ts` の削除・変更（残す対象）
- `data.json` に残存する旧設定キーのマイグレーション処理の新設（不要と判断済み）

## Progress & Implementation Notes

### History

#### 2026-09-22

- User Instruction:
  - project/governance のルールに従い、issue-phase010 シリーズを順番にすべて実装する

- Change:
  - `src/lib/{agenda,health,tray}/*`、`src/views/{Agenda,Health,UnscheduledTray}View.ts` と対応する `*ViewMount.svelte`、`tests/obs-e2e/{agenda,health,unscheduled-tray}*.e2e.ts` を削除した
  - `src/plugin.ts` から3ビューの import・registerView・addCommand・addRibbonIcon・detachLeavesOfType を削除した
  - `src/settings.ts` から `healthStaleDays` / `healthRules` の型定義・既定値・設定 UI セクションを削除した
  - `src/editor/task-drag-source.ts`、`src/editor/notation-lint.ts` は変更していない（残す対象）
  - `data.json` の旧キーに対するマイグレーション処理は新設していない（不要と判断済みのため）

- Rationale:
  - Issue 本文の削除対象・残すもの・受け入れ基準どおりに実施
  - 事前確認: `tests/obs-e2e/helpers/*` に3機能を前提とする記述なし、`manifest.json` / README にも記載なしを grep で確認済み

- Verification:
  - `grep -rniE 'agenda|health|tray' src tests` → 0件
  - `npx vitest run` → 21 test files / 467 tests すべて成功
  - `node esbuild.config.mjs production` → ビルド成功（`main.js` / `styles.css` 生成、警告はライブラリ側の既存警告のみ）

- Status: 実装完了。ユーザーの明示的な承認待ちのため Issue は Open のまま（WORKFLOW.md §6）。
