# [calendar] 仮置き（半透明＋?）の描画と plan prop の受け口（描画なし）

## 1. 課題と方針  — 人間が読む

### このissueで解決すること
1. **仮置き**: `@schedule?:` / `@due?:` 由来のアイテムを半透明＋「?」バッジで描き、確定予定と見分ける（gantt 側 issue-gantt-phase004-004 と同思想。仮置きが確定と同じ見た目だと「確定したつもり」事故が起きる）。
2. **plan の受け口**: オーナー決定（Q2）「calendar は plan のデータを**受け取るが表示はしない**（将来検討）」。今のうちに `plan` prop の型だけ定義しておく理由: 後から表示を足すとき、**ライブラリの型追加を待たずに本体が値を流し始められる**（IF を先に切っておくと将来の変更が片側で済む）。

### 方針
CalendarItem に `tentative?: boolean` と `plan?: { start: string; end: string } | null` を追加。tentative は描画に反映、plan は**保持のみ**（描画コード禁止）。

---

## 2. 進捗・実装メモ  — AIが読む

### 遵守事項（毎回）
- **実装前に本体リポジトリの `project/governance/`・`issue-phase004-000__phase-overview.md`・`issue-calendar-phase004-000__calendar-overview.md` を必ず読むこと。** prop 型の正は issue-phase004-004。
- **既存テストの見直しは機能実装と同等に重要。** CalendarItem 型の拡張は factories / validation とその全テストに波及する。**validation が「未知フィールド拒否」型の実装だと新フィールドで既存アイテムが不正扱いになる** — validation.ts の方式を最初に確認すること。

### 対象・既存資産
- `../calendar-for-mywork/src/lib/models/CalendarItem.ts` … 型追加。
- `src/lib/components/WeekView.svelte` / `MonthView.svelte` … クラス付与（`tentative`）。
- `src/lib/models/validation.ts` / `factories.ts` … 追随。

### 仕様
1. `tentative?: boolean` — true のとき:
   - アイテムに `tentative` クラス。CSS: `opacity: 0.55` 程度＋右上（または右端）に小さな「?」バッジ。
   - 種別クラス（task/appointment/meeting/deadline）と**併存**する（`calendar-item meeting tentative` のように）。
   - tentative アイテムも**ドラッグ・編集は可能**（仮置きの調整はよくある操作）。
2. `plan?: { start: string; end: string } | null` — **保持のみ。describe/描画コードを書かない。** 型コメントに「将来の表示検討用。現在は未描画（オーナー決定 2026-07-03）」と明記。
3. 「?」バッジは幅の狭いアイテムで潰れない配置（タイトル行の右端固定など）。

### 実装の要点・つまずき
- 編集ダイアログ（EventEditDialog.svelte）から保存するとき tentative / plan を**落とさない**こと（ダイアログが item を再構築する実装だと新フィールドが消える — ここが一番の罠。保存経路のテストを必ず追加）。
- opacity はアイテム全体に掛ける（背景だけ薄くして文字が濃いままだと「薄い」と認識されない）。

### TODO
- [ ] 型追加（tentative / plan）＋ validation・factories 追随
- [ ] tentative の描画（週・月・deadline 含む）
- [ ] 編集ダイアログ経由でフィールドが保持されることの確認＋テスト
- [ ] lib テスト見直し＋新テスト、本体 E2E 回帰

### 受け入れ基準
- tentative アイテムが半透明＋?で描かれ、ドラッグ・編集できる。
- plan フィールドを持つアイテムが従来と**同一の見た目**（描画されないことの確認）。
- 編集ダイアログで保存しても tentative / plan が消えない。
- lib テスト・本体 `npm run test:obs:e2e` 全通過。

### テスト観点
- tentative × 4 種別のクラス併存。
- plan 保持のみ（スナップショットに plan の描画痕跡が無いこと）。
- ダイアログ保存でのフィールド保持。

### 履歴（追記のみ）
- 2026-07-04 — 起票。

---

## 3. メタデータ
- id: issue-calendar-phase004-003__tentative-style-and-plan-prop
- status: open
- phase: 004
- target_repo: ../calendar-for-mywork
- related_issues: issue-phase004-000, issue-phase004-004（値の供給側）, issue-calendar-phase004-001, issue-calendar-phase004-002
- created: 2026-07-04
- updated: 2026-07-04
