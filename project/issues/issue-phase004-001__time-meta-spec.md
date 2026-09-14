# 【Spec 起票】時間メタ 3 層モデル（plan / schedule / due・仮置き・バリデーション・継承）

## 1. 課題と方針  — 人間が読む

### このissueで解決すること
Phase 004 の全実装の前提となる**仕様書（Spec）が存在しない**。オーナーが 2026-07-03 に確定した時間メタ 3 層モデル（`project/plan/time-meta-spec-and-implementation-plan-2026-07-03.html` §1〜§3）を、本プロジェクトの正式な Spec ファイルとして `project/specs/time-meta-model.spec.md` に起票する。

**なぜ Spec が必要か**: 本プロジェクトのガバナンスは「Spec が機能の唯一の真実」（system-baseline BR-001/BR-002）。Spec なしで phase004-002 以降を実装すると、後続 AI がパーサーやバリデーションの細部（例: `?` の位置、due 期間の解釈）を推測で埋めてしまい、ビュー間で挙動が食い違う。

### 方針
- 上記 HTML レポートの §1（3 層モデル）・§2（描画仕様）・§3（バリデーション・継承）を Spec 形式（既存 `project/specs/calendar-integration.spec.md` 等の体裁）へ転記・整理する。**内容の新規発明はしない**（すでにオーナー確定済み）。
- BR 番号を新規採番する（BR は恒久番号。既存 Spec の BR と重複しない番号帯を使う）。

---

## 2. 進捗・実装メモ  — AIが読む

### 遵守事項（毎回）
- **実装前に `project/governance/` と `issue-phase004-000__phase-overview.md` を必ず読むこと。**
- **着手時にユーザーへ確認すること（ブロッカー）**: 残論点 R-1「`@schedule` の名称を変えるか」（候補: `@do` / `@work` / `@slot` / `@focus` / 現状維持）。回答を得てから Spec に確定名を書く。回答が「現状維持」以外なら、Spec には新名称を正とし「旧名 `@schedule` は非推奨エイリアスとして受理」と明記する。

### 入力（正となる決定事項）
`project/plan/time-meta-spec-and-implementation-plan-2026-07-03.html` の §1〜§3。要点:
1. `@plan`（期間枠・日付のみは終日 00:00〜23:59）/ `@schedule`（時間ブロック）/ `@due`（期限・一点または期間）。
2. `?` 修飾子はキー直後（`@plan?:` `@schedule?:` `@due?:`）。意味は「仮置き」。
3. タスクは 3 メタのいずれか 1 つ以上必須（どれも無い＝Health の undated）。
4. バリデーション（違反＝エラー提示、入力は禁止しない）:
   - V-1: schedule が plan 枠に収まる（`plan.start ≤ schedule.start` かつ `schedule.end ≤ plan.end`）
   - V-2: `plan.end ≤ due(end)`
   - V-3: `schedule.end ≤ due(end)`
5. plan の継承: 自身に @plan が無ければ最も近い祖先の @plan を**内部値**として使う。Markdown へ自動追記しない。
6. メタ行の位置: タスク行直下が推奨＋自動生成の正規位置。**パーサーは子要素内なら位置を問わず受理**（寛容）、**ライター（upsert-meta 等）は必ず直下に書く**（厳格）。一括整形はユーザーがコマンドで明示的に呼んだ時のみ。
7. 値の省略記法は既存 `schedule-normalize` の規則（2 桁年・分省略・継続省略）を plan / due にも適用する。
8. グループ（親タスク）にも 3 メタすべて付与可。

### 実装の要点・つまずき
- Spec は**日本語**（言語ポリシー: specs は日本語）。
- 描画仕様（Gantt の点線枠・Calendar の太線矢印など）も Spec に含めるが、「ライブラリは無意味な prop を受けるだけで、意味の解釈は本体」という責務分界を必ず明記する（phase004-000 §2-1 参照）。
- 既存 Spec（calendar-integration / gantt-integration）と矛盾する記述がないか横断確認し、矛盾があれば本 Spec を正とし相手側に deprecation 注記を入れる（BR 番号は消さない・番号の付け替え禁止）。

