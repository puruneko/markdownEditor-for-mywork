# `@due` の終日イベント射影・カレンダー view 切替

## 1. 課題と方針  — 人間が読む

### このissueで解決すること
カレンダー変換は現状 `@schedule`（開始〜終了レンジ）中心で、**時刻を持たない `@due` のタスクがカレンダーに現れない**。「いつまで」しか決まっていないタスクが視界から消えるのは抜け漏れの温床（プラン §4.2 SHOULD）。

また、カレンダーの **日/週/月/アジェンダの view 切替が UI として確立していない**。期限の見える化と、用途に応じた粒度切替を本 issue でまとめて入れる。

### 方針
- `ast-to-calendar.ts` に、`@due`（時刻なし）を**終日（all-day）イベント**として射影するパスを追加（既存の `@schedule` パスは維持）。
- ビュー側ライブラリ（calendar-for-mywork）へ view mode（month/week/day/agenda）を切替プロップとして渡し、CalendarView 上に切替 UI を置く。

---

## 2. 進捗・実装メモ  — AIが読む

### 遵守事項（毎回）
- 着手時に**一度だけ** `project/governance/` を確認（`AI_RUNTIME_RULES.md` のロード順）。
- **テスト観点とテストコードは毎回すべて見直す**（`TESTING_STANDARD.md` 準拠）。

### 依存
- なし（既存のカレンダー変換・索引の上で完結）。`issue-phase001-001` の集約スコープと整合させる。

### 既存資産の再利用（必読・実装前に読む）
- `src/lib/calendar/ast-to-calendar.ts` / `.test.ts` … 射影ロジックの追加先。`@schedule` 射影と**同じ出力型**に `@due` 終日を足す。
- `src/lib/calendar/calendar-to-ast.ts` ＋ `src/lib/calendar/markdown-patch.ts` … 終日イベントをドラッグした時の書き戻し（`@due` 更新）。射影で付けた識別子で書き戻し先を一意化する。
- `src/views/CalendarView.ts` / `CalendarViewMount.svelte` … view mode プロップの受け渡しと切替 UI の設置先。
- `src/lib/parser/schedule-normalize.ts` … `@due` の正規形（日付のみ）解釈。

### 仕様（確定事項：迷ったらこれに従う）
- `@due`（時刻なし）→ その日の**終日帯**に 1 イベント。`@due` に時刻がある場合は時間グリッドへ（`@schedule` と同様）。
- 同一タスクが `@schedule` と `@due` を両方持つ場合は**両方表示**（重複ではなく別性質のイベント）。色/ラベルで区別。
- view mode は month / week / day / agenda の 4 種。既定は month。選択値は設定に永続化。
- 終日イベントを別日へドラッグ → `@due` を書き戻し（`markdown-patch` 基盤を使用）。時刻は付けない。
- 完了タスクの扱い（表示/淡色/非表示）は既存 `@schedule` 表示の挙動に合わせる。

### 実装の要点・つまずき
- 射影は純関数に保ち、`@due`/`@schedule` の両パスを 1 つの出力配列へ合流させる。識別子で書き戻し先（どちらのメタか）を区別できるようにする。
- view 切替はライブラリ側のプロップで完結するか要確認。プロップが無ければ最小の追従改修に留める（ライブラリは `file:` 参照の自作 `calendar-for-mywork`）。

### TODO
- [ ] `ast-to-calendar.ts` に `@due` 終日射影パスを追加（出力にメタ種別の識別子を付与）。
- [ ] 終日イベントのドラッグ → `@due` 書き戻し（`markdown-patch`）。
- [ ] CalendarView に month/week/day/agenda 切替 UI を追加し、選択を設定へ永続化。
- [ ] テスト追加・全見直し。

### 受け入れ基準（すべて満たすこと）
- 時刻なし `@due` タスクが該当日の終日帯に表示される。
- `@schedule` と `@due` を併せ持つタスクは両方が区別可能に表示される。
- 終日イベントを別日へドラッグすると `@due` が書き戻る。
- view を month/week/day/agenda に切替でき、選択が再起動後も保持される。

### テスト観点
- `vitest` 単体: `@due`（時刻なし/時刻あり）を含む AST が、終日/時間グリッドへ正しく射影されること。
- `@schedule`＋`@due` 併存タスクで 2 イベント生成されること。
- 終日ドラッグの書き戻しが `@due` のみを更新すること（`@schedule` を壊さない）。

### 履歴（追記のみ）
- 2026-06-30 — 起票（プラン §4.2・付録 Issue 候補 F、Phase2 SHOULD）。

---

## 3. メタデータ
- id: issue-phase002-006__due-allday-and-calendar-view-switch
- status: open
- phase: 002
- related_specs: なし（仕様は本issueに内包）
- related_decisions:
- target_files: src/lib/calendar/ast-to-calendar.ts, src/lib/calendar/markdown-patch.ts, src/views/CalendarView.ts, src/views/CalendarViewMount.svelte, src/settings.ts
- created: 2026-06-30
- updated: 2026-06-30
