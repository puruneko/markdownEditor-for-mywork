# dashboard-for-mywork（svelte-dashboard-lib）をホストへ導入する

## 1. 問題と方向性  — 人間向け

### この Issue が解決する問題

`for-mywork` 配下には `calendar-for-mywork`・`ganttchart-for-mywork`・`kanban-for-mywork` の3連携アプリが既にホスト（本リポジトリ）へ導入され、専用ビュー（コマンドパレット・リボンアイコンから開く Obsidian ItemView）として動作している。もう1つの連携アプリ `dashboard-for-mywork`（パッケージ名 `svelte-dashboard-lib`）は、進捗一覧・今やること・リマインド・未整理・不足情報チェックの5パネルを持つ読み取り専用ダッシュボードとして独立に開発済みだが、ホストへはまだ導入されていない。

ユーザーは「カレンダーなどと同じように、dashboard-for-mywork を導入して。いったんあなたの推奨案で作成して。動くところが見たいです」と指示した（2026-09-14）。曖昧な点は実装者の最善案で判断してよい旨、および実際に動作する状態まで持っていくことが明示されている。

### 方向性

- 導入方式は、既存の calendar/gantt/kanban と全く同じパターンに揃える: `ShadowItemView` を継承した `DashboardView`（Obsidian ItemView）＋ Svelte マウントコンポーネント（`DashboardViewMount.svelte`）＋ `plugin.ts` でのビュー登録・コマンド・リボンアイコン登録。
- `svelte-dashboard-lib` は他の3ライブラリと異なり、投影（`extractXxx()`）を必要としない。`Dashboard.svelte` の props（`DashboardProps`）が `sources: SourceEntry[]` をそのまま受け取る設計になっており、かつ `svelte-dashboard-lib/src/lib/models/contract.ts` の `Meta`/`TaskNode`/`Status` は、本リポジトリが `issue-phase005-001` で確定させたカノニカル定義（7状態・11メタキー）と完全に一致している（構造的に互換）。したがって `DashboardViewMount.svelte` は `sources`・`registerUpdater`・`onNodeClick` をそのまま `<Dashboard>` へ渡すだけでよい。書き戻し（`onNodePatch`）は行わない（ダッシュボードは読み取り専用。`svelte-dashboard-lib` の `DashboardProps` に `onNodePatch` 相当のフィールドは存在しない）。
- ビルド設定（`package.json`・`esbuild.config.mjs`・`vite.config.ts`）は、既存の3ライブラリと同じ「symlink を realpath 解決し、このプロジェクトの Svelte/luxon で直接ソースコンパイルする」方式を踏襲する（calendar 導入時に判明した Svelte バージョン不一致問題の回避策。`0014-calendar-library-integration.md` 参照）。
- 設定タブへの新規トグルは追加しない（既存の `showRibbonIcon` を流用する。kanban・calendar と同様、ダッシュボード専用の設定は本 Issue の範囲では設けない）。

---

## 2. 進捗と実装メモ  — AI 向け

### 2.1 対象ファイル

| ファイル | 役割 |
|---|---|
| `package.json` | `svelte-dashboard-lib`（`file:../dashboard-for-mywork`）を `dependencies` へ追加。`libs:update` スクリプトへ追加 |
| `esbuild.config.mjs` | `svelteLibSourcePlugin` の `libs` オブジェクトと `onResolve` フィルタ正規表現へ `svelte-dashboard-lib` を追加 |
| `vite.config.ts` | `resolve.alias` と `optimizeDeps.exclude` へ `svelte-dashboard-lib` を追加（単体テスト・`vite dev` 用） |
| `src/views/DashboardView.ts` | **新規作成**。`ShadowItemView` を継承する ItemView。`KanbanView.ts` と同型 |
| `src/views/DashboardViewMount.svelte` | **新規作成**。`svelte-dashboard-lib` の `Dashboard` へ `sources`/`registerUpdater`/`onNodeClick` を橋渡しする |
| `src/plugin.ts` | ビュー登録・コマンド・リボンアイコン・`onunload` の `detachLeavesOfType` を追加 |

### 2.2 実装内容（before/after）

#### A. `package.json`

```diff
   "scripts": {
-    "libs:update": "npm install svelte-calendar-lib svelte-gantt-lib svelte-kanban-lib",
+    "libs:update": "npm install svelte-calendar-lib svelte-gantt-lib svelte-kanban-lib svelte-dashboard-lib",
   ...
   "dependencies": {
     ...
+    "svelte-dashboard-lib": "file:../dashboard-for-mywork",
     "svelte-gantt-lib": "file:../ganttchart-for-mywork",
     "svelte-kanban-lib": "file:../kanban-for-mywork",
```

（`npm install` で `node_modules/svelte-dashboard-lib` が symlink として作成されることを確認する。）

#### B. `esbuild.config.mjs`（`svelteLibSourcePlugin`）

`libs` オブジェクトのキーへ `svelte-dashboard-lib` を追加し、`onResolve` の正規表現（2箇所: パッケージ名一致・`.css` サブパス一致）へ `svelte-dashboard-lib` を選択肢として追加する。既存の calendar/gantt/kanban と同じパターンを反復する。

#### C. `vite.config.ts`

`resolve.alias` に `svelte-dashboard-lib` → `node_modules/svelte-dashboard-lib/src/index.ts` のエントリを追加し、`optimizeDeps.exclude` 配列へ `'svelte-dashboard-lib'` を追加する。

#### D. `src/views/DashboardView.ts`（新規）

`KanbanView.ts` を雛形とする。`DASHBOARD_VIEW_TYPE = 'md-ast-editor-dashboard-view'`、`getViewClass()` は `'dashboard-view'`、アイコンは `'layout-dashboard'`（Obsidian 組み込みの lucide アイコン名）。

