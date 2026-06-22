# obs-0013: ガント/カレンダー ドラッグ操作の応答性改善

## ステータス

Closed

## 概要

ガントチャートのバードラッグ・カレンダーのリサイズ操作が異常に遅い。ドラッグ中（未確定状態）でも毎フレーム markdown への書き込みが発生しており、さらに FileSync がドラッグ中に割り込んで全再描画することでバーが元の位置に揺り戻される。

## 根本原因

### 原因 1（致命的）: ドラッグ中に毎フレーム vault.modify() が呼ばれる

`onBarDrag`（ガント）と `onItemResize`（カレンダー）は `mousemove` のたびに呼ばれる。現在の実装はそのたびに文字列操作 + `vault.modify()`（ディスク書き込み）を実行する。

```
mousemove (~60fps)
  → onBarDrag / onItemResize コールバック
  → patchScheduleForNode() で文字列操作
  → vault.modify() でディスク書き込み  ← 毎フレーム！
  → FileSync 300ms debounce をリセット
```

### 原因 2（致命的）: ドラッグ中に FileSync が割り込み再描画する

300ms ごとに FileSync の debounce が発火し、フルパース → 全再描画が起きる。
**ドラッグ中のバーが元の位置にスナップバックする視覚的な揺り戻しが発生。**

### 原因 3（中）: 自分の書き込みを自分で再パースする無駄ループ

`vault.modify(newMd)` → FileSync が同内容を読み返して再パース → 不要な再描画。

### コールバックの現状

| ライブラリ | コールバック | タイミング | 問題 |
|-----------|------------|----------|------|
| Gantt `onBarDrag` | 毎 mousemove | 毎フレーム | 🔴 毎フレーム書き込みが起きる |
| Gantt `onBarDragEnd` | **存在しない** | — | 🔴 確定タイミングを知る手段がない |
| Calendar `onItemResize` | 毎 mousemove | 毎フレーム | 🔴 同上 |
| Calendar `onItemResizeEnd` | **存在しない** | — | 🔴 同上 |
| Calendar `onItemMove` | drop のみ | ✅ | 問題なし |

## 解決策

3層の修正を行う。

1. **ganttchart-for-mywork**: `onBarDragEnd` コールバックを追加（mouseup 時に最終位置を通知）
2. **calendar-for-mywork**: `onItemResizeEnd` コールバックを追加（mouseup 時に最終位置を通知）
3. **markdownEditor-for-mywork（プラグイン）**: ドラッグ確定時のみ書き込み + FileSync の無駄再パース防止

---

## TODO

- [x] `ganttchart-for-mywork` に `onBarDragEnd` を追加する（下記「ライブラリ変更 1」参照）
- [x] `calendar-for-mywork` に `onItemResizeEnd` を追加する（下記「ライブラリ変更 2」参照）
- [x] `markdownEditor-for-mywork` のプラグイン側を修正する（下記「プラグイン変更」参照）
- [x] 全テスト実行・パス確認（91テスト全パス、ビルドエラーなし）

## 完了条件

- ドラッグ中（mouseup 前）に `vault.modify()` が呼ばれないこと
- ドロップ/マウスアップ後に 1 回だけ markdown が更新されること
- ドラッグ中にバーが揺り戻されないこと
- 全ユニットテストパス・ビルドエラーなし

---

## ライブラリ変更 1: `ganttchart-for-mywork`

変更するファイルは 2 つ。

---

### `src/utils/drag-handler.ts`

#### 変更点 1: `DragHandlerDeps.getParams()` の戻り値に `onBarDragEnd` を追加

```typescript
export interface DragHandlerDeps {
    getParams: () => {
        dayWidth: number
        snapUnit: number
        onBarDrag?: (
            nodeId: string,
            newStart: DateTime,
            newEnd: DateTime,
        ) => void
        // ↓ 追加
        onBarDragEnd?: (
            nodeId: string,
            finalStart: DateTime,
            finalEnd: DateTime,
        ) => void
        onGroupDrag?: (nodeId: string, daysDelta: number) => void
    }
}
```

#### 変更点 2: `DragState` に `currentStart` / `currentEnd` を追加

ドラッグ中の最新位置を保持し、mouseup 時に `onBarDragEnd` へ渡すために使用する。

```typescript
interface DragState {
    nodeId: string
    mode: DragMode
    originalStart: DateTime
    originalEnd: DateTime
    startX: number
    lastAppliedDelta: number
    currentStart: DateTime   // 追加
    currentEnd: DateTime     // 追加
}
```

#### 変更点 3: `handleMouseDown` で `currentStart` / `currentEnd` を初期化

