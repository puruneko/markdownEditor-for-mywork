# [kanban] カードの breadcrumb（所属パンくず）表示

## 1. 課題と方針  — 人間が読む

### このissueで解決すること
オーナー要望 2 件を 1 つの一般化で解決する:
1. カードグループ表示 OFF のとき、親カード配下のカードは**親カード名**が分からない。
2. ユニット表示 OFF のとき、ユニット所属のカードは**ユニット名**が分からない。

つまり「グルーピングを解除しても所属コンテキストを失わない」が本質。カード下部に小さく `セクション › 親カード › ユニット` と 1 行表示する **breadcrumb** に一般化すると、両方が 1 実装で済み、将来のファイル横断表示（どのファイル由来か）もここに載せられる。

値の組み立て（何をパンくずにするか）は**本体**（issue-phase004-004: `breadcrumb: string[]`）。ライブラリは受けた文字列配列を描くだけ。

### 方針
CardData に `breadcrumb?: string[]` を追加し、カード下部に描画。表示 ON/OFF と粒度は board config の prop で制御。

---

## 2. 進捗・実装メモ  — AIが読む

### 遵守事項（毎回）
- **実装前に本体リポジトリの `project/governance/`・`issue-phase004-000__phase-overview.md`・`issue-kanban-phase004-000__kanban-overview.md` を必ず読むこと。** prop 型の正は issue-phase004-004。issue-kanban-phase004-001（バグ修正）の**後**に着手（同一リポジトリの競合回避＋バグ優先）。
- **既存テストの見直しは機能実装と同等に重要。** CardData 型拡張はカード描画・配分テストに波及。既存に `CardAffiliation.svelte`（所属表示コンポーネント）が**既にある** — 重複実装せず、これが要望を満たすか・拡張で足りるかを最初に調査し、結果を履歴に記録すること（既存資産の再利用原則）。

### 対象・既存資産
- `../kanban-for-mywork/src/lib/components/CardAffiliation.svelte` … 既存の所属ラベル表示（KanbanCard / KanbanCardGroup から `affiliationLabels` で使用されている）。**本 Issue の実装はまずこれの調査から始める。** 既に「親の名前を出す」機構なら、breadcrumb はこの拡張（区切り記号・粒度制御・グルーピング状態連動）で実現するのが正しい。
- `src/lib/components/KanbanCard.svelte` … 通常/コンパクトの 2 描画。コンパクト（グループ内）では breadcrumb 不要（親がすぐ上に見えているため — 重複情報はうるさい）。
- 本体 `src/lib/kanban/ast-to-kanban.ts` … breadcrumb 値の供給（issue-phase004-004）。

### 仕様
1. CardData に `breadcrumb?: string[]`（先頭がセクション、末尾が直近の所属）。既存 `affiliationLabels` と統合できるならフィールドは 1 本化する（二重フィールド禁止。統合方針を履歴に記録）。
2. 描画: カード下部に 1 行、`セクション › 親カード › ユニット` 形式（区切り `›`）。フォント小・低コントラスト（カード本文より目立たない）。
3. **粒度・表示制御**（board config の prop）:
   - `showBreadcrumb?: boolean`（デフォルト true）
   - 現在のグルーピングで**すでに見えている階層は省く**: 例) 階層グルーピング（heading）中はセクション部分を省略、カードグループ表示中の子カードは親カード部分を省略。理由: 同じ情報の二重表示は「うるさい」（オーナーの一貫した要望）。この省略ロジックは lib 内（グルーピング状態を知っているのは lib）。
4. 長い breadcrumb は末尾優先で省略（`… › 親カード › ユニット`。直近の所属が最重要情報）。

### 実装の要点・つまずき
- 省略ロジックはグルーピング種別（`__hierarchy__` / status / なし / カードグループ表示）ごとの分岐になる。**分岐表をテストで固定**すること（この種の条件表は口頭仕様のままだと必ず齟齬る）。
- カードスニペット（本体がカード内容を差し替える `cardSnippet`）使用時も breadcrumb はカード枠側（lib 側）で描く — スニペットに任せると本体とlibの二重責務になる。既存の CardAffiliation の描画位置に合わせる。

### TODO
- [ ] CardAffiliation の現状調査（履歴に記録）→ 統合方針決定
- [ ] breadcrumb 描画＋省略ロジック（グルーピング状態連動・末尾優先トリム）
- [ ] showBreadcrumb prop
- [ ] lib テスト見直し＋分岐表テスト新設
- [ ] 本体 E2E: kanban-view.e2e.ts に「グルーピングなし時に親カード名がカードに表示される」1 件追加

### 受け入れ基準
- グルーピング「なし」でカード下部に `セクション › 親カード` が表示される。
- 階層グルーピング中はセクション部分が省略される。
- カードグループ内の子カードには breadcrumb が出ない（コンパクト表示）。
- showBreadcrumb=false で一切出ない（回帰）。
- lib テスト・本体 `npm run test:obs:e2e` 全通過。

### テスト観点
- グルーピング種別 × 所属の組合せ分岐表。
- 長い breadcrumb のトリム。

### 履歴（追記のみ）
- 2026-07-04 — 起票。

---

## 3. メタデータ
- id: issue-kanban-phase004-002__card-breadcrumb
- status: open
- phase: 004
- target_repo: ../kanban-for-mywork（＋本体 ast-to-kanban の値供給は issue-phase004-004）
- related_issues: issue-phase004-000, issue-phase004-004（値の供給側）, issue-kanban-phase004-001（先行）
- created: 2026-07-04
- updated: 2026-07-04
