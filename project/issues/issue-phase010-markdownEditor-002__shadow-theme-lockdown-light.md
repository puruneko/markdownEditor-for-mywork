# Shadow ビューへの Obsidian テーマ遮断（白基調固定）（元ID: I-02 ／ 対応 preIssue: COMMON-001（全リポジトリ分） ／ Phase: 1）

## 1. Background（背景）

`修正したい箇所.md` の common 節: 「ライト・ダークモード対応ができていない。ダークモードの時は obsidian 全体で文字が白になるが、拡張機能側は白基調のため文字が見えない部分がある。開発工数が少なくて済む場合はテーマに合わせ、大規模になる場合はテーマには合わせず、obsidian の CSS テーマ設定が拡張機能に適用されないようにして（白基調のままで OK）。」

**適用 DEC-01（テーマ方針＝遮断。追従はしない）**: 入力が「開発工数が少なくて済む場合はテーマに合わせ、大規模になる場合はテーマには合わせず…白基調のままで OK」と判断基準を先に与えている。analytics 自身が「追従＝calendar 219件 + gantt 216件 = 435件のトークン化（大規模）」と見積もっている。この基準を代入すると「遮断」で一意に決まる。

**適用 DEC-02（`:host` の継承プロパティ固定で一括解決）**: `:host` で止めれば現在および将来の該当箇所がまとめて塞がる。「どこが見えないか」の個別特定は行わない方針。

**症状の機構（実測。issue 本文として転記済み）**:
1. Shadow DOM が遮断するのは**セレクタのマッチだけ**。`color` / `font-size` / `line-height` / `letter-spacing` などの**継承プロパティは境界を貫通する**。
2. `ShadowItemView.ts` の `SHADOW_RESET_CSS` の `:host` は `display` / `flex-direction` / `width` / `height` / `overflow` / **`font-family`** のみを指定し、**`color` も `background` も指定していない**。
3. 4ライブラリ（calendar / gantt / kanban / dashboard）の `src` に Obsidian 変数（`var(--text-*)` / `var(--background-*)` / `var(--interactive-*)` / `var(--color-*)`）の参照は**1件も無い**（横断 grep でヒット0）。
4. → `background` だけ指定して `color` を指定していない要素が、Obsidian ダークテーマの `color`（白系）を継承して**白背景に白文字**になる。実例: gantt の `:global(.gantt-container){background:white}`、`.gantt-toggle-tree-btn{background:#fff}`、`.gantt-toggle-config-btn{background:#fff}`。
5. 逆に `color` を明示している要素（calendar の `.week-view{color:var(--calendar-text-color,#333)}`、gantt の `.gantt-node-name{color:#000}` 等）は無事。→ ユーザー報告「白基調のため文字が見えない**部分がある**」と正確に一致する。

## 2. Objective（目的）

Obsidian のダークテーマ配色が拡張機能の各ビューに継承・貫通しないようにし、常に白基調で読める状態にする。**全4ライブラリ（calendar / gantt / kanban / dashboard）分の COMMON-001 が、この1つの issue（markdownEditor 側の修正）だけで完了する。** calendar / gantt / kanban / dashboard の各リポジトリ側での作業は発生しない。

## 3. Scope（スコープ）

- `ShadowItemView.ts` の `SHADOW_RESET_CSS` への継承プロパティ固定
- `DashboardViewMount.svelte` のテーマ指定変更
- `KanbanTab.svelte` の config への theme 追加
- 対象は **Calendar / Gantt / Kanban / Dashboard / AstView の全5ビュー**

## 4. Implementation requirements（実装要件）

1. `src/views/ShadowItemView.ts` の `SHADOW_RESET_CSS` の `:host` に、継承プロパティを白基調で固定する（`color` / `background` / `font-size` / `line-height` / `letter-spacing`。`font-family` は既に指定済み）
2. `src/views/DashboardViewMount.svelte` の `theme="system"` → `theme="light"` に変更する
3. `src/lib/kanban/KanbanTab.svelte` の `config`（`$derived`）に `theme: 'light'` を追加する。**現在 `theme` フィールド自体が存在せず、`KanbanBoard.svelte` の `config.theme ?? 'dark'` により常時ダーク固定になっている**

## 5. Files / components likely to be changed（変更が見込まれるファイル／コンポーネント）

- `src/views/ShadowItemView.ts`（`SHADOW_RESET_CSS` の `:host` 定義）
- `src/views/DashboardViewMount.svelte`（`theme` prop）
- `src/lib/kanban/KanbanTab.svelte`（`config` の `$derived`）

