# ワークスペースライブラリのソースリンク手順

## 概要

`svelte-calendar-lib` / `svelte-gantt-lib` / `svelte-kanban-lib` などのワークスペースサイドプロジェクトを、
`dist/` を経由せずソース（`src/`）のまま markdownEditor-for-mywork に取り込む仕組みと、
新しいライブラリを追加する手順をまとめる。

---

## 仕組み

```
package.json（file: パス依存）
  "svelte-foo-lib": "file:../foo-for-mywork"
         │
         ▼ npm install
  node_modules/svelte-foo-lib  ──symlink──▶  ../../foo-for-mywork
         │
         ▼ esbuild.config.mjs: svelteLibSourcePlugin
  realpathSync() でシンボリックリンクを実パスに解決
  → foo-for-mywork/src/index.ts を直接バンドル対象にする
```

### なぜ dist/ をバイパスするか

同じ `.svelte` コンポーネントがシンボリックリンク経由と実パス経由の
両方でロードされると、esbuild が別モジュールとして扱い
`WeekView → WeekView2` のようなリネームが発生して実行時 `ReferenceError` になる。
`realpathSync` で実パスに統一することでこれを防いでいる。

---

## 現在登録済みのライブラリ

| パッケージ名 | ソースパス |
|---|---|
| `svelte-calendar-lib` | `../calendar-for-mywork` |
| `svelte-gantt-lib` | `../ganttchart-for-mywork` |
| `svelte-kanban-lib` | `../kanban-for-mywork` |

---

## 新しいライブラリを追加する手順

### 前提条件

追加したいライブラリが以下を満たしていること:

- `package.json` に `"name": "svelte-xxx-lib"` が設定されている
- `src/index.ts` が存在する（ソースエントリ）

### Step 1: `package.json` に依存を追加

```json
// dependencies セクションに追記
"svelte-xxx-lib": "file:../xxx-for-mywork"
```

### Step 2: `esbuild.config.mjs` の `svelteLibSourcePlugin` を更新

**`libs` オブジェクトに追加:**

```js
const libs = {
  'svelte-calendar-lib': resolve(realpathSync(...), 'src/index.ts'),
  'svelte-gantt-lib':    resolve(realpathSync(...), 'src/index.ts'),
  'svelte-kanban-lib':   resolve(realpathSync(...), 'src/index.ts'),
  'svelte-xxx-lib':      resolve(realpathSync(resolve(__dirname, 'node_modules/svelte-xxx-lib')), 'src/index.ts'),
}
```

**2箇所の正規表現フィルターに追加（`|svelte-xxx-lib` を末尾に追記）:**

```js
// パッケージ名 → src/index.ts へのリダイレクト
build.onResolve({ filter: /^(svelte-calendar-lib|svelte-gantt-lib|svelte-kanban-lib|svelte-xxx-lib)$/ }, ...)

// CSS インポート → 空モジュールに差し替え
build.onResolve({ filter: /^(svelte-calendar-lib|svelte-gantt-lib|svelte-kanban-lib|svelte-xxx-lib)\/.*\.css$/ }, ...)
```

### Step 3: npm install でシンボリックリンクを生成

```bash
npm install --legacy-peer-deps
```

> `--legacy-peer-deps` は `obsidian` パッケージの peer dependency 競合（@codemirror/state バージョン差異）を回避するために必要。

### Step 4: 動作確認

```bash
# ビルドエラーがないことを確認
node esbuild.config.mjs production

# 既存テストが通ることを確認
npx vitest run
```

---

## ライブラリ側で luxon を使っている場合

ライブラリが `luxon` に依存している場合、各ライブラリの `node_modules/luxon` が使われると
`DateTime instanceof` チェックが失敗する（クラスオブジェクトが別々になるため）。

`svelteLibSourcePlugin` 内で luxon を常に markdownEditor 側の `node_modules/luxon` に解決する
設定が入っているので、**追加作業は不要**（既存の `build.onResolve({ filter: /^luxon$/ }, ...)` が処理する）。

---

## トラブルシューティング

| 症状 | 原因 | 対処 |
|---|---|---|
| `Cannot find module 'svelte-xxx-lib'` | symlink 未生成 | `npm install --legacy-peer-deps` を再実行 |
| `ReferenceError: XxxComponent is not defined` | realpathSync 未設定で二重ロード | `esbuild.config.mjs` の `libs` と正規表現に追加されているか確認 |
| `DateTime instanceof` が false | luxon が複数インスタンス | 既存の luxon 解決設定で対応済みのはず。`readlink node_modules/svelte-xxx-lib` でリンク先を確認 |
