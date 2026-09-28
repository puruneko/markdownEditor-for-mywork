# Shadow DOM 内のテーマ遮断の抜けを塞ぐ（フォーム部品の文字色・Kanban/FilterBar の残存 Obsidian 変数参照）

## 1. Background（背景）

`修正したい箇所.md` の common 節:

> ライト・ダークモード対応ができていない。ダークモードの時はobsidian全体で文字が白になるが、拡張機能側は白基調のため文字が見えない部分がある。開発工数が少なくて済む場合はテーマに合わせ、大規模になる場合はテーマには合わせず、obsidianのCSSテーマ設定が拡張機能に適用されないようにして（白基調のままでOK）。
> - カレンダーの設定画面など、まだ一部対応されていない部分がある。

この要望に対し、`markdownEditor-for-mywork` リポジトリでは以前のサイクルで「テーマ遮断（白基調に固定し、Obsidian のテーマ設定を継承させない）」という方針が既に決定・実装されている（`src/views/ShadowItemView.ts` の `SHADOW_RESET_CSS` が全ビュー共通の Shadow DOM `:host` に `color: #000; background: #fff;` を固定注入している）。

**しかし、この遮断には 2 種類の抜けが現存する。**

### 抜け 1: フォーム部品（input / select）の文字色が継承されない

`:host` の `color: #000` は、通常のテキストには継承されるが、`<input>` や `<select>` の文字色は多くのブラウザ（Chromium 系。Obsidian は Electron/Chromium）で UA（ブラウザ既定）スタイルシートが優先され、`:host` の `color` を継承しない。Obsidian がダークテーマのとき、OS/ブラウザ側の `color-scheme` の扱いによっては、フォーム部品の文字色が暗い色のまま描画され、`background: white` 系の明るい背景と組み合わさって読めなくなる可能性がある。

実際に、`calendar-for-mywork/src/lib/components/MonthView.svelte`（1059-1068行）と `WeekView.svelte`（1976-1983行）の設定パネルの `input[type="number"]` / `select` は、次のように **背景色だけを指定し、文字色を指定していない**:

```css
.setting-item input[type="number"],
.setting-item select {
  font-size: 12px;
  padding: 3px 6px;
  border: 1px solid #ddd;
  border-radius: 3px;
  background: white;
  width: 80px;
}
```

これが、入力ファイルに書かれている「カレンダーの設定画面など、まだ一部対応されていない部分がある」の原因候補の一つである（この issue の対象は markdownEditor リポジトリ側の Shadow 境界の修正のみ。calendar-for-mywork 自体の CSS は変更しない）。

### 抜け 2: Shadow の中でホスト側コンポーネントが Obsidian の CSS 変数を参照している

CSS カスタムプロパティ（`var(--background-primary)` 等）は Shadow DOM の境界を越えて継承される。そのため、「テーマ遮断（白基調固定）」という方針にもかかわらず、markdownEditor 自身のホスト側コンポーネントの一部が、Obsidian のテーマ変数を直接参照しており、Obsidian がダークテーマのときにその変数がダークな値に解決され、白基調のはずの画面の中に暗い配色の部品が混在する。

具体的には次の 2 ファイル:

1. `src/lib/kanban/KanbanTab.svelte`（187-242行）: `.kanban-tab` に定義している `--kanban-*` という CSS カスタムプロパティ（kanban ライブラリ側が参照するブリッジ変数）の大半が `var(--background-primary, #1e1e1e)` のように **Obsidian 変数を第一候補、ダーク配色をフォールバックにする方式**になっている。
2. `src/lib/query/FilterBar.svelte`（171-269行、20箇所）: `.reload-btn` `.filter-chip` `.badge` `.filter-panel` `.filter-field` `.clear-btn` の各スタイルが同様に `var(--background-secondary, #2d2d2d)` `var(--text-muted, #999)` `var(--interactive-accent, #7c6af7)` 等を使っている。

