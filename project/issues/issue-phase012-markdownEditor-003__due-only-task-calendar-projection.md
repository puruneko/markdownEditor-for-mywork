# `@due` のみを持つタスクを calendar 用データに投影し、クリック時のID接尾辞を正規化する

## 1. Background（背景）

`修正したい箇所.md` の calendar 節（週表示）:

> カードをクリックしても該当行に移動しない場合があります。原因を分析し、解決して。
> - →追加要望。dueはタスク名表示を優先。全部入らない場合は時間は非表示。
> - →そもそもdueが表示されていないので、修正して。

### 現状（コード上、確認済みの事実）

`markdownEditor-for-mywork/src/lib/calendar/ast-to-calendar.ts` の `extractFromNodes` 関数（87行〜）は、次の条件でのみタスクを calendar 用の `CalendarItem`（`Task` 型）に変換している。

```ts
if (node.type === 'task' && node.meta?.schedule) {
  // ... schedule をパースして CalendarItem を生成 ...
}
```

この条件は `node.meta?.schedule`（`@schedule`）の有無だけを見ており、`node.meta?.due`（`@due`）は**一切参照されていない**（ファイル全体を検索しても `due` という文字列は出現しない）。そのため、`@schedule` を持たず `@due` のみを持つタスクは、この関数の対象から完全に外れ、calendar 側の `CalendarItem[]` に含まれない。

一方、calendar ライブラリ（`calendar-for-mywork`）側には、期限を表示するための仕組みが既に実装済みである。

- `models/temporal.ts` に `CalendarDatePoint`（日単位の一点。`{ kind: 'CalendarDatePoint', at: ISODate }`）と `CalendarDateTimePoint`（分単位の一点。`{ kind: 'CalendarDateTimePoint', at: DateTime }`）が定義されている。
- `utils/itemUtils.ts` の `isDeadlineDay(item)` / `isDeadlineTimed(item)` は、`item.temporal.kind` がこれらのいずれかであるかを判定する（**`item.type` は見ていない**）。
- `WeekView.svelte` は、`item.isDeadline`（`isDeadlineTimed(item)` の結果）が true のとき `.deadline-content` として、↓アイコン＋タイトル＋（分単位の場合）時刻を表示する描画パスを既に持つ（1736-1756行付近）。
- `MonthView.svelte` は、`isDeadlineDay(item)` が true の複数日／単日アイテムに対して、←アイコン付きの赤系スタイルで描画するパスを既に持つ（855-866行付近。こちらも `item.type` ではなく `temporal.kind` で判定している）。
- `utils/itemUtils.ts` の `PRESET_STYLE_RULES`（146-167行）には、`item.type === 'task'` の場合にのみ適用される「期限超過タスクは左に赤枠」「完了/中止タスクはグレー・半透明」というスタイルルールが定義されている。

このため、`@due` のみを持つタスクを **`type: 'task'`** として投影すれば、上記の期限超過・完了時のスタイルルールが自動的に適用される、という設計上の利点がある（`type: 'deadline'` にすると `status` を保持できず、これらのルールの対象外になる）。

### 加えて確認された事実: エディタからの書き込み経路とID接尾辞の必要性

`CalendarTab.svelte`（147-154行付近、`handleExternalDrop` 内）は、エディタからカレンダーの終日帯へタスクをドラッグ＆ドロップした際、次のように **`@due` を書き込む**処理を既に持つ:

```ts
if (inAllday) {
  const dueValue = dropDay.toFormat('yyyy-MM-dd')
  void onNodePatch(globalKey, (md, _doc, node) => upsertDue(md, node, dueValue))
  return
}
```

つまり、現状は「エディタから終日帯へドロップすると `@due` が書き込まれるが、その `@due` を持つタスクが calendar 上に表示されない」という、書き込みと表示の非対称が生じている。

`CalendarTab.svelte` の `handleItemClick`（74-76行）・`handleItemMove`（54-60行）・`handleItemResizeEnd`（66-72行）・`handleItemUpdate`（160行以降）は、いずれも `item.id` を**そのまま** `onNodeClick` / `onNodePatch` に渡す globalKey として使っている。もし `@due` から生成する項目の `id` に、schedule 項目と区別するための接尾辞（例: `__due`）を付与すると、これらの関数がその接尾辞付きの ID をそのまま globalKey として使ってしまい、書き戻し・クリック遷移の両方が壊れる。

