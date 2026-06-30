# svelte-gantt-lib: 外部ドロップ対応・全イベントコールバック公開

## 背景・要求元

`markdownEditor-for-mywork` プロジェクトにて、Obsidian エディタ上のタスク行を
Gantt ビューへドラッグ＆ドロップし、対象タスクの `@schedule` メタを自動書き込みする
機能（issue-phase002-004）を実装しようとしたが、以下の理由により **プラグイン側だけでは完結できない** ことが判明した。

### ブロッカー

Gantt チャート上のドロップ座標（clientX）を日付に変換するには
`extendedDateRange.start`（タイムライン SVG の x=0 に対応する日時）と
`dayWidth`（1日あたり px）が必要になる。

しかし `extendedDateRange` はライブラリ内部の Svelte ストアであり、
外部から読み取る手段が存在しない。
`calculateDateRange(nodes)` で得られる基準日付範囲からは
`bufferDays`（ズームスケール依存、最大90日）のオフセットが含まれるため、
近似計算では誤差が許容範囲を超える（最大 `90日 × 30px = 2700px` のずれ）。

---

## 要求 1: 外部ドロップコールバック（最優先）

### 概要

GanttChart の `GanttEventHandlers` に `onExternalDrop` コールバックを追加し、
外部ソース（HTML5 DnD の DataTransfer）からのドロップを受け付けられるようにする。

### 要求仕様

#### 1-1. `GanttEventHandlers` への追加

```ts
export interface GanttEventHandlers {
  // （既存ハンドラーはそのまま）

  /**
   * 外部ドロップが発生したとき（application/x-md-task 等、既存バーとは異なるソース）に発火。
   * ライブラリは「ドロップ先の日付」を座標から計算して渡す。
   * ペイロード解釈・書き戻しはコールバック側の責務。
   */
  onExternalDrop?: (event: GanttExternalDropEvent) => void

  /**
   * 外部ドラッグがタイムライン上をホバーしているとき、スナップ単位で発火。
   * ドラッグプレビュー（ゴーストバーなど）表示のために使用する。
   */
  onExternalDragOver?: (event: GanttExternalDragOverEvent) => void
}
```

#### 1-2. 新規型定義

```ts
export interface GanttExternalDropEvent {
  /** ドロップが発生した DragEvent（DataTransfer へのアクセス用） */
  originalEvent: DragEvent

  /** ドロップ位置の日付（タイムラインの x座標 → 日付変換済み、スナップ適用後） */
  dropDate: DateTime

  /** ドロップ位置の直近の GanttNode（バー上にドロップした場合、そのノード）。なければ null */
  nearestNode: GanttNode | null
}

export interface GanttExternalDragOverEvent {
  /** 現在のホバー日付（スナップ適用後） */
  hoverDate: DateTime

  /** ホバー位置の直近ノード */
  nearestNode: GanttNode | null
}
```

#### 1-3. ライブラリ側の実装要件

- タイムライン領域（`.gantt-timeline-wrapper`）に `dragover` イベントリスナーを追加する。
- `dragover` ハンドラー内で `event.dataTransfer.types` を確認し、
  既存バーの DnD（`text/plain` に内部 nodeId が入る）ではないと判断した場合に
  `onExternalDragOver` を呼ぶ。
- 外部ドロップを受け入れる条件: `onExternalDrop` が登録されており、かつ
  DataTransfer に既存バーのデータが含まれていない場合のみ `event.preventDefault()` を呼ぶ。
  （登録されていなければ既存挙動に影響しない）
- 座標→日付変換は `extendedDateRange.start + (scrollLeft + clientX - timelineRect.left) / dayWidth` で行う。
  スナップは `dragSnapDivision` の設定に従う。

#### 1-4. 後方互換性

- `onExternalDrop` が未登録の場合、既存の DnD 挙動・描画に一切影響しない。
- 既存の `onBarDrag` / `onBarDragEnd` とは独立して動作する。

---

## 要求 2: 全イベントコールバックの外部公開

### 概要

現在 `store.events.emit(...)` でライブラリ内部のイベントバスに流れているが、
ハンドラーが未登録のイベント（`panStart`・`panEnd`・スクロール変化等）は
`GanttEventHandlers` 経由で外部から購読できない。
すべてのイベントを `GanttEventHandlers` コールバックとして公開する。

### 現状の `GanttEventHandlers`（公開済み）