これらは calendar/gantt/kanban のタブに共通して差し込まれる `FilterBar` コンポーネントであり、他のタブ側コンポーネント（例: calendar/gantt の固定白背景）と同一画面内に混在した場合、「白基調に固定したはずなのに、フィルタバーだけダーク配色になる」という視覚的な不整合を生む。

**この issue は、上記 2 種類の抜けのうち、markdownEditor リポジトリ側で完結する修正（Shadow の `:host` の強化、Kanban/FilterBar の Obsidian 変数参照の除去）のみを対象とする。** calendar-for-mywork のフォーム部品の CSS 自体（`background: white` の指定など）は、この issue の対象外であり、calendar-for-mywork 側の別 issue で扱う。

## 2. Objective（目的）

Shadow DOM 内のすべてのビュー（Calendar / Gantt / Kanban / Dashboard / Ast）が、Obsidian のテーマ設定（特にダークテーマ）の影響を受けず、常に白基調で一貫して表示されるようにする。フォーム部品の文字色を明示的に固定し、Kanban と FilterBar から Obsidian の CSS 変数参照を除去する。

## 3. Scope（スコープ）

- `src/views/ShadowItemView.ts` の `SHADOW_RESET_CSS`（`:host` ブロックとフォーム部品向けのリセット規則の追加）。
- `src/lib/kanban/KanbanTab.svelte` の `.kanban-tab` に定義されている `--kanban-*` カスタムプロパティのうち、値が Obsidian 変数（`var(--background-*`, `var(--text-*`, `var(--interactive-*`）になっているものの置き換え・削除。
- `src/lib/query/FilterBar.svelte` の `<style>` ブロック内の Obsidian 変数参照の置き換え。
- `src/views/AstViewMount.svelte`、`src/views/CalendarViewMount.svelte`、`src/views/GanttViewMount.svelte`、`src/views/KanbanViewMount.svelte` の Obsidian 変数参照の置き換え。
- 対象外: `src/views/DashboardViewMount.svelte` の `theme="light"` 指定（既存のテーマ遮断方針どおりの実装であり、変更不要）。`styles/*.css`（Shadow の外にあり、Obsidian のテーマに自動追従する既存方針の対象。変更しない）。calendar-for-mywork / ganttchart-for-mywork / kanban-for-mywork / dashboard-for-mywork の各リポジトリの `src`（別リポジトリの別 issue で対応）。

## 4. Implementation requirements（実装要件）

### 4.1 `src/views/ShadowItemView.ts` の `SHADOW_RESET_CSS` を拡張する

現在の `SHADOW_RESET_CSS`（13-40行付近）は次のとおり:

```ts
export const SHADOW_RESET_CSS = `
  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
  :host {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    overflow: hidden;
    font-family: system-ui, -apple-system, sans-serif;
    color: #000;
    background: #fff;
    font-size: 14px;
    line-height: 1.5;
    letter-spacing: normal;
  }
  button {
    font-family: inherit;
    font-size: inherit;
    line-height: normal;
    cursor: pointer;
  }
  [data-is-dnd-shadow-item] {
    opacity: 0.5;
  }
`.trim()
```

これを次のように変更する（既存の宣言は残したまま追加する）。

1. `:host` ブロックに `color-scheme: light;` を追加する（ブラウザに「このスコープはライト配色である」と明示し、フォーム部品などのブラウザ既定描画がダーク側に寄るのを防ぐ）。
2. `:host` ブロックに、以降の他コンポーネントから参照させるための固定トークンを追加する:
   ```css
   --host-bg: #fff;
   --host-bg-secondary: #f3f4f6;
   --host-bg-hover: #e5e7eb;
   --host-border: #d1d5db;
   --host-text: #333;
   --host-text-muted: #666;
   --host-accent: #7c6af7;
   --host-text-on-accent: #fff;
   ```
3. `button` の規則に `color: inherit;` を追加する。
4. 新しい規則 `input, select, textarea { color: inherit; font: inherit; }` を追加する。

変更後の想定形（コメントやフォーマットは既存の書式に合わせてよい）:

