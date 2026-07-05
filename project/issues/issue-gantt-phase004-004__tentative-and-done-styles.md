# [gantt] 仮置き（半透明＋?）と完了（done）の描き分け

## 1. 課題と方針  — 人間が読む

### このissueで解決すること
1. **仮置き**: `@schedule?:` 等の仮置き予定を、確定予定と見分けられるようにする（オーナー要望: 透明度を上げ「?」マークを表示）。仮置きが確定と同じ見た目だと「確定したつもり」事故が起きる。
2. **done**: 完了タスクのバーが未完と同じ見た目で、「終わったもの」と「これからやるもの」がガント上で区別できない。**バーは消さない**（実績の記録として残す — オーナーの progress 報告ニーズに将来つながるため）。

### 方針
GanttNode に `tentative?: boolean` と `status?: string` を追加し、描画スタイルを分岐するだけ。値の意味づけは本体（issue-phase004-004）。

---

## 2. 進捗・実装メモ  — AIが読む

### 遵守事項（毎回）
- **実装前に本体リポジトリの `project/governance/`・`issue-phase004-000__phase-overview.md`・`issue-gantt-phase004-000__gantt-overview.md` を必ず読むこと。** prop 型の正は issue-phase004-004。
- **既存テストの見直しは機能実装と同等に重要。** バー描画のクラス/スタイル分岐テストを更新・追加。

### 対象・既存資産
- `../ganttchart-for-mywork/src/types.ts` … `tentative?: boolean` / `status?: string` を GanttNode に追加。
- `src/components/GanttTaskBar.svelte` … バー描画。既存の `gantt-bar--task` 等のクラス設計に倣い modifier クラスで分岐する。

### 仕様
1. **tentative**:
   - バー（および plan 枠・milestone。issue-gantt-phase004-002/003 の成果物）を `opacity: 0.5` 程度に。
   - バー右端の近くに「?」バッジ（小さい円＋?、または単純なテキスト）。SVG `<text>` で可。
   - クラス例: `gantt-bar--tentative`。
2. **done**（`status === 'done'` のとき）:
   - 彩度を落とす（グレー寄せ）＋バー内または左に ✓ マーク。
   - クラス例: `gantt-bar--done`。
   - tentative と done が同時なら done を優先（完了した仮予定は「終わった事実」が勝つ）。
3. status は `'todo' | 'doing' | 'blocked' | 'hold' | 'done'` が来る想定だが、**ライブラリは 'done' 以外を特別扱いしない**（他ステータスの色分けは将来の別 Issue。今回のスコープを広げない）。
4. 色・透明度は CSS 変数化。

### 実装の要点・つまずき
- ドラッグ挙動: tentative バーも**ドラッグ可**（仮置きの日程調整はよくある操作）。ドラッグ書き戻しで `?` が保持されるのは本体 upsert-meta の責務（issue-phase004-002 で実装済みのはず — 結合確認は本体 E2E で）。
- `?` バッジがバー幅より大きい極小バーのケース: バッジをバー外右側に出す等、潰れない配置にする。

### TODO
- [ ] 型追加（tentative / status）
- [ ] tentative 描画（バー・枠・◆ に適用＋?バッジ）
- [ ] done 描画（彩度＋✓、tentative との優先順位）
- [ ] lib テスト見直し＋新テスト、本体 E2E 回帰

### 受け入れ基準
- tentative の要素が半透明＋?付きで描かれ、ドラッグは可能。
- done のバーがグレー寄せ＋✓で描かれ、未完バーは従来どおり（回帰）。
- tentative かつ done は done 表示。
- lib テスト・本体 `npm run test:obs:e2e` 全通過。

### テスト観点
- クラス付与の分岐 unit（tentative / done / 両方 / どちらも無し）。
- 極小バーでのバッジ配置。

### 履歴（追記のみ）
- 2026-07-04 — 起票。

---

## 3. メタデータ
- id: issue-gantt-phase004-004__tentative-and-done-styles
- status: open
- phase: 004
- target_repo: ../ganttchart-for-mywork
- related_issues: issue-phase004-000, issue-phase004-004（prop 型の正）, issue-gantt-phase004-002, issue-gantt-phase004-003
- created: 2026-07-04
- updated: 2026-07-04
