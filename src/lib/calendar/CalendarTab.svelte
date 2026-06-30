<script lang="ts">
  import 'svelte-calendar-lib/dist/index.css'
  import { CalendarView, CalendarStorage, LocalStorageBackend, DEFAULT_WEEK_SETTINGS } from 'svelte-calendar-lib'
  import type { CalendarItem } from 'svelte-calendar-lib'
  import { DateTime } from 'luxon'
  import { extractCalendarItems } from './ast-to-calendar'
  import { patchScheduleForNode, patchTaskTitle, formatSchedule } from './markdown-patch'
  import { upsertSchedule, upsertDue } from '../patch/upsert-meta'
  import type { Document, TaskNode } from '../parser/types'
  import type { SourceEntry } from '../viewmodel/contract'
  import { makeGlobalKey } from '../viewmodel/global-key'
  import { MD_TASK_MIME } from '../../editor/task-drag-source'
  import type { TaskDragPayload } from '../../editor/task-drag-source'

  interface Props {
    /** 複数ソース（ファイルパスと Document のペア）— CalendarItem 抽出に使用 */
    sources: SourceEntry[]
    /** globalKey を受けて該当ファイルへ書き戻す非同期コールバック */
    onNodePatch: (globalKey: string, patcher: (md: string, doc: Document, node: TaskNode) => string) => Promise<void>
    /** アイテムクリック時に globalKey を通知するコールバック。エディタカーソル移動に使用。 */
    onNodeClick?: (globalKey: string) => void
  }

  let { sources, onNodePatch, onNodeClick }: Props = $props()

  const storage = new CalendarStorage(new LocalStorageBackend())

  // 現在表示中の基準日とビュータイプを追跡して @repeat 展開範囲を決定する
  let currentDate = $state(DateTime.now())
  let viewType = $state<'week' | 'month'>('week')

  let viewRange = $derived(
    viewType === 'month'
      ? {
          // 月ビュー: 前後の端数週も含めて余裕を持たせる
          start: currentDate.startOf('month').startOf('week'),
          end: currentDate.endOf('month').endOf('week'),
        }
      : {
          // 週ビュー: 当週全体
          start: currentDate.startOf('week'),
          end: currentDate.endOf('week'),
        },
  )

  let calendarItems = $derived(extractCalendarItems(sources, viewRange))

  function handleItemMove(item: CalendarItem, newStart: DateTime, newEnd: DateTime) {
    if (item.temporal.kind !== 'CalendarDateTimeRange') return
    void onNodePatch(item.id, (md, _doc, node) => {
      const newSchedule = formatSchedule(newStart, newEnd)
      return patchScheduleForNode(md, node, newSchedule)
    })
  }

  function handleItemResize(_item: CalendarItem, _newStart: DateTime, _newEnd: DateTime) {
    // ドラッグ中は markdown を更新しない。ライブラリが視覚プレビューを管理する。
  }

  function handleItemResizeEnd(item: CalendarItem, finalStart: DateTime, finalEnd: DateTime) {
    if (item.temporal.kind !== 'CalendarDateTimeRange') return
    void onNodePatch(item.id, (md, _doc, node) => {
      const newSchedule = formatSchedule(finalStart, finalEnd)
      return patchScheduleForNode(md, node, newSchedule)
    })
  }

  function handleItemClick(item: CalendarItem) {
    onNodeClick?.(item.id)
  }

  // ----------------------------------------------------------------
  // 外部ドロップ（エディタからのタスク DnD）
  // ----------------------------------------------------------------

  const DEFAULT_DURATION_MIN = 60

  function deriveWeekDays(): DateTime[] {
    const ws = storage.weekSettings ?? DEFAULT_WEEK_SETTINGS
    const weekStartsOn = ws.weekStartsOn ?? 1
    const showWeekend = ws.showWeekend ?? true
    let start = currentDate.startOf('day')
    while (start.weekday !== weekStartsOn) {
      start = start.minus({ days: 1 })
    }
    const allDays = Array.from({ length: 7 }, (_, i) => start.plus({ days: i }))
    return showWeekend ? allDays : allDays.filter(d => d.weekday <= 5)
  }

  function handleExternalDragOver(e: DragEvent) {
    if (e.dataTransfer?.types.includes(MD_TASK_MIME)) {
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    }
  }

  function handleExternalDrop(e: DragEvent) {
    const raw = e.dataTransfer?.getData(MD_TASK_MIME)
    if (!raw) return

    let payload: TaskDragPayload
    try { payload = JSON.parse(raw) } catch { return }

    const globalKey = makeGlobalKey(payload.sourcePath, payload.nodeId)
    const target = e.target as HTMLElement

    // ドロップ先の day-column を特定する
    const dayCol = target.closest?.('.day-column') as HTMLElement | null
    if (!dayCol) return

    const allCols = Array.from(
      dayCol.parentElement?.querySelectorAll(':scope > .day-column') ?? [],
    )
    const colIdx = allCols.indexOf(dayCol)
    const weekDays = deriveWeekDays()
    const dropDay = weekDays[colIdx]
    if (!dropDay) return

    // 終日帯か時間グリッドかを判定
    const inAllday = !!(
      target.closest?.('.day-allday') ||
      target.closest?.('.allday-drop-cell') ||
      target.closest?.('.allday-canvas')
    )

    if (inAllday) {
      const dueValue = dropDay.toFormat('yyyy-MM-dd')
      void onNodePatch(globalKey, (md, _doc, node) => upsertDue(md, node, dueValue))
      return
    }

    const gridEl = target.closest?.('.day-grid') as HTMLElement | null
    if (!gridEl) return

    const ws = storage.weekSettings ?? DEFAULT_WEEK_SETTINGS
    const startHour = ws.startHour ?? 0
    const minorTick = ws.minorTick ?? 15

    const gridRect = gridEl.getBoundingClientRect()
    const yInGrid = e.clientY - gridRect.top
    // day-grid 先頭には minorTick px の余白（▲インジケーター領域）がある
    const minutesSinceStart = Math.max(0, yInGrid - minorTick)
    const totalMinutes = startHour * 60 + minutesSinceStart
    const snappedMinutes = Math.round(totalMinutes / minorTick) * minorTick
    const hour = Math.floor(snappedMinutes / 60) % 24
    const minute = snappedMinutes % 60

    const startDt = dropDay.set({ hour, minute, second: 0, millisecond: 0 })
    const endDt = startDt.plus({ minutes: DEFAULT_DURATION_MIN })

    void onNodePatch(globalKey, (md, _doc, node) => upsertSchedule(md, node, formatSchedule(startDt, endDt)))
  }

  function handleItemUpdate(item: CalendarItem) {
    void onNodePatch(item.id, (md, _doc, node) => {
      let newMd = md
      if (item.title !== node.text) {
        newMd = patchTaskTitle(newMd, node.status, node.text, item.title)
      }
      if (
        item.temporal.kind === 'CalendarDateTimeRange' &&
        node.meta?.schedule
      ) {
        const newSchedule = formatSchedule(item.temporal.start, item.temporal.end)
        if (newSchedule !== node.meta.schedule) {
          newMd = patchScheduleForNode(newMd, node, newSchedule)
        }
      }
      return newMd
    })
  }
</script>

<div
  class="calendar-tab"
  ondragover={handleExternalDragOver}
  ondrop={handleExternalDrop}
>
  <CalendarView
    items={calendarItems}
    {storage}
    onViewChange={(date) => { currentDate = date }}
    onViewTypeChange={(type) => { viewType = type }}
    onItemClick={handleItemClick}
    onItemMove={handleItemMove}
    onItemResize={handleItemResize}
    onItemResizeEnd={handleItemResizeEnd}
    onItemUpdate={handleItemUpdate}
  />
</div>

<style>
  .calendar-tab {
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: #fff;
  }
</style>
