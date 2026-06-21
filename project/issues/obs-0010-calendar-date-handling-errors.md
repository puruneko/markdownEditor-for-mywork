# obs-0010: カレンダー日付処理の複合バグ（複数日スパン・instanceof 失敗）

## ステータス

Open

## 概要

カレンダービューで以下の2種類のエラーが発生する:

```
Uncaught Error: Invalid CalendarItem:
  - [temporal] CalendarDateTimeRange spans multiple days: 2026-03-24 -> 2026-03-25 (consider using CalendarDateRange instead)
```

```
Uncaught Error: Invalid CalendarItem:
  - [temporal.start] CalendarDateTimeRange.start must be a valid Luxon DateTime
  - [temporal.end] CalendarDateTimeRange.end must be a valid Luxon DateTime
```

## 根本原因

### バグA: 日付のみスケジュールを CalendarDateTimeRange として生成

`src/lib/calendar/ast-to-calendar.ts:55-58` は全ての `@schedule` を無条件に `CalendarDateTimeRange` として生成する。

```typescript
temporal: {
  kind: 'CalendarDateTimeRange' as const,
  start: parsed.start,
  end: parsed.end,
},
```

`parseSchedule()` は `DateTime.fromISO()` を使用する。日付のみ文字列（例: `2026-03-24`）が渡された場合、`DateTime.fromISO("2026-03-24")` は `2026-03-24T00:00:00.000` を返す。

以下のケースで複数日にまたがる `CalendarDateTimeRange` が生成される:

1. 日付のみスケジュール: `@schedule: 2026-03-24/2026-03-25` → midnight→midnight の2日間
2. 深夜またぎスケジュール: `@schedule: 2026-03-24T23:00/2026-03-25T01:00`
3. 複数日タスク: `@schedule: 2026-03-24T09:00/2026-03-25T17:00`

`calendar-for-mywork/src/lib/models/validation.ts:66-69` が複数日にまたがる `CalendarDateTimeRange` を拒否する:

```typescript
if (!start.hasSame(end.minus({ milliseconds: 1 }), 'day')) {
  errors.push({ field: 'temporal', message: `CalendarDateTimeRange spans multiple days...` });
}
```

この検証は `factories.ts:assertValid()` → `updateTimedItem()` 経由で、ユーザーがアイテムを操作した時点でスローされる。

### バグB: `instanceof DateTime` 失敗

`validation.ts:56,59` は `instanceof DateTime` でバリデーションする:

```typescript
if (!(start instanceof DateTime) || !start.isValid) { ... }
if (!(end instanceof DateTime) || !end.isValid) { ... }
```

obs-0009 で luxon 単一解決ルールを `esbuild.config.mjs` に追加済み（L80-86）だが、以下の経路で依然として `instanceof` が失敗する可能性がある:

1. **Svelte 5 `$state` Proxy ラッピング**: `CalendarView.svelte:54` の `let internalItems = $state<CalendarItem[]>([...items])` で Svelte 5 の深い Proxy が適用される。Proxy でラップされた DateTime オブジェクトは `proxy instanceof DateTime` が `false` を返す。`updateTimedItem()` の `{...item}` スプレッドは temporal を新しいオブジェクトに置換するが、既存の item 参照が Proxy 経由の場合に問題が残る可能性がある。
2. **esbuild resolve 漏れ**: `calendar-for-mywork` のソースファイル内の `import { DateTime } from 'luxon'` が `onResolve` フックを通過しない経路が存在する可能性。

### バグAとバグBの発生タイミング

両バグとも `factories.ts:assertValid()` から発生する。`assertValid()` は以下の関数内で呼ばれる:

- `createCalendarItem()` — ファクトリ経由の生成時
- `updateTimedItem()` — DnD/リサイズ後のアイテム更新時
- `updateAllDayItem()` — 終日アイテムの更新時
- `updatePointItem()` — Deadline アイテムの更新時

`ast-to-calendar.ts:48-60` はファクトリ関数を経由せず直接オブジェクトを構築するため、アイテム生成時にはバリデーションが実行されない。エラーはユーザーがアイテムを操作した時点で初めて発生する。

## 影響範囲

