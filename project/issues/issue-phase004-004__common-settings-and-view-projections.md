# 共通設定（祝日・meeting タグ・表示パラメータ）と ast-to-* 投影拡張（ライブラリ IF 確定）

## 1. 課題と方針  — 人間が読む

### このissueで解決すること
Phase 004 のライブラリ描画 Issue（gantt/calendar/kanban の各 Issue）が受け取る **prop の型と値を、本体側で確定して供給する**。ライブラリは「無意味な prop を受けて描くだけ」（phase004-000 §2-1）なので、意味の解釈＝この Issue がフェーズの結節点になる。具体的には:

1. **祝日・週末設定**（オーナー決定 Q7）: 祝日リストは設定ファイル参照。設定画面でパスを指定し、**デフォルトパスは main.js と同じディレクトリ（プラグインフォルダ）**。gantt / calendar 両方へ `holidays: string[]`（YYYY-MM-DD）と `weekend: number[]`（luxon 規約: 6=土, 7=日）を配る。
2. **meeting タグ設定**（Q6）: 「チェックボックスなし＋@schedule ＝予定（appointment）」「そのうちタグが『打合せ』『meeting』（設定で追加変更可）＝打合せ（meeting）」の判定を ast-to-calendar に実装。
3. **ganttバー横の表示パラメータ**（B-2）: 表示項目（デフォルト: ステータスのみ）を設定で選び、`trailingLabels` として gantt へ渡す。
4. **3 層モデルの投影**: plan / tentative / due（期間含む）を各ビューの item prop へ載せる。kanban へは breadcrumb（所属パンくず）を載せる。

### 方針
- prop 型はライブラリ側の型定義（`svelte-*-lib` の export）に追加が必要なものがある。**型の追加はライブラリリポジトリの各 Issue が行い、本 Issue は「本体から何をどう渡すか」を確定して実装する。** 型が未追加の間は本体側をコンパイルできないため、実装順は「ライブラリ Issue の型追加 → 本 Issue の投影実装」でもよい（依存が循環しないよう、**型だけ先に**各ライブラリへ入れる進め方を推奨）。

---

## 2. 進捗・実装メモ  — AIが読む

### 遵守事項（毎回）
- **実装前に `project/governance/` と `issue-phase004-000__phase-overview.md` を必ず読むこと。**
- **既存テストの見直しは機能実装と同等に重要。** `ast-to-calendar.test.ts` / `ast-to-gantt.test.ts` / `ast-to-kanban.test.ts` は出力 item の形を厳密に比較している可能性が高い。prop 追加で snapshot/deep-equal が壊れる際、「期待値に新フィールドを機械的に足す」のではなく、**新フィールドの値が正しいかをテストごとに考えて**期待値を書くこと。

### 既存資産（必読・実装前に読む）
- `src/lib/calendar/ast-to-calendar.ts` … CalendarItem 投影。calendar lib の `CalendarItem.type` は既に `'task' | 'appointment' | 'deadline'`。
- `src/lib/gantt/ast-to-gantt.ts` … GanttNode 投影（start/end は luxon DateTime）。
- `src/lib/kanban/ast-to-kanban.ts` … KanbanCard 投影（`parents` 相当の情報源は Section/親タスク/ユニットの階層）。
- `src/settings.ts` … 設定型・DEFAULT_SETTINGS・設定タブ。
- `src/views/ShadowItemView.ts` の `getExtraMountProps()` … ビューへ追加 prop を注入するフック（祝日等のビュー横断設定はここ経由が既存パターン）。

### 仕様（確定事項）

#### 2.1 祝日設定
- 設定項目: `holidayFilePath: string`（デフォルト `''` = プラグインフォルダの `holidays.json`）。
- ファイル形式: JSON 配列 `["2026-01-01", "2026-01-12", ...]`（YYYY-MM-DD）。**JSON にする理由**: Vault 内 md だとユーザーのノートと混ざり誤編集されやすく、プラグインフォルダなら配布物（テンプレート同梱）として扱える。
- 読み込み: プラグイン onload 時＋設定変更時。ファイル不存在は**エラーにせず空配列**（祝日は無くても動く機能。console に日本語で情報ログ）。
- 同梱テンプレート: 2026 年の日本の祝日 JSON をリポジトリに追加し、ビルド成果物と同じ場所に置く手順を README か設定説明に記す。
- `weekend: number[]` 設定（デフォルト `[6, 7]`）。
- 配布: calendar / gantt のビューへ `holidays` / `weekend` prop として渡す（`getExtraMountProps` → Mount → lib コンポーネント）。