### TODO
- [x] R-1（schedule 名称）をユーザーに確認 → 2026-08-01 時点で未回答。issue-phase004-000 §2-4「メタキー名は変えない。全 Issue は現行名で実装する」に従い、現行名 `@schedule` のまま Spec を起票した（8章に明記）。最終回答は引き続き未確定（下記「確認事項」参照）。
- [x] `project/specs/time-meta-model.spec.md` を起票（PURPOSE / SCOPE / DEFINITIONS / BEHAVIORAL REQUIREMENTS(BR) / EDGE CONDITIONS / VERIFICATION）
- [x] 既存 Spec との整合確認・必要なら deprecation 注記 → calendar-integration.spec.md・gantt-integration.spec.md と用語・BR番号の衝突なし。矛盾なし（deprecation 注記不要）。
- [x] 関連 Issue（phase004-002〜005、各ライブラリ Issue）の related_specs を更新 → issue-phase004-002・issue-phase004-005 の related_specs は起票時点から `time-meta-model.spec.md` を指しており変更不要と確認。issue-phase004-003・004（本 Issue の範囲外・未着手）は着手時に実装者が参照すること。

### 確認事項（ユーザーへ）
- **R-1（`@schedule` の名称）は依然オーナー最終回答待ち。** 今回は phase004-000 の指示に従い現行名で実装を進めたが、`project/plan/time-meta-spec-and-implementation-plan-2026-07-03.html` §7 の記載どおり、これは唯一の残ブロッカーとして残っている。改名する場合は Spec・パーサー・エディタの3層（issue-phase004-001/002/005、実装済み）に加えて lint 一括変換が必要になる。

### 受け入れ基準
- 上記決定事項 1〜8 がすべて BR として番号付きで記載されている。
- `?` 修飾子・due 期間・plan 終日解釈・継承の**エッジケース**（例: plan と due だけで schedule 無し、祖先複数段の継承、`?` 付きメタ同士のバリデーション扱い）が EDGE CONDITIONS に明記されている。
- phase004-002 の実装者が本 Spec だけを読んで実装に迷わない。

### テスト観点
- Spec 自体にテストは無いが、「VERIFICATION METHOD」節に各 BR をどの層（unit / E2E）で検証するかの対応表を書くこと。

### 履歴（追記のみ）
- 2026-07-04 — 起票。

### 2026-08-01 09:00

- User Instruction:
  - 「project/governanceを確認してください。そのあと、phase004のエディタ実装分をすべて実装してください。私は席を外すので、あなたの推奨案で実装し切ってください。懸念点や質問は各issueに追記しておいてください、後で確認します。」

- Change:
  - `project/specs/time-meta-model.spec.md` を新規作成（BR-001〜BR-043）。issue-phase004-005（エディタ実装）の前提として本 Issue を先行完了させた。
  - R-1 は未回答のため、issue-phase004-000 §2-4 に従い現行名 `@schedule` で確定。Spec 8章に「OUT OF SCOPE」として明記し、将来 R-1 が決まった場合の更新手順（NAMING_AND_ID_RULES §5・§6 準拠の追記）も記載した。
  - R-2〜R-4（plan継承の見せ方・calendar でのplan表示・gantt DnDデフォルト値）も Spec 8章で「対象外・実装時判断」として明記した。

- Rationale:
  - ユーザー不在時の自律実装が指示されたため、AI_RUNTIME_RULES §4「不確実性がある場合は STOP」よりも本指示（推奨案で実装し切る・懸念は Issue に記録）を優先した。R-1 のような真にユーザー判断が必要な事項は、実装をブロックする代わりに「現状維持で進め、確認事項として記録する」方針を採用した。

---

## 3. メタデータ
- id: issue-phase004-001__time-meta-spec
- status: implemented（ユーザー承認待ち）
- phase: 004
- related_specs: time-meta-model.spec.md（本 Issue で作成）
- related_issues: issue-phase004-000, issue-phase004-002, issue-phase004-003, issue-phase004-004
- target_files: project/specs/time-meta-model.spec.md（新規）
- created: 2026-07-04
- updated: 2026-08-01
