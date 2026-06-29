<script lang="ts">
  import 'svelte-calendar-lib/dist/index.css'
  import { CalendarView, CalendarStorage, LocalStorageBackend } from 'svelte-calendar-lib'
  import type { CalendarItem } from 'svelte-calendar-lib'
  import { DateTime } from 'luxon'
  import { extractCalendarItems } from './ast-to-calendar'
  import { patchScheduleForNode, patchTaskTitle, formatSchedule } from './markdown-patch'
  import type { Document, TaskNode } from '../parser/types'
  import type { SourceEntry } from '../viewmodel/contract'

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

<div class="calendar-tab">
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
