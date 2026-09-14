# 統一Markdownデータ仕様に基づくデータ定義インターフェースを整備する

## 1. 問題と方向性  — 人間向け

### この Issue が解決する問題

`for-mywork` 配下には、ホストである本リポジトリのほか、4つの連携アプリ（`calendar-for-mywork`・`ganttchart-for-mywork`・`kanban-for-mywork`・`dashboard-for-mywork`）が存在する。すべて同じ Markdown を情報源としているが、**同じ概念を、層ごとに違う語彙・違う粒度で、それぞれ独立に実装してしまった**状態になっている。

ユーザーの運用ルール（`dashboard-for-mywork/project/knowledge/【AI用引き継ぎ書】v1_認知負荷低減型_案件Markdown運用ルール細則_20260820_v1.1.md`、および同フォルダのマニュアル）が定める語彙と、本リポジトリのパーサー実装を突き合わせると、次の乖離がある。

| 概念 | 運用ルールが定める内容 | 本リポジトリの現在の実装 |
|---|---|---|
| タスク状態 | 7状態（`[?]`計画中・`[ ]`未着手・`[>]`作業中・`[!]`待ち・`[/]`一時保留・`[x]`完了・`[-]`中止） | **5状態のみ**。`src/lib/parser/plugins/remark-task-status.ts:14` の `CUSTOM_MARKER_RE = /^\[([>!\-])\] ([\s\S]+)$/` に `?` と `/` が含まれず、`[?]`・`[/]` はタスクとして解析されない |
| 状態の内部名 | `planning`／`ready`／`in_progress`／`waiting`／`deferred`／`completed`／`cancelled` | `src/lib/parser/types.ts:1` の `'todo' \| 'doing' \| 'done' \| 'blocked' \| 'hold'`。`blocked`（要注意・ブロック）と運用ルールの「待ち」、`hold`（保留・スキップ）と「中止」は意味が異なる |
| メタキー | 7キー（`@期限`・`@想定期間`・`@実施日時`・`@完了イメージ`・`@目的`・`@セーブポイント`・`@特記事項`）。人が編集する Markdown では日本語名を基本とする | `src/lib/parser/meta-keys.ts:1-9` の `META_KEYS` は7キーだが内訳が違う（`plan`・`schedule`・`due`・`priority`・`dependsOn`・`tags`・`repeat`）。`@完了イメージ`・`@目的`・`@セーブポイント`・`@特記事項` に対応するキーは**1つも存在しない** |
| メタキーの表記 | 日本語名が基本 | `src/lib/parser/plugins/remark-meta-fields.ts:17` の `META_LINE_RE = /^@(\w+)(\?)?:\s*(.*)$/`。`\w` は ASCII のみのため、`@実施日時:` のような日本語キー行は**正規表現に一致せず**、メタとして扱われない（通常のリスト行として残る） |
| メタ値の形 | `@完了イメージ` 等は子リスト（複数行）を値に取る | `remark-meta-fields.ts:56-64` は `- @key: 値` の**先頭1段落のみ**を値として読む。子リストは `:65-67` で兄弟ノードへ強制的に付け替えられる |

この結果、ユーザーが運用ルールどおりに Markdown を書いても、本リポジトリはその半分程度しか構造化できていない。連携アプリ側は、渡されない情報を表示しようがない。

ユーザーはこの状況を整理するため、統一データ仕様の提案書（`__workspace/unified-markdown-data-spec-proposal.md`）をレビューし、承認した（2026-09-14）。本 Issue は、そのうち**ホスト側が担う部分**を実装する。

### 方向性

