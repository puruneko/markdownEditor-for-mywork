# アジェンダ / Today ビュー（横断・期限ダッシュボード）

## 1. 課題と方針  — 人間が読む

### このissueで解決すること
「今日やること」「期限超過」を一覧する画面が無い。タスク管理で最も日常的に開く画面であり、抜け漏れ防止の中心になる。

この issue では、マルチソース索引を使って**全ファイルのタスクを期限・予定で束ねて時系列表示する AgendaView** を実装する。各行クリックで該当ファイルの該当行へジャンプする。

### 方針
- 新規 `AgendaView`（`ItemView`）をリボン／コマンドから開けるようにする（既存 4 ビューと同じ流儀）。
- タスクを **期限超過 / 今日 / 今週 / 予定なし（未完）** に振り分け、時系列表示。行クリックで既存カーソル移動を再利用。

---

## 2. 進捗・実装メモ  — AIが読む

### 遵守事項（毎回）
- 作業着手の開始時に**一度だけ** `project/governance/` を確認し、本プロジェクトのルールを確認すること（`AI_RUNTIME_RULES.md` のロード順に従う）。
- **テスト観点とテストコードは、毎回すべてを見直すこと**（`TESTING_STANDARD.md` 準拠）。

### 依存
- `issue-phase001-001__multi-source-ast-index`（`AstIndex`）。

### 既存資産の再利用（必読・実装前に読む）
- `src/views/KanbanView.ts` ＋ `src/views/KanbanViewMount.svelte` … `ItemView` 実装と Svelte マウントの**ひな形として最も近い**。これを土台に AgendaView を作る。
- `src/plugin.ts` … `registerView` / `addCommand` / `addRibbonIcon` の登録パターン（既存 4 ビューと同じ場所に追加）。
- `src/sync/editor-event-bus.ts` ＋ plugin.ts の `onFocusLine` 購読 … 行クリック→カーソル移動はこの既存経路。別ファイルを開く処理も既にある。
- `AstIndex.getAllTaskNodes(scope)` / `resolveLine`（前提 issue）… タスク取得と行解決。
- `luxon`（依存済み）… 日付比較に使う。

### 仕様（確定事項：迷ったらこれに従う）
- 振り分け純関数 `buildAgenda(tasks, today)`（`today` を引数で受けてテスト容易化）→ `{ overdue, today, thisWeek, undated }`。
- 各バケツ（未完タスクのみ。**完了は一切表示しない**）:
  - overdue: 日付が today より前。
  - today: 日付が today と同日。
  - thisWeek: today の翌日以降〜**今週の日曜まで**（週は月曜始まり・日曜終わり）。
  - undated: 日付メタ（`@schedule`/`@due`）が無い。
- 日付の採用順: `@schedule` があればその**終了日**、無ければ `@due`。
- 並び順（各バケツ内）: 日付昇順 → `priority` 昇順（小さいほど高優先・未指定は最後）→ ステータス順 `todo < doing < blocked < hold`。

### 実装の要点・つまずき
- 「未完」= `todo/doing/blocked/hold`（`done` 以外）。`filterNodes` を使うなら status にこの 4 つを渡す。
- View は薄く、振り分けは純関数 `buildAgenda` に寄せる（テストはここに集中）。
- 行クリックは `resolveLine(path, nodeId)` → 既存 `onFocusLine` 経路へ。

### TODO
- [ ] `buildAgenda` 純関数を実装。
- [ ] `AgendaView` / Mount（バケツ表示・行クリックジャンプ）。
- [ ] `plugin.ts` に登録・コマンド・リボン追加。
- [ ] テストを追加・全見直し（下記テスト観点）。

### 受け入れ基準（すべて満たすこと）
- 全ファイルのタスクが 4 バケツに正しく振り分く。
- 各バケツが日付→優先度→ステータス順。
- 行クリックで該当ファイルの該当行へジャンプ。
- 完了タスクは出ない。

### テスト観点
- `vitest` 単体: 固定 `today` ＋複数タスクで `buildAgenda` の振り分け・並び順。
- 境界: today ちょうど／週末境界／`@schedule` のみ／`@due` のみ／日付なし。
- 複数ファイル混在。

### 履歴（追記のみ）
- 2026-06-28 — 起票。
- 2026-06-28 — Haiku 実装可能な水準へ加筆（バケツ定義・週境界・並び順を確定、ひな形ビューを明示）。

---

## 3. メタデータ
- id: issue-phase002-002__agenda-today-view
- status: open
- phase: 002
- related_specs: なし（仕様は本issueに内包）
- related_decisions:
- target_files: src/lib/agenda/ast-to-agenda.ts, src/views/AgendaView.ts, src/views/AgendaViewMount.svelte, src/plugin.ts
- created: 2026-06-28
- updated: 2026-06-28
