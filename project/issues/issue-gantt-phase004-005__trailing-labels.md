# [gantt] バー横の汎用ラベル表示（trailingLabels）

## 1. 課題と方針  — 人間が読む

### このissueで解決すること
オーナー要望: タスクバーの横に期間情報のほか**ステータス等のパラメータ**を表示したい。表示項目は設定で変えられる（デフォルトはステータスのみ）。

**責務分界（重要）**: 「何を表示するか」を決めるのは本体（設定 `ganttTrailingFields` → 文字列化。issue-phase004-004）。ライブラリは**受け取った文字列配列をバー右に描くだけ**。この分担なら将来「進捗率も出したい」が本体の設定追加だけで済み、ライブラリの汎用性が保たれる。

### 方針
`trailingLabels?: string[]` prop を GanttNode に追加し、バー右側に順番に描く。

---

## 2. 進捗・実装メモ  — AIが読む

### 遵守事項（毎回）
- **実装前に本体リポジトリの `project/governance/`・`issue-phase004-000__phase-overview.md`・`issue-gantt-phase004-000__gantt-overview.md` を必ず読むこと。** prop 型の正は issue-phase004-004。
- **既存テストの見直しは機能実装と同等に重要。** バー横に既に何か（期間テキスト等）を描いていれば、その描画テストとの整合を確認して更新する。

### 対象・既存資産
- `../ganttchart-for-mywork/src/types.ts` … `trailingLabels?: string[]` 追加。
- `src/components/GanttTaskBar.svelte` / `GanttTimeline.svelte` … バー右側の既存テキスト描画（期間表示があるか着手時に確認し、ある場合は**その後ろ**に続ける）。

### 仕様
1. バー右端の外側に、`trailingLabels` の各要素を区切り（` / ` またはスペース）で連結して 1 行描画。SVG `<text>`。
2. フォントサイズはバー内ラベルより小さめ、色は低コントラスト（補助情報）。CSS 変数化。
3. 空配列・未指定なら何も描かない（既存描画と完全一致 = 回帰ゼロ）。
4. タイムライン右端をはみ出す場合はそのまま（クリッピングはタイムラインの既存 overflow に従う。省略記号などの凝った処理は**しない** — スコープ限定）。
5. milestone（◆）だけのタスクは ◆ の右に描く。

### 実装の要点・つまずき
- ラベルの x 座標は「バー end の x ＋ マージン」。milestone 期間表示（issue-gantt-phase004-002）がある場合は max(バー end, milestone end) の右。先行 Issue の実装を読んでから着手。
- `<text>` の描画はズーム（dayWidth 変更）で再計算されること（既存バーラベルと同じ再計算経路に乗せる）。

### TODO
- [ ] 型追加
- [ ] 描画実装（位置・スタイル・空時の無描画）
- [ ] lib テスト見直し＋新テスト、本体 E2E 回帰

### 受け入れ基準
- `trailingLabels: ['Doing', 'P1']` がバー右に「Doing / P1」と描かれる。
- 未指定時の描画が従来と同一（回帰）。
- lib テスト・本体 `npm run test:obs:e2e` 全通過。

### テスト観点
- 配列 0/1/複数要素の描画分岐、バー/◆ それぞれの基準位置。

### 履歴（追記のみ）
- 2026-07-04 — 起票。

---

## 3. メタデータ
- id: issue-gantt-phase004-005__trailing-labels
- status: open
- phase: 004
- target_repo: ../ganttchart-for-mywork
- related_issues: issue-phase004-000, issue-phase004-004（値の組み立て側）, issue-gantt-phase004-002
- created: 2026-07-04
- updated: 2026-07-04
