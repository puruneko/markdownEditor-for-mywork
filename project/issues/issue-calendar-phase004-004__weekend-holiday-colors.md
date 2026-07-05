# [calendar] 日付ヘッダ・セルの週末／祝日色分け

## 1. 課題と方針  — 人間が読む

### このissueで解決すること
gantt 側 issue-gantt-phase004-006 と同一の要望のカレンダー版: 土日と、ユーザー定義祝日の色分け。営業日が見えないと日程計画（オーナーの P2 課題）を誤る。

**重要**: gantt と**prop 名・型・weekday 規約を完全に揃える**こと（`holidays: string[]`（YYYY-MM-DD）/ `weekend: number[]`（1=月〜7=日、デフォルト `[6,7]`））。両ライブラリで規約が割れると、供給側（本体 issue-phase004-004）の配布コードが分岐して恒久的な保守コストになる。

### 方針
週表示（day-column ヘッダ・列背景）と月表示（セル背景・日付文字色）で色分け。判定純関数は gantt 側と同ロジック（各リポジトリに同名関数 `dayKind` を持つ。共有パッケージ化は今回しない — リポジトリ独立方針のため重複を許容し、テストで同一挙動を担保）。

---

## 2. 進捗・実装メモ  — AIが読む

### 遵守事項（毎回）
- **実装前に本体リポジトリの `project/governance/`・`issue-phase004-000__phase-overview.md`・`issue-calendar-phase004-000__calendar-overview.md` を必ず読むこと。** issue-gantt-phase004-006 が先に完了していれば、その dayKind 実装・テストを**読み写す**こと（挙動統一）。
- **既存テストの見直しは機能実装と同等に重要。** WeekView / MonthView のヘッダ・セル描画テストに色分岐ケースを追加。既存の「今日ハイライト」等と競合しないか確認（優先順位: 今日 > 祝日 > 週末、を推奨。決定を履歴に記録）。

### 対象・既存資産
- `../calendar-for-mywork/src/lib/components/WeekView.svelte`（`day-column` / ヘッダ）・`MonthView.svelte`（日セル）。
- `CalendarView.svelte` … トップレベル prop の受け口（holidays / weekend を配下へ流す）。

### 仕様
1. prop: `holidays?: string[]` / `weekend?: number[]`（デフォルト `[6, 7]`）。
2. 判定: `dayKind(isoDate, holidays, weekend)` 純関数（holidays は Set 化）。祝日 > 週末。
3. 週表示: ヘッダの曜日・日付文字色＋列背景の薄塗り。月表示: セル背景の薄塗り＋日付数字の色。
4. 色: 祝日=赤系薄・週末=グレー系薄。CSS 変数化。
5. 日付文字列化は `toISODate()` 相当で TZ ズレ防止（このライブラリの日付は ISODate 文字列ベース（calendarDate.ts）なので、比較は文字列同士で安全なはず — 実装の日付表現を確認して合わせる）。

### 実装の要点・つまずき
- 月表示の「前月・翌月のはみ出し日」も色分け対象（はみ出し日の薄色と祝日色の重なりで視認性が死なないか確認）。
- allday 帯・時間グリッドの背景塗りは列単位で（既存の today ハイライトと同じ塗り方があれば流用）。

### TODO
- [ ] prop 追加＋dayKind 純関数（gantt 側と挙動一致）
- [ ] 週・月の色分け描画（CSS 変数・today との優先順位）
- [ ] lib テスト見直し＋新テスト、本体 E2E 回帰

### 受け入れ基準
- weekend / holidays が週・月の両表示で色分けされる。祝日優先・today 最優先。
- prop 未指定時はデフォルト土日のみ。
- gantt 側と同じ入力で同じ判定結果（dayKind テストが両リポジトリで同一ケース・同一期待値）。
- lib テスト・本体 `npm run test:obs:e2e` 全通過。

### テスト観点
- dayKind unit（gantt 側と同一のテーブル）。
- today × 祝日の重なり。

### 履歴（追記のみ）
- 2026-07-04 — 起票。

---

## 3. メタデータ
- id: issue-calendar-phase004-004__weekend-holiday-colors
- status: open
- phase: 004
- target_repo: ../calendar-for-mywork
- related_issues: issue-phase004-000, issue-phase004-004（祝日データ供給）, issue-gantt-phase004-006（規約統一・先行推奨）
- created: 2026-07-04
- updated: 2026-07-04