```typescript
dragState = {
    nodeId: node.id,
    mode,
    originalStart: node.start,
    originalEnd: node.end,
    startX: event.clientX,
    lastAppliedDelta: 0,
    currentStart: node.start,   // 追加
    currentEnd: node.end,       // 追加
}
```

#### 変更点 4: `handleMouseMove` で `currentStart` / `currentEnd` を更新

`onBarDrag` を呼ぶ直前に追記する。

```typescript
// 既存コードの中で newStart / newEnd を確定させたあと、onBarDrag の直前に追記
dragState.currentStart = newStart   // 追加
dragState.currentEnd = newEnd       // 追加
onBarDrag(dragState.nodeId, newStart, newEnd)  // 既存
```

#### 変更点 5: `handleMouseUp` でドラッグ確定コールバックを呼ぶ

`dragState = null` にする**前**に `onBarDragEnd` を呼ぶ。

```typescript
function handleMouseUp(): void {
    if (dragState) {
        const { onBarDragEnd } = deps.getParams()
        // 追加: state クリア前に最終位置を通知
        onBarDragEnd?.(dragState.nodeId, dragState.currentStart, dragState.currentEnd)

        // 既存のデバッグログ（あれば残す）
        console.debug(
            "🎯 [GanttTimeline] Drag completed:",
            dragState.mode,
            "for node",
            dragState.nodeId,
        )
    }
    dragState = null
    window.removeEventListener("mousemove", handleMouseMove)
    window.removeEventListener("mouseup", handleMouseUp)
}
```

---

### `src/types.ts`

`GanttEventHandlers` インターフェースに `onBarDragEnd` を追加する。
既存の `onBarDrag` の直下に追記するのが適切。

```typescript
export interface GanttEventHandlers {
  // ... 既存のプロパティ ...

  /** バーがドラッグされたときに発火（controlled モードでは必須） */
  onBarDrag?: (nodeId: string, newStart: DateTime, newEnd: DateTime) => void;

  // ↓ 追加
  /** バーのドラッグが確定したとき（mouseup）に発火。最終的な start/end を通知する */
  onBarDragEnd?: (nodeId: string, finalStart: DateTime, finalEnd: DateTime) => void;

  /** グループ全体がドラッグされたときに発火 */
  onGroupDrag?: (nodeId: string, daysDelta: number) => void;

  // ... 以降は変更なし ...
}
```

---

## ライブラリ変更 2: `calendar-for-mywork`

変更するファイルは 2 つ。

---

### `src/lib/components/WeekView.svelte`

#### 変更点 1: `Props` に `onItemResizeEnd` を追加

既存の `onItemResize` の直下に追記する。

```typescript
interface Props {
  // ... 既存 ...

  /** アイテムリサイズ時のイベントハンドラ（毎 mousemove で発火） */
  onItemResize?: (item: CalendarItem, newStart: DateTime, newEnd: DateTime) => void;

  // ↓ 追加
  /** アイテムリサイズ確定時（mouseup）のイベントハンドラ。最終的な start/end を通知する */
  onItemResizeEnd?: (item: CalendarItem, finalStart: DateTime, finalEnd: DateTime) => void;

  // ... 以降は変更なし ...
}
```

`let { ..., onItemResize, onItemResizeEnd, ... } = $props()` にも `onItemResizeEnd` を追加。

#### 変更点 2: リサイズ追跡用 state 変数を追加

ファイル内の既存 state 変数（`resizingItem` などがある付近）に追記する。

```typescript
// --- 追加: リサイズ中の最新位置を保持する ---
let resizeLastStart: DateTime | null = $state(null)
let resizeLastEnd: DateTime | null = $state(null)
let alldayResizeLastStart: DateTime | null = $state(null)
let alldayResizeLastEnd: DateTime | null = $state(null)
```

#### 変更点 3: `handleResizeMove` でリサイズ最新位置を追跡

`onItemResize?.(...)` の呼び出し**直前**に state を更新する。

```typescript
// 既存コード（onItemResize の直前に追記）
resizeLastStart = newStart   // 追加
resizeLastEnd = newEnd       // 追加
onItemResize?.(resizingItem, newStart, newEnd)  // 既存
// 注意: resizeStartYは更新しない（累積的な変更を追跡するため）
```

#### 変更点 4: `handleResizeEnd` でリサイズ確定コールバックを呼ぶ

`resizingItem = null` にする**前**に `onItemResizeEnd` を呼ぶ。