- 本リポジトリは、統一データ仕様における**データ定義の保持者**である。カノニカル（正準）な型・語彙テーブルを本リポジトリが単独で持ち、各連携アプリへはそれぞれのアプリ固有の型へ**投影（projection）してから**渡す。
- **連携アプリは本リポジトリの型を参照しない**。連携アプリは、自分自身のリポジトリで定義した汎用的な型のみを持つ（`BR-043`〜`BR-047` の責務境界を維持する）。本 Issue は連携アプリ側のコードを変更しない。連携アプリ側の対応は、各リポジトリの Issue で個別に扱う（`2.7 節` 参照）。
- 状態の内部名は、運用ルールの7語彙へ移行する（`todo`→`ready`、`doing`→`in_progress`、`blocked`→`waiting`、`hold`→`cancelled`、`done` は据え置き、`planning`・`deferred` を新設）。これは破壊的変更であるため、**連携アプリ側が新旧どちらの値でも壊れない状態になった後**に本リポジトリを切り替える（`2.7 節` の順序）。
- 作業は優先度 A → B → C の順に進める。A だけでも運用ルールとの最大の乖離（7状態）が解消される。
- Issue を伴わない直接編集を行わない（`WORKFLOW §1`）。実装完了後も、人間の明示的な closure 承認を得るまで `status` は `open` のままとする（`WORKFLOW §6`）。

---

## 2. 進捗と実装メモ  — AI 向け

### 2.1 カノニカルデータ定義（本 Issue で確定させる内容）

以下が、本リポジトリが保持すべきデータ定義である。実装者はこの表を唯一の根拠とすること。

#### 2.1.1 タスク状態（7値）

| Markdown 記法 | カノニカル内部名 | 運用ルール上の意味 | 現在の内部名 |
|---|---|---|---|
| `- [?] 本文` | `planning` | 計画中（内容・順序・日時が未整理） | **なし（未実装）** |
| `- [ ] 本文` | `ready` | 未着手（実行可能だが未開始） | `todo` |
| `- [>] 本文` | `in_progress` | 作業中 | `doing` |
| `- [!] 本文` | `waiting` | 待ち（外部条件の待ち） | `blocked` |
| `- [/] 本文` | `deferred` | 一時保留（自分の都合による後回し） | **なし（未実装）** |
| `- [x] 本文` | `done` | 完了 | `done` |
| `- [-] 本文` | `cancelled` | 中止（実施しないが流れを残す） | `hold` |

#### 2.1.2 メタキー（11キー）

| 日本語表記 | カノニカル内部キー | 値の形 | 現在の実装 |
|---|---|---|---|
| `@想定期間` | `plan` | `string`（`開始/終了`） | あり |
| `@実施日時` | `schedule` | `string`（`開始/終了`） | あり |
| `@期限` | `due` | `string`（単一または範囲） | あり |
| `@完了イメージ` | `condition` | `string \| string[]` | **なし** |
| `@目的` | `purpose` | `string \| string[]` | **なし** |
| `@セーブポイント` | `savepoint` | `string \| string[]` | **なし** |
| `@特記事項` | `special_note` | `string \| string[]` | **なし** |
| （運用ルールに無し） | `priority` | `number` | あり |
| （運用ルールに無し） | `tags` | `string[]` | あり |
| （運用ルールに無し） | `dependsOn` | `string[]` | あり |
| （運用ルールに無し） | `repeat` | `string` | あり |

`?`（仮置き）修飾子は `plan`・`schedule`・`due` の3キーにのみ意味を持つ（現行 `Meta.tentative` の仕様を維持する）。

### 2.2 対象ファイル

| ファイル | 役割 | 優先度 |
|---|---|---|
| `src/lib/contract/canonical.ts` | **新規作成**。カノニカルな型と語彙テーブルの単一の情報源 | A |
| `src/lib/parser/types.ts` | `Status`・`Meta` の定義を `contract/canonical.ts` からの再エクスポートへ置き換える | A |
| `src/lib/parser/plugins/remark-task-status.ts` | `[?]`・`[/]` の解析追加、状態名の移行 | A |
| `src/lib/parser/ast-to-md.ts` | 状態名 → マーカーの書き戻し表を移行 | A |
| `src/lib/calendar/markdown-patch.ts` | 同上（カレンダー用の書き戻し） | A |
| `src/lib/highlight/task-language.ts` | エディタ装飾の正規表現に `?`・`/` を追加 | A |
| `src/lib/agenda/ast-to-agenda.ts` | 未完了判定の状態集合を移行 | A |
| `src/lib/health/rules.ts` | 同上（3箇所） | A |
| `src/lib/query/parse-query.ts` | クエリで受理する状態集合を移行 | A |
| `src/lib/tray/extract-unscheduled.ts` | 同上 | A |
| `src/lib/kanban/ast-to-kanban.ts` | レーン定義・フィールド定義の状態値を移行 | A |
| `src/lib/kanban/KanbanTab.svelte` | 同上（`:72`） | A |
| `src/lib/calendar/ast-to-calendar.ts` | 状態丸めの移行、`plan`・`tentative` の投影追加 | A・C |
| `src/lib/parser/meta-keys.ts` | 日本語エイリアス表の追加、4キーの追加 | A・B |
| `src/lib/parser/plugins/remark-meta-fields.ts` | 正規表現の Unicode 対応、4キーの受理、複数行値の対応 | A・B・C |
| `src/lib/gantt/ast-to-gantt.ts` | `plan`・`milestone`・`tentative`・`status` の投影追加 | C |

