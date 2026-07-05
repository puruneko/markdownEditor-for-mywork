# Phase 004 概要 — 時間メタ 3 層モデルとビュー描画拡張（フェーズ憲章）

> **これは実装 Issue ではない。** Phase 004 の全 Issue（`issue-phase004-*` / `issue-gantt-phase004-*` / `issue-calendar-phase004-*` / `issue-kanban-phase004-*`）に着手する前に、**必ずこのファイルと `project/governance/` を読むこと。**
>
> **ライブラリ Issue の場合はさらに各ライブラリ憲章を読むこと**（読み順: governance → 本ファイル → ライブラリ憲章 → 個別 Issue）:
> - gantt: `issue-gantt-phase004-000__gantt-overview.md`
> - calendar: `issue-calendar-phase004-000__calendar-overview.md`
> - kanban: `issue-kanban-phase004-000__kanban-overview.md`
>
> フェーズ共通の事項は**本ファイルが正**。各ライブラリ憲章は「そのライブラリ固有の規約・実行順」のみを持ち、共通事項を複製しない（乖離防止）。

## 1. このフェーズの目的とゴール

### 背景（なぜこのフェーズをやるのか）
本プロダクトのオーナーは「タスクの期限（いつまで）と実施予定（いつやるか）の管理不全」を根本課題として本アプリを開発している。2026-07-03 の仕様検討で、時間表現を **3 層モデル**として体系化することが決定した（詳細: `project/plan/time-meta-spec-and-implementation-plan-2026-07-03.html`。Spec 化は issue-phase004-001）。

| メタ | 意味（宣言） | 表示 |
|---|---|---|
| `@plan` | 「この期間の中でやらねばならない」— バッファ込みの枠（WBS 的） | Gantt: 点線枠。Calendar: データは受けるが**描画しない** |
| `@schedule` | 「この時間に私はこの作業をする」— 意思表示・時間ブロック | Gantt: バー。Calendar: イベント |
| `@due` | 「ここまでに終わらせる」— 期限。基本は一点、期間も可 | Gantt: ◆（期間は ◆〜◆ 塗り）。Calendar: 太い横線＋左端矢印 |
| `?` 修飾子 | 仮置き。3 メタすべてに付けられる（例 `@schedule?:`） | 全ビュー: 半透明＋「?」バッジ |

制約: ①タスクは 3 メタのいずれか 1 つ以上必須、②順序 `plan.start ≤ schedule ≤ plan.end ≤ due(end)` 違反は**エラー提示**（入力は禁止しない）、③@plan は祖先タスクから**内部継承**（Markdown へ自動追記しない）。

### 各リポジトリのゴール
- **本体（markdownEditor-for-mywork）**: 3 層モデルの Spec・パーサー・バリデーション（Health）・共通設定（祝日等）・ライブラリへ渡す prop の組み立て（ast-to-*）・エディタ装飾。**「意味」を知るのは本体だけ。**
- **gantt（../ganttchart-for-mywork）**: plan 枠・due ◆・仮置き/done の描き分け・バー横ラベル・祝日色・サブタスク表示と DnD 予定化。
- **calendar（../calendar-for-mywork）**: meeting 種別・deadline（due）の「ここまで」描画・仮置き・祝日色・plan prop の受け口（描画なし）。
- **kanban（../kanban-for-mywork）**: サブカードグループ DnD の表示位置バグ修正（最優先）・カードの breadcrumb 表示。

## 2. フェーズ共通の注意（全 Issue に適用）

1. **ライブラリは汎用に保つ。** `@plan` や「祝日」の意味をライブラリに持ち込まない。ライブラリは `plan?: {start,end}` / `holidays: string[]` のような**無意味な prop** を受けて描くだけ。意味の解釈（Markdown → prop）はすべて本体の ast-to-* が行う。理由: 3 ライブラリは独立した汎用ライブラリとして育てる方針（オーナー決定 2026-07-03 Q8）。
2. **既存テストの見直しは機能実装と同等に重要（必読）。** AI 実装者（特に Haiku/Sonnet）は既存テストを見直さない癖がある。このフェーズの変更は型・prop・描画クラスを変えるため、**既存テストが「今の仕様では不正解」になるケースが必ず発生する**。各 Issue の作業では:
   - 着手時に対象モジュールの既存テストを**全部読む**こと。
   - 「落ちたテストを通るように直す」のではなく「新仕様に照らして正しい期待値に書き換える」こと。落ちないが仕様的に無意味になったテストも削除・更新すること。
   - 新機能には必ず新テストを足すこと。テストなしの実装は受け入れられない（`project/governance/TESTING_STANDARD.md`）。
