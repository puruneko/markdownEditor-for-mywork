# マルチソース AST インデックス（複数ファイル横断集約の土台）

## 1. 課題と方針  — 人間が読む

### このissueで解決すること
`src/sync/file-sync.ts` は「今エディタで開いている 1 ファイル」しか追跡・パースしていない。複数ノートに散ったタスクを横断して集める仕組みが無く、アジェンダ・スマートリスト・抜け漏れ検出・埋め込み集約ブロックといった上位機能が一切成立しない。

この issue では、**Vault 内の複数 Markdown をパースしてメモリ上に索引（`path → Document`）として保持し、ファイル変更で差分更新する基盤**を作る。各タスクが「どのファイルの何行目か」を引けるようにし、後続機能がクリック→該当ファイル該当行へジャンプできるようにする。本 issue は UI を持たない（索引と API まで）。

### 方針
- 新規 `AstIndex` クラスを作り、`app.vault.getMarkdownFiles()` を起動時に走査して既存パーサーでパースし `Map<path, Document>` に保持。
- `app.vault.on('modify'|'create'|'delete'|'rename')` を購読し、**変更ファイルだけ**再パース（全件再走査しない）。debounce は既存 `debounceMs` を踏襲。
- スコープ（現在ファイル / 指定フォルダ / Vault 全体）を設定で選択。既定は Vault 全体。

---

## 2. 進捗・実装メモ  — AIが読む

### 遵守事項（毎回）
- 作業着手の開始時に**一度だけ** `project/governance/` を確認し、本プロジェクトのルールを確認すること（`AI_RUNTIME_RULES.md` のロード順に従う）。
- **テスト観点とテストコードは、毎回すべてを見直すこと**（`TESTING_STANDARD.md` 準拠）。

### 既存資産の再利用（必読・実装前に読む）
- `src/lib/parser/parse-markdown.ts` の `parseMarkdown(md): Document` … パースはこれを使う。**新パーサーを書かない。**
- `src/sync/file-sync.ts` … 現行の単一ファイル同期・debounce の実装。これを壊さず、索引はこの隣に足す（既存の同期経路は維持）。
- `src/sync/editor-event-bus.ts` … 後続機能のジャンプに使う既存バス（本 issue では配線不要、参照のみ）。
- `src/lib/parser/types.ts` の `Document.nodeLineMap`（`nodeId → 0-based 行`）… 行解決はこれを使う。索引は `path` をキーに各 `Document` を保持するだけで `(path, nodeId) → line` を引ける。
- `src/plugin.ts` … `onload`/`onunload` での生成・破棄の流儀（既存ビュー登録と同じ場所に配線）。

### 仕様（確定事項：迷ったらこれに従う）
- ノードの型は**変更しない**（`sourcePath` をノードに埋め込まない）。出自は索引側で `path` と一緒に返す（例：`{ path, node }`）。これで型の破壊的変更とテスト全書き換えを避ける。
- 公開 API（最低限・名前は変えてよいが責務は固定）:
  - 開始/停止、`getDocument(path)`、`getDocuments(scope)`、`getAllTaskNodes(scope): {path, node}[]`、`resolveLine(path, nodeId): number|undefined`、`onChange(cb): unsubscribe`。
- 差分更新は**変更ファイルのみ**再パースし、他ファイルの `Document` 参照は維持する（不要な再計算・再描画を避ける）。
- 初期走査は逐次でよい。**性能最適化（大量ファイルの遅延ロード等）は本 issue の対象外**（必要なら別 issue。TODO に残す）。

### 実装の要点・つまずき
- rename は path キーの付け替え（古い path を消し新 path で再パース）。delete はエントリ削除。これらで `onChange` を必ず発火。
- 購読は `onunload` で必ず解除（リーク防止）。
- スコープ「指定フォルダ」は path 前方一致で判定。

### TODO
- [ ] `AstIndex`（上記 API）を実装。
- [ ] vault イベント購読＋変更ファイルのみ差分更新＋`onChange` 発火。
- [ ] スコープ設定を `settings.ts` に追加し列挙へ反映。
- [ ] `plugin.ts` で生成・破棄を配線。
- [ ] テストを追加・全見直し（下記テスト観点）。

### 受け入れ基準（すべて満たすこと）
- 起動後、スコープ内全 Markdown が索引化され `getAllTaskNodes` が全ファイルのタスクを返す。
- ファイル編集で `debounceMs` 後にそのファイルのみ更新され `onChange` が発火。
- create/delete/rename が索引へ反映。
- `resolveLine(path, nodeId)` が正しい 0-based 行を返す。
- スコープ「指定フォルダ」で外のファイルが列挙されない。

### テスト観点
- `vitest` 単体: モック vault（複数ファイル）で初期索引・差分更新・delete・rename。
- 差分更新が変更ファイルのみ（他 `Document` 参照が同一）であること。
- スコープ別列挙、`resolveLine` 整合。

### 履歴（追記のみ）
- 2026-06-28 — 起票。
- 2026-06-28 — Haiku 実装可能な水準へ加筆（既存資産・確定仕様を内包）。

---

## 3. メタデータ
- id: issue-phase001-001__multi-source-ast-index
- status: open
- phase: 001
- related_specs: なし（仕様は本issueに内包）
- related_decisions:
- target_files: src/sync/ast-index.ts, src/sync/file-sync.ts, src/plugin.ts, src/settings.ts
- created: 2026-06-28
- updated: 2026-06-28
