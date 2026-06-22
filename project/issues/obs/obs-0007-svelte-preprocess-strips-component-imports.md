# obs-0007: svelte-preprocessがSvelteコンポーネントimportを除去するビルドエラー

## ステータス

Closed

## 概要

`esbuild.config.mjs` で使用している `svelte-preprocess` が、TypeScript処理時に `.svelte` コンポーネントのimport文をスクリプトブロックから除去する。これにより、バンドル後の `main.js` でコンポーネント関数（`WeekView`、`MonthView`、`EventEditDialog`等）が未定義となり、ビューを開いた時点で `ReferenceError: WeekView is not defined` が発生する。

## 影響範囲

- CalendarView（obs-0002）
- GanttView（obs-0003）
- 今後追加される全てのSvelteコンポーネント間import

## 根本原因の詳細

### 発生メカニズム

1. `CalendarView.svelte`（calendar-for-mywork内）の `<script lang="ts">` ブロックに以下のimportが存在する：
   ```ts
   import WeekView from './WeekView.svelte';
   import MonthView from './MonthView.svelte';
   import EventEditDialog from './EventEditDialog.svelte';
   ```

2. これらのコンポーネントは `<script>` ブロック内のJS式では使用されず、テンプレート部分（`{#if viewType === 'week'} <WeekView ... /> {/if}`）でのみ使用される。

3. `svelte-preprocess` のTypeScript変換は `<script>` ブロックのみを処理し、テンプレート部分を認識しない。そのため、TypeScriptの `transpileModule` がこれらのimportを「未使用」と判断し除去する。

4. Svelteコンパイラは、preprocessed後のコードを受け取る時点で既にimport文が消えている。コンパイラはテンプレート内の `WeekView` を「存在する変数への参照」として出力するが、対応するimport文は存在しない。

5. esbuildはimport文が無いため `WeekView.svelte` をバンドルに含めるが、CalendarViewのスコープ内で変数バインディングを生成しない。結果、実行時に `ReferenceError` となる。

### 検証結果

preprocessed前（元のソース）:
```
import WeekView from './WeekView.svelte';    // 存在する
import MonthView from './MonthView.svelte';  // 存在する
import EventEditDialog from './EventEditDialog.svelte'; // 存在する
```

preprocessed後（svelte-preprocess適用済み）:
```
// 3つのimportが全て消失している
import { DateTime } from 'luxon';
import { toISODate, diffDays, ... } from '../models';
```

Svelteコンパイル後（compile()出力）:
```js
// import文なし
export default function CalendarView($$anchor, $$props) {
  // ...
  WeekView($$anchor, { ... });  // 未定義変数への参照 → ReferenceError
}
```

### 過去の修正試行

`esbuild.config.mjs` に `realpathSync` によるシンボリックリンク解決を追加済み（重複モジュールロード対策）。しかし、今回の問題はモジュール解決ではなく、preprocessor段階でのimport除去が原因であるため、この修正では解決しない。

## 解決方針

`svelte-preprocess` を廃止し、Svelte 5ネイティブのTypeScriptサポートに移行する。

### 理由

- Svelte 5は `<script lang="ts">` を自身で処理可能（コンパイラ内蔵のTS対応）
- `svelte-preprocess` はSvelte 3/4時代のツールであり、Svelte 5のrunes構文やテンプレート内コンポーネント参照との互換性に問題がある
- `esbuild-svelte` はSvelte 5対応版ではpreprocessorなしでも `lang="ts"` を処理できる

## TODO

- [ ] `esbuild.config.mjs` から `svelte-preprocess` を除去し、`esbuild-svelte` の `preprocess` オプションを空にする（または削除する）
- [ ] ビルドが通ることを確認する
- [ ] `main.js` のバンドル出力に `WeekView` 等のコンポーネント関数定義が含まれていることを確認する
- [ ] Obsidian上でカレンダービューが正常に表示されることを確認する
- [ ] ガントビューも同様に正常動作することを確認する
- [ ] `svelte-preprocess` パッケージを `package.json` の依存から削除する
- [ ] 全テスト（機能テスト + 統合テスト）がパスすることを確認する

## コーディング観点（実装ガイド）

### 変更対象ファイル

1. **`esbuild.config.mjs`** — メインの修正対象

### 具体的な変更手順

#### 手順1: `svelte-preprocess` のimportを削除する

```diff
- import { sveltePreprocess } from 'svelte-preprocess'
```

この行を完全に削除しなければならない。

#### 手順2: `esbuildSvelte` プラグイン設定から `preprocess` オプションを削除する

変更前:
```js
esbuildSvelte({
  preprocess: sveltePreprocess(),
  compilerOptions: {
    css: 'injected',
    generate: 'client',
  },
}),
```

変更後:
```js
esbuildSvelte({
  compilerOptions: {
    css: 'injected',
    generate: 'client',
  },
}),
```

`preprocess` プロパティ自体を削除しなければならない。`preprocess: []` や `preprocess: undefined` ではなく、プロパティそのものを除去する。

#### 手順3: `package.json` の依存から `svelte-preprocess` を削除する

```bash
npm uninstall svelte-preprocess
```

### 変更してはならない箇所

- `svelteModuleTypeStripPlugin` — `.svelte.ts` ファイル用のカスタムプラグインであり、今回の問題とは無関係。削除してはならない。
- `svelteLibSourcePlugin` — シンボリックリンク解決・Svelteバージョン統一用プラグインであり、削除してはならない。
- `compilerOptions` の `css: 'injected'` と `generate: 'client'` — これらは正しい設定であり、変更してはならない。
- `compilerOptions` に `runes: true` を追加してはならない — レガシーコンポーネント（`export let` 構文使用）が存在するため、Svelte 5の自動検出に任せなければならない。

### 検証方法

1. `npm run build` でビルドエラーが出ないことを確認する
2. 生成された `main.js` 内で以下を確認する:
   ```bash
   # WeekView関数の定義が存在すること
   cat main.js | tr ';' '\n' | grep "function.*WeekView\|WeekView.*=.*function"
   # 定義なしの参照のみではないこと
   ```
3. Obsidianでプラグインをリロードし、Calendar View コマンドを実行してエラーが出ないことを確認する
4. `npm test` で全テストがパスすることを確認する

## 完了条件

- `svelte-preprocess` がビルドパイプラインから完全に除去されていること
- CalendarViewを開いた際に `ReferenceError` が発生しないこと
- GanttViewも同様にエラーなく動作すること
- テンプレート内でのみ使用されるコンポーネントimportがバンドルに正しく含まれること
- 全テストパス

## History

### 2026-03-25

- User Instruction:
  - obs-0007 を実装する

- Change:
  - `esbuild.config.mjs` から `import { sveltePreprocess } from 'svelte-preprocess'` を削除
  - `esbuildSvelte()` の `preprocess: sveltePreprocess()` オプションを削除
  - `svelte-preprocess` パッケージをアンインストール

- Rationale:
  - 全テスト（E2E 4スペック）パス
  - カレンダービュー・ガントビューともにコンポーネントが正常表示
  - バンドル後の `main.js` に `WeekView` の生識別子参照が消滅（minifyにより正常なバインディングに変換）

## related_specs

- `project/specs/calendar-integration.spec.md`

## 関連Issue

- obs-0002（カレンダービュー統合）— 直接的な不具合報告元
- obs-0003（ガントビュー）— 同一原因で影響を受ける可能性
