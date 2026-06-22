# 旧パーサーコードの削除とクリーンアップ

## Status

done

---

## Summary

#0033 での差し替えが完了し全テストがパスしたことを確認後、旧パーサー（`md-to-ast.ts`）と移行期の並存ファイルを削除してコードベースをクリーンにする。

---

## Current Direction

- `src/lib/parser/md-to-ast.ts` を削除する
- `src/lib/parser/parse-markdown-v2.ts` を `src/lib/parser/parse-markdown.ts`（または `index.ts` 経由）にリネーム・整理する
- `generateId` などの共有ロジックが適切なモジュールに置かれていることを確認する
- 削除後に `tsc --noEmit` と全テストが通ることを確認する
- 不要になったコメント（「旧パーサーとの互換のため」等）を除去する

---

## TODO

* [ ] `src/lib/parser/md-to-ast.ts` を削除する
* [ ] 並存用の仮ファイル名を本番名に整理する
* [ ] `tsc --noEmit` でコンパイルエラーがないことを確認する
* [ ] 全テストを実行してパスを確認する

---

## Notes (Append Only)

* 2026-06-22 -- Issue作成。#0033（差し替え完了）に依存。unified移行フェーズ5（最終）。
* 2026-06-22 -- 実装完了。`md-to-ast.ts`・`md-to-ast.test.ts`・`parse-markdown-v2.ts`・`parse-markdown-v2.test.ts` を削除。`parse-markdown.ts` / `parse-markdown.test.ts` が最終形。全181テスト通過・ビルドエラーなし。
* 8スペースリテラルインデントは CommonMark の「インデントコードブロック」ルール（相対4sp以上）に抵触するため非サポートとした。実環境（Obsidian・シリアライザ）はタブ文字を使用するため実害なし。demo/indent-patterns.md と対応テストを4スペースに更新。

## History

### 2026-06-22

- User Instruction:
  - unifiedを使ったパーサー書き直しの移行issueを細粒度で起票

- Change:
  - Issue新規作成

- Rationale:
  - 旧コードを残すと将来の混乱を招く。差し替え完了後は速やかに削除してデッドコードをゼロにする。