## 6. Dependencies（依存関係）

- 先行 Issue: なし（Phase 1・依存なし）
- 他リポジトリの preIssue をここで巻き取る: **COMMON-001（calendar / gantt / kanban / dashboard の全リポジトリ分）**。calendar・gantt・kanban・dashboard それぞれの plan には本件専用の issue は存在しない
- 他リポジトリへの影響（実装順序の前提として利用される。ただし他リポジトリ側でのコード変更は発生しない）: kanban リポジトリの『ステータス表示の共通ヘッダー化・上部固定・レイアウト切替』機能は、本 issue によって `config.theme = 'light'` が渡されるようになることを前提に実装順序が組まれている。dashboard リポジトリの『StatusBadge 固定幅化』等の機能についても同様に、本 issue でテーマが `light` 固定になっていることを前提としている

## 7. Acceptance criteria（受け入れ基準）

- （目視）Obsidian をダークテーマにした状態で、**Calendar / Gantt / Kanban / Dashboard / AstView の全5ビュー**を開き、文字が読めること
- 特に gantt のツールバーボタン（`.gantt-toggle-tree-btn` / `.gantt-toggle-config-btn` など `color` 指定が無い要素）を重点確認する

## 8. Test requirements（テスト要件）

- 自動テストは書きにくい（Shadow DOM 内の `color` 継承であるため）。**`SHADOW_RESET_CSS` が `color` / `background` を宣言していることの文字列スナップショットに留め、目視確認を DoD（Definition of Done）に明記する。**
- 過剰な E2E テストを新規作成しないこと

## 9. Out of scope（対象外）

- `src/app.css` / `src/main.ts` / `src/App.svelte` / `src/lib/editor/EditorLayout.svelte` / `MonacoEditor.svelte` は `vite.config.ts` でビルドされる**開発用の単体 Web アプリ**であり、Obsidian プラグイン本体（ルート `main.ts` → `src/plugin.ts`、`esbuild.config.mjs` → `main.js`）からは一切参照されない。`app.css` の `background: #1e1e1e` 等の濃色は本 issue の対象ではない
- `styles/metatag-*.css` 等のエディタ装飾（Shadow の外にあり、Obsidian 変数ベースで正しく追従しているため対象外）
- 「どこが見えないか」の個別箇所特定（DEC-02 により `:host` での一括解決に限定し、個別特定は行わない）

## Progress & Implementation Notes

### History

#### 2026-09-22

- User Instruction:
  - project/governance のルールに従い、issue-phase010 シリーズを順番にすべて実装する

- Change:
  - `src/views/ShadowItemView.ts` の `SHADOW_RESET_CSS` の `:host` に `color: #000` / `background: #fff` / `font-size: 14px` / `line-height: 1.5` / `letter-spacing: normal` を追加した（`font-family` は既存のまま）
  - `src/views/DashboardViewMount.svelte` の `<Dashboard>` の `theme="system"` を `theme="light"` に変更した
  - `src/lib/kanban/KanbanTab.svelte` の `config`（`$derived`）に `theme: 'light'` を追加した（`KanbanBoard.svelte` は `config.theme ?? 'dark'` でフォールバックしていたため、これが無いと常時ダーク固定だった）
  - `SHADOW_RESET_CSS` を export し、`:host` ブロックが継承プロパティを宣言していることを確認する単体テスト（`src/views/ShadowItemView.test.ts`）を新設した（Test requirements の「文字列スナップショットに留める」方針どおり）

- Rationale:
  - DEC-01/DEC-02 に従い、個別箇所特定ではなく `:host` の継承プロパティ固定による一括解決とした
  - AstView / CalendarView / GanttView / KanbanView / DashboardView の全5ビューが `ShadowItemView` を継承していることを確認済み（`grep -l "extends ShadowItemView" src/views/*.ts`）のため、`:host` の修正のみで全5ビューに反映される

- Verification:
  - `npx vitest run` → 22 test files / 468 tests すべて成功（新設1件含む）
  - `node esbuild.config.mjs production` → ビルド成功
  - **未実施（要目視確認。DoD）**: Obsidian をダークテーマにした状態で Calendar / Gantt / Kanban / Dashboard / AstView の全5ビューを開き、文字が読めることの目視確認。特に gantt の `.gantt-toggle-tree-btn` / `.gantt-toggle-config-btn` の重点確認。この目視確認は自動化できないため、ユーザー側での確認が必要

- Status: 自動化可能な範囲は実装完了。目視確認（DoD）とユーザーの明示的な承認待ちのため Issue は Open のまま（WORKFLOW.md §6）。