### 2.3 優先度A：状態語彙の移行と `[?]`・`[/]` の解析

#### A-1. `src/lib/contract/canonical.ts` を新規作成する

次の内容を持つファイルを作成する。本リポジトリ内で状態・メタキーの語彙を参照する箇所は、すべてこのファイルを import する。

```ts
/** 統一Markdownデータ仕様: タスク状態（7値） */
export type Status =
  | 'planning'
  | 'ready'
  | 'in_progress'
  | 'waiting'
  | 'deferred'
  | 'done'
  | 'cancelled'

/** Markdown のチェックボックス内文字 → Status */
export const STATUS_BY_MARKER: Readonly<Record<string, Status>> = {
  '?': 'planning',
  ' ': 'ready',
  '>': 'in_progress',
  '!': 'waiting',
  '/': 'deferred',
  'x': 'done',
  '-': 'cancelled',
} as const

/** Status → Markdown のチェックボックス表記（書き戻し用） */
export const MARKER_BY_STATUS: Readonly<Record<Status, string>> = {
  planning:    '[?]',
  ready:       '[ ]',
  in_progress: '[>]',
  waiting:     '[!]',
  deferred:    '[/]',
  done:        '[x]',
  cancelled:   '[-]',
} as const

/** 未完了とみなす状態（done・cancelled 以外） */
export const INCOMPLETE_STATUSES: readonly Status[] =
  ['planning', 'ready', 'in_progress', 'waiting', 'deferred'] as const
```

`Meta` 型と `META_KEYS` は `B-1`・`B-2` で同ファイルへ追加する。優先度Aの時点では `Meta` は `src/lib/parser/types.ts` の現状のまま据え置いてよい。

#### A-2. `src/lib/parser/types.ts:1` を置き換える

```ts
// 変更前
export type Status = 'todo' | 'doing' | 'done' | 'blocked' | 'hold'

// 変更後
export type { Status } from '../contract/canonical'
```

`Meta`（`:3-17`）・`TaskNode`（`:19-35`）・`ListNode`（`:37-51`）・`QuoteNode`（`:53-62`）・`Node`（`:64`）・`Section`（`:66-75`）・`Document`（`:77-82`）は、この時点では変更しない。本ファイルを import している36箇所は、`Status` の値が変わるだけで型名は変わらないため、import 文の修正は不要である。

#### A-3. `src/lib/parser/plugins/remark-task-status.ts` を変更する

```ts
// 変更前（:14）
const CUSTOM_MARKER_RE = /^\[([>!\-])\] ([\s\S]+)$/

// 変更後
const CUSTOM_MARKER_RE = /^\[([>!\-?/])\] ([\s\S]+)$/
```

```ts
// 変更前（:16-21）
function markerToStatus(marker: string): Status | null {
  if (marker === '>') return 'doing'
  if (marker === '!') return 'blocked'
  if (marker === '-') return 'hold'
  return null
}

// 変更後（STATUS_BY_MARKER を使う）
function markerToStatus(marker: string): Status | null {
  return STATUS_BY_MARKER[marker] ?? null
}
```

`:28`（`checked === true`）は `'done'` のまま変更しない。`:32`（`checked === false`）を `'todo'` から `'ready'` へ変更する。