```ts
export const SHADOW_RESET_CSS = `
  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
  :host {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    overflow: hidden;
    font-family: system-ui, -apple-system, sans-serif;
    color: #000;
    background: #fff;
    font-size: 14px;
    line-height: 1.5;
    letter-spacing: normal;
    color-scheme: light;
    --host-bg: #fff;
    --host-bg-secondary: #f3f4f6;
    --host-bg-hover: #e5e7eb;
    --host-border: #d1d5db;
    --host-text: #333;
    --host-text-muted: #666;
    --host-accent: #7c6af7;
    --host-text-on-accent: #fff;
  }
  button {
    font-family: inherit;
    font-size: inherit;
    line-height: normal;
    cursor: pointer;
    color: inherit;
  }
  input, select, textarea {
    color: inherit;
    font: inherit;
  }
  [data-is-dnd-shadow-item] {
    opacity: 0.5;
  }
`.trim()
```

### 4.2 `src/lib/kanban/KanbanTab.svelte` から Obsidian 変数参照を削除する

`.kanban-tab` の `<style>` ブロック（187-242行）にある `--kanban-*` 宣言のうち、値が `var(--background-*` / `var(--text-*` / `var(--interactive-*` で始まるものを、**そのカスタムプロパティの宣言ごと削除する**（kanban ライブラリ側の `var(--kanban-xxx, <既定色>)` というフォールバック機構により、宣言が無ければ kanban ライブラリ自身の明るい既定色がそのまま使われる。ライブラリ側は変更不要）。

削除対象（value が Obsidian 変数のもの。値の右側は削除確認用の参考、削除するのは行全体）:

```
--kanban-bg:               var(--background-primary,     #1e1e1e);
--kanban-toolbar-bg:       var(--background-primary-alt, #252526);
--kanban-toolbar-border:   var(--background-modifier-border, #404040);
--kanban-btn-bg:           var(--interactive-normal,     #2d2d30);
--kanban-btn-hover-bg:     var(--interactive-hover,      #3e3e42);
--kanban-btn-color:        var(--text-normal,            #cccccc);
--kanban-lane-bg:          var(--background-secondary,   #252526);
--kanban-lane-border:      var(--background-modifier-border, #404040);
--kanban-lane-header-bg:   var(--background-secondary-alt, #2d2d30);
--kanban-lane-title-color: var(--text-normal,            #d4d4d4);
--kanban-lane-count-bg:    var(--background-modifier-border, #3e3e42);
--kanban-lane-count-color: var(--text-muted,             #858585);
--kanban-card-bg:          var(--background-primary,     #1e1e1e);
--kanban-card-border:      var(--background-modifier-border, #404040);
--kanban-card-key-color:   var(--text-accent,            #9cdcfe);
--kanban-card-value-color: var(--text-normal,            #d4d4d4);
--kanban-card-id-color:    var(--text-faint,             #4ec9b0);
--kanban-group-border:              var(--background-modifier-border, #404040);
--kanban-group-header-bg:           var(--background-secondary-alt,   #2d2d30);
--kanban-group-header-hover-bg:     var(--background-modifier-hover,  #3e3e42);
--kanban-group-label-color:         var(--text-normal,                #cccccc);
--kanban-group-count-bg:            var(--background-modifier-border,  #3e3e42);
--kanban-group-count-color:         var(--text-muted,                  #858585);
--kanban-group-accent:              var(--interactive-accent,          #4ec9b0);
--kanban-section-header-bg:         var(--background-primary-alt,     #252526);
--kanban-section-header-hover-bg:   var(--background-modifier-hover,  #2d2d30);
--kanban-group-children-border:     var(--interactive-accent,         #4ec9b0);
--kanban-group-children-border-l2:  var(--background-modifier-border, #404040);
--kanban-group-children-border-l3:  var(--background-modifier-border, #3a3a3a);
--kanban-accent:               var(--interactive-accent,      #4ec9b0);
--kanban-filter-bg:            var(--background-primary,      #252526);
--kanban-filter-border:        var(--background-modifier-border, #404040);
--kanban-filter-nested-bg:     var(--background-secondary,    #2d2d30);
--kanban-filter-nested-border: var(--background-modifier-border, #404040);
```