```typescript
function handleResizeEnd() {
  document.removeEventListener('mousemove', handleResizeMove)
  document.removeEventListener('mouseup', handleResizeEnd)

  // すべてのカレンダーアイテムのdraggableを再有効化（既存）
  const allItems = document.querySelectorAll('.calendar-item')
  allItems.forEach(el => {
    (el as HTMLElement).setAttribute('draggable', 'true')
  })

  // 追加: リサイズ確定を通知（state クリア前）
  if (resizingItem && resizeLastStart && resizeLastEnd) {
    onItemResizeEnd?.(resizingItem, resizeLastStart, resizeLastEnd)
  }

  // 既存のクリア処理
  resizingItem = null
  resizeEdge = null
  resizeStartY = 0

  // 追加: 追跡 state もクリア
  resizeLastStart = null
  resizeLastEnd = null
}
```

#### 変更点 5: `handleAlldayResizeMove` で allday リサイズ最新位置を追跡

`onItemResize?.(...)` の呼び出し**直前**に state を更新する。

```typescript
// 既存コード（onItemResize の直前に追記）
alldayResizeLastStart = newStart   // 追加
alldayResizeLastEnd = newEnd       // 追加
onItemResize?.(alldayResizingItem, newStart, newEnd)  // 既存
```

#### 変更点 6: `handleAlldayResizeEnd` で allday リサイズ確定コールバックを呼ぶ

`alldayResizingItem = null` にする**前**に `onItemResizeEnd` を呼ぶ。

```typescript
function handleAlldayResizeEnd() {
  document.removeEventListener('mousemove', handleAlldayResizeMove)
  document.removeEventListener('mouseup', handleAlldayResizeEnd)

  const allBars = document.querySelectorAll('.allday-item')
  allBars.forEach(el => (el as HTMLElement).setAttribute('draggable', 'true'))

  // 追加: allday リサイズ確定を通知（state クリア前）
  if (alldayResizingItem && alldayResizeLastStart && alldayResizeLastEnd) {
    onItemResizeEnd?.(alldayResizingItem, alldayResizeLastStart, alldayResizeLastEnd)
  }

  // 既存のクリア処理
  alldayResizingItem = null
  alldayResizeEdge = null
  alldayResizeStartX = 0
  alldayResizeStartDay = null

  // 追加: 追跡 state もクリア
  alldayResizeLastStart = null
  alldayResizeLastEnd = null
}
```

---

### `src/lib/components/CalendarView.svelte`

`WeekView` と `MonthView` の両方を wrapper するコンポーネント。
`onItemResizeEnd` を props として受け取り、内部ハンドラーを経由して各 View に伝達する。

#### 変更点 1: `Props` に `onItemResizeEnd` を追加

```typescript
interface Props {
  // ... 既存 ...
  onItemResize?: (item: CalendarItem, newStart: DateTime, newEnd: DateTime) => void;
  onItemResizeEnd?: (item: CalendarItem, finalStart: DateTime, finalEnd: DateTime) => void;  // 追加
  // ...
}
```

destructuring にも追加。

#### 変更点 2: `handleItemResizeEnd` wrapper 関数を追加

既存の `handleItemResize` 関数の隣に追加する。

```typescript
// 既存
function handleItemResize(item: CalendarItem, newStart: DateTime, newEnd: DateTime) {
  defaultHandleItemResize(item, newStart, newEnd)
  onItemResize?.(item, newStart, newEnd)
}

// 追加
function handleItemResizeEnd(item: CalendarItem, finalStart: DateTime, finalEnd: DateTime) {
  onItemResizeEnd?.(item, finalStart, finalEnd)
}
```

#### 変更点 3: WeekView / MonthView への prop 伝達

`CalendarView.svelte` 内で `WeekView` と `MonthView` を使っている箇所に `onItemResizeEnd={handleItemResizeEnd}` を追加する。

---

## プラグイン変更: `markdownEditor-for-mywork`

変更するファイルは 3 つ。

---

### `src/lib/gantt/GanttTab.svelte`

#### 変更点 1: `onBarDrag` から書き込みを削除

ドラッグ中は何もしない（ライブラリが視覚プレビューを管理する）。

```typescript
const handlers: GanttEventHandlers = {
  // 変更前:
  // onBarDrag(nodeId, newStart, newEnd) {
  //   const node = findNodeById(doc, nodeId)
  //   if (!node || !node.meta?.schedule) return
  //   const newSchedule = formatSchedule(newStart, newEnd)
  //   if (newSchedule === node.meta.schedule) return
  //   onMdChange(patchScheduleForNode(mdValue, node, newSchedule))
  // },

  // 変更後:
  onBarDrag(_nodeId, _newStart, _newEnd) {
    // ドラッグ中は markdown を更新しない。
    // ライブラリが視覚的プレビューを管理するため、ここでは何もしない。
  },

  // 追加: ドラッグ確定時（mouseup）にのみ書き込む
  onBarDragEnd(nodeId, finalStart, finalEnd) {
    const node = findNodeById(doc, nodeId)
    if (!node || !node.meta?.schedule) return
    const newSchedule = formatSchedule(finalStart, finalEnd)
    if (newSchedule === node.meta.schedule) return
    onMdChange(patchScheduleForNode(mdValue, node, newSchedule))
  },

  // ... onZoomChange は変更なし ...
}
```

