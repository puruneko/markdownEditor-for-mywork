# リマインド通知

## 1. 課題と方針  — 人間が読む

### このissueで解決すること
期限（`@due`）や開始時刻（`@schedule`）が来ても**何も起きない**。「気づかず期限超過」は最も典型的な抜け漏れであり、本プロダクトの哲学「抜け漏れ防止」の直接的な未達領域である（プラン §4.3・§5.3 #7）。

本 issue では、集約インデックス（`issue-phase001-001`）が把握する全タスクの直近の開始/期限を常駐タイマーで監視し、Obsidian の `Notice`（デスクトップは Notification API 併用）でリマインドする。

### 方針
- プラグイン常駐タイマーで、スコープ内タスクの直近 `@schedule` 開始 / `@due` を監視。
- 既定リードタイム（例: 開始10分前）を設定化。`@reminder` メタで個別指定も可能にする。
- 通知クリックで該当タスク行へジャンプ（既存のカーソルジャンプを再利用）。

---

## 2. 進捗・実装メモ  — AIが読む

### 遵守事項（毎回）
- 着手時に**一度だけ** `project/governance/` を確認（`AI_RUNTIME_RULES.md` のロード順）。
- **テスト観点とテストコードは毎回すべて見直す**（`TESTING_STANDARD.md` 準拠）。

### 依存
- `issue-phase001-001__multi-source-ast-index`（`AstIndex.getAllTaskNodes` / `onChange` / `resolveLine`）… 監視対象の供給源。

### 既存資産の再利用（必読・実装前に読む）
- `src/sync/ast-index.ts` … `getAllTaskNodes(scope)` で日時付きタスクを取得、`onChange` で索引更新に追従、`resolveLine(path,nodeId)` でジャンプ先行を解決。
- `src/lib/parser/schedule-normalize.ts` … `@schedule`/`@due` の正規形（ISO）パース。通知時刻の算出はここを通す（独自パースを書かない）。
- `src/lib/parser/meta-keys.ts` … `@reminder` 追加時はここと `remark-meta-fields`・`Meta` 型を拡張。
- `src/plugin.ts` … 常駐タイマーの登録/破棄（`registerInterval` 等）、カーソルジャンプ実装。
- `src/settings.ts` … 既定リードタイム・ON/OFF 設定の追加先。

### 仕様（確定事項：迷ったらこれに従う）
- 監視対象は **未完（status ≠ done）** かつ 未来の `@schedule` 開始 または `@due` を持つタスク。
- 既定リードタイム（分）は設定値。`@reminder`（例: `@reminder: -10m` または絶対時刻）があればそれを優先。
- 同一タスク・同一発火時刻の**多重通知を防止**（発火済みキーを記録、索引更新で再構築しても重複しない）。
- `@reminder` を導入する場合は `Meta.reminder?: string` を追加し `META_KEYS` に登録。導入可否が曖昧なら**まず既定リードタイムのみ**で実装し、`@reminder` は TODO に残す。
- タイマー精度は分単位で十分。1 分ごとのチェックループで可。

### 実装の要点・つまずき
- 索引が変わるたびに発火スケジュールを再構築する設計にし、`onChange` 購読は破棄時に解除。
- 過去日時の `@due`（既に超過）は起動時に一括通知すると煩い → 「超過まとめ通知」は別挙動 or 抑制（既定は未来発火のみ）。
- 発火時刻の計算は必ず `schedule-normalize` の正規形を経由（タイムゾーン/省略記法の揺れを持ち込まない）。

### TODO
- [ ] 「タスク集合 → 発火イベント列」を生成する純関数を新設（リードタイム適用・未完/未来フィルタ・多重排除）。
- [ ] 常駐タイマー（1 分ループ）で発火時刻を監視し `Notice`／Notification を表示。
- [ ] 通知クリック → `resolveLine` でカーソルジャンプ。
- [ ] 設定（ON/OFF・既定リードタイム）を `settings.ts` に追加。
- [ ] （任意）`@reminder` メタ対応（`Meta`・`META_KEYS`・`remark-meta-fields`）。
- [ ] テスト追加・全見直し。

### 受け入れ基準（すべて満たすこと）
- 未完タスクの開始/期限のリードタイム前に通知が出る。
- 通知クリックで該当行へジャンプする。
- 索引更新（日時変更・タスク削除）後に発火予定が正しく再構築され、重複通知が出ない。
- 通知 OFF 設定で一切発火しない。

### テスト観点
- `vitest` 単体: タスク集合＋現在時刻＋リードタイムから「発火イベント列」が正しく出る（未完/未来のみ・多重排除・`@reminder` 優先）。
- 索引更新で発火列が再構築され重複しないこと。
- 超過済み `@due` が既定では未来発火に含まれないこと。

### 履歴（追記のみ）
- 2026-06-30 — 起票（プラン §4.3・付録 Issue 候補 E、Phase2 SHOULD）。

---

## 3. メタデータ
- id: issue-phase002-005__reminder-notifications
- status: open
- phase: 002
- related_specs: なし（仕様は本issueに内包）
- related_decisions:
- target_files: src/plugin.ts, src/settings.ts, src/sync/ast-index.ts, src/lib/parser/meta-keys.ts
- created: 2026-06-30
- updated: 2026-06-30
