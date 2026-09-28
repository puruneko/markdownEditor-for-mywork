# gantt 投影: 見出し自身の `@schedule` をバー期間に反映し、明示的な予定であることを示すフラグを付与する

## 1. Background（背景）

`修正したい箇所.md` の gantt 節:

> タスクにplanとscheduleがある場合、どちらもタスク名など表示せず、scheduleのバーのみ表示して。planの日時は文字列の最後がバーの先頭になるよう表示して。同様にdueもscheduleがある場合はタスク名は非表示にして。日時は表示して。
> - →この要望が一切反映されていません。

ユーザーへの確認により、次の3点が判明している。

1. plan と schedule は、`- [ ]` タスクにも、通常のリスト項目にも、見出し（`## 見出し`）にも付けている。
2. 「schedule のバーのみ表示」とは、plan の点線の枠は残したまま、**名前のラベルだけ**を消すという意味である。
3. 見出しに `@schedule` がある場合、見出しのバーは**自身の `@schedule` の期間**で描く。ない場合は、従来どおり配下のタスクの日付を集計した期間で描く。

本 issue は、上記のうち **「見出しに `@schedule` がある場合、見出しのバーの期間をその値にする」** という、ホスト（markdownEditor）側の投影ロジックの変更を担当する。あわせて、ガントライブラリ（`ganttchart-for-mywork`）側で「plan/schedule のラベル抑制ルールを task 以外のノード種別にも適用する」ための新しいフラグ（`hasExplicitSchedule`）を、ホスト側から正しく設定する。

**ライブラリ側（`GanttNode` 型への `hasExplicitSchedule?: boolean` フィールドの追加、`GanttTimeline.svelte` のラベル抑制ロジックの変更）は、別リポジトリの issue `issue-phase012-gantt-003__apply-plan-schedule-rules-to-all-node-types.md`（ganttchart-for-mywork）で対応する。本 issue はそのフィールドを実際に設定する、ホスト側の投影コード（`ast-to-gantt.ts`）の変更のみを担当する。**

### 現状（コード上、確認済みの事実）

`markdownEditor-for-mywork/src/lib/gantt/ast-to-gantt.ts` の見出し（`Section`）を変換する関数（308-333行付近）は、次のようになっている。

```ts
const type: GanttNodeType = section.depth === 1 ? 'project' : 'section'
const range = sectionDescendantDateRange(section)
const sectionId = makeGlobalKey(sourcePath, section.id)
const ganttNode: GanttNode = {
  id: sectionId,
  parentId,
  type,
  name: section.title,
  ...(range ? { start: range.start, end: range.end } : {}),
}

// issue-phase011-markdownEditor-001: 見出し自身の @plan を点線枠として描画する。
if (section.meta?.plan) {
  const plan = parseSchedule(section.meta.plan)
  if (plan) ganttNode.plan = plan
}

// issue-phase011-markdownEditor-001: 見出し自身の @due をマイルストン形状に変換する。
if (section.meta?.due) {
  const milestone = parseMilestone(section.meta.due)
  if (milestone) ganttNode.milestone = milestone
}
```

`range`（見出しのバーの開始・終了）は `sectionDescendantDateRange(section)`（113-130行付近）から得られ、これは**配下の子ノードと下位の見出しの日付メタを再帰的に集計した結果**である。**見出し自身の `section.meta.schedule` は、この集計にも、上記のコードのどこにも参照されておらず、完全に無視されている。** つまり、見出しに `@schedule` を書いても、それがバーの期間に反映されることは一度もない。これが「一切反映されていません」という報告の一因である可能性が高い。

一方、見出し自身の `@plan` と `@due` は既にこのコードで反映されている（上記の2つの `if` ブロック）。今回追加するのは `@schedule` の扱いのみである。

`sectionHasSchedule(section)`（62-69行）は、見出し・配下いずれかに日付メタがあれば true を返す可視性判定用の関数であり、これは変更不要（見出し自身の `@schedule` の有無は、この関数がチェックする `hasDateMeta(section.meta)` に既に含まれているため、可視性自体は現状でも正しく決まる。問題は「見出しに `@schedule` があるとき、それをバーの期間として使うかどうか」という別の論点である）。

