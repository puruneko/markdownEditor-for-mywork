# 変更方向の矢印インジケータ表示

## Status
proposed

## Summary
左右エディタの間に、現在の変更方向を示す矢印を表示する。
どちら側の編集がトリガーとなっているかをユーザに明示する。

## Current Direction
- 左右ペインの間（中央ガター）に矢印コンポーネントを配置する
- 状態は3種: `idle`（矢印なし）、`md-to-ast`（→）、`ast-to-md`（←）
- 同期処理の開始時に方向を設定し、完了後に `idle` に戻す
- アニメーション付きで視認性を高める

## TODO
* [x] 独立コンポーネントではなく EditorLayout 内のガターとして実装
* [x] 3状態（idle / md-to-ast / ast-to-md）の管理を実装
* [x] レイアウトへの組み込み（左右ペインの間の 40px ガター）
* [x] 同期処理との連動（方向表示のタイミング制御）
* [x] 矢印のスタイリングとアニメーション（CSS transition）

## Notes (Append Only)
* 2026-03-22 — Issue 作成
* 2026-03-22 — 実装完了。→ (teal) / ← (orange) / ⇆ (gray/idle) の3状態。CSS color transition 付き。