3. **本体の E2E は必ず `project/knowledge/obsidian-plugin-testing.md` を読んでから触る。** 全ビューは shadow DOM 内に描画され、素の複合セレクタでは要素が見えない。ヘルパ（`tests/obs-e2e/helpers/`）を使うこと。変更を伴う E2E テストは実行時生成ファイルを使うこと（resetVault の UTF-8 上流バグ回避）。
4. **メタキー名は変えない。** `@schedule` の改名（R-1）はオーナー判断待ち。全 Issue は現行名で実装する。ライブラリはそもそもメタ名を知らないので影響しない。
5. **コミットは Issue closure 時のみ・ユーザー承認後**（`project/governance/WORKFLOW.md`）。実装完了時は Issue の status を `implemented（ユーザー承認待ち）` にして止まること。
6. **console 出力は日本語**（言語ポリシー）。

## 3. 実装順序と依存関係（個別 Issue の前にやること）

```
Step 0（依存なし・即着手可）
  ├ issue-kanban-phase004-001  DnD 表示位置バグ修正（最優先）
  └ issue-gantt-phase004-001   左パネルスリム化

Step 1（このフェーズの土台。他のすべてに先行）
  ├ issue-phase004-001  時間メタ 3 層モデル Spec 起票  ← 着手時に R-1（schedule 名称）をユーザーへ確認
  └ issue-phase004-002  パーサー拡張（@plan・?・due 期間）

Step 2（Step 1 の後）
  ├ issue-phase004-003  plan 継承＋Health バリデーション
  └ issue-phase004-004  共通設定＋ast-to-* 投影（★ライブラリへ渡す prop 型をここで確定）

Step 3（Step 2 の issue-phase004-004 が確定してから着手）
  ├ gantt:    004-002 due◆ / 004-003 plan枠 / 004-004 仮置き・done / 004-005 ラベル / 004-006 祝日色
  ├ calendar: 004-001 meeting / 004-002 deadline描画 / 004-003 仮置き・plan受け口 / 004-004 祝日色
  └ kanban:   004-002 breadcrumb
  ├ 本体:     issue-phase004-005 エディタ装飾・lint
  └ gantt 大物: 004-007 サブタスク表示 → 004-008 DnD 予定化（この順）

※ Step 3 のライブラリ Issue は互いに独立（並行可）。ただし同一リポジトリ内は競合回避のため直列を推奨。
```

**prop の型の「正」は issue-phase004-004 が定める。** ライブラリ Issue に書かれた prop 名・型と issue-phase004-004 の確定内容が食い違ったら、issue-phase004-004（と本体の `contract` 型定義）を正とし、相違を本 Issue の履歴に追記すること。

## 4. 各リポジトリのテスト実行方法

| リポジトリ | ユニット | E2E |
|---|---|---|
| 本体 | `npm run test:unit`（vitest 445件〜） | `npm run test:obs:e2e`（実機 Obsidian・8 spec〜） |
| gantt / calendar / kanban | 各リポジトリの `package.json` の test スクリプトを確認して実行 | 本体の E2E が統合検証を兼ねる（ライブラリ変更後は**本体側でもビルド＋E2E を回す**こと。ビルドはライブラリの src を直接コンパイルするため、ライブラリ変更は本体ビルドに即反映される） |

## 5. メタデータ
- id: issue-phase004-000__phase-overview
- status: active（フェーズ期間中は常時参照）
- phase: 004
- related_specs: time-meta-model（issue-phase004-001 で起票予定）
- related_issues: phase004 全 Issue、issue-phase000-003（kanban バグ）、issue-phase003-008（入力補助・別フェーズ継続）
- created: 2026-07-04
- updated: 2026-07-04