さらに、`--kanban-lane-count-bg` と `--kanban-lane-count-color` は kanban-for-mywork 側のどこからも参照されていない（未使用の宣言）ため、上記の削除リストに含めたうえで復活させない。

**次の宣言は削除せず、そのまま残す**（値が Obsidian 変数ではなく、色以外のレイアウト値のため）:

```
--kanban-font:             var(--font-interface,         system-ui, sans-serif);
--kanban-lane-width:       220px;
--kanban-lane-gap:         8px;
--kanban-lanes-padding:    12px;
--kanban-lane-padding:     8px;
--kanban-lane-radius:      6px;
--kanban-card-radius:      4px;
--kanban-card-padding:     8px 10px;
--kanban-card-gap:         6px;
--kanban-group-header-height:       43px;
```

`--kanban-font` は値に `var(--font-interface, system-ui, sans-serif)` を含むが、フォント指定であり配色ではないため、この issue の対象外として残す。

### 4.3 `src/lib/query/FilterBar.svelte` の Obsidian 変数参照を置き換える

`<style>` ブロック（171-269行付近）にある次の対応表に従い、`var(--obsidian変数, <既定値>)` の形の記述を、既定値の引数を持たない `var(--host-*)` 参照に置き換える。

| 置き換え前のパターン | 置き換え後 |
|---|---|
| `var(--background-primary, #1e1e1e)` | `var(--host-bg)` |
| `var(--background-secondary, #2d2d2d)` | `var(--host-bg-secondary)` |
| `var(--background-modifier-hover, #3a3a3a)` | `var(--host-bg-hover)` |
| `var(--background-modifier-border, #444)` | `var(--host-border)` |
| `var(--text-normal, #d4d4d4)` | `var(--host-text)` |
| `var(--text-muted, #999)` | `var(--host-text-muted)` |
| `var(--interactive-accent, #7c6af7)` | `var(--host-accent)` |
| `var(--text-on-accent, #fff)` | `var(--host-text-on-accent)` |

対象は `.reload-btn`、`.reload-btn:hover`、`.filter-chip`、`.filter-chip.active`、`.badge`、`.filter-panel`、`.filter-field`、`.filter-field input`、`.clear-btn` の各規則（全 20 箇所）。値以外（プロパティ名、セレクタ、他のスタイル値）は変更しない。

### 4.4 各 `*ViewMount.svelte` の Obsidian 変数参照を置き換える

同じ対応表を使い、次のファイルの `border-bottom: 1px solid var(--background-modifier-border, #444);` を `border-bottom: 1px solid var(--host-border);` に置き換える。

- `src/views/CalendarViewMount.svelte`（該当行付近）
- `src/views/GanttViewMount.svelte`（該当行付近）
- `src/views/KanbanViewMount.svelte`（該当行付近）
- `src/views/AstViewMount.svelte`: 上記のほか、`background: var(--background-primary, #1e1e1e);`（2箇所）を `background: var(--host-bg);` に、`color: var(--text-normal, #d4d4d4);` を `color: var(--host-text);` に置き換える。

## 5. Files / components likely to be changed（変更が見込まれるファイル／コンポーネント）

- `src/views/ShadowItemView.ts`
- `src/lib/kanban/KanbanTab.svelte`
- `src/lib/query/FilterBar.svelte`
- `src/views/AstViewMount.svelte`
- `src/views/CalendarViewMount.svelte`
- `src/views/GanttViewMount.svelte`
- `src/views/KanbanViewMount.svelte`
- `src/views/ShadowItemView.test.ts`（テスト追加）

## 6. Dependencies（依存関係）