#### 2.2 calendar 投影
- チェックボックス付きタスク → `type: 'task'`（既存どおり）。
- **チェックボックスなしのリスト項目＋@schedule** → `type: 'appointment'`。現状この投影が無ければ新設（ListNode で meta.schedule を持つもの）。
- appointment のうち **tags が設定 `meetingTags`（デフォルト `['打合せ', 'meeting']`）のいずれかを含む** → `type: 'meeting'`（calendar lib 側で union に追加される。issue-calendar-phase004-001 参照）。
- @due → `type: 'deadline'` の item として**別途**投影（タスク 1 件から task item と deadline item の 2 件が出る）。期間 due は deadline の temporal を期間にする。
- plan: CalendarItem へ `plan?: { start, end }` を渡す（**calendar は描画しない**。受け口のみ — オーナー決定 Q2）。
- tentative: item に `tentative?: boolean` を付与（メタ単位の詳細は不要。schedule 由来 item は tentative.schedule、deadline item は tentative.due を見る）。

#### 2.3 gantt 投影
- GanttNode へ追加して渡す: `plan?: { start: DateTime; end: DateTime }`（日付のみは start=00:00 / end=23:59 に展開）、`milestone?: DateTime | { start: DateTime; end: DateTime }`（due）、`tentative?: boolean`、`status?: string`、`trailingLabels?: string[]`。
- trailingLabels の組み立て: 設定 `ganttTrailingFields: string[]`（デフォルト `['status']`、候補 status/due/priority/tags/期間）から文字列化。**ライブラリは受けた文字列を描くだけ**にする理由: 表示項目の追加要望が来ても本体の設定追加だけで済む。

#### 2.4 kanban 投影
- KanbanCard へ `breadcrumb: string[]` を追加（例 `['案件X', 'タスクA', '準備ユニット']` — セクション › 親カード › ユニットの順）。表示粒度の制御は lib 側 prop（issue-kanban-phase004-002）。既存の `parents` 系フィールドがあれば流用し、無ければ mdast-to-sections の path 情報から組み立てる。

### 実装の要点・つまずき
- **luxon の単一インスタンス問題**（obs-0009）: gantt へ渡す DateTime は本体の luxon で作る。ライブラリ内で `DateTime.isDateTime` 判定が false になったら esbuild の resolve を疑う。
- 祝日ファイルの読み込みは Obsidian の `app.vault.adapter` ではなく**プラグインフォルダ**（`this.manifest.dir`）基準。`app.vault.adapter.read(normalizePath(...))` で configDir 配下も読める — 実装時に Obsidian API の実挙動を確認し、決めた読み方を本 Issue の履歴に記録すること。
- deadline item の id は task と衝突しないよう `${globalKey}::due` のような**派生 id** にする（calendar 側の {#each} キー衝突と、クリック時の globalKey 逆引きに注意 — 逆引き（onNodeClick）では派生 id から globalKey へ戻す処理を忘れない）。

### TODO
- [ ] 設定: holidayFilePath / weekend / meetingTags / ganttTrailingFields（設定タブ UI 含む）
- [ ] 祝日 JSON ローダ＋2026 年テンプレート同梱
- [ ] ast-to-calendar: appointment / meeting / deadline / plan / tentative 投影
- [ ] ast-to-gantt: plan / milestone / tentative / status / trailingLabels 投影
- [ ] ast-to-kanban: breadcrumb 投影
- [ ] 各 Mount への prop 配線（holidays / weekend）
- [ ] 既存テスト全見直し＋新テスト
- [ ] 本 Issue 完了時、確定した prop 型一覧を履歴に記録（ライブラリ Issue の実装者が参照する）

### 受け入れ基準
- 祝日ファイルを置き換えるとカレンダー/ガントの祝日 prop が変わる（unit で確認、描画はライブラリ Issue 側）。
- `- 打合せの予定`（チェックなし）＋`@schedule`＋`@tags: 打合せ` が `type: 'meeting'` に投影される。
- `@due` 持ちタスクから deadline item が投影され、期間 due は期間 temporal になる。
- `@plan` 持ちタスクの GanttNode に plan が載り、日付のみ plan の end が 23:59 に展開されている。
- KanbanCard に breadcrumb が載る。
- `npm run test:unit` 全通過。

### テスト観点
- ast-to-* の各投影 unit テスト（tentative の伝播・派生 id・meetingTags のカスタム値）。
- 祝日ローダ: 不存在ファイル→空配列＋ログ、不正 JSON→空配列＋警告ログ。

### 履歴（追記のみ）
- 2026-07-04 — 起票。

---

## 3. メタデータ
- id: issue-phase004-004__common-settings-and-view-projections
- status: open
- phase: 004
- related_specs: time-meta-model.spec.md
- related_issues: issue-phase004-000, issue-phase004-002（先行必須）, 各ライブラリ phase004 Issue（本 Issue が IF の正）
- target_files: src/settings.ts, src/lib/calendar/ast-to-calendar.ts, src/lib/gantt/ast-to-gantt.ts, src/lib/kanban/ast-to-kanban.ts, src/views/*.ts（getExtraMountProps）, 各 *.test.ts
- created: 2026-07-04
- updated: 2026-07-04
