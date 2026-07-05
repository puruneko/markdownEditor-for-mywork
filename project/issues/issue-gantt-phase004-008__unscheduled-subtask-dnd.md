# [gantt] 期間なしサブタスクの DnD 予定化（onSchedule コールバック）

## 1. 課題と方針  — 人間が読む

### このissueで解決すること
issue-gantt-phase004-007 で表示した**期間なしサブタスクのテキスト行**を、タイムライン上へドラッグすると**その場で期間が設定される**ようにする。「タスクを書き出す → ガント上で日程に割り付ける」という時間ブロッキングの中核操作で、オーナーの P2 課題（いつやるかを決める）への直接回答。

**責務分界**: ライブラリはドロップ位置から日時を計算して `onSchedule(nodeId, start, end)` を**コールバックするだけ**。Markdown への `@schedule` 書き込みは本体（既存 upsert-meta 経由）。この分担は既存のバードラッグ→書き戻しと同じパターン。

### 方針
Unscheduled Tray（issue-phase003-001、open）の「未予定→ドラッグで予定化」と**同じ操作概念**。コールバック署名・デフォルト期間長の扱いを共通にし、本体側のハンドラを共用できる形にする（同じ操作が 2 箇所で違う挙動になるのを防ぐ）。

---

## 2. 進捗・実装メモ  — AIが読む

### 遵守事項（毎回）
- **実装前に本体リポジトリの `project/governance/`・`issue-phase004-000__phase-overview.md`・`issue-gantt-phase004-000__gantt-overview.md` を必ず読むこと。** issue-gantt-phase004-007 完了が前提。
- **既存テストの見直しは機能実装と同等に重要。** 既存バードラッグ（drag-handler）のテスト・本体 E2E の「バードラッグで @schedule が更新される」に影響しないこと（回帰確認必須）。

### 対象・既存資産
- lib: 既存のバードラッグ実装（mouse イベント＋window リスナーの drag-handler。着手時に所在特定）。**同じイベント機構に乗せる**（新しい DnD 機構を作らない）。
- 本体: `src/lib/gantt/GanttTab.svelte` 相当のコールバック受け口、`src/lib/patch/upsert-meta.ts`（@schedule 書き込み。`?` なしで書く）、`src/settings.ts` の `defaultDurationMin`（**既存設定。デフォルト期間長 60 分**。新設定を作らずこれを使う）。

### 仕様
1. 期間なし行のテキストを mousedown → タイムライン上へドラッグ → ドロップ位置の日時を start とする。
2. **期間長**: ドロップ時点では `defaultDurationMin`（本体から prop `defaultDurationMinutes?: number` で受け取る。lib デフォルト 60）。end = start + 期間長。
3. ドラッグ中はゴースト（半透明の仮バー）をカーソル位置に表示（ドロップ先が視覚的に分かること）。
4. ドロップで `onSchedule(nodeId: string, start: DateTime, end: DateTime)` を 1 回だけ発火。ライブラリは自分でノードの start/end を書き換え**ない**（データは常にホストから一方向で来る。書き戻し→再パース→再描画のループは既存バードラッグと同じ）。
5. 日時の丸め: ドロップ位置は 15 分単位に丸める（ズームが日単位のときは日単位＝その日の 09:00 開始とする。開始時刻のデフォルトはハードコードせず prop `defaultStartHour?: number`（デフォルト 9）にする — 汎用性維持）。
6. 本体側: onSchedule 受領 → upsert-meta で `@schedule: <start>/<end>` を対象タスクへ書き込み（正規位置＝タスク行直下、省略記法は使わず正規形で書く）。

### 実装の要点・つまずき
- **既存バードラッグとの干渉**: 期間なし行はバーが無いのでヒット判定は行テキスト要素。mousedown のターゲット判別を明確に分け、バードラッグの回帰テストを必ず実行。
- ドロップがタイムライン外（ツリー側・ヘッダ）の場合はキャンセル（onSchedule を発火しない）。
- E2E は `tests/obs-e2e/helpers/drag.ts` の `dispatchMouseDrag` を流用可能（mousedown=行要素、move/up=window）。**本体 E2E に「期間なしサブタスクをドラッグ → @schedule が Markdown に書かれ、バーが描画される」を必ず追加**（書き戻しと DOM の両面アサート。`project/knowledge/obsidian-plugin-testing.md` §4.2/§4.5 必読）。

### TODO
- [ ] lib: 行ドラッグ＋ゴースト＋丸め＋onSchedule
- [ ] lib: prop（defaultDurationMinutes / defaultStartHour）
- [ ] 本体: onSchedule → upsert-meta 配線
- [ ] 両リポジトリのテスト見直し＋新設、E2E 追加（バードラッグ回帰含む）

### 受け入れ基準
- 期間なしサブタスク行をタイムラインへドラッグすると、Markdown に `@schedule` が正規形で書かれ、再描画でバーになる（E2E で両面アサート）。
- 既存バードラッグの挙動が不変（回帰）。
- タイムライン外ドロップで何も起きない。
- 両リポジトリのテストと本体 `npm run test:obs:e2e` 全通過。

### テスト観点
- 丸めロジック unit（15 分単位・日単位・defaultStartHour）。
- onSchedule の発火回数（1 回）とキャンセル系。

### 履歴（追記のみ）
- 2026-07-04 — 起票。

---

## 3. メタデータ
- id: issue-gantt-phase004-008__unscheduled-subtask-dnd
- status: open
- phase: 004
- target_repo: ../ganttchart-for-mywork（＋本体 src/lib/gantt/ ほか）
- related_issues: issue-phase004-000, issue-gantt-phase004-007（先行必須）, issue-phase003-001（操作概念の共通化）
- created: 2026-07-04
- updated: 2026-07-04