### `hasExplicitSchedule` フラグについて

ガントライブラリの `GanttNode` 型は、`type === 'task'` のノードにのみ「plan/schedule 共存時のラベル抑制」ルールが適用される設計になっている（`ganttchart-for-mywork/src/components/GanttTimeline.svelte` の `getLabelClips` 内、`isTaskType = node.type === 'task'` で判定）。見出し（`section` / `project`）やリスト項目（`subsection`）にこのルールを適用できるようにするため、`issue-phase012-gantt-003` にて、ライブラリ側に `GanttNode.hasExplicitSchedule?: boolean` という新しいフィールドが追加され、`isTaskType` の代わりに `isTaskType || node.hasExplicitSchedule === true` で判定するように変更される予定である。

このフィールドは「バーの期間が、このノード自身に明示的に書かれた予定（`@schedule`）に由来するか」を表す。**集計によって決まった期間（配下のタスクの日付から計算されたもの）の場合は、このフラグを立てない。** これにより、見出し自身に `@schedule` がある場合だけラベル抑制ルールが働き、集計期間しかない見出しでは、これまでどおり見出しの名前がバーに表示され続ける。

`GanttNode.metadata` フィールドは「ライブラリは無視する」と型定義に明記されているため、この判定に `metadata.schedule` を使うことはできない（ライブラリ側のロジックが `metadata` を参照してはならない）。そのため、専用の `hasExplicitSchedule` フィールドが必要になる。

## 2. Objective（目的）

1. 見出しに `@schedule` がある場合、そのバーの期間を見出し自身の `@schedule` の値にする（ない場合は、従来どおり配下の集計期間を使う）。
2. task・リスト項目（`subsection`）・見出し（`section`/`project`）のうち、バーの期間が自身の明示的な予定（`@schedule` または、リスト項目における `@schedule` 由来の期間）に由来する場合に `hasExplicitSchedule: true` を設定し、ライブラリ側のラベル抑制ルールが正しく適用されるようにする。

## 3. Scope（スコープ）

- `src/lib/gantt/ast-to-gantt.ts` の、見出し（`Section`）を変換する関数、リスト項目（`type: 'subsection'`）を変換する箇所、task（`type: 'task'`）を変換する箇所。
- 対象外: `src/lib/gantt/ast-to-gantt.ts` 以外のファイル。`GanttNode` 型自体への `hasExplicitSchedule` フィールドの追加（`issue-phase012-gantt-003` で対応済みであることを前提とする）。plan と schedule の共存時のラベル抑制ロジック自体（ライブラリ側、同 issue で対応）。

## 4. Implementation requirements（実装要件）

### 4.1 見出し自身の `@schedule` を優先してバーの期間にする

見出しを変換する関数（308-333行付近）を次のように変更する。

- `section.meta?.schedule` が存在し、かつ既存の `parseSchedule()`（このファイル冒頭で定義されている、`"start/end"` 形式の文字列を `{start, end}` にパースする関数）でパースできた場合は、その `{start, end}` を `range` の代わりに使う。
- パースできなかった場合、または `section.meta?.schedule` が存在しない場合は、従来どおり `sectionDescendantDateRange(section)` の結果を使う。

変更後のイメージ:

```ts
const explicitSchedule = section.meta?.schedule ? parseSchedule(section.meta.schedule) : null
const range = explicitSchedule ?? sectionDescendantDateRange(section)
const sectionId = makeGlobalKey(sourcePath, section.id)
const ganttNode: GanttNode = {
  id: sectionId,
  parentId,
  type,
  name: section.title,
  ...(range ? { start: range.start, end: range.end } : {}),
  ...(explicitSchedule ? { hasExplicitSchedule: true } : {}),
}
```

