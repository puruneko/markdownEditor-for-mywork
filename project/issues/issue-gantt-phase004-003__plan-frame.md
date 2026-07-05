# [gantt] plan の点線枠表示（「この期間内でやる」枠）

## 1. 課題と方針  — 人間が読む

### このissueで解決すること
オーナー決定: `@plan` は「この期間の中でタスクを実施しなければならない」というバッファ込みの枠（WBS 的概念）で、ガント上では **schedule バーを包む点線枠**として表示する。これにより「枠は決めたが日時は未定」「枠の中のどこでやるか」が一目で分かる。

```
|- - - - - - plan：点線枠 - - - - - -|
|    ■■■■ schedule：バー ■■■■       |
|- - - - - - - - - - - - - - - - - -|
```

### 方針
`plan?: { start, end }` prop を受けてタスク行の背後に点線フレームを描くだけ。plan の意味・継承の解決は本体側（issue-phase004-003/004）で、**ライブラリには解決済みの値が来る**。

---

## 2. 進捗・実装メモ  — AIが読む

### 遵守事項（毎回）
- **実装前に本体リポジトリの `project/governance/`・`issue-phase004-000__phase-overview.md`・`issue-gantt-phase004-000__gantt-overview.md` を必ず読むこと。** prop 型の正は issue-phase004-004。
- **既存テストの見直しは機能実装と同等に重要。** 表示範囲計算・行描画のテストが影響対象。

### 対象・既存資産
- `../ganttchart-for-mywork/src/types.ts` … `plan?: { start: DateTime; end: DateTime }` を GanttNode に追加。
- `src/components/GanttTimeline.svelte` / `GanttTaskBar.svelte` … 行描画。plan 枠はバーより**背面**（SVG は描画順＝重なり順なので、枠を先に描く）。

### 仕様
1. 描画: タスク行に、plan.start〜plan.end の範囲で**角丸の点線枠**（`stroke-dasharray`、塗りなし or ごく薄い塗り）。行高いっぱいより少し内側（バーを包んで見えるように、バーより上下に 1〜2px 大きい）。
2. plan のみ（バーなし）のタスク: 点線枠だけを描く。「日時未定だが枠は確定」の表現（オーナー決定 Q2 の使い分け: `?`＝日時はあるが自信なし／plan のみ＝日時そのものが未定）。
3. 色は CSS 変数化（ホスト上書き可）。デフォルトは低彩度（枠は補助情報。バーより目立ってはいけない）。
4. 表示範囲計算に plan を含める（milestone と同様。issue-gantt-phase004-002 と同じ関数を触るため、**両 Issue を同一人が続けて実装するか、先行 Issue の変更を読んでから着手**すること）。
5. plan 枠は**ドラッグ・リサイズ非対応**（本フェーズでは表示のみ。枠の変更はエディタで行う）。

### 実装の要点・つまずき
- バーと枠の x 計算は同一関数を使う（ズレ防止）。
- `tentative`（issue-gantt-phase004-004）と組み合わさる場合（`@plan?:`）は枠も半透明＋`?` バッジ対象。本 Issue では「tentative が true なら opacity を落とす」だけ入れて、`?` バッジは 004-004 に任せる（重複実装しない）。

### TODO
- [ ] GanttNode に plan 追加
- [ ] 点線枠描画（バー背面・plan のみ対応・CSS 変数）
- [ ] 表示範囲計算への算入
- [ ] lib テスト見直し＋新テスト、本体 E2E 回帰

### 受け入れ基準
- plan＋schedule のタスクで、バーを包む点線枠が描かれる。
- plan のみのタスクで点線枠だけが描かれる。
- plan なしタスクの描画が従来と同一（回帰）。
- lib テスト・本体 `npm run test:obs:e2e` 全通過。

### テスト観点
- 座標 unit（枠がバーを内包する座標関係、plan のみ、範囲算入）。
- 描画分岐（plan あり/なし/plan のみ）。

### 履歴（追記のみ）
- 2026-07-04 — 起票。

---

## 3. メタデータ
- id: issue-gantt-phase004-003__plan-frame
- status: open
- phase: 004
- target_repo: ../ganttchart-for-mywork
- related_issues: issue-phase004-000, issue-phase004-004（prop 型の正）, issue-gantt-phase004-002（範囲計算が共通）, issue-gantt-phase004-004（tentative 装飾）
- created: 2026-07-04
- updated: 2026-07-04