- **前提条件**: このリポジトリ（markdownEditor-for-mywork）自体は現時点で作業ツリーがクリーン（未コミット差分なし）であることを確認済み。ただし、他の4リポジトリ（calendar / gantt / kanban / dashboard）の作業ツリーには本 issue 群とは別の未コミット差分が存在するため、着手前にプロジェクト管理者がそれらのベースラインをコミットしていることを確認すること。
- このリポジトリ内での依存: なし。単独で着手可能。
- 後続: `issue-phase012-kanban-002__shared-header-lane-alignment.md`（kanban-for-mywork 側）は、この issue で `--kanban-lanes-padding` 等のレイアウト用カスタムプロパティの値（12px 等）が変わらないことを前提にしている。本 issue はレイアウト用の値を削除しないため、後続 issue に影響しない。

## 7. Acceptance criteria（受け入れ基準）

- Obsidian をダークテーマに設定した状態で、Calendar / Gantt / Kanban / Ast の各タブを開いたとき、フィルタバー（リロードボタン、フィルタチップ、フィルタパネル）が白基調の配色で表示され、Obsidian 全体のダーク配色を継承していないこと。
- Kanban タブが、Obsidian のテーマ設定に関わらず、kanban ライブラリ本来の明るい既定配色（`--kanban-bg` の既定値 `#1e1e1e` ではなく、kanban-for-mywork 側の各コンポーネントが個別に持つ明るいフォールバック色）で表示されること。
- `input[type=number]` や `select` を Shadow 内に持つ画面（例: Ast ビューのフィルタ入力欄）で、ダークテーマ時にも文字が白背景の上で読めること。

## 8. Test requirements（テスト要件）

- `src/views/ShadowItemView.test.ts` に次のテストケースを追加する:
  - `:host` ブロックの文字列に `color-scheme: light` が含まれることを確認する（既存の `describe('SHADOW_RESET_CSS', ...)` 内に追加する）。
  - `input, select, textarea` の規則ブロックに `color: inherit` が含まれることを確認する。
- 静的検証テストを新設する（例: `src/views/shadow-theme-lockdown.test.ts`）: `src/lib/kanban/KanbanTab.svelte`、`src/lib/query/FilterBar.svelte`、`src/views/AstViewMount.svelte`、`src/views/CalendarViewMount.svelte`、`src/views/GanttViewMount.svelte`、`src/views/KanbanViewMount.svelte` の各ファイル内容を読み込み、正規表現 `var\(--(background|text|interactive)-` にマッチする箇所が 0 件であることを検証する。
- 実行コマンド: `npm run test:unit`（実行前後で失敗件数が変更前から増えないことを確認する）。
- 実機確認（`npm run test:obs:e2e` が実行できる場合）: ダークテーマで Kanban タブと各ビューのフィルタバーを開き、スクリーンショットを取得する。実行できない場合は、手動でダークテーマのスクリーンショットを 3 枚（Kanban タブ、任意のビューのフィルタバー、Ast ビューのフィルタ入力欄）取得し、issue に添付する。

## 9. Out of scope（対象外）

- `src/views/DashboardViewMount.svelte` の `theme="light"` 指定（既存の実装のままでよい。変更不要）。
- `styles/*.css`（Shadow の外にあるエディタ本体の CSS。Obsidian のテーマに自動追従する既存方針の対象であり、変更しない）。
- calendar-for-mywork の設定パネル（`MonthView.svelte` / `WeekView.svelte`）のフォーム部品の CSS 自体の修正（この issue はホスト側の Shadow 境界のみを対象とする。calendar-for-mywork 側の別 issue で対応すること）。
- ganttchart-for-mywork / dashboard-for-mywork の配色（別リポジトリの対象。本 issue の対象外）。
- kanban ライブラリ側（`kanban-for-mywork/src`）の変更（`--kanban-*` の受け皿はライブラリ側に既に存在するフォールバック機構であり、ライブラリ自体は変更しない）。

## 要確認

- 実機の Obsidian に配置されているプラグイン（`main.js`）が、このリポジトリの現在のソースと一致しているか（`npm run obs:update:manifest` によるコピーが最新かどうか）は、この issue の作業開始前にプロジェクト管理者に確認すること。推測で「反映済み」と判断しないこと。

## Progress & Implementation Notes

### History

#### 2026-09-27

- User Instruction:
  - project/governance のルールに従い、issue-phase012 シリーズを順番にすべて実装する

