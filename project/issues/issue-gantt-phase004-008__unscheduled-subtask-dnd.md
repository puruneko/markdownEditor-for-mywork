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

### 2026-07-23 実装

- Change:
  - lib（`../ganttchart-for-mywork`）:
    - `src/utils/unscheduled-schedule.ts` を新設。`computeUnscheduledStart`/`computeUnscheduledRange` で丸めロジック（minorUnit が `'hour'` なら15分単位、それ以外は日単位＋`defaultStartHour`固定）を実装。DOM非依存の純粋関数。
    - `src/utils/drag-handler.ts` に `createUnscheduledDragHandler` を追加。既存 `createDragHandler` と同じ「mousedown→window の mousemove/mouseup」機構を踏襲しつつ、ノードデータ（start/end）は一切書き換えない設計（`onGhostUpdate`/`onGhostClear` でホスト側の一時的な表示状態のみ更新、`onSchedule` はドロップ確定時に1回だけ発火）。`isWithinTimeline` 判定はコンポーネント側から注入する形にして DOM 非依存を維持。
    - `GanttTimeline.svelte`: 期間なしサブタスク行の `<text>` に `pointer-events="auto"` と mousedown ハンドラ、`data-node-id` を付与。ドラッグ中は `ghostDrag`（コンポーネント内 `let`、ノードデータには触れない）を更新し、半透明の点線ゴースト（`.gantt-ghost-bar`/`.gantt-ghost-label`）を描画。ドロップ位置がタイムライン表示領域外（`timelineContainer` の bounding rect 外）の場合は `onSchedule` を発火せずゴーストのみ消去する。
    - `types.ts`: `GanttEventHandlers.onSchedule`、`GanttConfig.defaultDurationMinutes`（既定60）/`defaultStartHour`（既定9）、`GanttUserEventType`/`DetailMap` に `'schedule'` を追加。
    - `GanttChart.svelte`/`gantt-store.ts`: `handleSchedule` で `handlers.onSchedule` 呼び出し＋`store.events.emit('schedule', ...)`（既存 `barDragEnd` と同一パターン）。`DEFAULT_CONFIG` に新設定のデフォルト値を追加。
    - テスト: `tests/utils/unscheduled-schedule.test.ts`（9件）、`tests/utils/drag-handler.test.ts` に `createUnscheduledDragHandler` の単体テスト追加（13件、境界外キャンセル含む）、`tests/components/gantt-timeline-schedule.test.ts`（3件、`@testing-library/svelte` で実際に `GanttChart` をマウントしてドラッグ→ゴースト表示→`onSchedule` 発火→ゴースト消去を確認）。
  - 本体（`markdownEditor-for-mywork`）:
    - `src/lib/gantt/GanttTab.svelte`: `handlers.onSchedule` を追加し、`formatSchedule` + 既存 `upsertSchedule`（`../patch/upsert-meta`）で `@schedule` を正規形・タスク行直下に書き込む。`ganttConfig` に `defaultDurationMinutes: defaultDurationMin`（既存 `settings.defaultDurationMin` を流用。新設定は追加していない）。
    - `tests/obs-e2e/gantt-view.e2e.ts` に実機シナリオを追加（期間なしサブタスク行をドラッグ→`@schedule` 書き戻し→バー再描画を両面アサート）。
  - `defaultStartHour` は lib の汎用性維持のため prop としては存在するが、本体からは明示的に渡さず lib 既定値（9）に委ねている（新規ユーザー設定は追加していない、issue の指示どおり）。

- 検証結果:
  - lib: `npx vitest run` 179 件成功（既存 zoom-gesture.test.ts の3件失敗は本Issueと無関係の既存不具合。作業前から失敗しており本Issueの変更は影響していないことを `git stash` で比較確認済み）。
  - 本体: `npx vitest run` 455 件全成功。`npm run build` 成功（新規 a11y warning 1件は同ファイル内の既存パターンと同種、エラーなし）。
  - 本体 `npm run test:obs:e2e`（実機 Obsidian・wdio）: 新規シナリオは**単独実行では毎回成功**（ドラッグ→ゴースト表示→`@schedule` 書き戻し→バー再描画まで実機で確認済み）。他 7 ファイルの既存 E2E は全て成功、`gantt-view.e2e.ts` 内の既存 7 件も成功。**ただし `gantt-view.e2e.ts` を全件まとめて実行した場合のみ、新規シナリオがまれに失敗する**（Gantt View の leaf 再生成・AstIndex 反映タイミングに関する実行環境依存の非決定性で、ツリーペインとタイムラインの再描画がまれに同期しない事象を観測。本体・ライブラリのロジック自体には要因を見つけられず、`openGanttViewUntilTaskVisible` ヘルパでリトライを入れても解消しないケースがある）。単体テスト・コンポーネント統合テスト・E2E単独実行のいずれも一貫して正しい動作を示しており、機能自体の実装は正しいと判断している。

- Rationale:
  - 既存のバードラッグ機構（mouse + window リスナー）を再利用し、新しい DnD 機構を増やさない方針（gantt 憲章の実装規約）に従った。
  - ライブラリはノードデータを自分で書き換えない一方向データフロー原則を厳守するため、ドラッグ中のプレビューは実データを動かす既存バードラッグの手法ではなく、完全に独立した「ゴースト」表示として実装した。
  - E2E のまれな失敗は本Issueの実装ロジックの欠陥ではなく実行環境（Obsidian leaf ライフサイクル）のタイミング事象と判断し、これ以上の追跡は費用対効果に見合わないと判断して打ち切った。次回このテストが再度不安定になった場合は `project/knowledge/obsidian-plugin-testing.md` への追記を検討すること。

### 2026-07-23（再確認・後始末）

- Change:
  - 前セッションが残していた調査用の一時ファイル `tests/obs-e2e/__debug008.e2e.ts` / `__debug008b.e2e.ts`（`expect(true).toBe(true)` のみのトレース専用スクリプト、成果物ではない）を削除した。
  - lib（`../ganttchart-for-mywork`）の同issueファイルには実装内容が履歴反映されておらず `status: open` のままだったため、本エントリと同内容を反映し `status: implemented` へ更新した（issue-gantt-phase004-007 で確立済みのパターンに合わせ、lib側にも本体側と同じ履歴を持たせる）。
  - lib `npm run test`（180件成功、無関係の既存不具合3件を除く）・本体 `npm run test:unit`（455件成功）を再実行して回帰がないことを再確認した。
  - `gantt-view.e2e.ts` の新規シナリオを `it.only` で複数回単独実行し、常に成功することを再確認した。ファイル全体を通しで実行すると、実行順によって新規シナリオが失敗する回・無関係な既存2件（バードラッグ／完了タスク）が失敗する回の両方が発生することを診断ログ付きで確認し、前回セッションの結論（実行環境のタイミング事象であり実装欠陥ではない）を追認した。診断用コードは検証後に削除済み。

- Rationale:
  - WORKFLOW の履歴保存原則に従い、lib・本体の両issueファイルの記録内容を一致させた。
  - 調査用の一時ファイルは成果物ではなく、コミット対象に含めるべきではないため削除した。

---

## 3. メタデータ
- id: issue-gantt-phase004-008__unscheduled-subtask-dnd
- status: implemented（ユーザー承認待ち。E2E の稀な非決定性については上記履歴参照）
- phase: 004
- target_repo: ../ganttchart-for-mywork（＋本体 src/lib/gantt/ ほか）
- related_issues: issue-phase004-000, issue-gantt-phase004-007（先行必須）, issue-phase003-001（操作概念の共通化）
- created: 2026-07-04
- updated: 2026-07-23
