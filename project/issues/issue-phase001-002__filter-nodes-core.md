# 共通フィルタ基盤 `filterNodes(doc, query)`

## 1. 課題と方針  — 人間が読む

### このissueで解決すること
タスクを条件で絞り込む手段が無い。「未完だけ」「今週期限」「`#総務` かつ緊急」のような絞り込みは、ホスト層フィルタバー・スマートリスト・アジェンダ・埋め込み集約ブロックが**共通で**必要とする。

この issue では、それら全機能が共有する**唯一のフィルタ実装**を、`Document` を入力に取り条件に合致するタスクだけを残した新しい `Document` を返す**純関数 `filterNodes`** として実装する。各機能は独自フィルタを持たず必ずこれを使う。

### 方針
- 入力 `Document` は破壊しない（イミュータブル。新 `Document` を返す）。
- 条件は構造化オブジェクトで表現（DSL 文字列のパースは別 issue。ここは型と関数のみ）。
- 「子タスクが合致したら親グループ/セクションを残すか」を `keepAncestors` で切替（既定 true。ビューの文脈保持に必要）。

---

## 2. 進捗・実装メモ  — AIが読む

### 遵守事項（毎回）
- 作業着手の開始時に**一度だけ** `project/governance/` を確認し、本プロジェクトのルールを確認すること（`AI_RUNTIME_RULES.md` のロード順に従う）。
- **テスト観点とテストコードは、毎回すべてを見直すこと**（`TESTING_STANDARD.md` 準拠）。

### 既存資産の再利用（必読・実装前に読む）
- `src/lib/parser/types.ts` … `Document` / `Section` / `TaskNode` / `ListNode` / `QuoteNode` / `Meta` / `Status` の構造。これに沿って走査する。
- `src/lib/calendar/markdown-patch.ts` の `searchNodes` / `findNodeById` … セクション→子→孫を再帰走査する既存パターン。フィルタの走査もこれを参考にする（コピーでなく構造の踏襲）。
- 配置先は新規 `src/lib/query/filter.ts`（後続 issue が import する）。

### 仕様（確定事項：迷ったらこれに従う）
- 関数: `filterNodes(doc, query, opts?) : Document`。`opts.keepAncestors` 既定 `true`。
- 条件キー（すべて任意・指定したものだけ AND で評価）:
  - `status`: `Status[]`（いずれか一致）。「未完」を表したい呼び出し側は `['todo','doing','blocked','hold']` を渡す。
  - `tags`: `string[]`（`@tags` のいずれかを含む）。
  - `priorityMax`: number（`priority <= 値`。小さいほど高優先）。
  - `dueBefore` / `dueAfter`: `YYYY-MM-DD`。**いずれも同日を含む**（`@due <= dueBefore` / `@due >= dueAfter`）。
  - `hasSchedule`: boolean（`@schedule` 有無）。
  - `hasDate`: boolean（`@schedule` または `@due` の有無）。
  - `text`: string（タスク text の部分一致・大文字小文字無視）。
  - `sectionPath`: `string[]`（セクションパスの前方一致）。
- 判定対象は **`TaskNode` のみ**。`ListNode`/`QuoteNode`/`Section` は自体を判定せず `keepAncestors` の挙動で残す/落とす。
- 配列条件（`status`/`tags`）は OR、条件間は AND。
- `keepAncestors: true` … 合致タスクの祖先グループ・セクションを保持。`false` … 合致 `TaskNode` のみ保持し空セクションは落とす。
- 空 `query` は全件一致（元の構造を返す）。

### 実装の要点・つまずき
- 純関数・イミュータブル厳守（入力 `doc` を一切変更しない。新しい配列/オブジェクトを構築）。後続の全機能がこの性質に依存する。
- 型のガイド（数行のみ・詳細実装は委譲）:
  ```ts
  // 形だけのガイド。フィールドの網羅と実装は委譲。
  type FilterQuery = { status?: Status[]; tags?: string[]; /* ...上記キー... */ }
  function filterNodes(doc: Document, query: FilterQuery, opts?: { keepAncestors?: boolean }): Document
  ```

### TODO
- [ ] `FilterQuery` 型と `filterNodes` を実装（上記キー・AND/OR）。
- [ ] `keepAncestors` の両挙動。
- [ ] テストを追加・全見直し（下記テスト観点）。

### 受け入れ基準（すべて満たすこと）
- 各条件が単体で正しく動く。
- 複数条件が AND で結合。
- `keepAncestors:true` で祖先保持、`false` で合致タスクのみ。
- 入力 `Document` が不変（参照等価で確認）。
- 空 query は全タスクを返す。

### テスト観点
- `vitest` 単体: 固定 `Document` フィクスチャで各条件・組み合わせ・祖先保持の両モードを表形式で。
- 日付境界（同日を含む仕様どおり）。
- イミュータビリティ。

### 履歴（追記のみ）
- 2026-06-28 — 起票。
- 2026-06-28 — Haiku 実装可能な水準へ加筆（条件・境界・祖先保持を確定、型ガイドのみ提示）。

---

## 3. メタデータ
- id: issue-phase001-002__filter-nodes-core
- status: open
- phase: 001
- related_specs: なし（仕様は本issueに内包）
- related_decisions:
- target_files: src/lib/query/filter.ts
- created: 2026-06-28
- updated: 2026-06-28