#### E. `src/views/DashboardViewMount.svelte`（新規）

```svelte
<script lang="ts">
  import { Dashboard } from 'svelte-dashboard-lib'
  import type { SourceEntry } from '../lib/viewmodel/contract'

  interface Props {
    sources: SourceEntry[]
    registerUpdater: (fn: (sources: SourceEntry[]) => void) => void
    onNodeClick: (globalKey: string) => void
  }

  let { sources, registerUpdater, onNodeClick }: Props = $props()
</script>

<div class="dashboard-mount">
  <Dashboard {sources} {registerUpdater} {onNodeClick} theme="system" />
</div>
```

`ShadowItemView` は `ViewMountProps`（`onNodePatch`・`onReload` を含む）を常に渡すため、`Props` 型はこの2つを省略してよい（Svelte 5 の `$props()` は未使用の余剰プロパティを許容する。マウント元は構造的に上位互換の props オブジェクトを渡すのみで、コンポーネント側が使わないフィールドを無視することは他のコンポーネントでも起きない特殊対応ではなく、単に分割代入で受け取らないだけでよい）。

#### F. `src/plugin.ts`

`KANBAN_VIEW_TYPE` 関連の4箇所（import・`registerView`・`addCommand`・`addRibbonIcon`・`onunload` の `detachLeavesOfType`）と同じ位置に、`DashboardView`/`DASHBOARD_VIEW_TYPE` の同型のブロックを追加する。コマンド ID は `open-dashboard-view`、コマンド名は `Dashboard View を開く`、リボンアイコンは `layout-dashboard`。

### 2.3 スコープ外

- `svelte-dashboard-lib` 側のソースコード変更（責務境界 `BR-043`〜`BR-047` に反するため）。
- ダッシュボード専用の設定トグル（更新頻度・表示パネルの選択等）の追加。
- `onNodePatch`（書き戻し）対応。ダッシュボードは読み取り専用ビューとして導入する。

### 2.4 テスト

- `npm run check`: 型エラーが増えないことを確認する。
- `npm run test:unit`: 既存529件が引き続き成功することを確認する（本 Issue はダッシュボード投影ロジックを追加しないため、新規単体テストは必須としない）。
- `npm run build`: ビルドが成功することを確認する。
- 実機確認: Obsidian E2E（`wdio run wdio.conf.mts`）で Dashboard View が開けること・5パネルタブが描画されることを確認する新規スペック `tests/obs-e2e/dashboard-view.e2e.ts` を追加し、スクリーンショットを証跡として残す（`captureView` ヘルパ使用。kanban の先例に倣う）。

### 履歴（追記のみ）

#### 2026-09-14

- ユーザー指示:
  - 「カレンダーなどと同じように、dashboard-for-mywork を導入して。いったんあなたの推奨案で作成して。動くところが見たいです」

- 変更:
  - 本 Issue を新規作成した。既存の calendar/gantt/kanban 導入パターン（`0014-calendar-library-integration.md` 等）を踏襲する方針とし、`2.1`〜`2.2節` に対象ファイルと変更内容を列挙した。
  - `svelte-dashboard-lib` は投影層を持たず `sources` をそのまま受け取れる設計であることを確認し（`DashboardProps`・`contract.ts` の型が `issue-phase005-001` のカノニカル定義と一致）、投影関数の新規実装は不要と判断した。

- 根拠:
  - `WORKFLOW §2.4` に基づき、変更対象と before/after を列挙した。
  - ユーザーの明示指示（本欄冒頭）により、曖昧な設計判断（アイコン選択・コマンドID命名・設定トグルを追加しない判断）は実装者の最善案とした。

#### 2026-09-14（実装完了）

- 実施内容:
  - `2.2節` の A〜F をすべて実装した。`npm install svelte-dashboard-lib` により `node_modules/svelte-dashboard-lib` が `../../dashboard-for-mywork` への symlink として作成されることを確認した。
  - `tests/obs-e2e/dashboard-view.e2e.ts` を新規作成した（`2.4節` の実機確認スペック）。

- テスト実施結果:
  - `npm run check`: 新規エラーなし（585ファイル・84エラー。ファイル数は `dashboard-for-mywork` のソースが型チェック対象に加わった分のみ増加し、エラー数は既存ベースラインと同一）。
  - `npm run test:unit`: 529件全て成功（既存回帰なし）。
  - `npm run build`: 成功。`main.js` に `md-ast-editor-dashboard-view` が含まれることを確認した。
  - Obsidian E2E（全9スペック、`dashboard-view.e2e.ts` を含む）: 8スペック全項目成功。`gantt-view.e2e.ts` の2件失敗は `issue-phase005-001` で確認済みの既存事象（本Issueと無関係）のみ。
  - `dashboard-view.e2e.ts` の実行時にスクリーンショット（`dashboard-view-initial.png`）を取得し、実際に Obsidian 上でダッシュボードが「今やること」パネル・7状態バッジ・優先度順表示とともに描画されることを目視確認した。ユーザーへ送付済み。

- 根拠:
  - `TESTING_STANDARD.md`（Functional Tests・E2E Tests は共に必須）に従い、単体レベルの投影ロジックを追加しない本Issueでも、実機E2Eで「開ける・描画される」ことを検証した。

---

## 3. メタデータ
- id: issue-phase000-004__dashboard-view-integration
- status: open
- phase: 000
- related_specs: documents/external-data-contract.spec.md
- related_decisions:
- target_files: package.json, esbuild.config.mjs, vite.config.ts, src/views/DashboardView.ts, src/views/DashboardViewMount.svelte, src/plugin.ts
- created: 2026-09-14
- updated: 2026-09-14