具体的には、`src/lib/viewmodel/resolve.ts` の `patchInFile` / `resolveRef` は `parseGlobalKey` で `filePath` と `localId` に分解した後、`findNodeById(doc, localId)` でノードを探すが、`localId` に想定外の接尾辞が付いていると該当ノードが見つからず、`if (!node) return`（何もせず終了。エラーも出ない）となる。同様に、クリック遷移を行う `src/views/ShadowItemView.ts` の `navigateToNode`（212行付近）も `doc.nodeLineMap.get(stripOccurrenceSuffix(localId))` でノードの行を探すが、`stripOccurrenceSuffix` は末尾の `__r<数字>`（`@repeat` のオカレンス接尾辞）しか除去しないため、`__due` を除去できず、同様に失敗する。

**したがって、`@due` 項目の ID に接尾辞を付与する場合は、`CalendarTab.svelte` 自身が、`onNodePatch` / `onNodeClick` を呼ぶ直前に接尾辞を取り除く必要がある。** `ShadowItemView.ts` や `resolve.ts` 側を変更する必要はない（これらは常に接尾辞のない通常の globalKey だけを受け取ればよい）。

## 2. Objective（目的）

`@due` を持つタスク（`@schedule` を持たないもの）が calendar 上に期限として表示され、かつクリックで該当行に正しく遷移できるようにする。

## 3. Scope（スコープ）

- `src/lib/calendar/ast-to-calendar.ts`: `@due` のみを持つタスクを期限項目として投影するロジックの追加。
- `src/lib/viewmodel/global-key.ts`: `__due` 接尾辞を除去する関数の追加。
- `src/lib/calendar/CalendarTab.svelte`: 期限項目の ID から接尾辞を除去してから `onNodePatch` / `onNodeClick` を呼ぶように変更。
- 対象外: `@schedule` と `@due` を両方持つタスクの扱い（別 issue で対応する。本 issue は `@due` のみを持つタスクに限定する）。`@due` が期間（`start/end` 形式）の場合の扱い（対象外。項目を生成しない）。calendar-for-mywork（ライブラリ本体）の変更（本 issue はホスト側の投影ロジックのみを対象とする。ライブラリ側の表示ロジックは既存のものをそのまま使う）。

## 4. Implementation requirements（実装要件）

### 4.1 `src/lib/calendar/ast-to-calendar.ts`: 期限項目の投影を追加する

`extractFromNodes` 関数内、既存の `if (node.type === 'task' && node.meta?.schedule) { ... }` ブロック（96行〜）とは**独立した別の分岐**として、次の条件を追加する。

```ts
if (node.type === 'task' && !node.meta?.schedule && node.meta?.due && !node.meta?.repeat) {
  // due のみを持つタスクを期限項目として生成する
}
```

この分岐の中で、次の規則に従って `CalendarItem`（`Task` 型）を1件生成し `items` 配列に push する。

- `id`: `` `${makeGlobalKey(sourcePath, node.id)}__due` ``（末尾に `__due` を付与する。schedule 項目の ID `makeGlobalKey(sourcePath, node.id)` と衝突しないようにするため）。
- `type: 'task'`
- `status: mapStatus(node.status)`（既存の schedule 分岐と同じ関数を使う）
- `title: node.text`
- `parents`: 既存の schedule 分岐と同じ算出方法（`node.path.slice(0, -1).map(p => p.replace(/\[\d+\]$/, ''))`）を使う。
- `temporal`: `node.meta.due` の文字列の形式によって次のように分岐する。
  - 正規表現 `/^\d{4}-\d{2}-\d{2}$/` に一致する（日付のみ）場合: `{ kind: 'CalendarDatePoint', at: node.meta.due }`
  - 上記に一致せず、`DateTime.fromISO(node.meta.due)` が有効な場合: `{ kind: 'CalendarDateTimePoint', at: DateTime.fromISO(node.meta.due) }`
  - `node.meta.due` が `/` を含む（期間指定）、またはどちらの形式にも一致しない場合: **この分岐では項目を生成しない**（`due` が期間の場合の扱いは対象外。既存の `parseMilestone` 関数（gantt 側の `ast-to-gantt.ts` にあるもの）は本ファイルには存在しないため、新たに import や複製をしないこと。日付のみ／日時のみの単純なケースだけを扱う）。
- `viewRange` が指定されている場合、期限の日付が `viewRange.start` から `viewRange.end` の範囲外であれば、この項目は生成しない（既存の schedule 分岐と同様の絞り込みを行う）。

`@repeat` を持つタスクの `@due` は対象外とする（オカレンス展開のロジックは `@schedule` の存在を前提にしているため、この issue では扱わない）。

既存の `@schedule` を使った投影処理は変更しない。

### 4.2 `src/lib/viewmodel/global-key.ts`: 接尾辞除去関数を追加する

