# Vite + Svelte 5 + TypeScript プロジェクト初期構築

## Status
proposed

## Summary
エディタアプリの土台として、Vite + Svelte 5 + TypeScript のプロジェクトを作成する。
`npm create vite` でスキャフォールドし、ビルド・dev serverの動作を確認する。

## Current Direction
- `npm create vite@latest` で Svelte + TypeScript テンプレートを使用する
- Svelte 5 の runes モード（`$state`, `$derived` 等）を前提とする
- 不要なボイラープレート（Counter等）は削除する

## TODO
* [x] Vite + Svelte 5 + TS でプロジェクトをスキャフォールド
* [x] 不要なボイラープレートを削除
* [ ] `npm run dev` で起動確認（ユーザ確認）
* [x] `npm run build` でビルド確認

## Notes (Append Only)
* 2026-03-22 — Issue 作成
* 2026-03-22 — 実装完了。`/workspace/md-ast-editor/` にプロジェクト作成、`npm run build` 成功確認。`@sveltejs/vite-plugin-svelte@^5.0.0` (vite 6対応版) を使用。