- カレンダービュー全般: 複数日スパンまたは日付のみスケジュールを持つタスクの表示・操作
- ガントビュー: 同じ `parseSchedule()` を使用するが、ガントライブラリには `assertValid()` がないため現時点ではエラーにならない。ただし日付型の不整合リスクは残る。

## 解決方針

### 方針1: `parseSchedule()` の型判定強化（バグA修正）

`ast-to-calendar.ts` の `parseSchedule()` を拡張し、入力形式に応じて適切な temporal 型を選択する:

1. 日付のみ（`T` を含まない）: `CalendarDateRange` を生成
2. 時刻付き同一日内: `CalendarDateTimeRange` を生成（現行動作）
3. 時刻付き複数日: `CalendarDateRange` を生成（時刻情報は切り捨て）

temporal 型の選択ロジックを `parseSchedule()` の戻り値型に反映する。現在の戻り値は `{ start: DateTime; end: DateTime } | null` だが、temporal 型の判別に必要な情報を含む型に変更する。

### 方針2: `instanceof DateTime` 回避（バグB修正）

`calendar-for-mywork/src/lib/models/validation.ts` の `instanceof DateTime` チェックを、Luxon の duck typing に変更する:

```typescript
// Before:
if (!(start instanceof DateTime) || !start.isValid) { ... }

// After（案）:
function isLuxonDateTime(v: unknown): v is DateTime {
  return v != null && typeof v === 'object' && 'isValid' in v && 'toISO' in v && 'isLuxonDateTime' in v;
}
if (!isLuxonDateTime(start) || !start.isValid) { ... }
```

Luxon の DateTime オブジェクトは `isLuxonDateTime` 静的プロパティを持つ。duck typing によりプロキシラップや異なるインスタンスからの DateTime も正しく判定できる。

### 方針3: spec 更新

`project/specs/calendar-integration.spec.md` の以下の BR を更新する:

- **BR-010**: `CalendarDateTimeRange` のみ → 入力形式に応じて `CalendarDateTimeRange` または `CalendarDateRange` を生成する仕様に変更
- **BR-011**: `YYYY-MM-DDTHH:mm/YYYY-MM-DDTHH:mm` のみ → `YYYY-MM-DD/YYYY-MM-DD` 形式も受理する仕様に変更

## TODO

- [x] `src/lib/calendar/ast-to-calendar.ts` の `parseSchedule()` を拡張し、日付のみ・複数日スケジュールを `CalendarDateRange` として生成する
- [x] `ast-to-calendar.ts` の `extractFromNodes()` で temporal 型に応じたオブジェクト構築に変更する
- [x] `calendar-for-mywork/src/lib/models/validation.ts` の `instanceof DateTime` チェックを duck typing に変更する
- [x] `project/specs/calendar-integration.spec.md` の BR-010, BR-011 を更新する
- [ ] `src/lib/gantt/ast-to-gantt.ts` の `parseSchedule()` も同様に日付のみ対応を追加する（整合性のため）
- [ ] 機能テスト追加: 日付のみスケジュール、複数日スケジュール、深夜またぎスケジュールの各パターン
- [x] 全テスト実行・パス確認

## コーディング観点（実装ガイド）

### 変更対象ファイル

1. **`src/lib/calendar/ast-to-calendar.ts`** — `parseSchedule()` 拡張、temporal 型の分岐
2. **`calendar-for-mywork/src/lib/models/validation.ts`** — `instanceof DateTime` → duck typing
3. **`project/specs/calendar-integration.spec.md`** — BR-010, BR-011 更新
4. **`src/lib/gantt/ast-to-gantt.ts`** — `parseSchedule()` の整合性修正（任意）

### 具体的な変更手順

#### 手順1: `parseSchedule()` の戻り値型を拡張する

変更前:
```typescript
export function parseSchedule(schedule: string): { start: DateTime; end: DateTime } | null
```

変更後:
```typescript
type ParsedSchedule =
  | { kind: 'dateTimeRange'; start: DateTime; end: DateTime }
  | { kind: 'dateRange'; start: string; endExclusive: string }

export function parseSchedule(schedule: string): ParsedSchedule | null
```

