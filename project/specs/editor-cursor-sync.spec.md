# エディタカーソル同期仕様

**Issue:** obs-0026  
**最終更新:** 2026-06-21

## 概要

カレンダービュー・ガントビューのアイテムをクリックしたとき、Obsidian エディタの対応行にカーソルを移動してフォーカスする機能の仕様。

---

## 1. パーサー: lineNumber フィールド

### 1.1 対象型

`src/lib/parser/types.ts` の以下の型に `lineNumber: number` を追加している。

| 型 | フィールドの意味 |
|---|---|
| `TaskNode` | `- [ ] タスク` 行の 0-based 絶対行インデックス |
| `ListNode` | `- テキスト` 行の 0-based 絶対行インデックス |
| `QuoteNode` | blockquote の最初の行の 0-based 絶対行インデックス |
| `Section` | 見出し行（`# ...`）の 0-based 絶対行インデックス。無名セクションは `-1` |

### 1.2 絶対行インデックスの計算

`tokenize()` が Markdown を行分割する際に、空行を除去した後も元のファイルの行番号（0-based）を `lineIndex` として保持する。
`parseNodes()` はノード生成時に `rawLine.lineIndex` をそのまま `lineNumber` として設定する。

**例:**
```
line 0: # セクション
line 1: (空行)
line 2: - [ ] タスクA
line 3:   - @schedule: 2026-04-01T10:00/12:00
line 4: - リストB
```

→ タスクA.lineNumber = 2, リストB.lineNumber = 4

### 1.3 Document.nodeLineMap

`Document` 型に `nodeLineMap: Map<string, number>` を追加。
`parseMarkdown()` 完了時に全ノード・全セクション（無名セクション除く）を走査して構築する。

```
nodeLineMap: {
  "section-1" → 0,   // # セクション の行
  "n1a2b3c4"  → 2,   // タスクA の行
  "n5d6e7f8"  → 4,   // リストB の行
}
```

**用途:** クリックされたアイテムの `id` からエディタにジャンプすべき行番号を O(1) で引く。

---

## 2. EditorEventBus

`src/sync/editor-event-bus.ts`

ビュー（カレンダー/ガント）からエディタへのカーソル移動要求を仲介するシンプルな pub/sub。

### API

```typescript
class EditorEventBus {
  /** カーソル移動を要求する。登録済みの全ハンドラを呼び出す。 */
  requestFocusLine(lineNumber: number): void

  /** ハンドラを登録する。返却値は解除関数。 */
  onFocusLine(handler: (lineNumber: number) => void): () => void
}
```

### ライフサイクル

- `plugin.ts` の `onload()` で生成し `MdAstEditorPlugin.editorEventBus` として保持する。
- `onunload()` でのクリーンアップは不要（ハンドラは各 View の onClose で自動解除される設計ではなく、`plugin` が保持するクロージャのため GC される）。

---

## 3. クリック → カーソル移動のデータフロー

```
ユーザークリック
    │
    ▼
GanttTab.svelte           : handlers.onBarClick(ganttNode)
CalendarTab.svelte        : handleItemClick(calendarItem)
    │ onNodeClick(nodeId)
    ▼
GanttView.ts / CalendarView.ts
    │ doc = fileSync.getCurrentDocument()
    │ lineNumber = doc.nodeLineMap.get(nodeId)
    │ editorEventBus.requestFocusLine(lineNumber)
    ▼
plugin.ts (onFocusLine ハンドラ)
    │ MarkdownView.editor.setCursor({ line: lineNumber, ch: 0 })
    │ MarkdownView.editor.focus()
    ▼
Obsidian エディタ: 対応行にカーソル移動
```

---

## 4. コンポーネント間のプロパティ連鎖

### GanttView 側

```
GanttView.ts
  └─ GanttViewMount.svelte  (prop: onNodeClick)
       └─ GanttTab.svelte   (prop: onNodeClick)
            └─ GanttEventHandlers.onBarClick → onNodeClick(ganttNode.id)
```

### CalendarView 側

```
CalendarView.ts
  └─ CalendarViewMount.svelte  (prop: onNodeClick)
       └─ CalendarTab.svelte   (prop: onNodeClick)
            └─ CalendarView[lib].onItemClick → onNodeClick(item.id)
```

---

## 5. Obsidian: ファイルとタブの解決ロジック

`plugin.ts` の `onFocusLine` ハンドラは次の順序で動作する:

1. `fileSync.getCurrentFile()` で FileSync が追跡しているファイルを取得する
2. `workspace.iterateAllLeaves` で **そのファイルを表示している** MarkdownView リーフを探す
3. 既存タブが見つかった場合: `revealLeaf` で前面に出してカーソル移動
4. 既存タブが見つからない場合: `getLeaf(false)` で新規リーフを取得し `openFile` してカーソル移動

これにより、「先頭タブ」ではなく「対応ファイルのタブ」に常にジャンプする。

## 5b. ブラウザ（Web App）: Monaco エディタへの連携

ブラウザ環境では Obsidian API は存在しないため、`MonacoEditor.svelte` の `registerReveal` prop を使う。

```
ユーザーがカレンダー/ガントアイテムをクリック
    │ onNodeClick(nodeId)
    ▼
EditorLayout.svelte: handleNodeClick(nodeId)
    │ line = currentDoc.nodeLineMap.get(nodeId)
    │ revealInEditor(line)
    ▼
MonacoEditor.svelte: editor.revealLineInCenter(line + 1)
                     editor.setPosition({ lineNumber: line + 1, column: 1 })
                     editor.focus()
```

Monaco は 1-based 行番号のため、0-based の `lineNumber` に +1 して渡す。

---

## 6. GanttNode / CalendarItem と node.id の対応

ガント・カレンダー両ライブラリは `GanttNode.id` / `CalendarItem.id` にパーサーノードの `node.id`（または `section.id`）をそのまま使用している。

- `ast-to-gantt.ts`: section.id / node.id → GanttNode.id
- `ast-to-calendar.ts`: node.id → CalendarItem.id

このため、クリック時に受け取った `id` を `nodeLineMap` で直接引ける。

---

## 7. 変更ファイル一覧

| ファイル | 変更内容 |
|---|---|
| `src/lib/parser/types.ts` | `lineNumber` を全 Node 型・Section 型に追加、`Document.nodeLineMap` 追加 |
| `src/lib/parser/md-to-ast.ts` | `RawLine.lineIndex` 追加、各ノードに lineNumber 設定、`buildNodeLineMap` 追加 |
| `src/sync/editor-event-bus.ts` | 新規: `EditorEventBus` クラス |
| `src/plugin.ts` | `EditorEventBus` 生成・`onFocusLine` → `editor.setCursor()` 接続 |
| `src/views/GanttView.ts` | `editorEventBus` コンストラクタ引数追加、`onNodeClick` コールバック生成・配線 |
| `src/views/CalendarView.ts` | 同上 |
| `src/views/GanttViewMount.svelte` | `onNodeClick` prop 追加・GanttTab へ渡す |
| `src/views/CalendarViewMount.svelte` | 同上 |
| `src/lib/gantt/GanttTab.svelte` | `onNodeClick` prop 追加、`handlers.onBarClick` で呼び出し |
| `src/lib/calendar/CalendarTab.svelte` | `onNodeClick` prop 追加、`onItemClick` で呼び出し |
| `src/lib/parser/md-to-ast.test.ts` | lineNumber / nodeLineMap のユニットテスト追加 |
| `tests/integration/editor-event-bus.test.ts` | 新規: EditorEventBus ユニットテスト |
