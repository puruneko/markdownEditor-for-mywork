# 新 parseMarkdown() 公開 API の組み立て

## Status

done

---

## Summary

#0025〜#0030 で実装した各モジュール（プラグイン・変換レイヤー・Section構築）を組み合わせて、既存の `parseMarkdown(markdown: string): Document` と同一シグネチャの新しい公開 API を実装する。

---

## Current Direction

- `src/lib/parser/parse-markdown-v2.ts`（仮名）として実装し、旧 `md-to-ast.ts` と並存させる
- unified パイプライン：`unified().use(remarkParse).use(remarkGfm).use(remarkTaskStatus).use(remarkMetaFields)` を構築する
- パイプライン出力（mdast root）を `buildSections()` → `buildNodeLineMap()` に渡し `Document` を返す
- 旧 `parseMarkdown` と同一の入出力になることをスナップショットテストで確認する
- この時点では既存コードへの差し替えは行わない（#0033 で行う）

---

## TODO

* [ ] `src/lib/parser/parse-markdown-v2.ts` を新規作成する
* [ ] unified パイプラインを組み立てる
* [ ] 既存テストケースを新 API で実行し、出力が一致することを確認するスナップショットテストを書く
* [ ] 既知のエッジケース（混在インデント・タブ・@meta誤ネスト）のテストを追加する

---

## Notes (Append Only)

* 2026-06-22 -- Issue作成。#0025〜#0030 全てに依存。unified移行フェーズ4。
* 並存期間を設けることで差し替えリスクを低減する。

## History

### 2026-06-22

- User Instruction:
  - unifiedを使ったパーサー書き直しの移行issueを細粒度で起票

- Change:
  - Issue新規作成

- Rationale:
  - 旧APIと並存させてスナップショット比較することで、差し替え前に動作保証できる。