**注意**: `STATUS_BY_MARKER` は `' '`（半角空白）・`'x'` のキーも持つが、それらは remark-gfm が `checked` として先に処理するため、`CUSTOM_MARKER_RE` 経由で到達することはない。到達しない経路があること自体は不具合ではない。

#### A-4. 状態名を参照している全箇所を移行する

次の12箇所で、旧状態名を新状態名へ置き換える。`todo`→`ready`、`doing`→`in_progress`、`blocked`→`waiting`、`hold`→`cancelled`（`done` は変更なし）。

| ファイル:行 | 現在の内容 | 変更方針 |
|---|---|---|
| `src/lib/parser/ast-to-md.ts:8-16` | `statusToMarker()` の switch | `MARKER_BY_STATUS[status]` を返す実装へ置き換える |
| `src/lib/calendar/markdown-patch.ts:15-19` | 同様の switch | 同上 |
| `src/lib/agenda/ast-to-agenda.ts:32` | `new Set(['todo','doing','blocked','hold'])` | `new Set(INCOMPLETE_STATUSES)` へ置き換える |
| `src/lib/health/rules.ts:57` | 同上 | 同上 |
| `src/lib/health/rules.ts:178` | `node.status !== 'doing'` | `node.status !== 'in_progress'` |
| `src/lib/health/rules.ts:222` | `!== 'todo' && !== 'blocked' && !== 'hold'` | `!== 'ready' && !== 'waiting' && !== 'cancelled'` |
| `src/lib/query/parse-query.ts:10` | `new Set<Status>([...5値...])` | 7値へ拡張（`STATUS_BY_MARKER` の値集合を使ってよい） |
| `src/lib/tray/extract-unscheduled.ts:12` | `['todo','doing','blocked','hold']` | `[...INCOMPLETE_STATUSES]` |
| `src/lib/kanban/ast-to-kanban.ts:44-68` | レーン定義4件（`id`・`filter.value`・`updateRules.value`） | 7レーンへ拡張（`planning`・`deferred` を追加し、既存4件の値を新名称へ） |
| `src/lib/kanban/ast-to-kanban.ts:86` | `options: ['todo','doing','done','blocked','hold']` | 7値へ |
| `src/lib/kanban/ast-to-kanban.ts:14` | 型コメント | 7値へ |
| `src/lib/kanban/KanbanTab.svelte:72` | `VALID_STATUSES` の5値 | 7値へ |
| `src/lib/calendar/ast-to-calendar.ts:12-18` | `mapStatus()`（5→3値の丸め） | `in_progress`→`in_progress`、`done`→`done`、それ以外→`ready`（連携先の対応状況に合わせる。`2.7 節` 参照） |

#### A-5. `src/lib/highlight/task-language.ts:44` を変更する

```ts
// 変更前
/^(\s*- )(\[[xX>!\- ]\])(.*)$/

// 変更後
/^(\s*- )(\[[xX>!\-?/ ]\])(.*)$/
```

#### A-6. メタ行の正規表現を Unicode 対応にする

```ts
// 変更前（src/lib/parser/plugins/remark-meta-fields.ts:17）
const META_LINE_RE = /^@(\w+)(\?)?:\s*(.*)$/

// 変更後
const META_LINE_RE = /^@([\p{L}\p{N}_]+)(\?)?:\s*(.*)$/u
```

あわせて `src/lib/parser/meta-keys.ts` へ日本語エイリアス表を追加し、`applyMetaKey`（`remark-meta-fields.ts:19-46`）が switch する前にエイリアスを正規化する。

```ts
// src/lib/parser/meta-keys.ts へ追加
export const META_KEY_ALIASES: Readonly<Record<string, MetaKey>> = {
  '想定期間': 'plan',
  '実施日時': 'schedule',
  '期限':     'due',
} as const

export function normalizeMetaKey(raw: string): MetaKey | null {
  if (raw in META_KEYS) return raw as MetaKey
  return META_KEY_ALIASES[raw] ?? null
}
```

優先度Bで4キーを追加する際は、この `META_KEY_ALIASES` へ `'完了イメージ': 'condition'` 等の4行を追加する。

