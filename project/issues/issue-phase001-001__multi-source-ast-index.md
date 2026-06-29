# マルチソース AST インデックス（複数ファイル横断集約の土台）

## 1. 課題と方針  — 人間が読む

### このissueで解決すること
`src/sync/file-sync.ts` は「今エディタで開いている 1 ファイル」しか追跡・パースしていない。複数ノートに散ったタスクを横断して集める仕組みが無く、上位機能が成立しない。

この issue では、**Vault 内の複数 Markdown をパースしてメモリ上に索引（`path → Document`）として保持し、ファイル変更で差分更新する基盤**を作る。本 issue の責務は**索引（per-file の Document 保持）と API まで**。

### 方針
- 新規 `AstIndex` クラス：`app.vault.getMarkdownFiles()` を起動時に走査し既存パーサーでパースして `Map<path, Document>` に保持。
- `app.vault.on('modify'|'create'|'delete'|'rename')` を購読し**変更ファイルだけ**再パース。debounce は既存 `debounceMs` を踏襲。
- スコープ（現在ファイル / 指定フォルダ / Vault 全体）を設定で選択。既定は Vault 全体。

### ⚠️ 重要な訂正（再オープン理由）
当初実装で `ShadowItemView` に `buildMergedDoc()` を追加し、複数ファイルの `Document` を**連結して1つの偽 Document** にしてパネルへ渡した。これがクロスファイルでの **id 衝突**（`section-N` は全ファイル共通、タスク id も別ファイル間で衝突）を生み、**`each_key_duplicate`・パネルのレイアウト崩壊・書き戻しの誤ファイル混入**を引き起こした。
→ **索引自体（per-file 保持）は正しい。** だが「複数 Document をマージして消費する」責務は本 issue から**切り離す**。集約の消費（識別子の名前空間化・ViewModel・書き戻しのファイル振り分け）は `issue-phase001-005` で再設計する。本 issue では `buildMergedDoc` を**撤去**し、索引は per-file の取り出しのみ提供する。

---

## 2. 進捗・実装メモ  — AIが読む

### 遵守事項（毎回）
- 作業着手の開始時に**一度だけ** `project/governance/` を確認し、本プロジェクトのルールを確認すること（`AI_RUNTIME_RULES.md` のロード順に従う）。
- **テスト観点とテストコードは、毎回すべてを見直すこと**（`TESTING_STANDARD.md` 準拠）。

### 既存資産の再利用（必読・実装前に読む）
- `src/lib/parser/parse-markdown.ts` の `parseMarkdown(md): Document` … パースはこれを使う。**新パーサーを書かない。**
- `src/sync/file-sync.ts` … 現行の単一ファイル同期・debounce。これを壊さず、索引はこの隣に足す。
- `src/sync/ast-index.ts` … 実装済みの索引（保持・差分更新・スコープ・onChange）。本 issue の訂正では消費側のマージ撤去に集中する。
- `src/views/ShadowItemView.ts` の `buildMergedDoc` … **撤去対象**（`phase001-005` の ViewModel に置換）。

### 仕様（確定事項：迷ったらこれに従う）
- ノードの型は**変更しない**（出自は索引側で `path` と一緒に返す：`{ path, node }`）。
- 公開 API（責務固定）：開始/停止、`getDocument(path)`、`getDocuments(): Map<path, Document>`、`getAllTaskNodes(scope): {path, node}[]`、`resolveLine(path, nodeId)`、`onChange(cb): unsubscribe`。
- **索引は「複数 Document をマージしない」。** 連結した単一 Document を返す API を持たせない（マージは禁止）。消費側（`phase001-005`）が per-file を畳んで ViewModel 化する。
- 差分更新は変更ファイルのみ。性能最適化は対象外（別 issue）。

### TODO
- [x] `AstIndex`（上記 API）を実装。
- [x] vault イベント購読＋変更ファイルのみ差分更新＋`onChange` 発火。
- [x] スコープ設定を `settings.ts` に追加し列挙へ反映。
- [x] `plugin.ts` で生成・破棄を配線。
- [x] 索引単体のテスト。
- [x] **訂正:** `ShadowItemView` の `buildMergedDoc` とそれに依存する経路を撤去（消費は `phase001-005` へ移管）。索引はマージ用 API を提供しない。
- [x] 撤去後、単一ファイル表示が従来どおり（回帰なし）であることを確認。

### 受け入れ基準（すべて満たすこと）
- スコープ内全 Markdown が索引化され `getAllTaskNodes` が全ファイルのタスクを `{path, node}` で返す。
- 編集で `debounceMs` 後にそのファイルのみ更新され `onChange` 発火。create/delete/rename 反映。
- **索引はマージした単一 Document を返さない**（per-file のみ）。
- `buildMergedDoc` 撤去後、各パネルが単一ファイルで従来どおり描画される（`each_key_duplicate`・崩れが無い）。

### テスト観点
- `vitest` 単体: モック vault で初期索引・差分更新・delete・rename・スコープ別列挙・`resolveLine`。
- 差分更新が変更ファイルのみ（他 `Document` 参照が同一）。
- 回帰: `buildMergedDoc` 撤去後の単一ファイル描画。

### 履歴（追記のみ）
- 2026-06-28 — 起票。
- 2026-06-28 — Haiku 実装可能な水準へ加筆。
- 2026-06-28 — 実装完了（索引・差分更新・テスト）。ただし消費側で `buildMergedDoc` を導入。
- 2026-06-28 — **再オープン。** `buildMergedDoc`（複数 Document の連結）がクロスファイル id 衝突を生み `each_key_duplicate`・パネル崩壊・書き戻し誤爆を招いた。索引（per-file 保持）は維持し、マージ消費の責務を本 issue から外して `phase001-005`（識別子＋ViewModel）で再設計する。本 issue は `buildMergedDoc` 撤去と回帰確認まで。
- 2026-06-28 — **完了。** `ShadowItemView` から `buildMergedDoc`・`NodeToFile`・`nodeToFile` フィールド・`astIndexUnsubscribe`・クロスファイルナビゲーション経路を撤去。`fileSyncHandler` は単一ファイル doc を直接渡す形に簡略化。全テスト 242 件パス、回帰なし。

---

## 3. メタデータ
- id: issue-phase001-001__multi-source-ast-index
- status: closed
- phase: 001
- related_specs: なし（仕様は本issueに内包）
- related_decisions:
- target_files: src/sync/ast-index.ts, src/views/ShadowItemView.ts（buildMergedDoc 撤去）, src/sync/file-sync.ts, src/plugin.ts, src/settings.ts
- created: 2026-06-28
- closed: 2026-06-28
- updated: 2026-06-28
