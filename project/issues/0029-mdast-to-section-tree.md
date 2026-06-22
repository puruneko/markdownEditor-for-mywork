# mdast root → Section ツリー構築

## Status

done

---

## Summary

mdast の `root` ノードから `heading` ノードを起点に `Section` ツリーを構築する関数を実装する。既存の `parseSections` + `nestSections` ロジックを unified ベースで再実装する。

---

## Current Direction

- mdast `root.children` を走査し、`heading` ノードの出現位置でセクションを区切る
- heading と次の heading の間にある list/blockquote ノードを #0028 の変換関数でノード化する
- `nestSections`（見出し深度によるツリー化）のロジックは既存 `md-to-ast.ts` から移植する
- heading のない場合は単一の匿名セクション（`id: 'section-0'`）として扱う
- `lineNumber` は mdast の `position.start.line` から取得する（0-based に変換）
- 実装は `src/lib/parser/mdast-to-sections.ts` として作成する

---

## TODO

* [ ] `src/lib/parser/mdast-to-sections.ts` を新規作成する
* [ ] `buildSections(root: Root): Section[]` を実装する
* [ ] `nestSections` ロジックを移植する
* [ ] 見出しなしドキュメントの匿名セクション処理を実装する
* [ ] ユニットテストを実装する（見出しあり・なし・ネスト見出しの各ケース）

---

## Notes (Append Only)

* 2026-06-22 -- Issue作成。#0028（ノード変換）に依存。unified移行フェーズ3。

## History

### 2026-06-22

- User Instruction:
  - unifiedを使ったパーサー書き直しの移行issueを細粒度で起票

- Change:
  - Issue新規作成

- Rationale:
  - Section構築はノード変換と独立したロジックであるため別Issueとした。mdastのpositionを活用することでlineNumber追跡がより信頼性高くなる。