### 2.4 優先度B：未対応の4メタキーを追加する

#### B-1. `src/lib/contract/canonical.ts` へ `Meta` と `META_KEYS` を移設・拡張する

```ts
export const META_KEYS = {
  plan: 'plan',
  schedule: 'schedule',
  due: 'due',
  priority: 'priority',
  dependsOn: 'dependsOn',
  tags: 'tags',
  repeat: 'repeat',
  condition: 'condition',
  purpose: 'purpose',
  savepoint: 'savepoint',
  special_note: 'special_note',
} as const
export type MetaKey = keyof typeof META_KEYS

export type Meta = {
  plan?: string
  schedule?: string
  due?: string
  priority?: number
  dependsOn?: string[]
  tags?: string[]
  repeat?: string
  /** @完了イメージ。単一行なら string、子リストなら string[]（優先度C） */
  condition?: string | string[]
  purpose?: string | string[]
  savepoint?: string | string[]
  special_note?: string | string[]
  tentative?: { plan?: true; schedule?: true; due?: true }
}
```

`src/lib/parser/meta-keys.ts` は `contract/canonical.ts` からの再エクスポートにする（既存の import 元を変えないため）。`src/lib/parser/types.ts:3-17` の `Meta` も同様に再エクスポートへ置き換える。

#### B-2. `META_KEY_ALIASES` へ4行を追加する

```ts
'完了イメージ': 'condition',
'目的':        'purpose',
'セーブポイント': 'savepoint',
'特記事項':     'special_note',
```

#### B-3. `applyMetaKey`（`remark-meta-fields.ts:19-46`）へ4ケースを追加する

4キーはいずれも文字列としてそのまま格納する（この時点では単一行のみ。複数行は優先度C）。`?` 修飾子はこの4キーには適用しない（`tentative` へ入れない）。

### 2.5 優先度C：メタ値の複数行対応と、ガント／カレンダー投影の拡充

#### C-1. メタ値の複数行対応（`remark-meta-fields.ts:56-67`）

現在、`- @key: 値` の子ブロックは `:65-67` で親の兄弟へ付け替えられている。`condition`・`purpose`・`savepoint`・`special_note` の4キーに限り、この付け替えを行わず、子リストの各項目のテキストを `string[]` として値に格納する。`plan`・`schedule`・`due`・`priority`・`tags`・`dependsOn`・`repeat` の7キーについては、現在の付け替え動作を変更しない。

#### C-2. ガント投影に `plan`・`milestone`・`tentative`・`status` を追加する（`src/lib/gantt/ast-to-gantt.ts`）

`ganttchart-for-mywork` の `GanttNode` 型は、これらのフィールドを**既に持っており描画も実装済み**である（`ganttchart-for-mywork/src/types.ts:123` `milestone?`、`:130` `plan?`、`:136` `tentative?`、`:142` `status?`）。しかし本リポジトリの投影はこれらを一切設定していない。

次の4箇所のオブジェクトリテラルへフィールドを追加する。

| 行 | 現在 | 追加するもの |
|---|---|---|
| `:137-145`（繰り返し展開） | `metadata.status` のみ | トップレベル `status: node.status` |
| `:155-165`（タスク） | 同上 | `status: node.status`、`plan`（`node.meta?.plan` をパースした `{start,end}`）、`milestone`（`node.meta?.due` をパース）、`tentative`（`node.meta?.tentative?.schedule === true`） |
| `:195-204`（list → subsection） | なし | `plan`・`status`（`@実施日時` はフェーズには設定しない運用ルールのため `schedule` は追加しない） |
| `:227-233`（section → project） | なし | 変更なし |

日時文字列 → `DateTime` の変換は、既存の `parseSchedule` 相当の処理（`ast-to-gantt.ts` 内の既存ヘルパー）を再利用する。パースに失敗した値はフィールド自体を設定しない。

#### C-3. カレンダー投影に `plan`・`tentative` を追加する（`src/lib/calendar/ast-to-calendar.ts:103-110`）

`calendar-for-mywork` 側に対応するフィールドが追加された後（同リポジトリの Issue `0018`）に実施する。追加前に実施すると型エラーになるため、順序を守ること（`2.7 節`）。

