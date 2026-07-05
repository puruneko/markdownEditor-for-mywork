# [gantt] 日付ヘッダ・列の週末／祝日色分け

## 1. 課題と方針  — 人間が読む

### このissueで解決すること
オーナー要望: 日付ヘッダの土日の色を変え、ユーザー定義の祝祭日も色を変える。営業日が見えないガントでは「あと何営業日あるか」を誤認し、期限管理（オーナーの根本課題 P2）を誤る。

**責務分界**: 「どの日が祝日か」を知るのは本体（設定ファイル読込。issue-phase004-004）。ライブラリは `holidays: string[]`（YYYY-MM-DD）と `weekend: number[]`（luxon の weekday 規約: 1=月〜7=日）を受けて塗るだけ。

### 方針
GanttChart のトップレベル prop に holidays / weekend を追加し、ヘッダセルと日列の背景色を分岐する。

---

## 2. 進捗・実装メモ  — AIが読む

### 遵守事項（毎回）
- **実装前に本体リポジトリの `project/governance/`・`issue-phase004-000__phase-overview.md`・`issue-gantt-phase004-000__gantt-overview.md` を必ず読むこと。** prop 型の正は issue-phase004-004。
- **既存テストの見直しは機能実装と同等に重要。** ヘッダ描画のテストがあれば色分岐ケースを追加。calendar 側にも同仕様の Issue（issue-calendar-phase004-004）がある — **prop 名・型・weekday 規約を必ず揃える**こと（両リポジトリで規約が割れると本体の配布コードが分岐して汚れる）。

### 対象・既存資産
- `../ganttchart-for-mywork/src/components/GanttHeader.svelte` … 日付ヘッダ。
- `GanttTimeline.svelte` … 日グリッド（列背景を塗る場所。既存のグリッド線描画を確認）。

### 仕様
1. prop: `holidays?: string[]`（YYYY-MM-DD。重複・順不同許容）、`weekend?: number[]`（デフォルト `[6, 7]` = 土日）。
2. 判定: 祝日 > 週末 の優先（祝日が土曜でも祝日色）。判定は純関数 `dayKind(date, holidays, weekend): 'holiday' | 'weekend' | 'normal'` に切り出してテスト可能にする。holidays は Set 化して O(1) 照合（表示範囲×毎描画で配列 includes は無駄）。
3. 色: ヘッダ文字色＋列背景の薄塗り。祝日=赤系薄、週末=グレー系薄。CSS 変数化（ホスト上書き可）。
4. 日単位より粗いズーム（週表示等があれば）ではヘッダ色分けのみ・列塗りは省略（潰れるため）。既存のズーム段階を確認して判断し、判断結果を履歴に記録。

### 実装の要点・つまずき
- DateTime→YYYY-MM-DD の文字列化はタイムゾーンで日付がズレないよう `toISODate()` を使う（`toISO().slice(0,10)` は TZ 依存の罠あり — luxon はローカル TZ だが将来 UTC データが来た時に壊れる。toISODate で統一）。
- 列背景はバー・plan 枠より**さらに背面**（SVG 描画順の最初）。

### TODO
- [ ] prop 追加＋dayKind 純関数
- [ ] ヘッダ・列の色分け描画（CSS 変数）
- [ ] lib テスト見直し＋新テスト、本体 E2E 回帰

### 受け入れ基準
- weekend 指定日がグレー系、holidays 指定日が赤系で表示される。祝日優先。
- prop 未指定時はデフォルト土日のみ色分け、holidays なし。
- lib テスト・本体 `npm run test:obs:e2e` 全通過。

### テスト観点
- dayKind の unit（祝日/週末/通常/祝日∧週末/空配列）。

### 履歴（追記のみ）
- 2026-07-04 — 起票。

---

## 3. メタデータ
- id: issue-gantt-phase004-006__weekend-holiday-header
- status: open
- phase: 004
- target_repo: ../ganttchart-for-mywork
- related_issues: issue-phase004-000, issue-phase004-004（祝日データ供給）, issue-calendar-phase004-004（同仕様・規約統一）
- created: 2026-07-04
- updated: 2026-07-04