---

### `src/lib/calendar/CalendarTab.svelte`

#### 変更点 1: `handleItemResize` から書き込みを削除

```typescript
// 変更前:
// function handleItemResize(item: CalendarItem, newStart: DateTime, newEnd: DateTime) {
//   if (item.temporal.kind !== 'CalendarDateTimeRange') return
//   const node = findNodeById(doc, item.id)
//   if (!node) return
//   const newSchedule = formatSchedule(newStart, newEnd)
//   onMdChange(patchScheduleForNode(mdValue, node, newSchedule))
// }

// 変更後:
function handleItemResize(_item: CalendarItem, _newStart: DateTime, _newEnd: DateTime) {
  // ドラッグ中は markdown を更新しない。
}
```

#### 変更点 2: `handleItemResizeEnd` を追加

```typescript
// 追加: リサイズ確定時（mouseup）にのみ書き込む
function handleItemResizeEnd(item: CalendarItem, finalStart: DateTime, finalEnd: DateTime) {
  if (item.temporal.kind !== 'CalendarDateTimeRange') return
  const node = findNodeById(doc, item.id)
  if (!node) return
  const newSchedule = formatSchedule(finalStart, finalEnd)
  onMdChange(patchScheduleForNode(mdValue, node, newSchedule))
}
```

#### 変更点 3: `<CalendarView>` に `onItemResizeEnd` を渡す

```svelte
<CalendarView
  items={calendarItems}
  {storage}
  onItemMove={handleItemMove}
  onItemResize={handleItemResize}
  onItemResizeEnd={handleItemResizeEnd}
  onItemUpdate={handleItemUpdate}
/>
```

---

### `src/sync/file-sync.ts`

#### 変更点: `parseFile` で同一コンテンツ再パースをスキップ

`vault.modify(newMd)` した直後に FileSync が同じ `newMd` を読み返して再パースするのを防ぐ。
`this.app.vault.read()` の直後、`parseMarkdown()` の前に 1 行追加するだけ。

```typescript
private async parseFile(file: TFile): Promise<void> {
  try {
    const content = await this.app.vault.read(file)
    // 追加: 内容が変わっていなければ再パース・再通知をスキップする
    if (content === this.currentMarkdown) return
    const doc = parseMarkdown(content)
    this.currentDoc = doc
    this.currentMarkdown = content
    this.currentFile = file
    this.notify(doc, file)
  } catch {
    // 読み取りエラーは無視する（ファイルが削除された場合など）。
  }
}
```

---

## 修正後の動作

| フェーズ | vault 書き込み | FileSync 発火 | 再描画 |
|---------|------------|------------|------|
| **ドラッグ中（修正前）** | ~60回/秒 | 300msごと | 毎 300ms でバーが揺れ戻る |
| **ドラッグ中（修正後）** | 0回 | 0回 | なし（滑らか） |
| **ドロップ後（修正後）** | 1回 | 300ms後に1回 | 1回（正常更新） |

## History

- 2026-03-26: 実装完了・Closed
  - ライブラリ変更（ganttchart-for-mywork / calendar-for-mywork）は別 AI が実施
  - `GanttTab.svelte`: `onBarDrag` から書き込みを削除、`onBarDragEnd` で書き込み
  - `CalendarTab.svelte`: `handleItemResize` から書き込みを削除、`handleItemResizeEnd` で書き込み
  - `file-sync.ts`: `content === this.currentMarkdown` チェックで同一内容再パースを防止
  - 91ユニットテスト全パス・ビルドエラーなし確認

## 関連ファイル

- `ganttchart-for-mywork/src/utils/drag-handler.ts`
- `ganttchart-for-mywork/src/types.ts`
- `calendar-for-mywork/src/lib/components/WeekView.svelte`
- `calendar-for-mywork/src/lib/components/CalendarView.svelte`
- `markdownEditor-for-mywork/src/lib/gantt/GanttTab.svelte`
- `markdownEditor-for-mywork/src/lib/calendar/CalendarTab.svelte`
- `markdownEditor-for-mywork/src/sync/file-sync.ts`
