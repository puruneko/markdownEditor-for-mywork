# 未スケジュール・トレイ（日付なしタスクの引き出し）

## 1. 課題と方針  — 人間が読む

### このissueで解決すること
「md にバーっと書いて、後から割り付ける」運用を完成させるには、**まだ日付の無いタスクだけを集めた引き出し（トレイ）**から、カレンダー／ガントへドラッグして割り付けられると自然になる。トレイが空＝「全タスク予定化済み」で抜け漏れチェックも兼ねる。

この issue では、索引から**日付メタが無い未完タスクだけ**を集めて一覧するトレイを実装し、そこからの DnD で `issue-phase002-004` の割り付け基盤を使って予定を付与する。割り付け済みはトレイから消える。

### 方針
- トレイに `filterNodes`（`hasDate:false` ＋未完）で抽出したタスクを列挙。
- 各項目を `issue-phase002-004` と**同一のドラッグペイロード**でドラッグ可能にし、ドロップ処理も再利用。
- 索引更新で日付が付いた項目は自動的に外れる。

---

## 2. 進捗・実装メモ  — AIが読む

### 遵守事項（毎回）
- 作業着手の開始時に**一度だけ** `project/governance/` を確認し、本プロジェクトのルールを確認すること（`AI_RUNTIME_RULES.md` のロード順に従う）。
- **テスト観点とテストコードは、毎回すべてを見直すこと**（`TESTING_STANDARD.md` 準拠）。

### 依存
- `issue-phase001-001__multi-source-ast-index`（索引・`onChange`）
- `issue-phase001-002__filter-nodes-core`（`hasDate` 条件）
- `issue-phase002-004__selection-drag-to-view-meta`（**ドラッグペイロードとドロップ処理を必ず共有**。重複実装しない）

### 既存資産の再利用（必読・実装前に読む）
- `issue-phase002-004` で実装した DataTransfer ペイロード（MIME `application/x-md-task`、`{sourcePath,line,nodeId}`）と各ビューの drop 処理 … トレイ項目はこれを**そのまま**ドラッグ源にする。受け手（Mount の drop）は改修不要。
- `src/lib/query/filter.ts` の `filterNodes`（`hasDate:false`）… 抽出条件。
- `AstIndex.getDocuments(scope)` / `onChange`（前提 issue）… データ取得と再描画トリガ。
- `src/views/KanbanView.ts` ＋ Mount … `ItemView` ＋ Svelte マウントのひな形。
- `src/plugin.ts` … View 登録・コマンド・リボン。

### 仕様（確定事項：迷ったらこれに従う）
- 抽出条件: **status ≠ done** かつ **`@schedule` も `@due` も無い** `TaskNode`（`filterNodes(doc, { status:['todo','doing','blocked','hold'], hasDate:false })` を索引の各 Document に適用して集約）。
- トレイ項目のドラッグは `issue-phase002-004` と**完全に同一の MIME・ペイロード**。受け手を共通化するため独自形式にしない。
- `onChange` を購読して再描画。日付が付いた項目は次回描画で消える。購読は破棄時に解除。
- 「クイック・ドロップ標的（今日/明日/来週）」は本 issue の**対象外**（別 issue。必要なら TODO に残す）。

### 実装の要点・つまずき
- ドロップ先の挙動は `issue-phase002-004` 完了が前提。**先に W を完了**してから本 issue を実装する。
- 抽出は純関数に寄せてテスト可能にする（完了・日付ありが除外されること）。

### TODO
- [ ] 抽出（未完・日付なし）を `filterNodes` で実装。
- [ ] トレイビュー（列挙・ドラッグ源＝W と同一ペイロード）。
- [ ] `onChange` 購読で自動更新・購読解除。
- [ ] `plugin.ts` に登録・コマンド・リボン追加。
- [ ] テストを追加・全見直し（下記テスト観点）。

### 受け入れ基準（すべて満たすこと）
- スコープ内の「未完・日付なし」だけがトレイに並ぶ。
- トレイ項目をカレンダー/ガントへドラッグ → W の処理で日付付与。
- 日付が付いたタスクはトレイから消える（索引更新で自動反映）。
- すべて割り付け済みでトレイは空になる。

### テスト観点
- `vitest` 単体: 索引フィクスチャから「未完・日付なし」を抽出（完了・日付ありが除外）。
- ドラッグペイロードが W と同一仕様であること。
- `onChange` 後の再描画で割り付け済みが消える。

### 履歴（追記のみ）
- 2026-06-28 — 起票。
- 2026-06-28 — Haiku 実装可能な水準へ加筆（抽出条件確定・W とのペイロード共有を明記・実装順を指定）。

---

## 3. メタデータ
- id: issue-phase003-001__unscheduled-tray
- status: open
- phase: 003
- related_specs: なし（仕様は本issueに内包）
- related_decisions:
- target_files: src/views/UnscheduledTrayView.ts, src/views/UnscheduledTrayViewMount.svelte, src/plugin.ts
- created: 2026-06-28
- updated: 2026-06-28
