# Issue 0035: KanbanカードにMD説明情報をdescriptionとして渡す

## 状態
Closed

## 概要
svelte-kanban-libの`CardData`に`description`パラメータのサポートが追加された。
`KanbanCard`の`description`フィールドにMDの説明情報（タスクノードの子`QuoteNode.raw`および`isMemo: true`の`ListNode.text`）を渡すようロジックを修正する。

## 対象ファイル
- `src/lib/kanban/ast-to-kanban.ts`
- `src/lib/kanban/ast-to-kanban.test.ts`

## 要件

- `KanbanCard`型は`description?: string`フィールドを持たなければならない。
- `taskToCard`関数は、`TaskNode.children`の中の`QuoteNode`と`isMemo: true`の`ListNode`からテキストを収集し、`description`に設定しなければならない。
- 説明情報が存在しない場合は、`description`フィールドを設定してはならない（undefinedのまま）。
- `KANBAN_FIELD_DEFINITIONS`は`description`フィールドの定義を含まなければならない。
- 対応するテストを追加しなければならない。

## 説明情報の収集ルール

- `QuoteNode`の場合は`node.raw`を使用しなければならない。
- `ListNode`かつ`isMemo: true`の場合は`node.text`を使用しなければならない。
- 複数の説明ノードが存在する場合は改行（`\n`）で結合しなければならない。
- `TaskNode`（子タスク）は説明情報の収集対象に含めてはならない。

## History

### 2026-06-27 19:34

- User Instruction:
  - MDの説明情報をdescriptionに渡すようロジックを修正する

- Change:
  - `KanbanCard`型に`description?: string`フィールドを追加
  - `extractDescription()`関数を追加（子`QuoteNode.raw`と`isMemo: true`の`ListNode.text`を収集）
  - `taskToCard()`に`extractDescription()`の呼び出しを追加
  - `KANBAN_FIELD_DEFINITIONS`に`description`フィールド定義を追加
  - テスト4件追加（QuoteNode、ListNode(memo)、説明なし、複数説明の結合）

- Rationale:
  - svelte-kanban-libのKanbanCard.svelteが`card.description`をツールチップ表示に使用するため
