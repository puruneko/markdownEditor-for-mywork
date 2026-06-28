# ノート埋め込み型ライブ集約ブロック（task-query）

## 1. 課題と方針  — 人間が読む

### このissueで解決すること
案件ノートに「この案件の未完タスク一覧」を**手で転記して管理簿化**すると二重管理・更新漏れが起きる。Dataview / Tasks の最大の価値は、ノートにクエリを書くと**表示時に最新一覧へ自動展開**される点にある。

この issue では、ノート内に ` ```task-query ` コードブロックを書くと、**索引（マルチソース AST）から条件に合致するタスク一覧をその場にライブ描画**する。各行クリックで該当ファイルの該当行へジャンプし、索引更新で一覧も自動更新する。

### 方針
- `registerMarkdownCodeBlockProcessor('task-query', ...)` を使う。
- ブロック本文は簡易 `key:value` DSL でフィルタ条件を書き、`FilterQuery` へ変換する。
- データ源は `AstIndex`、絞り込みは `filterNodes`。行クリックは既存のカーソル移動を再利用。

---

## 2. 進捗・実装メモ  — AIが読む

### 遵守事項（毎回）
- 作業着手の開始時に**一度だけ** `project/governance/` を確認し、本プロジェクトのルールを確認すること（`AI_RUNTIME_RULES.md` のロード順に従う）。
- **テスト観点とテストコードは、毎回すべてを見直すこと**（`TESTING_STANDARD.md` 準拠）。

### 依存
- `issue-phase001-001__multi-source-ast-index`（`AstIndex`）
- `issue-phase001-002__filter-nodes-core`（`filterNodes`/`FilterQuery`）

### 既存資産の再利用（必読・実装前に読む）
- `src/sync/editor-event-bus.ts` ＋ `src/plugin.ts`（`this.editorEventBus.onFocusLine(...)` の購読箇所）… 行クリック→カーソル移動は**この既存経路をそのまま使う**。別ファイルの場合のファイルオープン処理も plugin.ts に既にある。
- `AstIndex.onChange` / `getDocuments(scope)`（前提 issue で実装）… 再描画トリガとデータ取得。
- `filterNodes`（前提 issue）… 絞り込み。
- 登録は `src/plugin.ts` の `onload`（既存 `registerView` 群の近く）。

### 仕様（確定事項：迷ったらこれに従う）
- DSL（1 行 1 条件、`key: value`）:
  - `status: todo,doing` → `status`
  - `tag: 総務,清掃` → `tags`
  - `due: <=2026-07-05` / `due: >=2026-07-01` → `dueBefore`/`dueAfter`
  - `priority: <=2` → `priorityMax`
  - `text: 見積` → `text`
  - `scope: vault|folder|current`（既定 vault）
- **相対日付（「今週」等）は本 issue では非対応**。絶対日付（`YYYY-MM-DD`）のみ。相対表記は自然言語日付 issue に委ねる。
- 不正な DSL 行は**無視して残りを適用**し、クラッシュしない（必要なら小さな注意表示）。
- 描画体裁: `- [状態] テキスト （出典: ファイル名:行）`。クリックでジャンプ。
- `AstIndex.onChange` を購読して再描画。プロセッサ破棄時に**購読解除**（リーク防止）。

### 実装の要点・つまずき
- DSL パースは**純関数**（文字列→`FilterQuery`）に切り出してテスト可能にする。CodeBlockProcessor 配線は薄く保つ。
- 購読解除を忘れない（ブロック再描画のたびに購読が積み上がらないよう、登録/解除をペアにする）。

### TODO
- [ ] DSL パース純関数（文字列→`FilterQuery`、不正行は無視）。
- [ ] CodeBlockProcessor 登録・一覧描画・クリックジャンプ・`onChange` 再描画・購読解除。
- [ ] テストを追加・全見直し（下記テスト観点）。

### 受け入れ基準（すべて満たすこと）
- `task-query` ブロックで条件に合致するタスク一覧が描画される。
- 別ファイルのタスククリックで、そのファイルが開いて該当行へカーソル移動。
- どこかのファイルを編集すると一覧が自動更新。
- 不正 DSL でクラッシュしない。

### テスト観点
- `vitest` 単体: DSL→`FilterQuery` を各キー・複合・不正入力で。
- 一覧生成（索引フィクスチャ＋クエリ→期待行集合）。
- `onChange` 再描画・購読解除（リークしない）。

### 履歴（追記のみ）
- 2026-06-28 — 起票。
- 2026-06-28 — Haiku 実装可能な水準へ加筆（DSL 確定・既存ジャンプ経路の再利用を明記）。

---

## 3. メタデータ
- id: issue-phase001-004__embedded-query-block
- status: open
- phase: 001
- related_specs: なし（仕様は本issueに内包）
- related_decisions:
- target_files: src/lib/query/parse-query.ts, src/views/query-block.ts, src/plugin.ts
- created: 2026-06-28
- updated: 2026-06-28
