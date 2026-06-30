# kanban ライブラリ仕様更新への追従（階層グルーピング移行）

## 1. 課題と方針  — 人間が読む

### このissueで解決すること

外部の `svelte-kanban-lib`（`file:../kanban-for-mywork`）のグルーピング仕様が更新され、
本アプリ側の実装がコンパイル不能・仕様不整合になった。これを新仕様で動作するよう修正する。

**ライブラリ側の仕様変更（更新後）：**
- グルーピングモデルが「カードの任意フィールド配列 + `sectionDepth`」方式から、
  **カードの順序付き階層パス `hierarchy: HierarchySegment[]`** ＋ `headingLevel` / `showUnits` 方式へ移行した。
  - `HierarchySegment` は `{ type: 'heading'; level: number; name: string }`（見出し）または
    `{ type: 'unit'; name: string }`（リスト由来のグループ）。
- 階層グルーピングは `config.groupBy = HIERARCHY_GROUP_BY`（`'__hierarchy__'`）で有効化する。
  - `headingLevel`：先頭から採用する heading 段数（最小 1、既定 2）。
  - `showUnits`：採用した最後の heading 以降の unit 段もグループ ID に含めるか（既定 false）。
- `KanbanBoardConfig` から **`sectionDepth` が削除**された（→ 旧実装が型エラー）。
- グループ選択 UI のドロップダウンは `section` キーを除外し、「階層」または各フィールドを選ぶ方式になった。
- カードグループ機能（サブカードのインライン展開）は `card.parentId` を参照する。

**本アプリ側で発生していた不整合（修正前）：**
- `src/lib/kanban/ast-to-kanban.ts` / `KanbanTab.svelte` / `ast-to-kanban.test.ts` が
  削除済みの `sectionDepth` を参照し型エラー（`npm run check` で 3 件）。
- カードに `hierarchy` を付与しておらず、新ライブラリの階層グルーピング・所属ラベル表示が機能しない。

### 方針

ライブラリ既定に合わせた **階層グルーピングへの移行** を採用する（推奨プラン）。

- `ast-to-kanban.ts`：AST のセクション（見出し）→ `heading` 段、リストグループ → `unit` 段として
  `hierarchy: HierarchySegment[]` を構築する。見出しレベルは `Section.depth`（`#`=1, `##`=2…）を使用。
  マルチソース時はファイル名を最上位 `heading`（level 0）段として付与する。
- 後方互換・フィルタ用途のため `section` / `sectionTitle` / `groupTitle` は `hierarchy` から導出して維持。
- タスクの親がタスクのときのみ `parentId`（globalKey）を張り、カードグループ表示を可能にする。
- `createKanbanConfig(cards, headingLevel=2, showUnits=false)` に変更し、
  `groupBy = HIERARCHY_GROUP_BY` ＋ `resolveHierarchyGroupId` で Markdown 出現順の `groups` を生成。
- `KanbanTab.svelte`：状態を `userGroupBy=HIERARCHY_GROUP_BY` / `headingLevel` / `showUnits` に置換し、
  `config` と `handleConfigChange` を新フィールドに対応させる。
- 既定値はライブラリ既定（`headingLevel=2` / `showUnits=false`）に合わせる。
  リストグループ単位での分割が欲しい場合はボードの「ユニット表示」トグルで切り替え可能。

---

## 2. 進捗・実装メモ  — AIが読む

### 遵守事項（毎回）
- 着手時に**一度だけ** `project/governance/` を確認（`AI_RUNTIME_RULES.md` のロード順）。
- **テスト観点とテストコードは毎回すべて見直す**（`TESTING_STANDARD.md` 準拠）。

### 依存
- なし（外部ライブラリ `svelte-kanban-lib` の更新に追従するのみ）

