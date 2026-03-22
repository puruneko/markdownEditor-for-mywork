# Monaco Editor の導入と基本表示

## Status
proposed

## Summary
Monaco Editor パッケージを導入し、Svelte コンポーネントとしてラップする。
単体で Markdown テキストを表示・編集できる状態にする。

## Current Direction
- `monaco-editor` パッケージを使用する
- Vite 向けの Monaco ワーカー設定を行う
- 再利用可能な `MonacoEditor.svelte` コンポーネントを作成する
- props: `value`, `language`, `readonly` 等を受け取る設計にする

## TODO
* [x] `monaco-editor` パッケージをインストール
* [x] Vite 用 Monaco ワーカー設定（`window.MonacoEnvironment` 手動設定）
* [x] `MonacoEditor.svelte` コンポーネント作成
* [x] Markdown モードでの表示確認（ビルド成功で確認）
* [x] JSON モードでの表示確認（ビルド成功で確認）

## Notes (Append Only)
* 2026-03-22 — Issue 作成
* 2026-03-22 — 実装完了。`vite-plugin-monaco-editor` は使わず `window.MonacoEnvironment` で手動ワーカー設定。Svelte 5 runes モードで `MonacoEditor.svelte` 実装。