既存の `stripOccurrenceSuffix` 関数（`__r\d+$` を除去する）は変更しない。その下に、新しい関数を追加する。

```ts
/**
 * calendar 側で `@due` のみを持つタスクを期限項目として投影する際に付与した
 * 末尾の `__due` サフィックスを除去する。
 * `@repeat` のオカレンスID（`__r<数字>`）とは無関係の別の接尾辞であり、
 * `stripOccurrenceSuffix` では除去できないため、専用の関数として用意する。
 */
export function stripDueSuffix(localId: string): string {
  return localId.replace(/__due$/, '')
}
```

### 4.3 `src/lib/calendar/CalendarTab.svelte`: 接尾辞を除去してから呼び出す

`stripDueSuffix` を `../viewmodel/global-key` から import する。次の4箇所で、`item.id` をそのまま渡している部分を `stripDueSuffix(item.id)` に置き換える。

- `handleItemClick`（74-76行）: `onNodeClick?.(item.id)` → `onNodeClick?.(stripDueSuffix(item.id))`
- `handleItemMove`（54-60行）: `onNodePatch(item.id, ...)` の `item.id` を `stripDueSuffix(item.id)` に置き換える。
- `handleItemResizeEnd`（66-72行）: 同様に `item.id` を `stripDueSuffix(item.id)` に置き換える。
- `handleItemUpdate`（160行以降）: 同様に `item.id` を `stripDueSuffix(item.id)` に置き換える。

（`handleItemMove` と `handleItemResizeEnd` は、`item.temporal.kind !== 'CalendarDateTimeRange'` の場合に早期リターンする既存のガードがあるため、期限項目に対しては実質的に処理が進まない。それでも、将来の変更で早期リターンの条件が変わった場合に備え、上記4箇所すべてに一貫して適用すること。）

`handleExternalDrop` 内で `makeGlobalKey(payload.sourcePath, payload.nodeId)` から直接組み立てている `globalKey`（147行付近、`@due` を書き込む処理）は、`item.id` を経由しない別の変数であるため、この issue の変更対象ではない（変更不要）。

## 5. Files / components likely to be changed（変更が見込まれるファイル／コンポーネント）

- `src/lib/calendar/ast-to-calendar.ts`
- `src/lib/viewmodel/global-key.ts`
- `src/lib/calendar/CalendarTab.svelte`
- `src/lib/calendar/ast-to-calendar.test.ts`（テスト追加）
- `src/lib/viewmodel/global-key.test.ts`（テスト追加）

## 6. Dependencies（依存関係）

- 前提条件: 他の4リポジトリ（calendar / gantt / kanban / dashboard）の未コミットの作業ツリーが、プロジェクト管理者によってベースラインとしてコミットされていること。
- このリポジトリ内での依存: なし。単独で着手可能（`svelte-calendar-lib` の既存の型定義・既存のライブラリ機能のみを使用し、calendar-for-mywork 側への変更は不要）。
- 関連（依存ではないが、同じ入力要件から派生している別リポジトリの issue）:
  - `issue-phase012-calendar-002__deadline-allday-click-and-time-label-display.md`（calendar-for-mywork 側。終日帯・月表示でのクリック精度向上と、期限の時刻表示の幅調整を扱う。本 issue の変更だけでも `@due` の項目は表示され、クリック遷移も機能するが、終日帯でのクリックの取りこぼしがある場合の追加対策は当該 issue で行う）。

## 7. Acceptance criteria（受け入れ基準）

- `@schedule` を持たず `@due` のみを持つタスクが、週表示・月表示に期限として表示される。
- 表示された期限項目をクリックすると、対応する Markdown の行にエディタのカーソルが移動する。
- エディタから calendar の終日帯へタスクをドラッグ＆ドロップして `@due` が書き込まれた後、そのタスクが期限として表示され、クリックで遷移できる。
- `@schedule` と `@due` を両方持つタスクの既存の表示（schedule 項目のみが表示される現状の挙動）が変わらないこと。

## 8. Test requirements（テスト要件）

`src/lib/calendar/ast-to-calendar.test.ts` に次のケースを追加する。

- `@due: 2026-10-01`（日付のみ）を持つタスク → `CalendarDatePoint` の項目が1件生成され、`id` が `` `${対象ノードのglobalKey}__due` `` になっている。
- `@due: 2026-10-01T15:00`（日時）を持つタスク → `CalendarDateTimePoint` の項目が生成される。
- `@schedule` と `@due` を両方持つタスク → 期限項目は生成されず、既存の schedule 項目のみが生成される（1件のまま）。
- `@due` が期間形式（例: `2026-10-01/2026-10-03`）のタスク → 期限項目は生成されない（0件）。
- `@due` の値が日付としてパースできない文字列のタスク → 期限項目は生成されない。
- `@due` と `@repeat` を両方持つタスク → 期限項目は生成されない。
- `viewRange` を指定し、期限の日付がその範囲外にあるタスク → 期限項目は生成されない。

