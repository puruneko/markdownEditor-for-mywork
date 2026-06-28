# ホスト層フィルタバー（パネル非依存・常設・最小表示）

## 1. 課題と方針  — 人間が読む

### このissueで解決すること
フィルタを「パネル（カンバン等）の内部機能」にすると実装がばらつき、パネルを増やすたびに作り直しになる。本アプリは md をパースした AST を各 `*ViewMount.svelte` からパネルへ渡しているので、**フィルタは「パネルへ渡す瞬間のデータ」に作用させ、パネル本体には一切手を入れない**設計が望ましい。

この issue では、全ビュー共通の `<FilterBar>` を各 `*ViewMount.svelte` の**直下**に設置し、`filterNodes`（別 issue）でデータを絞ってからパネルへ渡す。UI は普段最小表示、必要時のみ展開する。

### 方針
- `<FilterBar bind:query>`：既定は小さなチップ（アイコン＋適用中条件数バッジ）。クリックで展開、フォーカスアウトで畳む、クリアボタンを持つ。
- 各 Mount はパネルへ渡す直前に `filterNodes(doc, query)` の結果を渡す。パネル本体は無改修。条件はパネルごとに独立（全体同期は別 issue）。

---

## 2. 進捗・実装メモ  — AIが読む

### 遵守事項（毎回）
- 作業着手の開始時に**一度だけ** `project/governance/` を確認し、本プロジェクトのルールを確認すること（`AI_RUNTIME_RULES.md` のロード順に従う）。
- **テスト観点とテストコードは、毎回すべてを見直すこと**（`TESTING_STANDARD.md` 準拠）。

### 依存
- `issue-phase001-002__filter-nodes-core`（`filterNodes`/`FilterQuery`）を先に完了していること。

### 既存資産の再利用（必読・実装前に読む）
- **データフローがビューごとに異なる**ので必ず両方を読むこと:
  - `src/lib/calendar/CalendarTab.svelte` … `let x = $derived(extractCalendarItems(doc))` の**派生値パターン**。Calendar/Gantt/Ast 系はこの形で `filterNodes(doc, query)` を派生させて渡す。
  - `src/views/KanbanViewMount.svelte` … `registerUpdater` ＋ `$state` で `doc` を受ける**別パターン**。ここでは受けた `doc` から `$derived` でフィルタ結果を作ってパネルへ渡す。
- `src/app.css` … 既存スタイルの置き場。最小チップ/展開のスタイルをここに足す。
- パネル本体（`*Tab.svelte`、`src/lib/*/ast-to-*.ts`）は**触らない**。

### 仕様（確定事項：迷ったらこれに従う）
- 設置対象は 4 つ: `CalendarViewMount` / `GanttViewMount` / `KanbanViewMount` / `AstViewMount`。各 Mount の最上部に `<FilterBar bind:query>` を置く。
- `FilterBar` 内部状態 `expanded` 既定 `false`。折りたたみ時表示 `[ ⛃ フィルタ {N} ]`（N=適用中条件数。0 のときバッジ非表示）。展開時に条件入力＋クリア。
- 適用中（N>0）はアイコンをアクティブ色にする（隠れているデータがあると気づかせる＝抜け漏れ防止）。
- 条件 0 件のときパネルへ渡るデータは元と等価であること。
- 条件はパネルごとに独立（同期は別 issue `AE`）。

### 実装の要点・つまずき
- Svelte 5 runes 厳守。`query` は `$state`、パネルへ渡す値は `$derived(filterNodes(doc, query))`。`doc` 更新時もフィルタが再適用されるよう派生で組む。
- Kanban は `doc` を `$state` で受けてから派生する点に注意（Calendar の `$props` 直 derive と経路が違う）。
- 差し込みは「パネルへ渡していた `doc` を `filteredDoc` に置換」する最小変更に留める。

### TODO
- [ ] `FilterBar.svelte`（最小↔展開・条件数バッジ・クリア）を実装。
- [ ] 4 Mount に設置し、パネルへ `filterNodes` 結果を渡す（各ビューの流儀に合わせる）。
- [ ] 最小/展開のスタイルを `app.css` に追加。
- [ ] テストを追加・全見直し（下記テスト観点）。

### 受け入れ基準（すべて満たすこと）
- 4 ビューすべてにフィルタバーが表示される。
- 既定最小、クリックで展開、フォーカスアウトで畳む。
- 条件設定でパネルへ渡るデータが絞られる（パネル無改修）。
- 適用中は条件数バッジ＋アクティブ色。クリアで全件に戻る。

### テスト観点
- `vitest`: `FilterBar` の状態遷移（最小↔展開・条件数・クリア）。
- Mount がパネルへ渡す値を `filterNodes(doc, query)` に差し替えていること（派生ロジックの単体）。
- 条件 0 件で元データと等価。

### 履歴（追記のみ）
- 2026-06-28 — 起票。
- 2026-06-28 — Haiku 実装可能な水準へ加筆（ビュー別データフロー差異・確定仕様を内包）。

---

## 3. メタデータ
- id: issue-phase001-003__host-filter-bar
- status: open
- phase: 001
- related_specs: なし（仕様は本issueに内包）
- related_decisions:
- target_files: src/lib/query/FilterBar.svelte, src/views/*ViewMount.svelte, src/app.css
- created: 2026-06-28
- updated: 2026-06-28