判定ロジック:
- `parts[0]` と `parts[1]` の両方に `T` が含まれない場合 → `dateRange`
- `T` が含まれる場合 → `dateTimeRange`
- `dateTimeRange` で複数日にまたがる場合 → `dateRange` にフォールバック（時刻情報切り捨て）

#### 手順2: `extractFromNodes()` で temporal 型の分岐を追加する

```typescript
const parsed = parseSchedule(node.meta.schedule)
if (!parsed) continue

let temporal: TimeSpan
if (parsed.kind === 'dateRange') {
  temporal = {
    kind: 'CalendarDateRange' as const,
    start: parsed.start,       // ISODate string
    endExclusive: parsed.endExclusive,  // ISODate string
  }
} else {
  temporal = {
    kind: 'CalendarDateTimeRange' as const,
    start: parsed.start,
    end: parsed.end,
  }
}
```

#### 手順3: `validation.ts` の instanceof を duck typing に変更する

`validateTimeSpan()` 内の `CalendarDateTimeRange` および `CalendarDateTimePoint` のケースで:

```typescript
function isLuxonDateTime(v: unknown): v is DateTime {
  if (v == null || typeof v !== 'object') return false;
  const obj = v as Record<string, unknown>;
  return obj.isLuxonDateTime === true;
}
```

この関数で `instanceof DateTime` を置換する。Luxon の全 DateTime オブジェクトは `isLuxonDateTime` プロパティに `true` を持つ。

### 変更してはならない箇所

- `calendar-for-mywork/src/lib/models/temporal.ts` のファクトリ関数 — 既存のインタフェースは変更しない
- `calendar-for-mywork/src/lib/models/factories.ts` の `assertValid()` 呼び出しパターン — 検証自体は維持する
- `esbuild.config.mjs` の luxon 解決ルール — obs-0009 の修正は残す（duck typing は追加の安全策）
- `CalendarView.svelte` のイベントハンドラ構造 — 変更不要

### 検証方法

1. 以下のスケジュール形式でエラーが出ないことを確認:
   - `@schedule: 2026-03-24/2026-03-25`（日付のみ）
   - `@schedule: 2026-03-24T09:00/2026-03-24T17:00`（同一日時刻付き）
   - `@schedule: 2026-03-24T23:00/2026-03-25T01:00`（深夜またぎ）
   - `@schedule: 2026-03-24T09:00/2026-03-26T17:00`（複数日時刻付き）
2. カレンダービューでアイテムの DnD・リサイズが正常に動作すること
3. 日付のみアイテムが終日レーン（allday lane）に正しく表示されること
4. `npm test` で全テストパス

## 完了条件

- 上記4種のスケジュール形式がエラーなくカレンダーに表示されること
- アイテム操作時に `Invalid CalendarItem` エラーが発生しないこと
- `instanceof DateTime` による検証が Proxy ラッピングに耐性を持つこと
- spec が実装と整合していること
- 全テストパス

## related_specs

- `project/specs/calendar-integration.spec.md`
- `project/specs/gantt-integration.spec.md`

## History

### 2026-03-25

- User Instruction:
  - obs-0010 を実装する

- Change:
  - `src/lib/calendar/ast-to-calendar.ts`: `parseSchedule()` の戻り値型を `ParsedSchedule` union 型に変更。日付のみ（`T` を含まない）→ `CalendarDateRange`、時刻付き同一日 → `CalendarDateTimeRange`、時刻付き複数日 → `CalendarDateRange` にフォールバック
  - `src/lib/calendar/ast-to-calendar.ts`: `extractFromNodes()` で temporal 型を `parsed.kind` で分岐して構築
  - `calendar-for-mywork/src/lib/models/validation.ts`: `instanceof DateTime` を `isLuxonDateTime()` duck typing 関数に置換（`CalendarDateTimeRange` および `CalendarDateTimePoint` のチェック）
  - `project/specs/calendar-integration.spec.md`: BR-010, BR-011 を実装に合わせて更新

- Rationale:
  - 全テスト（unit 20スペック + E2E 4スペック）パス
  - ユニットテスト `ast-to-calendar.test.ts` 既存20件すべて通過

## 関連Issue

- obs-0002（カレンダービュー統合）
- obs-0009（luxon 重複による instanceof 破壊）— 関連する既知問題、本 Issue はその残存影響を扱う