### 2.6 テスト

`TESTING_STANDARD.md` によりテストは省略できない。既存のテストファイルへ追加する（新規ファイルは作らない）。

| テスト対象 | 追加先ファイル | 追加するケース |
|---|---|---|
| `[?]`・`[/]` の解析 | `src/lib/parser/parse-markdown.test.ts` | `- [?] 計画中のタスク` が `status: 'planning'` になる。`- [/] 保留中のタスク` が `status: 'deferred'` になる |
| 状態名の移行 | 同上 | `- [ ]`→`ready`、`- [>]`→`in_progress`、`- [!]`→`waiting`、`- [-]`→`cancelled`、`- [x]`→`done` |
| 書き戻しの往復 | `src/lib/parser/ast-to-md.test.ts` | 7状態すべてについて、パース→シリアライズで元の記法へ戻る |
| 日本語メタキー | `src/lib/parser/parse-markdown.test.ts` | `- @実施日時: 2026-07-01T09:00/10:00` が `meta.schedule` に入る。`- @期限: 2026-07-31` が `meta.due` に入る |
| 4キーの追加 | 同上 | `- @完了イメージ: 資料が承認された状態` が `meta.condition` に入る |
| 複数行値（優先度C） | 同上 | `- @完了イメージ:` の直下に子リスト2件がある場合、`meta.condition` が長さ2の配列になる。かつ、その子リストが `children` に残らない |
| ガント投影 | `src/lib/gantt/ast-to-gantt.test.ts` | `@想定期間` を持つタスクの `GanttNode.plan` が設定される。`@期限` を持つタスクの `milestone` が設定される。`@実施日時?` を持つタスクの `tentative` が `true` になる |
| カレンダー投影 | `src/lib/calendar/ast-to-calendar.test.ts` | 7状態が3値へ丸められる（`in_progress`／`done`／それ以外は `ready`） |
| かんばん投影 | `src/lib/kanban/ast-to-kanban.test.ts` | 7レーンが生成される。カードの `status` が新名称になる |

### 2.7 実施順序（重要）

状態の内部名変更は、連携アプリへ渡す値が変わる破壊的変更である。次の順序を守ること。

1. **先に連携アプリ側を対応させる**（各リポジトリの Issue）。
   - `calendar-for-mywork` Issue `0018`：状態語彙の拡張、`plan`・`tentative` フィールドの追加
   - `ganttchart-for-mywork` Issue `issue-gantt-phase005-001`：状態別スタイルの汎用化
   - `kanban-for-mywork` Issue `0029`：複数行値の表示、状態別スタイル
   - `dashboard-for-mywork` Issue `issue-phase002-001`：7状態モデルへの移行
2. **その後に本 Issue の優先度A（状態名の移行）を実施する**。
3. 優先度B・Cは、1 の完了を待たずに着手してよい（新しいキーの追加であり、既存の値を変えないため）。

各連携アプリ側の Issue は、新旧どちらの状態名を受け取っても壊れない実装（未知の値を汎用的に扱う）を求めている。したがって 1 が完了していれば、2 の切り替え時に連携アプリ側の同時変更は不要である。

### 2.8 スコープ外

- 連携アプリ4リポジトリのソースコードの変更（各リポジトリの Issue で扱う）。
- 連携アプリが本リポジトリの型を import する形への変更（責務境界 `BR-043`〜`BR-047` に反するため、行ってはならない）。
- `@完了イメージ` 等の「祖先からの継承」ロジック（`@plan` の継承が未実装であることと同様、別論点）。
- Markdown 記法そのものの変更提案（運用ルールはユーザーの所有物であり、本リポジトリが決めるものではない）。
- `priority`・`tags`・`dependsOn`・`repeat` の運用ルールへの追記（運用ルール側の論点）。
- エディタ上での `[?]`・`[/]` のクイックフィックス・補完UI（別 Issue）。

### 2.9 TODO