（`GanttNode` 型に `hasExplicitSchedule` フィールドが存在しない場合、この行は TypeScript のコンパイルエラーになる。`issue-phase012-gantt-003` が先に完了し、`svelte-gantt-lib` の型定義にこのフィールドが追加されていることを前提とする。詳細は「6. Dependencies」を参照。）

`@plan` と `@due` を反映する既存の2つの `if` ブロックは変更しない。

### 4.2 リスト項目（`type: 'subsection'`）に `hasExplicitSchedule` を設定する

`type: 'subsection'` を生成している箇所（250行付近）で、`node.meta?.schedule` がパースでき、それによって `start`/`end` を設定している場合に `hasExplicitSchedule: true` を追加する。該当箇所の既存コードを確認し、`schedule` の値から `start`/`end` を設定している条件分岐に、同じ条件で `hasExplicitSchedule: true` を追加すること。

### 4.3 task（`type: 'task'`）には `hasExplicitSchedule` を明示的に設定してもよいが必須ではない

ライブラリ側の判定は `isTaskType || node.hasExplicitSchedule === true` になる予定であり、`type: 'task'` のノードは `isTaskType` が true になるため、`hasExplicitSchedule` を明示的に設定しなくても動作する。一貫性のため設定してもよいが、この issue の必須要件ではない。

## 5. Files / components likely to be changed（変更が見込まれるファイル／コンポーネント）

- `src/lib/gantt/ast-to-gantt.ts`
- `src/lib/gantt/ast-to-gantt.test.ts`（テスト追加）

## 6. Dependencies（依存関係）

- **必須の前提**: `issue-phase012-gantt-003__apply-plan-schedule-rules-to-all-node-types.md`（ganttchart-for-mywork 側）が完了し、`GanttNode` 型に `hasExplicitSchedule?: boolean` フィールドが追加され、当該ライブラリのビルドが最新化されていること。このリポジトリ（markdownEditor-for-mywork）は `vite.config.ts` / `esbuild.config.mjs` で `svelte-gantt-lib` を `node_modules/svelte-gantt-lib/src/index.ts`（symlink 経由でリポジトリの `src` に直接解決）にエイリアスしているため、ライブラリ側のソース変更は即座にこのリポジトリのビルドに反映される。型チェック（`npm run check`）を実行する前に、ライブラリ側の変更が完了していることを確認すること。
- 前提条件: 他の4リポジトリ（calendar / gantt / kanban / dashboard）の未コミットの作業ツリーが、プロジェクト管理者によってベースラインとしてコミットされていること。

## 7. Acceptance criteria（受け入れ基準）

- 見出しに `@schedule` を書くと、そのバーが見出し自身の `@schedule` の期間で描かれる（配下のタスクの日付ではなく）。
- 見出しに `@schedule` がなく、配下にタスクがある場合は、従来どおり配下の集計期間でバーが描かれる。
- `@schedule` と `@plan` を両方持つ見出しで、ライブラリ側のラベル抑制ルール（別 issue で実装）が正しく機能する（本 issue の完了後、`issue-phase012-gantt-003` 側の受け入れ基準と合わせて確認する）。

## 8. Test requirements（テスト要件）

`src/lib/gantt/ast-to-gantt.test.ts` に次のケースを追加する。

- 見出しに `@schedule: 2026-10-01/2026-10-05` があり、配下に別の日付を持つタスクがある場合 → 見出しの `start`/`end` が `@schedule` の値になり、`hasExplicitSchedule: true` が設定される。
- 見出しに `@schedule` がなく、配下にタスクがある場合 → 見出しの `start`/`end` が配下の集計期間になり、`hasExplicitSchedule` は設定されない（`undefined`）。
- 見出しの `@schedule` がパースできない不正な文字列の場合 → 従来どおり配下の集計期間にフォールバックする。
- リスト項目（`- 項目` に `@schedule` と `@plan` がある場合） → `type: 'subsection'`、`hasExplicitSchedule: true`、`plan` フィールドが設定される。
- 通常の task に `@schedule` がある場合 → 従来どおり `type: 'task'` として変換される（既存のテストが引き続き通ることを確認する）。

