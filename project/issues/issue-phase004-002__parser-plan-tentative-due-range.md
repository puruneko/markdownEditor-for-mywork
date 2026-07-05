# パーサー拡張：@plan メタ・仮置き `?` 修飾子・@due 期間対応

## 1. 課題と方針  — 人間が読む

### このissueで解決すること
時間メタ 3 層モデル（Spec: `project/specs/time-meta-model.spec.md`、issue-phase004-001 で起票）のうち、**パーサー（AST 生成）層**を実装する。現状パーサーは `@schedule` `@due` `@priority` `@dependsOn` `@tags` `@repeat` のみを認識し、以下ができない:
1. `@plan: 2026-07-07/07-11` — 「この期間内でやる」枠を表現できない。
2. `@schedule?: ...` のような **キー末尾 `?`（仮置き）** — 「仮の予定」を構造として持てないため、ビューが仮置きを描き分けられない。
3. `@due: 2026-07-10/07-15` の**期間指定** — 現状 due は一点日付のみ想定。

**なぜパーサーが先か**: ビュー（gantt/calendar）の描画 Issue はすべて「AST に plan/tentative/due 期間が載っていること」を前提とする。パーサーが無いとビュー側は何も受け取れない。

### 方針
- 既存の remark プラグイン機構（`src/lib/parser/plugins/remark-meta-fields.ts`）と正規化（`src/lib/parser/schedule-normalize.ts`）を**拡張**する。新しい解析経路を作らない（正規表現の乱立はパーサーとリントの乖離を生む — issue-phase000-001 の教訓）。

---

## 2. 進捗・実装メモ  — AIが読む

### 遵守事項（毎回）
- **実装前に `project/governance/` と `issue-phase004-000__phase-overview.md` を必ず読むこと。**
- **既存テストの見直しは機能実装と同等に重要。** 本 Issue は `Meta` 型を変更するため、`src/lib/parser/*.test.ts` 全部と、Meta を参照する `ast-to-*.test.ts` / `upsert-meta.test.ts` / `filter.test.ts` / `rules.test.ts` / `expand.test.ts` に影響しうる。**着手時に全部読み、新仕様に照らして期待値を書き換えること。**「型エラーを黙らせるだけの修正」は禁止。

### 既存資産（必読・実装前に読む）
- `src/lib/parser/meta-keys.ts` … META_KEYS 定義。`plan` を追加する。
- `src/lib/parser/plugins/remark-meta-fields.ts` … `- @key: value` 子リスト行の解析。キー判定箇所に `?` 剥がしを入れる。
- `src/lib/parser/schedule-normalize.ts` … `normalizeSchedule`（期間）と `normalizeDue`（一点）。plan は normalizeSchedule と同じ期間正規化を使う。
- `src/lib/parser/types.ts` … `Meta` 型定義。
- Spec: `project/specs/time-meta-model.spec.md`（issue-phase004-001。未起票なら先にそちらを完了させること）。

### 仕様（確定事項：迷ったらこれと Spec に従う）
1. `Meta` 型に追加:
   ```ts
   plan?: string          // 正規化済み 'start/end'（schedule と同形式）
   tentative?: { plan?: true; schedule?: true; due?: true }   // ? 修飾子
   ```
   due の期間対応: 既存 `due?: string` の値に `'YYYY-MM-DD'`（一点）または `'YYYY-MM-DD/YYYY-MM-DD'`（期間）を許す。**別フィールドにしない**理由: due の「一点 or 期間」は表示側の分岐で吸収でき、フィールドを分けると全参照箇所（filter/health/agenda/ビュー）の分岐が倍になる。
