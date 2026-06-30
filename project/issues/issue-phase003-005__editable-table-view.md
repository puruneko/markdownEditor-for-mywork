# 編集可能テーブル（表）ビュー

## 1. 課題と方針  — 人間が読む

### このissueで解決すること
ビューは AST/カレンダー/ガント/カンバンのみで、**スプレッドシート的な表ビューが無い**。大量タスクの棚卸し・一括編集（日付やステータスをまとめて直す）で Projects 等に大きく劣る（プラン §5.2 Projects・§5.3 #5）。

本 issue では、列＝タスク/ステータス/期限/スケジュール/優先度/タグ/出典ファイル の**編集可能テーブル**を追加し、セル編集を既存の Markdown 書き戻し基盤に接続する。「一覧で見て、その場で直す」＝転記レス＋抜け漏れ点検に効く。

### 方針
- 集約インデックス（`issue-phase001-001`）の全タスクを行として表に展開。
- ホスト層フィルタ（`issue-phase001-003`）でソート/絞り込み。
- セル編集 → `upsert-meta`/`markdown-patch` で該当ファイル該当行へ書き戻し（globalKey 経由）。

---

## 2. 進捗・実装メモ  — AIが読む

### 遵守事項（毎回）
- 着手時に**一度だけ** `project/governance/` を確認（`AI_RUNTIME_RULES.md` のロード順）。
- **テスト観点とテストコードは毎回すべて見直す**（`TESTING_STANDARD.md` 準拠）。

### 依存
- `issue-phase001-001__multi-source-ast-index`（全タスク供給・`onChange`）。
- `issue-phase001-002__filter-nodes-core` ＋ `issue-phase001-003__host-filter-bar`（絞り込み/ソート）。
- `issue-phase001-005__cross-file-identity-and-viewmodel`（globalKey・`patchInFile`／書き戻し先特定）。

### 既存資産の再利用（必読・実装前に読む）
- `src/lib/patch/upsert-meta.ts` / `src/lib/calendar/markdown-patch.ts` … セル編集の書き戻し基盤。`(sourcePath,line,field)` 単位の最小パッチを流用（フィールド単位編集はプラン A-1 と同基盤）。
- `src/lib/viewmodel/contract.ts`（`SourceTagged`/`globalKey`）・`resolve.ts` … 各行の出自タグと書き戻し先解決。
- `src/sync/ast-index.ts` … `getAllTaskNodes(scope)`・`onChange`。
- `src/views/ShadowItemView.ts` ＋ いずれかの `*ViewMount.svelte` … View ＋ Svelte マウントのひな形。
- `src/lib/query/FilterBar.svelte` … 絞り込み/ソート UI を流用。

### 仕様（確定事項：迷ったらこれに従う）
- 列: タスク文 / ステータス / `@due` / `@schedule` / `@priority` / `@tags` / 出典ファイル。
- 行は**集約スコープの全（未完含む）タスク**。フィルタで絞り込み可。列ヘッダでソート。
- セル編集 → 該当フィールドのみ最小パッチで書き戻し（`upsert-meta` 系）。テキスト列はタスク文の置換。
- ステータス列はドロップダウン（`[ ] [>] [x] [!] [-]`）。日付列はピッカー（`issue-phase003-004` のピッカーを共有可）。
- 書き戻し先は **globalKey → (sourcePath,line)** で特定。`mergedDoc` を作らずファイル単位でパッチ。
- `onChange` で再描画。編集中セルのフォーカスは可能な範囲で保持。

### 実装の要点・つまずき
- 編集 → 書き戻し → 索引更新 → 再描画 のループでフォーカス/スクロールが飛ばないよう配慮。
- 複数行同時編集（一括ステータス変更）は次段でよいが、書き戻しは1行ずつのトランザクションで安全に。
- 日付/ステータスの正規化は既存（`schedule-normalize`・status マップ）を経由し、表ビュー独自の整形を作らない。

### TODO
- [ ] テーブル View（`TableView` ＋ Mount）。列定義・ソート・フィルタ連携。
- [ ] セル編集 UI（テキスト/ステータスドロップダウン/日付ピッカー）。
- [ ] セル編集 → `upsert-meta`/`markdown-patch` 書き戻し（globalKey 経由・ファイル単位）。
- [ ] `onChange` 再描画・`plugin.ts` 登録。
- [ ] テスト追加・全見直し。

### 受け入れ基準（すべて満たすこと）
- 集約スコープの全タスクが表で一覧でき、列ソート・フィルタが効く。
- セル編集が該当ファイル該当行へ最小パッチで書き戻る（他フィールドを壊さない）。
- 索引更新後に表が再描画され、書き戻し結果が反映される。

### テスト観点
- `vitest` 単体: セル編集 → 生成されるパッチが該当フィールドのみを変更すること（各列）。
- globalKey → (sourcePath,line) の書き戻し先解決が正しいこと。
- ソート/フィルタ適用後も書き戻し先が正しく特定されること。

### 履歴（追記のみ）
- 2026-06-30 — 起票（プラン §5.2/§5.3・付録 Issue 候補 T、Phase3 SHOULD）。

---

## 3. メタデータ
- id: issue-phase003-005__editable-table-view
- status: open
- phase: 003
- related_specs: なし（仕様は本issueに内包）
- related_decisions:
- target_files: src/views/TableView.ts, src/views/TableViewMount.svelte, src/lib/patch/upsert-meta.ts, src/lib/viewmodel/resolve.ts, src/plugin.ts
- created: 2026-06-30
- updated: 2026-06-30