実行コマンド: `npm run test:unit`、`npm run build`（`svelte-gantt-lib` の型定義が更新された状態でビルドが通ることを確認する）。

## 9. Out of scope（対象外）

- ガントライブラリ側（`GanttNode` 型、`GanttTimeline.svelte` のラベル抑制ロジック）の変更（`issue-phase012-gantt-003` で対応する）。
- 見出しのバーをドラッグして `@schedule` を書き戻す機能（現状、見出しのバーのドラッグは Markdown に書き戻されない仕様であり、この issue でも変更しない）。
- calendar・dashboard で見出しの `@schedule` を扱うこと（対象外）。

## 要確認

- なし。

## Progress & Implementation Notes

### History

#### 2026-09-27

- User Instruction:
  - project/governance のルールに従い、issue-phase012 シリーズを順番にすべて実装する

- Change:
  - **前提の確認**: `node_modules/svelte-gantt-lib`（symlink先 `ganttchart-for-mywork`）の `src/types.ts`・`GanttTimeline.svelte` に `hasExplicitSchedule` が既に実装済みであることを確認した。ただし `dist/`（`tsc` の Node解決が参照する型）が未再生成だったため、`ganttchart-for-mywork` 側で `npm run build` を実行して `dist/types.d.ts` に反映させた（ソースコードの変更は行っていない。既存のビルド成果物の再生成のみ）
  - `src/lib/gantt/ast-to-gantt.ts` の見出し変換部分（`extractFromSection`）: `section.meta?.schedule` を `parseSchedule()` でパースし、成功すれば `range`（バーの期間）に優先して使い、`hasExplicitSchedule: true` を設定するようにした。パース失敗または `@schedule` 無しの場合は従来どおり `sectionDescendantDateRange(section)` にフォールバックする。既存の `@plan`/`@due` の反映処理は変更していない
  - `list` 分岐（`type: 'subsection'`）: `node.meta?.schedule` がパースできて `start`/`end` を設定する条件に、同じ条件で `hasExplicitSchedule: true` を追加した
  - `task` 分岐: Issue 本文どおり必須ではないため変更していない（`isTaskType` により自動的にラベル抑制ルールが適用されるため）
  - 単体テスト追加: `src/lib/gantt/ast-to-gantt.test.ts` に5件（見出しの明示的 schedule 優先＋hasExplicitSchedule設定、schedule無し時の集計フォールバック＋hasExplicitSchedule未設定、不正なschedule文字列時のフォールバック、リスト項目のschedule+plan+hasExplicitSchedule、通常taskの既存回帰）

- Rationale:
  - Implementation requirements の変更後イメージをそのまま実装した。ライブラリ側の型定義が古いビルド成果物を参照していたため、型チェックが通らない状態だったが、これは「ライブラリ側のソース変更が完了していない」のではなく「ビルドが未反映」という状態であり、Dependencies 節の前提条件（「ライブラリのビルドが最新化されていること」）を満たすために必要な最小限の対応としてビルドのみ実行した

- Verification:
  - `npx vitest run` → 26 test files / 536 tests すべて成功（新設5件含む）
  - `npx tsc --noEmit` → `hasExplicitSchedule` 関連の型エラーは解消。変更ファイルに起因するその他の型エラーなし
  - `node esbuild.config.mjs production` → ビルド成功
  - **実機 Obsidian E2E 検証を実施**: `gantt-view.e2e.ts` を実行し、8件中6件成功。残り2件（バードラッグ・completed装飾のグレーアウト）は issue-phase011-markdownEditor-001 の作業時に特定済みの、本セッションの変更とは無関係な既存の日付ドリフト問題（`test-tasks.md` の固定フィクスチャ日付と実行時の現在日時のズレ）であり、本 issue による新規の回帰ではないことを確認済み

- Status: 実装完了・実機E2E確認済み（無関係な既存の2件を除き成功）。ユーザーの明示的な承認待ちのため Issue は Open のまま（WORKFLOW.md §6）。
