# グループの進捗ロールアップ

## 1. 課題と方針  — 人間が読む

### このissueで解決すること
グループ（`isGroup`）配下に複数の子タスクがあっても、**完了率（3/5・60%）が出ない**。親見出し単位の進捗が一目で分からず、どのグループが終盤か・停滞かが見えない（プラン §4.4 SHOULD・Quick Win 候補）。

本 issue は AST の派生段で子孫タスクの done 比率を集計して `progress` として付与し、カンバン/ガント/AST のグループ見出しにバー表示する。**純粋な派生プロパティ**なので書き戻し不要・低リスク。

### 方針
- `mdast-to-nodes` の派生プロパティ算出に、グループの `progress`（done 数 / 子孫タスク総数）を追加。
- 各ビューのグループ見出しに進捗バー/比率を表示。

---

## 2. 進捗・実装メモ  — AIが読む

### 遵守事項（毎回）
- 着手時に**一度だけ** `project/governance/` を確認（`AI_RUNTIME_RULES.md` のロード順）。
- **テスト観点とテストコードは毎回すべて見直す**（`TESTING_STANDARD.md` 準拠）。

### 依存
- なし（既存 AST 派生段の上で完結）。先行着手可（プラン Quick Win）。

### 既存資産の再利用（必読・実装前に読む）
- `src/lib/parser/types.ts` … `TaskNode`/`ListNode` の派生プロパティ（`hasTaskDescendant`/`isGroup` 等）。ここに `progress` を追加。
- `src/lib/parser/mdast-to-nodes.ts` … 派生プロパティを計算している箇所。`progress` の集計もここで純粋に算出。
- `src/lib/kanban/ast-to-kanban.ts` / `src/lib/gantt/ast-to-gantt.ts` … グループ見出し相当の出力にバー用データを渡す。
- `src/views/AstViewMount.svelte` ＋各 Mount … 見出しのバー描画箇所。

### 仕様（確定事項：迷ったらこれに従う）
- `progress` は **`{ done: number; total: number }`**（または比率）。`total` は**子孫タスク総数**（leaf/グループ問わずタスクを数える。`isMemo`/quote は除外）。`done` は status === 'done' の子孫タスク数。
- 集計対象が 0（タスク子孫なし）なら `progress` は付与しない（`undefined`）。
- `[-]`(hold)・`[!]`(blocked)・`[>]`(doing) は **done に数えない**（done のみ分子）。分母には含める。
- 表示はグループ見出しに「3/5（60%）」＋バー。バー表示の ON/OFF は設定化。
- 派生のみ・**書き戻し一切なし**。

### 実装の要点・つまずき
- 「子孫タスク総数」の定義（ネストしたグループの数え方）をテストで固定。グループ自身をタスクとして二重計上しないこと。
- 各ビューで集計を再実装せず、AST 派生 `progress` を単に読むだけにする（単一ソース化）。

### TODO
- [ ] `types.ts` に `progress?: { done: number; total: number }` を追加。
- [ ] `mdast-to-nodes.ts` で子孫タスクの done/total を集計し付与。
- [ ] AST/カンバン/ガントのグループ見出しにバー表示（ON/OFF 設定）。
- [ ] テスト追加・全見直し。

### 受け入れ基準（すべて満たすこと）
- グループ見出しに完了率（n/m・％）とバーが表示される。
- done のみが分子、未完各種は分母に含まれる。
- タスク子孫の無いグループには進捗が出ない。
- 本文・書き戻しに一切影響しない。

### テスト観点
- `vitest` 単体: ネストしたグループで `progress` の done/total が正しい（doing/blocked/hold は分母のみ、グループ自身を二重計上しない）。
- タスク子孫なしで `progress` が `undefined`。

### 履歴（追記のみ）
- 2026-06-30 — 起票（プラン §4.4・付録 Issue 候補 G、Phase3 SHOULD・先行可）。

---

## 3. メタデータ
- id: issue-phase003-002__group-progress-rollup
- status: open
- phase: 003
- related_specs: なし（仕様は本issueに内包）
- related_decisions:
- target_files: src/lib/parser/types.ts, src/lib/parser/mdast-to-nodes.ts, src/lib/kanban/ast-to-kanban.ts, src/lib/gantt/ast-to-gantt.ts
- created: 2026-06-30
- updated: 2026-06-30