- Change:
  - `src/views/ShadowItemView.ts` の `SHADOW_RESET_CSS`: `:host` に `color-scheme: light` と `--host-*`（bg/bg-secondary/bg-hover/border/text/text-muted/accent/text-on-accent）の8トークンを追加。`button` に `color: inherit` を追加。新規則 `input, select, textarea { color: inherit; font: inherit; }` を追加
  - `src/lib/kanban/KanbanTab.svelte`: `.kanban-tab` の `--kanban-*` のうち Obsidian 変数を値に持つ32宣言（`--kanban-lane-count-bg`/`--kanban-lane-count-color` を含む未使用宣言も含む）をすべて削除。レイアウト用の10宣言（幅・余白・角丸等）はそのまま残した。加えて、Test requirements の静的検証（ファイル全体で0件）を満たすため、Issue 本文の削除リストには無かった `.kanban-card-inner:hover .card-title`・`.card-title`・`.card-meta` の3箇所（Obsidian変数を直接参照）も `var(--host-*)` に置き換えた
  - `src/lib/query/FilterBar.svelte`: `.reload-btn`・`.reload-btn:hover`・`.filter-chip`・`.filter-chip.active`・`.badge`・`.filter-panel`・`.filter-field`・`.filter-field input`・`.clear-btn` の計20箇所を、Issue本文の対応表どおり `var(--host-*)` に置き換えた
  - `src/views/AstViewMount.svelte`・`CalendarViewMount.svelte`・`GanttViewMount.svelte`・`KanbanViewMount.svelte`: `border-bottom` の `var(--background-modifier-border, #444)` を `var(--host-border)` に置き換え。`AstViewMount.svelte` はさらに `background`（2箇所）を `var(--host-bg)`、`color` を `var(--host-text)` に置き換えた
  - `DashboardViewMount.svelte`・`styles/*.css`・他リポジトリの `src` は対象外のため変更していない
  - 単体テスト追加: `src/views/ShadowItemView.test.ts` に2件（`color-scheme: light`、`input,select,textarea` の `color: inherit`）。新設 `src/views/shadow-theme-lockdown.test.ts`（6ファイルそれぞれについて `var\(--(background|text|interactive)-` に0件マッチすることを検証する静的テスト）

- Rationale:
  - `.kanban-card-inner`/`.card-title`/`.card-meta` の3箇所は Implementation requirements 本文（4.2）の削除リストには無いが、Test requirements（§8）が「ファイル内に Obsidian 変数参照が0件」を明示的に要求しており、この3箇所を残すとテストが失敗するため、Objective（常に白基調で一貫表示）とも整合する形で修正した
  - `--kanban-font` はフォント指定でありレイアウト値に準ずるため、Issue本文の指示どおり削除しなかった

- Verification:
  - `npx vitest run` → 26 test files / 520 tests すべて成功（新設8件含む）
  - `npx tsc --noEmit` → 変更ファイルに起因する型エラーなし
  - `node esbuild.config.mjs production` → ビルド成功
  - **実機 Obsidian E2E 検証を実施**: `kanban-view.e2e.ts`（4件成功・1件既存skip）、`ast-view.e2e.ts`（3件成功）を実行し、CSS変更によるDOM構造・機能面の回帰が無いことを確認
  - **ダークテーマでの目視確認（実機スクリーンショット）を実施**: Obsidian を `theme-dark` にした状態で Kanban タブとフィルタパネル、AST ビューのフィルタ入力欄（`input[type=date]` 含む）を開き、スクリーンショットで確認した。いずれも白基調で表示され、Obsidian 側のダーク配色を継承していないことを視覚的に確認した（一時的な検証用スペックで撮影後、スペック自体は削除済み。スクリーンショットは `tests/obs-e2e/screenshots/` に生成される既存の gitignore 対象ディレクトリのため、成果物としては残していない）

- Status: 実装完了・実機E2E検証済み・ダークテーマ目視確認済み。ユーザーの明示的な承認待ちのため Issue は Open のまま（WORKFLOW.md §6）。
