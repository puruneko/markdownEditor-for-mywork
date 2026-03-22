# ガントチャート統合 実装計画

## 概要

Markdown AST エディタの右パネルにガントチャート表示を追加する。
ASTから `meta.schedule` を持つタスクおよび階層構造を抽出し、ガントチャート上に表示する。
ガントチャート上での変更はMarkdown文字列に反映され、Markdownが唯一の正の情報源となる。

## 設計方針

### データフロー（単方向）

```
Markdown文字列 → (parse) → AST → (extract) → GanttNode[]
                                                    ↓
                                             GanttChart表示
                                                    ↓
                                           ユーザ操作（バードラッグ等）
                                                    ↓
                                           Markdown文字列の対象行のみ置換
                                                    ↓
                                           再パース → 全体再描画
```

### 原則

- Markdown文字列が唯一の正の情報源（Single Source of Truth）
- ASTおよびガントチャートはMarkdownの派生ビュー
- ガントチャートからの変更は **対象行のみの文字列置換** でMarkdownを更新する（AST再構成は行わない）
- ガントチャートライブラリは `ganttchart-for-mywork` (svelte-gantt-lib) を使用する

## 技術スタック（追加分）

- ガントチャート: ganttchart-for-mywork (svelte-gantt-lib)
- 日時処理: luxon（既に導入済み）

## ライブラリAPI概要

### GanttNode型

```typescript
interface GanttNode {
  id: string
  parentId: string | null
  type: 'project' | 'section' | 'subsection' | 'task'
  name: string
  start?: DateTime
  end?: DateTime
  isCollapsed?: boolean
  metadata?: Record<string, unknown>
}
```

### GanttChart コンポーネント

```typescript
interface GanttChartProps {
  nodes: GanttNode[]
  handlers?: GanttEventHandlers
  config?: GanttConfig
}
```

### イベントハンドラ

```typescript
interface GanttEventHandlers {
  onNodeClick?: (node: GanttNode) => void
  onBarDrag?: (nodeId: string, newStart: DateTime, newEnd: DateTime) => void
  onNameClick?: (node: GanttNode, event: MouseEvent) => void
  onBarClick?: (node: GanttNode, event: MouseEvent) => void
  // 他省略
}
```

## カレンダー統合との差分

| 観点 | カレンダー | ガントチャート |
|------|-----------|-------------|
| データ型 | CalendarItem (flat, temporal) | GanttNode (hierarchical, start/end) |
| 階層 | parents配列（表示用） | parentId（ツリー構造必須） |
| schedule無しノード | 除外 | section/projectとして含む |
| CSSインポート | dist/index.css必要 | 不要（scoped CSS内蔵） |
| 変更コールバック | onItemMove, onItemResize, onItemUpdate | onBarDrag |

## 実装フェーズ

### Phase 1: 仕様策定・UI基盤

| Issue | 内容 | 依存 |
|-------|------|------|
| #0019 | ガントチャート連携仕様（Spec）の策定 | なし |
| #0020 | 右パネルのタブにGanttタブ追加 | なし |
| #0021 | svelte-gantt-lib ライブラリの導入 | なし |

### Phase 2: データ変換

| Issue | 内容 | 依存 |
|-------|------|------|
| #0022 | AST → GanttNode[] 変換ロジックの実装 | #0019, #0021 |

### Phase 3: 表示統合

| Issue | 内容 | 依存 |
|-------|------|------|
| #0023 | ガントチャートタブへの GanttChart 表示統合 | #0020, #0022 |

### Phase 4: 双方向同期

| Issue | 内容 | 依存 |
|-------|------|------|
| #0024 | ガントチャート操作（バードラッグ）からのMarkdown更新 | #0023 |

## 実装順序

```
#0019（Spec策定）
#0020（タブUI追加）   ─┐
#0021（ライブラリ導入）─┤
                      ↓
               #0022（変換ロジック）
                      ↓
               #0023（ガントチャート表示）
                      ↓
               #0024（バードラッグ同期）
```

Phase 1の#0020と#0021は並行して進められる。

## ディレクトリ構成（追加分）

```
src/
  lib/
    gantt/
      ast-to-gantt.ts        -- AST → GanttNode[] 変換
      ast-to-gantt.test.ts   -- 変換ロジックのテスト
      gantt-patch.ts          -- ガントチャート → Markdown行パッチ
      gantt-patch.test.ts     -- パッチロジックのテスト
      GanttTab.svelte         -- ガントチャートタブコンポーネント
    editor/
      EditorLayout.svelte     -- タブUI追加（既存ファイル改修）
```

## 参照仕様

- AST構造: `project/instructions/AST仕様とロジックルール（構造定義込み）.md`
- タスク管理記法: `project/instructions/Markdownベース_タスク管理記法_仕様.md`
- ガントチャートライブラリ: https://github.com/puruneko/ganttchart-for-mywork.git
- カレンダー統合計画: `project/plan/calendar-integration-plan.md`
- 既存パッチ方式: `src/lib/calendar/markdown-patch.ts`
