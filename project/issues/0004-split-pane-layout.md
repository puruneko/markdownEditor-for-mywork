# 左右分割レイアウトの実装

## Status
proposed

## Summary
画面を左右に分割し、左にMarkdownエディタ、右にASTエディタを配置するレイアウトを実装する。

## Current Direction
- CSS Grid または Flexbox で左右50%分割する
- 左ペイン: Monaco（Markdown モード）
- 右ペイン: Monaco（JSON モード、読み取り専用を初期状態とする）
- リサイズ機能は初期段階では不要

## TODO
* [x] `EditorLayout.svelte` コンポーネント作成
* [x] 左ペインに Monaco（markdown）を配置
* [x] 右ペインに Monaco（json）を配置
* [x] 画面全体を埋めるレイアウト調整
* [x] 両エディタが独立して動作することを確認（ビルド成功）

## Notes (Append Only)
* 2026-03-22 — Issue 作成
* 2026-03-22 — 実装完了。CSS Flexbox で左右50%分割。中央ガターに方向矢印を配置（Phase3の #0009 を先行実装）。
