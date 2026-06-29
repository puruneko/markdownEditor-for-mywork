# クロスファイル識別子とビューモデル層（エディタ⇄パネルの疎結合な継ぎ目）

## 1. 課題と方針  — 人間が読む

### このissueで解決すること
複数ファイルを集約表示しようとした結果、**`each_key_duplicate` エラーとパネルのレイアウト崩壊・書き戻しの誤ファイル混入**が発生した。原因は識別子の設計にある:

- セクション id は `section-0` `section-1` …と**位置採番**で、**全ファイルで重複**する。
- タスク id は `(テキスト+兄弟番号)` のハッシュで、**別ファイル間で容易に衝突**する（例：複数ノートの「未整理メモ > 電話する」）。
- パネルは `{#each}` を `node.id` / `section.id` の**直キー**にしているため、集約で id が重複し Svelte が `each_key_duplicate` を投げる。
- 書き戻しの `findNodeById(doc, card.id)` は**最初の一致**を返し、別ファイル/別タスクへ誤って書き込む。
- 当初実装は複数 `Document` を**連結した偽 Document** をパネルへ渡したため、エディタ側の集約変更がパネルへ直接波及した（密結合）。

この issue では、これを**本質的・堅牢・拡張可能**に作り直す。中核は2つ:
1. **グローバルに一意で安定な識別子**（どのファイルのどのノードかを必ず区別できるキー）。
2. **エディタ側（パーサー/索引/同期）とパネル（UI）を分離する唯一の継ぎ目＝ビューモデル層**。パネルはこの契約だけに依存し、エディタ側の内部実装が変わっても壊れない。

### 方針（疎結合の継ぎ目を1つ作る）
- すべての横断アドレスを **`globalKey = `${sourcePath}::${localId}``** で表す。パネルの `{#each}` キー・クリック・編集・書き戻しは**必ずこの globalKey**で行う。生の `node.id` をパネル間でグローバルに使わない。
- **偽 merged Document を作らない。** 索引の per-file `Document` 群を、変換器が **source-tag 付きのビューモデル**（各アイテムが `globalKey` と `sourcePath` を持つ平坦なデータ）に畳んでパネルへ渡す。
- 書き戻し・ナビは globalKey から**該当ファイルを解決して per-file で**行う（`findNodeById` は単一 Document に対してのみ呼ぶ）。

---

## 2. 進捗・実装メモ  — AIが読む

### 遵守事項（毎回）
- 作業着手の開始時に**一度だけ** `project/governance/` を確認し、本プロジェクトのルールを確認すること（`AI_RUNTIME_RULES.md` のロード順に従う）。
- **テスト観点とテストコードは、毎回すべてを見直すこと**（`TESTING_STANDARD.md` 準拠）。

### 依存・順序
- `issue-phase001-001`（索引：per-file `Document` 保持と `getDocuments()`）。本 issue が索引の**唯一の消費の正**となる。
- **本 issue は filter-bar / query-block / agenda / health / drag-meta / tray より先**に完成させる（それらは本 issue のビューモデルと globalKey に依存する）。

### 既存資産の再利用（必読・実装前に読む）
- `src/sync/ast-index.ts` の `getDocuments(): Map<path, Document>` … per-file の取り出し。
- `src/views/ShadowItemView.ts` … `buildMergedDoc` を**廃止**し、ビューモデル生成と globalKey ベースのナビ／書き戻しに作り替える対象。
- `src/lib/calendar/markdown-patch.ts` の `findNodeById` … **単一ファイルの Document に対してのみ**使う（per-file 書き戻し）。
- `src/lib/kanban/ast-to-kanban.ts` / `src/lib/calendar/ast-to-calendar.ts` / `src/lib/gantt/ast-to-gantt.ts` … 各アイテムの `id: node.id` を **globalKey** に、`sourcePath` を付与するよう改修。Gantt のグループ `id: section.id` も名前空間化。
- `src/lib/kanban/KanbanTab.svelte` ほか各 `*Tab.svelte` … `{#each}` キーと `card.id` 利用箇所（クリック・書き戻し）を globalKey 化。
- `src/lib/parser/mdast-to-nodes.ts` の `generateId` ／ `src/lib/parser/mdast-to-sections.ts` の section id … ローカル id の一意性強化（下記仕様）。

### 仕様（確定事項：迷ったらこれに従う）

**(a) グローバルキー**
- 共通ヘルパー `makeGlobalKey(path, localId)` / `parseGlobalKey(key)` を1モジュールに置く。区切りは `::`。`parseGlobalKey` は**最後の `::` で分割**する（パスに `::` が無い前提だが、念のため末尾優先で localId を取る）。
- パネルへ渡るすべてのアイテム・グループのキーは globalKey。クリック/編集コールバックも globalKey を渡す。

**(b) ローカル id の一意性強化（本質的修正）**
- パーサーのノード id を「テキストハッシュ」から **構造の位置インデックス基盤**に変更する（例：セクション索引と子の索引を連ねた安定パス）。これで**同一ファイル内でも構造的に一意**になり、並び順が変わらない限り**安定**する。
- section id は位置採番のままでよい（globalKey で名前空間化されるため、ファイル内で一意なら十分）。
- 目的は「同一テキストの兄弟」「重複サブツリー」でも id が衝突しないこと。

