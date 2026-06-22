# obs-0009: luxon 重複バンドルによる instanceof 失敗でアイテム移動時エラー

## ステータス

Closed

## 概要

カレンダーアイテムの終了日時をドラッグすると `ReferenceError` ではなく以下のエラーが発生する:

```
Invalid CalendarItem:
  - [temporal.start] CalendarDateTimeRange.start must be a valid Luxon DateTime
  - [temporal.end] CalendarDateTimeRange.end must be a valid Luxon DateTime
```

## 根本原因

`calendar-for-mywork` および `ganttchart-for-mywork` がそれぞれ独自の `node_modules/luxon` を持っている。esbuild がワークスペースライブラリのソースをバンドルする際、各ライブラリ内のファイルから `import { DateTime } from 'luxon'` を解決すると、主プロジェクトの luxon とは別のコピーが使われる。

### 発生メカニズム

1. `ast-to-calendar.ts`（主プロジェクト）が `DateTime.fromISO()` でアイテムを作成 → **主プロジェクトの luxon の DateTime クラス**
2. カレンダーライブラリ内 `factories.ts:assertValid()` → `validation.ts:validateCalendarItem()` が `!(start instanceof DateTime)` をチェック → **ライブラリの luxon の DateTime クラス**
3. 2つの `DateTime` は別オブジェクトのため `instanceof` が `false` を返す → バリデーション失敗 → `Error` スロー

### 証拠

修正前: `isLuxonDateTime=!0` が `main.js` に 2 箇所存在（luxon が 2 コピーバンドルされていた）
修正後: `isLuxonDateTime=!0` が `main.js` に 1 箇所のみ

## 解決方針

`esbuild.config.mjs` の `svelteLibSourcePlugin` に luxon の単一解決ルールを追加する。

```js
build.onResolve({ filter: /^luxon$/ }, () => {
  return { path: require.resolve('luxon', { paths: [__dirname] }) }
})
```

ワークスペースライブラリ内からの全 `import 'luxon'` が主プロジェクトの単一コピーに解決され、`instanceof` が正常に動作する。

## TODO

- [x] `esbuild.config.mjs` に luxon の単一解決ルールを追加
- [x] ビルド確認
- [x] 全テストパス確認

## 完了条件

- カレンダーアイテムのリサイズ・移動でエラーが発生しないこと
- `main.js` 内の luxon インスタンスが 1 つに統合されていること
- 全テストパス

## related_specs

- `project/specs/calendar-integration.spec.md`

## History

### 2026-03-25

- User Instruction:
  - カレンダーの終了日時を移動するとエラーが出るので修正

- Change:
  - `esbuild.config.mjs` の `svelteLibSourcePlugin` に luxon 単一解決ルールを追加

- Rationale:
  - ビルド成功、全テスト（E2E 4スペック）パス
  - luxon の重複が解消（`isLuxonDateTime` マーカーが 1 箇所に統合）