2. `?` 修飾子の構文: **キー名の直後・コロンの前**のみ有効（`@schedule?:`）。`@schedule ?:` や `@?schedule:` は不正（既存の不正メタ扱い＝その行は無視され、lint が警告する。lint 側対応は issue-phase004-005）。
3. `@plan` の値: `@schedule` と同じ期間形式＋同じ省略記法。**日付のみ（`2026-07-07/07-11`）は終日解釈**だが、終日への展開（00:00〜23:59）は**パーサーではやらない**。正規化された文字列をそのまま保持し、解釈は投影側（ast-to-*）が行う。理由: schedule の日付のみ表記が既にそうなっており（`dateRange` として保持）、パーサー層で時刻を発明すると Markdown との往復（ast-to-md）で情報が増えてしまう。
4. `@due` 期間値の正規化: `/` を含む場合は `normalizeSchedule` と同じ継続省略を適用（`2026-07-10/15` → `2026-07-10/2026-07-15`）。
5. `ast-to-md`（`src/lib/parser/ast-to-md.ts`）は**入力の再現**が責務。`?` 付きメタは `?` 付きのまま出力すること（ラウンドトリップ保証）。
6. `upsert-meta`（`src/lib/patch/upsert-meta.ts`）: 既存メタ更新時に `?` を**保持**する（ドラッグで日時を動かしても仮置きのまま）。`?` を外す操作は別 Issue（確定操作）で扱う。

### 実装の要点・つまずき
- **ラウンドトリップテストを必ず追加**: `parse → ast-to-md` で `@plan?:` の行が一字一句戻ること。ここが壊れると「ビューを開いただけで Markdown が書き換わる」最悪の退行になる（本プロダクトの核は「素の Markdown が唯一の正」）。
- `remark-meta-fields.ts` のキー判定は文字列一致。`?` を剥がしてから META_KEYS 照合し、剥がした事実を `tentative` に記録する、の順にする。META_KEYS に `'schedule?'` のようなキーを足す実装は**禁止**（キーの二重化はリント・補完・全参照箇所を汚染する）。
- `@repeat` と `@plan` の併用は現時点で未定義。Spec に従い「repeat の展開は schedule 起点」のまま変更しない。

### TODO
- [ ] Meta 型拡張（plan / tentative）
- [ ] remark-meta-fields: plan キー追加・`?` 剥がしと tentative 記録
- [ ] schedule-normalize: plan への適用・due 期間の継続省略対応（関数名は実態に合わせ整理可）
- [ ] ast-to-md: `?` 付き・plan のラウンドトリップ出力
- [ ] upsert-meta: `?` 保持
- [ ] 既存テスト全見直し＋新テスト（下記）

### 受け入れ基準
- `- @plan: 26-07-07/11` が `plan: '2026-07-07/2026-07-11'` にパースされる。
- `- @schedule?: 2026-07-10T10:00/11:00` が `schedule` に正規化値・`tentative.schedule === true` でパースされる。
- `- @due: 2026-07-10/15` が期間 due としてパースされる。一点 due の既存挙動は不変。
- 上記 3 つすべてで parse → ast-to-md ラウンドトリップが入力と一致する。
- `npm run test:unit` 全通過（既存テストは新仕様に照らして更新済みであること）。

### テスト観点
- 正常系（上記受け入れ基準）＋異常系: `@plan:`（値なし）、`@ schedule?:`、`?` の位置違い、due 期間の逆順。異常系は「メタとして解釈されない（既存の不正メタと同じ扱い）」を確認。
- ラウンドトリップ: `parse-markdown.test.ts` / `ast-to-md.test.ts` に追加。
- upsert-meta: `?` 付きメタの値更新で `?` が残ること。

### 履歴（追記のみ）
- 2026-07-04 — 起票。

---

## 3. メタデータ
- id: issue-phase004-002__parser-plan-tentative-due-range
- status: open
- phase: 004
- related_specs: time-meta-model.spec.md
- related_issues: issue-phase004-000, issue-phase004-001（先行必須）, issue-phase004-003, issue-phase004-004
- target_files: src/lib/parser/meta-keys.ts, src/lib/parser/types.ts, src/lib/parser/plugins/remark-meta-fields.ts, src/lib/parser/schedule-normalize.ts, src/lib/parser/ast-to-md.ts, src/lib/patch/upsert-meta.ts, 各 *.test.ts
- created: 2026-07-04
- updated: 2026-07-04
