# 抜け漏れ検出パネル（ヘルスチェック）

## 1. 課題と方針  — 人間が読む

### このissueで解決すること
「気づかず落とす」タスクを能動的に拾い上げる画面が無い。md を唯一の正とする運用では、形式不正や放置で集計から漏れたタスクを構造的にあぶり出す仕組みが重要になる。

この issue では、マルチソース索引に複数の検出ルールを走らせ、**問題タスクを一覧表示する HealthView** を実装する。各行クリックで該当箇所へジャンプする。

検出ルール（最低限）:
1. 未完なのに日付（`@schedule`/`@due`）が無い。
2. 過去日付なのに未完（期限超過）。
3. `[>]`（doing）のまま N 日以上放置（停滞）。
4. `@dependsOn` の参照先が解決できない（未解決依存）。
5. 依存先がすべて完了し「着手可能」になったタスク。
6. 形式不正で集計から漏れているメタ（リント issue と同一基準）。

### 方針
- 各ルールは「索引のタスク集合（`path` 付き）と today を受け取り、該当を返す純関数」。
- ルールごとに ON/OFF と閾値を設定で変更。結果は HealthView 一覧、行クリックでジャンプ。

---

## 2. 進捗・実装メモ  — AIが読む

### 遵守事項（毎回）
- 作業着手の開始時に**一度だけ** `project/governance/` を確認し、本プロジェクトのルールを確認すること（`AI_RUNTIME_RULES.md` のロード順に従う）。
- **テスト観点とテストコードは、毎回すべてを見直すこと**（`TESTING_STANDARD.md` 準拠）。

### 依存
- `issue-phase001-001__multi-source-ast-index`（`AstIndex`）。
- ルール 6 は `issue-phase000-001__notation-lint-quickfix` の検出と**同一基準**（重複実装しない。リントの検出純関数を再利用）。

### 既存資産の再利用（必読・実装前に読む）
- `src/views/KanbanView.ts` ＋ Mount … `ItemView` ＋ Svelte マウントのひな形。
- `src/plugin.ts` … View 登録・コマンド・リボン・設定タブの追加場所。
- `src/settings.ts` … 設定追加のパターン（`DEFAULT_SETTINGS` ＋ `MdAstEditorSettingTab.display()`）。ルール ON/OFF・閾値はここに足す。
- `src/sync/editor-event-bus.ts` ＋ `onFocusLine` 経路 … 行クリックジャンプ。
- `AstIndex.getAllTaskNodes` / `resolveLine` … タスク取得・行解決。
- リントの検出純関数（前提 issue）… ルール 6 で再利用。

### 仕様（確定事項：迷ったらこれに従う）
- ルール 3 の停滞閾値 **既定 7 日**（設定で変更可）。判定基準日は today。
- **`@dependsOn` の突き合わせ（暫定確定）**: 参照値を各タスクの `text`（完全一致）と突き合わせる。一致するタスクが無ければルール 4（未解決）。一致タスクが全て `done` ならルール 5（着手可能）。将来 `@id` 体系を導入したらそちらを優先する（TODO）。→ この暫定ルールにより 4・5 も**保留にせず実装する**。
- 各検出は純関数。`HealthFinding` は最低限 `{ ruleId, path, line, message }`。
- 完了タスクは原則対象外（ルールの性質上、未完を対象に判定）。

### 実装の要点・つまずき
- ルールは 1 個ずつ独立した純関数にして、`runHealthChecks` で束ねる。テストはルール単位で書く。
- ルール 6 はリントと基準を共有する（別実装で乖離させない）。
- View は薄く、判定は純関数側に寄せる。

### TODO
- [ ] 各ルール純関数 ＋ `runHealthChecks(tasks, today, config)` を実装。
- [ ] `settings.ts` にルール ON/OFF・閾値を追加。
- [ ] `HealthView` / Mount（一覧・行クリックジャンプ）。
- [ ] `plugin.ts` に登録・コマンド・リボン追加。
- [ ] テストを追加・全見直し（下記テスト観点）。

### 受け入れ基準（すべて満たすこと）
- ルール 1〜6 が固定 today ＋フィクスチャで正しいタスクを検出（4・5 は text 突き合わせの暫定仕様で動作）。
- ルール ON/OFF・閾値が設定で反映。
- 行クリックで該当ファイルの該当行へジャンプ。

### テスト観点
- `vitest` 単体: 各ルールごとに陽性・陰性フィクスチャ＋固定 today。
- ルール 3 の閾値境界。
- ルール 4・5 の依存突き合わせ（未解決／着手可能／一部未完）。
- 複数ファイル混在。ルール 6 がリントと同一基準であること。

### 履歴（追記のみ）
- 2026-06-28 — 起票。
- 2026-06-28 — Haiku 実装可能な水準へ加筆（依存突き合わせの暫定確定で 4・5 を実装可能化、閾値確定）。

---

## 3. メタデータ
- id: issue-phase002-003__health-check-panel
- status: open
- phase: 002
- related_specs: なし（仕様は本issueに内包）
- related_decisions:
- target_files: src/lib/health/rules.ts, src/views/HealthView.ts, src/views/HealthViewMount.svelte, src/settings.ts, src/plugin.ts
- created: 2026-06-28
- updated: 2026-06-28
