# mdast listItem → TaskNode/ListNode 変換レイヤー実装

## Status

done

---

## Summary

#0026・#0027 のプラグインで付与された情報を持つ mdast listItem ツリーを、既存の `TaskNode`・`ListNode`・`QuoteNode` 型（`src/lib/parser/types.ts`）に変換する関数を実装する。

---

## Current Direction

- `mdast.ListItem` + `data.taskStatus` / `data.meta` → `TaskNode | ListNode` の再帰変換関数を実装する
- mdast の `position.start.line`（1-based）を `lineNumber`（0-based）に変換してノードに付与する
- `depth`・`path`・`id`（既存 `generateId` ロジック流用）を計算する
- `hasTaskDescendant`・`isGroup`・`isLeafTask`・`isMemo` の派生フィールドを計算する
- blockquote（`>`）は mdast の `blockquote` ノードから `QuoteNode` に変換する
- 変換関数は `src/lib/parser/mdast-to-nodes.ts` として実装する

---

## TODO

* [ ] `src/lib/parser/mdast-to-nodes.ts` を新規作成する
* [ ] `convertListItem(node, depth, parentPath): TaskNode | ListNode` を実装する
* [ ] `convertBlockquote(node): QuoteNode` を実装する
* [ ] `generateId` を既存 `md-to-ast.ts` から切り出して共有モジュール化する
* [ ] 派生フィールド（hasTaskDescendant等）の計算ロジックを実装する
* [ ] ユニットテストを実装する（TaskNode/ListNode/QuoteNode が正しく生成されることを確認）

---

## Notes (Append Only)

* 2026-06-22 -- Issue作成。#0026・#0027 に依存。unified移行フェーズ3。
* mdast の position は 1-based line なので lineNumber（0-based）への変換に注意。

## History

### 2026-06-22

- User Instruction:
  - unifiedを使ったパーサー書き直しの移行issueを細粒度で起票

- Change:
  - Issue新規作成

- Rationale:
  - mdast と既存の内部型（TaskNode等）を橋渡しするレイヤーを独立issueにすることで、既存型の変更なしに移行できる。