**(c) ビューモデル契約（疎結合の継ぎ目）**
- パネル向けの型を**1モジュール**（例 `src/lib/viewmodel/contract.ts`）に集約する。これが唯一の境界。共通ラッパ：`SourceTagged<T> = T & { sourcePath: string; globalKey: string }` のような形（型ガイドのみ・実装は委譲）。
- 変換器（ast-to-kanban/calendar/gantt）は **`{path, doc}` の配列**を受け取り、各アイテムに `globalKey`・`sourcePath` を付与して出力する。**Document を連結しない。**

**(d) 解決・書き戻しの共通部品（将来も再利用）**
- `resolveRef(index, globalKey): { path, localId, line, file } | undefined` … ナビと書き戻しの**唯一の解決器**。
- `patchInFile(index, globalKey, (md, doc, node) => newMd): Promise<void>` … 該当ファイルの md を取得 →（per-file の）`findNodeById(localId)` → patch → **そのファイルへ** `vault.modify`。drag-meta・状態トグル・編集ダイアログが共通利用。
- ナビ（クリック→カーソル移動）も `resolveRef` 経由。別ファイルは開いてから移動。

**(e) ShadowItemView の作り替え**
- `buildMergedDoc` を廃止。索引 → ビューモデル生成 → パネルへ。
- `onNodeClick` / 編集は globalKey を受け、`resolveRef` / `patchInFile` で**該当ファイル**に作用（`getCurrentFile()` に書かない）。
- 単一ファイル時も同じ globalKey 経路で動かす（分岐を増やさない）。

### 実装の要点・つまずき
- `{#each}` のキーは**必ず globalKey**。`card.id` 直キーは集約で衝突する。グループ（section）キーも名前空間化する。
- `findNodeById` は**集約データに対して呼ばない**（最初の一致で誤爆）。必ず per-file の Document に対して。
- 書き戻し先は**アイテムの sourcePath**。現在ファイルではない。
- 契約型を1モジュールに閉じ込め、パネルはそこだけに依存させる（エディタ側の変更がパネルへ波及しない＝今回の崩壊の再発防止）。

### 将来を見据えて用意するもの（今すぐ全部使わなくてよい）
- `makeGlobalKey`/`parseGlobalKey`/`resolveRef`/`patchInFile`/`SourceTagged<T>` を共通ユーティリティとして整備（後続 issue が再利用）。
- 変換器の「複数ソース受け取り」シグネチャを今のうちに統一（単一ファイルは要素1の配列として渡す）。

### TODO
- [x] ローカル id を位置インデックス基盤へ変更し一意性を担保（パーサー＋テスト）。
- [x] `makeGlobalKey`/`parseGlobalKey` と契約型（`SourceTagged` 等）を1モジュールに。
- [x] 変換器3種を「`{path,doc}[]` 受け取り・globalKey/sourcePath 付与」に改修。
- [x] `resolveRef`/`patchInFile` を実装。
- [x] `ShadowItemView` を作り替え（buildMergedDoc 廃止・globalKey ナビ／書き戻し）。
- [x] 各 `*Tab.svelte` の `{#each}` キーと書き戻しを globalKey 化。
- [x] テストを追加・全見直し（下記テスト観点）。

### 受け入れ基準（すべて満たすこと）
- 複数ファイルを集約表示しても `each_key_duplicate` が出ない（キーが globalKey で一意）。
- 別ファイルのカードをクリック → **正しいファイルの正しい行**へ移動。
- 別ファイルのカードをドラッグ/編集 → **そのファイル**に書き戻り、**他ファイルを汚さない**。
- 単一ファイル時も従来どおり（回帰なし・レイアウト崩れ無し）。
- パーサー/索引の内部を変えてもパネル契約（1モジュール）が壊れない。
- 同一テキストの兄弟・重複サブツリーでもローカル id が衝突しない。

### テスト観点
- `vitest` 単体: `makeGlobalKey`/`parseGlobalKey` の往復、`::` を含む異常パス、末尾分割。
- ローカル id 一意性（同一テキスト兄弟・重複サブツリー・複数ファイル）。
- 変換器3種が複数ソースで globalKey/sourcePath を正しく付与し、キーが全体で一意。
- `resolveRef`/`patchInFile` が正しいファイル・行に解決し、他ファイルを変更しない。
- 回帰: 単一ファイルでの各パネル描画・クリック・書き戻し。

### 履歴（追記のみ）
- 2026-06-28 — 起票。複数ファイル集約で表面化した id 衝突（`each_key_duplicate`・パネル崩壊・書き戻し誤爆）の本質的修正として、グローバル識別子とビューモデル層（疎結合の継ぎ目）を定義。
- 2026-06-28 — 実装完了。325テスト・E2Eすべて合格。

---

## 3. メタデータ
- id: issue-phase001-005__cross-file-identity-and-viewmodel
- status: implemented
- phase: 001
- related_specs: なし（仕様は本issueに内包）
- related_decisions:
- target_files: src/lib/viewmodel/contract.ts, src/lib/viewmodel/global-key.ts, src/lib/viewmodel/resolve.ts, src/lib/parser/mdast-to-nodes.ts, src/lib/parser/mdast-to-sections.ts, src/lib/{kanban,calendar,gantt}/ast-to-*.ts, src/lib/*/(*)Tab.svelte, src/views/ShadowItemView.ts
- created: 2026-06-28
- updated: 2026-06-28
