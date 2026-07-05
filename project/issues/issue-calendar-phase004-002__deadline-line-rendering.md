# [calendar] deadline（due）の「ここまで」描画（太い横線＋左端矢印）

## 1. 課題と方針  — 人間が読む

### このissueで解決すること
オーナー決定: `@due`（期限）はカレンダー上で**太い横線＋左端に短い矢印終点**で描き、「ここまでに終わらせる」感を出す。通常イベントと同じ矩形で描くと「その時間に作業する予定」と誤読される — deadline は時間の占有ではなく**締切の宣言**なので、見た目を根本的に変える必要がある。

```
━━━━━━━━━━◄   ← その日の帯に太線、左端に矢印（時間軸の「手前へ向かう」印）
```

### 方針
CalendarItem の `type: 'deadline'` は既存。**deadline の描画スタイルを上記仕様に刷新**する。deadline item の生成（@due→item）は本体（issue-phase004-004）。期間 due（`start/end`）は temporal が期間で来る。

---

## 2. 進捗・実装メモ  — AIが読む

### 遵守事項（毎回）
- **実装前に本体リポジトリの `project/governance/`・`issue-phase004-000__phase-overview.md`・`issue-calendar-phase004-000__calendar-overview.md` を必ず読むこと。**
- **既存テストの見直しは機能実装と同等に重要。** 既存の deadline 描画（WeekView に `'calendar-item deadline'` / `deadline-content` クラスが存在する）のテスト・スタイルを**仕様刷新として置き換える**。「既存の deadline テストが通るから触らない」は不可 — 見た目仕様が変わるのでテストの期待値自体を新仕様に更新すること。

### 対象・既存資産
- `../calendar-for-mywork/src/lib/components/WeekView.svelte` … 既存 deadline 分岐（1031 行付近・`item-content deadline-content`）。現行がどう描いているかを最初に確認し、履歴に記録。
- `MonthView.svelte` … 月表示の deadline 表現。
- `src/lib/models/temporal.ts` … TimeSpan（期間 due は CalendarDateRange / CalendarDateTimeRange で来る）。

### 仕様
1. **一点 deadline（時刻なし）**: その日の終日帯（allday 領域）に太い横線（高さ 3〜4px）＋左端に ◄（矢印）。タイトルは線の上に小さく表示。
2. **時刻あり deadline**: 週表示の該当時刻位置に同じ太線＋◄ を水平に描く（イベント矩形にしない）。
3. **期間 deadline**: start〜end の全日にわたる太線＋**終端側（end）に ◄**。始端は細い縦棒等の開始印（表現の細部は実装裁量。決めたら履歴に記録）。
4. 色は既存の deadline 系（赤系が自然）を CSS 変数化。tentative（`@due?:`）は半透明＋?（issue-calendar-phase004-003 のクラスと組み合わせ）。
5. クリック挙動は既存 item と同じ（onItemClick 相当が deadline でも発火。エディタジャンプが効くこと）。
6. deadline は**ドラッグ・リサイズ非対応**（期限の変更は重い操作。エディタでの明示変更に限定 — gantt 側 ◆ と同じ理由）。既存 DnD 対象から除外する分岐を確認。

### 実装の要点・つまずき
- 「◄ が左端」の意味: 時間は左→右へ流れるので、**締切線の左端に矢印がある＝「ここより手前で終わらせる」**という視覚。矢印を右端に付けると逆の意味に見えるので注意（オーナー指定は左端）。
- 週の複数日にまたがる期間 deadline は、既存の複数日 allday バーの分割描画（週跨ぎ）ロジックに乗せる。
- 月表示は帯が細いので、太線＋◄ の簡略版（線＋端点マーク）でよい。

### TODO
- [ ] 現行 deadline 描画の調査（履歴に記録）
- [ ] 一点（終日/時刻あり）・期間の 3 描画パターン実装
- [ ] DnD 非対象化の確認
- [ ] lib テスト見直し（既存 deadline テストの期待値刷新）＋新テスト、本体 E2E 回帰

### 受け入れ基準
- 一点 deadline が太線＋左端 ◄ で描かれる（終日帯／時刻位置の両方）。
- 期間 deadline が期間全体の線＋終端 ◄ で描かれる。
- deadline はドラッグできない。クリックでエディタジャンプは効く。
- lib テスト・本体 `npm run test:obs:e2e` 全通過。

### テスト観点
- 3 描画パターンのクラス/構造 unit。
- 週跨ぎ期間 deadline の分割。
- 既存 task/appointment 描画の回帰。

### 履歴（追記のみ）
- 2026-07-04 — 起票。

---

## 3. メタデータ
- id: issue-calendar-phase004-002__deadline-line-rendering
- status: open
- phase: 004
- target_repo: ../calendar-for-mywork
- related_issues: issue-phase004-000, issue-phase004-004（deadline item の供給側）, issue-calendar-phase004-003
- created: 2026-07-04
- updated: 2026-07-04