`src/lib/viewmodel/global-key.test.ts` に次のケースを追加する。

- `stripDueSuffix('note.md::id0__due')` が `'note.md::id0'` を返す。
- `stripDueSuffix('note.md::id0')`（接尾辞なし）が入力をそのまま返す。
- 既存の `stripOccurrenceSuffix` が `__due` サフィックスを除去しないこと（回帰確認。`stripOccurrenceSuffix('note.md::id0__due')` が `'note.md::id0__due'` のまま変わらないことを確認する）。

実行コマンド: `npm run test:unit`、`npm run build`（ビルドが通ることを確認する）。

## 9. Out of scope（対象外）

- `@schedule` と `@due` を両方持つタスクの表示方法（別 issue `issue-phase012-calendar-002` 以降、または新規 issue で対応する）。
- `@due` が期間形式（`start/end`）の場合の投影（対象外。今回は単一日時のみを扱う）。
- 期限項目をドラッグして `@due` の値を書き換える機能（`handleItemMove` / `handleItemResizeEnd` は Point 型の temporal に対して早期リターンする既存の挙動のままとし、変更しない）。
- calendar-for-mywork（ライブラリ本体）のコード変更。

## 要確認

- なし（ユーザーへの確認済み事項: `@schedule` と `@due` の両方を持つタスクは両方の表示箇所に出す、という回答を得ているが、その実装は本 issue の対象外とし、別 issue で扱う）。

## Progress & Implementation Notes

### History

#### 2026-09-27

- User Instruction:
  - project/governance のルールに従い、issue-phase012 シリーズを順番にすべて実装する

- Change:
  - `src/lib/calendar/ast-to-calendar.ts`: `buildDueOnlyItem()` を新設し、`extractFromNodes()` に既存の `@schedule` 分岐とは独立した新しい分岐（`node.type === 'task' && !node.meta?.schedule && node.meta?.due && !node.meta?.repeat`）を追加した。`@due` が `/^\d{4}-\d{2}-\d{2}$/` に一致すれば `CalendarDatePoint`、`DateTime.fromISO` で有効な日時ならば `CalendarDateTimePoint`、期間形式（`/` を含む）またはどちらにも一致しなければ項目を生成しない。`id` は `` `${makeGlobalKey(...)}__due` ``。`viewRange` 指定時は期限日時が範囲外なら生成しない
  - `src/lib/viewmodel/global-key.ts`: `stripDueSuffix(localId)` を新設（`__due$` を除去）。既存の `stripOccurrenceSuffix` は変更していない
  - `src/lib/calendar/CalendarTab.svelte`: `handleItemClick`・`handleItemMove`・`handleItemResizeEnd`・`handleItemUpdate` の4箇所で `item.id` を `stripDueSuffix(item.id)` に置き換えた。`handleExternalDrop` 内の `globalKey`（`item.id` を経由しない別変数）は変更していない
  - 単体テスト追加: `src/lib/calendar/ast-to-calendar.test.ts` に7件（日付のみ/日時/schedule併存時の非生成/期間形式の非生成/パース不能の非生成/repeat併存時の非生成/viewRange範囲外の非生成、および範囲内での生成の回帰確認）。`src/lib/viewmodel/global-key.test.ts` に3件（`stripDueSuffix` の基本動作、サフィックス無しの場合、`stripOccurrenceSuffix` が `__due` を除去しないことの回帰確認）

- Rationale:
  - Implementation requirements に記載された規則（正規表現・優先順位・viewRange絞り込み）をそのまま実装した。gantt側の `parseMilestone` は import・複製せず、Issue の指示どおり日付のみ／日時のみの単純なケースのみを自前で扱った

- Verification:
  - `npx vitest run` → 26 test files / 531 tests すべて成功（新設11件含む）
  - `npx tsc --noEmit` → 変更ファイルに起因する型エラーなし（`ast-to-calendar.test.ts` に残る2件の型エラーは本セッション開始前から存在した無関係な既存の問題であることを確認済み）
  - `node esbuild.config.mjs production` → ビルド成功
  - **実機 Obsidian E2E 検証を実施**: `calendar-view.e2e.ts`（4件成功）を実行し、既存のカレンダー機能に回帰が無いことを確認した

- Status: 実装完了・実機E2E回帰確認済み。ユーザーの明示的な承認待ちのため Issue は Open のまま（WORKFLOW.md §6）。
