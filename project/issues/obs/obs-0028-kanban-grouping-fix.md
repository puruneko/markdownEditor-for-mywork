# obs-0028: Kanbanグルーピング表示バグ修正・グルーピング単位の正規化

## ステータス

Open

## 概要

Kanbanボードでグループセレクタを「グループ（groupTitle）」以外に切り替えると、
タスクが誤ったグループに表示され、正しいグループが空になるバグを修正する。
あわせて、list単位でグルーピングする際に上位のheadingを親ラベルとして表示できるようにする。

## 背景・動機

`svelte-kanban-lib` の `KanbanBoard` は `groupBy` をローカル `$state` として一度だけ初期化し、
ユーザーがUIで変更した際は `onConfigChange` イベントで外部に通知する設計になっている。

一方 `KanbanTab.svelte` の `handleConfigChange` は `lanes` と `allowCrossGroupMove` しか保存しておらず、
`groupBy` の変更を無視していた。その結果、`config.groups` は常に `groupTitle` ベースで生成され続け、
実際の `groupBy` フィールドとの不整合が生じていた。

具体的には、以下の構造で：
```
# Heading
- List name（チェックなし）
  - [ ] Task
```

ユーザーが「セクション」（sectionTitle）を選択すると：
- `distributeCardsByGroup` は `config.groups`（groupTitle値="List name"）と
  カードのsectionTitle値（"Heading"）の両方からグループIDを収集する
- タスクが "Heading" グループ（自動検出）に表示され、"List name" グループが空になる

## 実装方針

### バグ修正（`groupBy`とgroupsの不整合を解消）

**`src/lib/kanban/KanbanTab.svelte`**:
- `userGroupBy` 状態を追加（デフォルト: `'groupTitle'`）
- `handleConfigChange` で `event.config.groupBy` を保存する
- `config` 生成時に `createKanbanConfig(cards, userGroupBy)` を呼ぶ

**`src/lib/kanban/ast-to-kanban.ts`**:
- `createKanbanConfig` に `groupByField: string = 'groupTitle'` 引数を追加
- グループIDをそのフィールド値から収集するよう変更

### 親ラベル表示

`groupByField = 'groupTitle'`（list単位）のとき、`sectionTitle` が異なれば
グループ `label` を `"sectionTitle > groupTitle"` 形式にする。

ライブラリは `config.groups[].label` をそのままグループヘッダに表示するため、
ラベル生成ロジックの変更だけで反映される（ライブラリ修正不要）。

## TODO

- [x] `src/lib/kanban/ast-to-kanban.ts`: `createKanbanConfig(cards, groupByField)` に引数追加・ラベル生成変更
- [x] `src/lib/kanban/KanbanTab.svelte`: `userGroupBy` 追加・`handleConfigChange` 修正
- [x] `src/lib/kanban/ast-to-kanban.test.ts`: 新しい引数に対応したテスト追加（23テスト、全184テストパス）
- [x] `src/lib/kanban/ast-to-kanban.ts`: KanbanCard に `section: string[]` 追加、extractFromNodes 引数変更、createKanbanConfig 簡略化
- [x] `src/lib/kanban/KanbanTab.svelte`: userGroupBy='section'・userSectionDepth・cardTitleMultiline 追加、fieldDefinitions 更新
- [x] `src/lib/kanban/ast-to-kanban.test.ts`: section フィールドのテスト追加・更新（22テスト、全183テストパス）

## 完了条件

- `# H > - List > - [ ] Task` 構造でグループセレクタを「セクション」に切り替えたとき、
  タスクがセクショングループに正しく表示されること
- 「グループ」に戻したとき、タスクがlistグループに正しく表示されること
- list単位でグルーピングした際、グループヘッダに `"Heading > List name"` 形式で表示されること
- 全テストがパスすること

## 関連ファイル

- `src/lib/kanban/ast-to-kanban.ts`（変更）
- `src/lib/kanban/ast-to-kanban.test.ts`（変更）
- `src/lib/kanban/KanbanTab.svelte`（変更）

## History

### 2026-06-25

- User Instruction:
  - Kanbanグルーピング表示バグの調査・修正

- Change:
  - `createKanbanConfig` に `groupByField` 引数追加（デフォルト: `'groupTitle'`）
  - `buildGroupLabel` 追加（groupTitleとsectionTitleが異なる場合は `"S > G"` 形式）
  - `KanbanTab.svelte` に `userGroupBy` 状態追加、`handleConfigChange` で groupBy 変更を保存

- Rationale:
  - `KanbanBoard`（ライブラリ）は groupBy をローカル state で管理し、変更時のみ onConfigChange で通知する設計
  - 従来の `handleConfigChange` は groupBy を無視していたため、config.groups が常に groupTitle ベースで生成され続けた
  - config.groups はプロップをリアクティブに参照するため、KanbanTab 側で正しい groups を渡すだけで解決（ライブラリ修正不要）

### 2026-06-25 ライブラリ更新対応・section 配列フィールドへの移行

- User Instruction:
  - ライブラリ標準の描画に戻し、section 階層構造に対応したデータ渡しに変更

- Change:
  - KanbanCard に `section: string[]` 追加（例: `["Heading", "List"]`）
  - `extractFromNodes` の引数を `sectionTitle+groupTitle` から `sectionPath: string[]` に変更
  - `createKanbanConfig` を大幅簡略化: `groups` 定義を生成しない（ライブラリがカードから自動収集）
  - `buildGroupLabel` を削除（ライブラリの `getGroupPath` が `groupId` の `/` 区切りから自動計算）
  - `KanbanTab.svelte`: `userGroupBy='section'`・`userSectionDepth`・`cardTitleMultiline` 追加
  - `KANBAN_FIELD_DEFINITIONS`: `section: 'array'` を追加、`groupTitle` を削除

- Rationale:
  - 更新後のライブラリは配列型フィールド + sectionDepth でネイティブに階層グルーピングを提供
  - `distributeCardsByGroup` はカードのあるグループだけを作成するよう変更され、空グループバグは解消
  - `getGroupPath("Heading / List")` → `"Heading"` の自動計算でカスタムラベルハックが不要に