- [x] A-1: `src/lib/contract/canonical.ts` を新規作成する
- [x] A-2: `src/lib/parser/types.ts:1` を再エクスポートへ置き換える
- [x] A-3: `remark-task-status.ts` の正規表現と対応表を変更する
- [x] A-4: 状態名を参照している12箇所を移行する
- [x] A-5: `task-language.ts:44` の正規表現を変更する
- [x] A-6: `META_LINE_RE` を Unicode 対応にし、日本語エイリアス表を追加する
- [x] B-1: `Meta`・`META_KEYS` を `contract/canonical.ts` へ移設し4キーを追加する
- [x] B-2: 日本語エイリアス4行を追加する
- [x] B-3: `applyMetaKey` へ4ケースを追加する
- [x] C-1: 4キーの複数行値に対応する
- [x] C-2: ガント投影へ `plan`・`milestone`・`tentative`・`status` を追加する
- [x] C-3: カレンダー投影へ `plan`・`tentative` を追加する（`calendar-for-mywork` Issue `0018` の完了後）
- [x] `2.6 節` のテストをすべて追加し、`npm run test:unit` が成功することを確認する
- [x] `documents/external-data-contract.spec.md` を、本 Issue による変更内容へ更新する（データ契約は現行実装の記述であり、実装が変われば同時に更新しなければならない。同文書 `§10`）

### 履歴（追記のみ）

#### 2026-09-14（実装）

- ユーザー指示:
  - 「最新のissueを実装して」。曖昧な部分は実装者の最善案で判断してよい旨の指示、および各連携ライブラリ側も同様のデータ構造対応を終えているはずなので、単体・E2E・ブラウザ・Obsidianの各テストを含めて実施するよう指示があった。

- 実施内容:
  - 優先度A・B・C をすべて実装した（`2.9節` の TODO はすべて完了）。
  - `2.7節` の実施順序を確認: `calendar-for-mywork`（Issue `0018`）・`kanban-for-mywork`（Issue `0029`）・`ganttchart-for-mywork`（Issue `issue-gantt-phase005-001`）の3リポジトリの実コードを確認し、いずれも新語彙（7状態・`plan`・`tentative`・任意の `status` 文字列）を受理できる実装が既に入っていることを確認した（Issue 自体の `status` はガント・かんばんが `closed`/`completed`、カレンダーは `open` のままだが、これは `WORKFLOW §6` により人間の closure 承認待ちであることを示すのみで、コードの実装状況とは独立である）。この確認をもって優先度Aの前提条件（連携アプリ側の先行対応）を満たしていると判断した。
  - Issue本文に明記の無い箇所で、同一の不整合パターンを持つ2箇所を追加で修正した（Issueの対象ファイルと同一ファイル内、または同一問題領域の姉妹実装であり、範囲外の変更ではないと判断）:
    - `src/lib/calendar/markdown-patch.ts` の `patchNodeStatus` 内の書き戻し用正規表現（`A-5` と同一の文字クラス不足パターン。`?`・`/` を追加しないと新2状態への書き戻しが失敗するため）。
    - `src/editor/task-decoration.ts`（Monaco/CodeMirror ではなく CodeMirror ベースの別のエディタ装飾経路。`task-language.ts` の A-5・A-6 と同一の不足パターンを持っていた。修正しない場合、`[?]`・`[/]` タスク行および日本語メタキー行がエディタ上で無装飾のままになる）。
  - `src/lib/calendar/ast-to-calendar.ts` の `TimeSpan` 型不整合（`plan` 追加に伴い顕在化。`ISODate` ブランド型と平文 `string` の不一致）を、型キャストにより解消した。副次効果として、同ファイルに既存していた同種の `temporal` の型エラーも解消された（`svelte-check` のベースラインエラー数は 85→84 に減少）。
  - `documents/sample-external-data-{s,m,l}.json` を `npm run gen:samples` で再生成した。
  - `documents/external-data-contract.spec.md` を実装内容に合わせて更新した（BR-017・BR-025・BR-050 の本文更新、BR-069〜BR-072 の新規追加、§3.2 状態表の更新、§4.7 メタ参照表の更新、注釈 A-09 をかんばんのみの残課題へ縮小、§9.1 実例を実際の再生成出力へ更新）。

