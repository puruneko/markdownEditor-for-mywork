# [calendar] meeting 種別の追加とタスク／予定／打合せの描き分け（形で区別）

## 1. 課題と方針  — 人間が読む

### このissueで解決すること
オーナー要望: 「タスクと打合せと単純な予定が視覚的に分かるように。ただし、うるさいのは NG」。カレンダーライブラリの `CalendarItem.type` は既に `'task' | 'appointment' | 'deadline'` を持つ。不足は ①`'meeting'` 種別、②種別の**静かな描き分け**（色を増やすのではなく**形**で区別する方針 — 色はステータス/タグ由来の 1 系統に温存する）。

種別の判定（チェックなし＋schedule=appointment、タグ=meeting）は**本体の責務**（issue-phase004-004。オーナー決定 Q6）。ライブラリは type を受けて描くだけ。

### 方針
- `CalendarItem.type` union に `'meeting'` を追加。
- 描き分け: **task=左ボーダー＋チェック余白 / appointment=枠線のみ（ゴースト風）/ meeting=塗りつぶし / deadline=既存（issue-calendar-phase004-002 で刷新）**。

---

## 2. 進捗・実装メモ  — AIが読む

### 遵守事項（毎回）
- **実装前に本体リポジトリの `project/governance/`・`issue-phase004-000__phase-overview.md`・`issue-calendar-phase004-000__calendar-overview.md` を必ず読むこと。** prop/型の正は issue-phase004-004。
- **既存テストの見直しは機能実装と同等に重要。** `CalendarItem.type` の union 拡張は、type を switch している全箇所（WeekView.svelte のクラス決定関数 — `'calendar-item task task-xxx'` / `'calendar-item appointment'` / `'calendar-item deadline'` を返す関数が既にある）と、factories / validation（`src/lib/models/factories.ts` / `validation.ts`）のテストに波及する。**網羅 switch（exhaustive check）があるとコンパイルエラーで発見できるが、文字列分岐だと黙って素通りする** — grep で `'appointment'` の全参照を洗うこと。

### 対象・既存資産
- `../calendar-for-mywork/src/lib/models/CalendarItem.ts` … type union。
- `src/lib/models/Appointment.ts` … meeting は Appointment の亜種として扱うか独立型にするか: **独立の type 値としつつ、フィールドは Appointment と同一**でよい（現段階で meeting 固有フィールドは無い。将来必要になったら追加）。
- `src/lib/components/WeekView.svelte`（クラス決定: 1031 行付近 `'calendar-item deadline'` 等）/ `MonthView.svelte`（`month-item` 系。同様の分岐を確認）。
- `src/lib/models/factories.ts` / `validation.ts` … 生成・検証に type 分岐があれば追随。

### 仕様
1. type union へ `'meeting'` 追加。未知 type が来た場合のフォールバックは appointment 扱い（描画が消えるより安全）。
2. クラス付与: `calendar-item meeting`（週）/ `month-item meeting`（月）。
3. CSS（うるさくしない原則）:
   - task: 左に 3px のボーダー＋本文（既存の task-status 色は維持）。
   - appointment: 背景ほぼ透明＋1px 枠線（ゴースト）。
   - meeting: 塗りつぶし（1 色。彩度は控えめ）。
   - すべて CSS 変数化しホストが上書き可能に。
4. 月表示でも同じ 3 区別が成立すること（ドット＋タイトルの月アイテムでは、ドットの形 ●/○/■ で区別する等、月ビューの実装に合わせた最小表現でよい。決めた表現を履歴に記録）。

### 実装の要点・つまずき
- WeekView は `getRootNode()` で shadow root 対応済みのコードがある（744 行付近）— DOM 検索を追加する場合は同じパターンを踏襲（document 直参照は shadow 内で壊れる）。
- tentative（issue-calendar-phase004-003）と直交する: 種別クラスと tentative クラスが**同時に付く**設計にする（例 `calendar-item meeting tentative`）。

### TODO
- [ ] type union 拡張＋全分岐箇所の洗い出し（grep 結果を履歴に記録）
- [ ] 週・月の描き分け CSS＋クラス付与
- [ ] factories / validation の追随
- [ ] lib テスト見直し＋新テスト、本体 E2E 回帰

### 受け入れ基準
- type='meeting' のアイテムが塗り、appointment が枠線、task が左ボーダーで描かれる（週・月とも）。
- 既存 task / deadline の描画に意図しない変化がない（回帰）。
- lib テスト・本体 `npm run test:obs:e2e` 全通過。

### テスト観点
- クラス決定関数の unit（4 種別＋未知 type フォールバック）。
- validation: meeting が appointment と同じ検証を通ること。

### 履歴（追記のみ）
- 2026-07-04 — 起票。

---

## 3. メタデータ
- id: issue-calendar-phase004-001__meeting-kind-and-styles
- status: open
- phase: 004
- target_repo: ../calendar-for-mywork
- related_issues: issue-phase004-000, issue-phase004-004（種別判定の供給側）, issue-calendar-phase004-003
- created: 2026-07-04
- updated: 2026-07-04
