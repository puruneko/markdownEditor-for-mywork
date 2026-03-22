# タスクチェックボックス記法のハイライト

## Status
proposed

## Summary
Markdown エディタ内のカスタムチェックボックス記法（`[>]`, `[!]`, `[-]`）をステータスごとに色分けしてハイライトする。

## Current Direction
- Monaco Monarch トークナイザで拡張チェックボックスパターンを認識させる
- 各ステータスに異なる色を割り当てる:
  - `[ ]` todo: デフォルト
  - `[>]` doing: 青系
  - `[x]` done: 緑系
  - `[!]` blocked: 赤系
  - `[-]` hold: グレー系

## TODO
* [x] `ITokensProvider` に全5ステータスの正規表現ルールを追加
* [x] 各ステータス用のテーマカラーを定義（`md-task-dark` テーマ）
  - `[ ]` todo: デフォルト白 (#cccccc)
  - `[>]` doing: 青 (#569cd6)
  - `[x]` done: ティール (#4ec9b0)
  - `[!]` blocked: 赤 (#f44747)
  - `[-]` hold: グレー (#808080)
* [x] 全ステータスでの表示確認（ビルド成功）

## Notes (Append Only)
* 2026-03-22 — Issue 作成
* 2026-03-22 — 実装完了。`task-language.ts` に統合。`md-task` 言語として EditorLayout の左エディタに適用済み。