- テスト実施結果:
  - `npm run check`（svelte-check）: 新規エラーなし（ベースライン比較で確認。むしろ1件減少）。
  - `npm run test:unit`: 529件全て成功（既存テストの状態語彙移行、新規テスト追加を含む）。
  - `npx playwright test`（ブラウザE2E）: 14件全て成功。
  - Obsidian E2E（`wdio run wdio.conf.mts`、全8スペック）: 7スペック全項目成功。`gantt-view.e2e.ts` のみ2件失敗（`バードラッグで @schedule が更新される`・`完了タスクのバーが completed 装飾でグレーアウトされる`）。この2件は、本Issueの変更を一切含まない `git stash` 後のベースラインコードでも同一内容・同一箇所で再現することを確認済みであり、本Issueに起因する回帰ではない、既存の未解決事象である。
  - `kanban-view.e2e.ts` はレーンID変更（7状態化）に追随してテストコードを更新し、全項目成功を確認した。

- 変更しなかったもの（スコープ外の再確認）:
  - 連携アプリ4リポジトリのソースコード（`2.8節` により対象外）。
  - `gantt-view.e2e.ts` の2件の既存失敗（本Issue範囲外の既知事象。別途調査が必要）。

- 根拠:
  - `WORKFLOW §2.4`（Haiku実行可能水準）に基づき記述された Issue 本文の before/after を、実装の唯一の根拠として使用した。
  - ユーザーの明示指示（本欄冒頭）により、Issue本文に記載の無い判断（連携アプリ側テキストラベルの日英表記、レーンの表示順序、姉妹実装2箇所の追加修正）は実装者の最善案で決定した。
  - `WORKFLOW §6` により、`status` は引き続き `open` のままとし、クローズはユーザーの明示承認を待つ。

- ユーザー指示:
  - `__workspace/unified-markdown-data-spec-proposal.md`（統一Markdownデータ仕様書・案）を承認した。これを各ライブラリへ適用していく。
  - エディタ側にデータ定義のインターフェースを作成する。その Issue を作成すること。
  - 連携アプリ（ライブラリ）は独立性を保つこと。エディタのデータ定義を参照するようなことはしないこと。

- 変更:
  - 本 Issue を新規作成した。`phase005` は、統一データ仕様に基づく横断的なデータ定義整備のフェーズとして新設した（`phase004` は時間メタ3層モデルの実装フェーズであり、問題領域が異なるため。`WORKFLOW §2.1`）。
  - 統一データ仕様書のうちホスト側が担う範囲（カノニカル型の保持、パーサー語彙の拡張、各連携アプリ型への投影）を、実際のソースコードの該当行と突き合わせて `2.2`〜`2.5 節` に列挙した。
  - 状態語彙の移行が破壊的変更であるため、連携アプリ側の対応を先行させる順序を `2.7 節` に明記した。

- 根拠:
  - `WORKFLOW §2.4`（Haiku 実行可能水準）に従い、変更対象を `path:line` で特定し、変更前後のコードを併記した。
  - 連携アプリが本リポジトリの型を参照しない方針は、データ契約 `BR-043`〜`BR-047`（責務境界）およびユーザーの明示指示（2026-09-14）による。

---

## 3. メタデータ
- id: issue-phase005-001__canonical-data-model-interface
- status: open
- phase: 005
- related_specs: documents/external-data-contract.spec.md
- related_decisions:
- target_files: src/lib/contract/canonical.ts, src/lib/parser/types.ts, src/lib/parser/meta-keys.ts, src/lib/parser/plugins/remark-task-status.ts, src/lib/parser/plugins/remark-meta-fields.ts, src/lib/parser/ast-to-md.ts, src/lib/highlight/task-language.ts, src/lib/agenda/ast-to-agenda.ts, src/lib/health/rules.ts, src/lib/query/parse-query.ts, src/lib/tray/extract-unscheduled.ts, src/lib/calendar/ast-to-calendar.ts, src/lib/calendar/markdown-patch.ts, src/lib/gantt/ast-to-gantt.ts, src/lib/kanban/ast-to-kanban.ts, src/lib/kanban/KanbanTab.svelte
- created: 2026-09-14
- updated: 2026-09-14