### 対象ファイル
- `src/lib/kanban/ast-to-kanban.ts` … `hierarchy`/`parentId` 構築、`createKanbanConfig` を階層方式に変更
- `src/lib/kanban/KanbanTab.svelte` … 状態・`config`・`handleConfigChange` を新フィールドへ移行
- `src/lib/kanban/ast-to-kanban.test.ts` … `createKanbanConfig` のテストを階層方式に更新

### TODO
- [x] ライブラリ新仕様（models / cardDistribution / KanbanBoard）の確認
- [x] `ast-to-kanban.ts` を `hierarchy` ベースへ移行
- [x] `parentId`（カードグループ用）を付与
- [x] `createKanbanConfig` を `headingLevel`/`showUnits`/`HIERARCHY_GROUP_BY` に変更
- [x] `KanbanTab.svelte` を新フィールドへ移行
- [x] テスト更新（kanban 35 件パス、全体 439 件パス）
- [x] `npm run check` の kanban 関連型エラー解消を確認
- [x] esbuild バンドル成功を確認
- [ ] ユーザーによる動作確認・クローズ承認

### 受け入れ基準（すべて満たすこと）
- `npm run check` で kanban 関連の型エラーが 0 件（他ビューの既存エラーは本issue対象外）。
- `vitest` 全件パス（kanban 35 件を含む）。
- Kanban ビューが既定で見出し階層（headingLevel=2）でグループ表示される。
- ボード UI の「階層」「heading 段数」「ユニット表示」操作でグルーピングが変化する。
- ステータスグルーピング時のエディタからの外部ドロップ（status レーンへの書き戻し）が従来どおり動作する。

### 既知の対象外事項
- `src/lib/calendar/*`・`src/lib/parser/*.test.ts`・`src/sync/*`・`src/settings.ts`・`tests/obs-e2e/*`・
  `src/main.ts` の型エラーは本issue着手前から存在し、kanban 仕様更新とは無関係のため対象外。

### 履歴（追記のみ）

## History

### 2026-07-01

- User Instruction:
  - kanban ライブラリが仕様を更新したので、本アプリで動くように実装を修正すること。推奨プランで動く状態まで実装し切ること。issue-0028 としてまとめること。

- Change:
  - 新 Issue 起票（ID は後述の理由により新スキーム `issue-phase003-011` を採用）。
  - `ast-to-kanban.ts`：`section: string[]`+`sectionDepth` ベースから `hierarchy: HierarchySegment[]` ベースへ移行。`parentId` 付与。`createKanbanConfig` を `headingLevel`/`showUnits`/`HIERARCHY_GROUP_BY` に変更。
  - `KanbanTab.svelte`：`userGroupBy=HIERARCHY_GROUP_BY` / `headingLevel` / `showUnits` へ状態移行。`config`・`handleConfigChange` 更新。
  - `ast-to-kanban.test.ts`：`createKanbanConfig` のテストを階層方式に更新（`section` 導出のテストは現状維持）。

- Rationale:
  - ライブラリが `KanbanBoardConfig.sectionDepth` を削除し階層モデル（`hierarchy`/`headingLevel`/`showUnits`）へ移行したため、それに追従する。ライブラリ既定に合わせることで将来の追従コストを下げる。
  - ID について：ユーザー指定の「issue-0028」は既存の無関係なクローズ済み Issue `0028-mdast-to-tasknode.md`（および `obs-0028-kanban-grouping-fix.md`）が占有済みで、`NAMING_AND_ID_RULES`（新規は `issue-phase<PPP>-<NNN>` スキーム／レガシー番号は再利用しない）に反するため、現行フェーズの新スキーム ID で起票した。

---

## 3. メタデータ
- id: issue-phase003-011__kanban-lib-spec-migration
- status: proposed
- phase: 003
- related_specs: なし
- related_decisions: なし
- target_files: src/lib/kanban/ast-to-kanban.ts, src/lib/kanban/KanbanTab.svelte, src/lib/kanban/ast-to-kanban.test.ts
- created: 2026-07-01
- updated: 2026-07-01