| ハンドラー名 | 発火タイミング |
|---|---|
| `onNodeClick` | ツリー行またはバーのクリック |
| `onNameClick` | ツリー内ノード名クリック |
| `onBarClick` | タイムラインバーのクリック |
| `onBarDrag` | バードラッグ中（毎フレーム） |
| `onBarDragEnd` | バードラッグ完了 |
| `onGroupDrag` | グループ移動 |
| `onAutoAdjustSection` | セクション日付自動調整 |
| `onToggleCollapse` | 折り畳み/展開 |
| `onDataChange` | データ変更（uncontrolled モード） |
| `onZoomChange` | ズームレベル変更 |

### 追加要求ハンドラー

| ハンドラー名（追加） | 対応する内部イベント | 渡すべき引数 |
|---|---|---|
| `onPanStart` | `store.events.emit('panStart', ...)` | `startX: number, startY: number, originalEvent: MouseEvent` |
| `onPanEnd` | `store.events.emit('panEnd', ...)` | `endX: number, endY: number, originalEvent: MouseEvent` |
| `onScrollChange` | タイムライン `scroll` イベント | `scrollLeft: number, scrollTop: number` |
| `onViewportChange` | ビューポートサイズ変更 | `width: number, height: number` |
| `onDateRangeChange` | `extendedDateRange` 更新時 | `range: DateRange`（extendedDateRange そのもの） |

#### 要求仕様詳細

```ts
export interface GanttEventHandlers {
  // （既存ハンドラーはそのまま）

  /** タイムラインのパン（ドラッグスクロール）開始 */
  onPanStart?: (startX: number, startY: number, originalEvent: MouseEvent) => void

  /** タイムラインのパン終了 */
  onPanEnd?: (endX: number, endY: number, originalEvent: MouseEvent) => void

  /** タイムラインのスクロール位置変化 */
  onScrollChange?: (scrollLeft: number, scrollTop: number) => void

  /** タイムライン描画領域のサイズ変化（リサイズ対応） */
  onViewportChange?: (width: number, height: number) => void

  /**
   * 表示日付範囲（extendedDateRange）が変化したとき。
   * 外部ドロップの座標→日付変換に利用できる。
   * これが公開されれば onExternalDrop コールバックなしでも座標変換が実装可能。
   */
  onDateRangeChange?: (range: DateRange) => void
}
```

#### `onDateRangeChange` の重要性

`onDateRangeChange` が公開されれば、プラグイン側は受け取った `DateRange` を
変数に保持しておき、自前の `drop` ハンドラーで座標→日付変換できる。
これは「要求 1」の `onExternalDrop` と同等の機能を別経路で実現するものであり、
どちらか一方でも実装されれば本プロジェクトの目的は達成できる。

---

## 優先度

| 要求 | 優先度 | 理由 |
|---|---|---|
| `onExternalDrop` + `onExternalDragOver` | **必須** | ライブラリ側で座標変換を完結させる唯一の方法 |
| `onDateRangeChange` | **必須（代替手段）** | プラグイン側での座標変換を可能にする最小限の公開 |
| `onPanStart` / `onPanEnd` | 推奨 | プラグイン側のプレビュー UI 同期に必要 |
| `onScrollChange` | 推奨 | 同上 |
| `onViewportChange` | 任意 | あれば望ましい |

---

## 実装時の注意事項

### 既存 DnD との競合回避

ライブラリ内部のバー DnD は `event.dataTransfer` に `text/plain` で内部 nodeId をセットする。
外部ドロップ判定はこれとの区別が必要：

```ts
// 内部バー DnD の判定
const isInternalDrag = event.dataTransfer.types.includes('text/plain')
  && !event.dataTransfer.types.includes('application/x-md-task')

// 外部ドラッグの判定（プラグイン側の MIME）
const isExternalTaskDrag = event.dataTransfer.types.includes('application/x-md-task')
```

### 座標変換の公式

```ts
// タイムライン内の x 座標（SVG コンテンツ座標系）
const contentX = event.clientX - timelineRect.left + timelineScrollLeft

// 日付への変換
const days = contentX / dayWidth
const dropDate = extendedDateRange.start.plus({ days })

// スナップ（dragSnapDivision = 4 のとき 0.25日 = 6時間単位）
const snapDays = 1 / dragSnapDivision
const snappedDays = Math.round(days / snapDays) * snapDays
const snappedDate = extendedDateRange.start.plus({ days: snappedDays })
```

---

## 関連情報

- 要求元 issue: `issue-phase002-004__selection-drag-to-view-meta`（markdownEditor-for-mywork）
- ブロッカーとなった実装: `src/views/GanttViewMount.svelte` — 外部ドロップ未実装
- 影響ファイル（実装後に対応予定）: `src/lib/gantt/GanttTab.svelte`
- 作成: 2026-06-29
