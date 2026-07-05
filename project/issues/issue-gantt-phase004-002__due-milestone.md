# [gantt] due のマイルストン表示（一点◆・期間は ◆〜◆＋塗り）

## 1. 課題と方針  — 人間が読む

### このissueで解決すること
オーナー決定（時間メタ 3 層モデル）: `@due`（期限）はガント上で**マイルストン**として表示する。一点なら ◆、期間指定なら**始点と終点に ◆＋間を塗りつぶし**。現状ガントは schedule バーしか描けず、「いつまでに終わらせるか」が見えない — オーナーの根本課題（期限を落として怒られる）に直結する表示。

### 方針
ライブラリは意味を知らず、`milestone` prop（日時 1 つ or 期間）を受けて描くだけ。値の供給は本体の ast-to-gantt（issue-phase004-004）。

---

## 2. 進捗・実装メモ  — AIが読む

### 遵守事項（毎回）
- **実装前に本体リポジトリの `project/governance/`・`issue-phase004-000__phase-overview.md`・`issue-gantt-phase004-000__gantt-overview.md` を必ず読むこと。** prop 型の正は issue-phase004-004。食い違いがあればそちらを正とする。
- **既存テストの見直しは機能実装と同等に重要。** GanttNode 型変更により lib 内の型テスト・描画計算テストが影響を受ける。座標計算のテストに新ケース（milestone の x 座標）を必ず追加。

### 対象・既存資産
- `../ganttchart-for-mywork/src/types.ts` … GanttNode 型（start/end は luxon DateTime）。ここに milestone を追加。
- `src/components/GanttTimeline.svelte` / `GanttTaskBar.svelte` … バー描画（SVG rect）。日時→x 座標の変換関数（core/ か utils/ にあるはず。着手時に特定）を流用する。

### 仕様
1. 型追加:
   ```ts
   milestone?: DateTime | { start: DateTime; end: DateTime }
   ```
2. 描画（タスク行のタイムライン上）:
   - 一点: その日時の x 位置に ◆（SVG の rotate した rect か polygon）。バーと同じ行に重ねて描く（バーが無い＝due のみのタスクは ◆ 単独）。
   - 期間: start と end に ◆、間を薄い塗り（バーと区別できる低彩度／低透明度）で結ぶ。
   - ◆ のサイズは行高の 6〜7 割目安。既存のバー色設計（GanttNodeStyle）と衝突しない専用色（CSS 変数化し、ホストが上書き可能に）。
3. ◆ にホバータイトル（`<title>`）で日時文字列を出す（ツールチップの簡易版。凝った UI は作らない）。
4. milestone は**ドラッグ対象外**（既存のバー drag-handler に反応させない）。理由: due の変更は「期限の変更」であり誤操作リスクが高い。エディタでの明示的変更に限定する（オーナーの P2 課題=期限厳守、の保護）。

### 実装の要点・つまずき
- x 座標変換は必ず既存のバーと同じ関数を使う（独自計算するとズームやスクロールで ◆ だけズレる）。
- タイムラインの表示範囲計算（最小/最大日付）に milestone を**含める**こと。含めないと「due が表示範囲外で ◆ が見えない」事故になる。範囲計算の関数（descendantDateRange 相当が lib 側にもあるか確認）を更新し、そのテストも更新。

### TODO
- [ ] GanttNode に milestone 追加
- [ ] ◆／期間◆〜◆ の描画・CSS 変数・title
- [ ] 表示範囲計算への算入
- [ ] ドラッグ非対象の確認
- [ ] lib テスト見直し＋新テスト、本体 E2E 回帰

### 受け入れ基準
- milestone（一点）で ◆ が正しい x 位置に描かれる。バー無しタスクでも描かれる。
- milestone（期間）で ◆〜◆＋塗りが描かれる。
- ◆ をドラッグしても何も起きない。バーのドラッグは従来どおり動く（回帰）。
- lib テスト・本体 `npm run test:obs:e2e` 全通過。

### テスト観点
- 座標計算 unit（一点・期間・表示範囲境界）。
- バー＋◆ 併存／◆ 単独／milestone なし（回帰）の描画分岐。

### 履歴（追記のみ）
- 2026-07-04 — 起票。

---

## 3. メタデータ
- id: issue-gantt-phase004-002__due-milestone
- status: open
- phase: 004
- target_repo: ../ganttchart-for-mywork
- related_issues: issue-phase004-000, issue-phase004-004（prop 型の正）
- created: 2026-07-04
- updated: 2026-07-04
