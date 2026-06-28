# 繰り返しタスク（@repeat / RRULE 展開）

## 1. 課題と方針  — 人間が読む

### このissueで解決すること
「毎月第2・第4金曜の定期清掃」のような繰り返し業務を表現できない。記法ガイドの実例にすら登場するのに、現状は 1 回分の予定しか書けない。

この issue では、タスクに繰り返しルール `@repeat` を追加し、`@schedule` を起点に**表示範囲分の発生回（オカレンス）をカレンダー・ガントへ展開**する。Markdown 本文は 1 行のまま（展開はビュー側だけ）で書き戻しの複雑化を避ける。

### 方針
- メタキー `@repeat` を追加（値は RFC 5545 RRULE のサブセット。例 `FREQ=WEEKLY;BYDAY=FR;INTERVAL=2`）。
- `rrule` ライブラリで `@schedule` 開始を起点に表示範囲のオカレンスを生成し、カレンダー/ガントへ投入。

---

## 2. 進捗・実装メモ  — AIが読む

### 遵守事項（毎回）
- 作業着手の開始時に**一度だけ** `project/governance/` を確認し、本プロジェクトのルールを確認すること（`AI_RUNTIME_RULES.md` のロード順に従う）。
- **テスト観点とテストコードは、毎回すべてを見直すこと**（`TESTING_STANDARD.md` 準拠）。

### 既存資産の再利用（必読・実装前に読む）
- `src/lib/parser/meta-keys.ts` … `META_KEYS` に `repeat` を追加。型 `MetaKey` も自動で増える。
- `src/lib/parser/plugins/remark-meta-fields.ts` … `@キー` パースの実装。ここに `repeat` を通す（既存キーと同じ流儀）。
- `src/lib/parser/types.ts` の `Meta` … `repeat?: string` を追加。
- `src/lib/parser/ast-to-md.ts` ＋ `src/lib/parser/ast-to-md.test.ts` … シリアライズのラウンドトリップ。`@repeat` が消えない/変形しないことを必ず担保。
- `src/lib/calendar/ast-to-calendar.ts` / `src/lib/gantt/ast-to-gantt.ts` … オカレンス展開を反映する変換。既存の `@schedule` 1 件展開のロジックを基準に拡張。
- 新規依存: `package.json` に `rrule` を追加。

### 仕様（確定事項：迷ったらこれに従う）
- オカレンスの**終了時刻 = 初回 `@schedule` の所要時間を維持**（開始＋duration）。
- 展開は**ビュー側のみ**。本文・AST のタスク数は増やさない。各オカレンスに「繰り返し由来」フラグと**元タスクの `nodeId`** を持たせ、クリックは元の 1 行へジャンプ。
- **完了挙動（チェックで次回生成等）は本 issue の対象外**。表示のみ（チェックしても繰り返しは変化しない）。将来対応は TODO に残す。
- 不正な `@repeat` は例外を投げず**展開スキップ**（リント issue が警告）。
- 展開純関数: `expandOccurrences(meta, rangeStart, rangeEnd) → {start,end}[]` の形に切り出す（テスト容易化）。

### 実装の要点・つまずき
- パース・型・シリアライズ・展開・変換の 5 箇所を**漏れなく**触る（どれか欠けるとラウンドトリップで `@repeat` が落ちる）。
- 既存の非繰り返しタスクの挙動は不変（回帰させない）。

### TODO
- [ ] `meta-keys`/`remark-meta-fields`/`types`/`ast-to-md` に `@repeat` を追加（パース・型・シリアライズ）。
- [ ] `rrule` 追加し `expandOccurrences` を実装。
- [ ] `ast-to-calendar`/`ast-to-gantt` に展開反映（元 nodeId 紐付け）。
- [ ] テストを追加・全見直し（下記テスト観点）。

### 受け入れ基準（すべて満たすこと）
- `@repeat: FREQ=WEEKLY;BYDAY=FR;INTERVAL=2` が表示範囲内の該当金曜すべてに展開表示。
- 各オカレンスの所要時間が初回 `@schedule` と一致。
- パース→シリアライズで `@repeat` 保持（ラウンドトリップ）。
- `@repeat` 無しタスクは従来どおり（回帰なし）。
- 不正値で例外を投げず展開スキップ。

### テスト観点
- `vitest` 単体: `expandOccurrences` を WEEKLY/MONTHLY/INTERVAL/BYDAY × 範囲で。
- ラウンドトリップ（`ast-to-md.test.ts` に `@repeat` ケース追加）。
- `ast-to-calendar`/`ast-to-gantt` の展開出力（件数・start/end・元 nodeId）。
- 回帰: 既存の非繰り返しテスト通過。

### 履歴（追記のみ）
- 2026-06-28 — 起票。
- 2026-06-28 — Haiku 実装可能な水準へ加筆（触る 5 箇所・確定仕様を内包）。

---

## 3. メタデータ
- id: issue-phase002-001__recurring-tasks-rrule
- status: open
- phase: 002
- related_specs: なし（仕様は本issueに内包）
- related_decisions:
- target_files: src/lib/parser/(meta-keys|types|ast-to-md).ts, src/lib/parser/plugins/remark-meta-fields.ts, src/lib/recurrence/expand.ts, src/lib/calendar/ast-to-calendar.ts, src/lib/gantt/ast-to-gantt.ts, package.json
- created: 2026-06-28
- updated: 2026-06-28
