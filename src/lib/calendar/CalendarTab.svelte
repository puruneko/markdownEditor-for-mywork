<script lang="ts">
  import 'svelte-calendar-lib/dist/index.css'
  import { CalendarView, CalendarStorage, LocalStorageBackend } from 'svelte-calendar-lib'
  import type { CalendarItem } from 'svelte-calendar-lib'
  import { DateTime } from 'luxon'
  import { extractCalendarItems } from './ast-to-calendar'
  import { findNodeById, patchScheduleForNode, patchTaskTitle, formatSchedule } from './markdown-patch'
  import type { Document } from '../parser/types'

  interface Props {
    /** Raw markdown string — used as patch target (source of truth) */
    mdValue: string
    /** Parsed AST — used for CalendarItem extraction and node lookup */
    doc: Document
    onMdChange: (newMd: string) => void
    /** アイテムクリック時にノードIDを通知するコールバック。エディタカーソル移動に使用。 */
    onNodeClick?: (nodeId: string) => void
  }

  let { mdValue, doc, onMdChange, onNodeClick }: Props = $props()

  const storage = new CalendarStorage(new LocalStorageBackend())

  // Derive CalendarItem[] from AST every time doc changes
  let calendarItems = $derived(extractCalendarItems(doc))

  // ----------------------------------------------------------------
  // #0017: drag move / resize → patch @schedule line only
  // ----------------------------------------------------------------

  function handleItemMove(item: CalendarItem, newStart: DateTime, newEnd: DateTime) {
    if (item.temporal.kind !== 'CalendarDateTimeRange') return
    const node = findNodeById(doc, item.id)
    if (!node) return
    const newSchedule = formatSchedule(newStart, newEnd)
    onMdChange(patchScheduleForNode(mdValue, node, newSchedule))
  }

  function handleItemResize(_item: CalendarItem, _newStart: DateTime, _newEnd: DateTime) {
    // ドラッグ中は markdown を更新しない。ライブラリが視覚プレビューを管理する。
  }

  function handleItemResizeEnd(item: CalendarItem, finalStart: DateTime, finalEnd: DateTime) {
    if (item.temporal.kind !== 'CalendarDateTimeRange') return
    const node = findNodeById(doc, item.id)
    if (!node) return
    const newSchedule = formatSchedule(finalStart, finalEnd)
    onMdChange(patchScheduleForNode(mdValue, node, newSchedule))
  }

  // ----------------------------------------------------------------
  // #0018: edit dialog save → patch title and/or @schedule line only
  // ----------------------------------------------------------------

  function handleItemClick(item: CalendarItem) {
    onNodeClick?.(item.id)
  }

  function handleItemUpdate(item: CalendarItem) {
    const oldNode = findNodeById(doc, item.id)
    if (!oldNode) return

    let newMd = mdValue

    // Patch title if changed (- [marker] oldTitle → - [marker] newTitle)
    if (item.title !== oldNode.text) {
      newMd = patchTaskTitle(newMd, oldNode.status, oldNode.text, item.title)
    }

    // Patch @schedule if changed
    if (
      item.temporal.kind === 'CalendarDateTimeRange' &&
      oldNode.meta?.schedule
    ) {
      const newSchedule = formatSchedule(item.temporal.start, item.temporal.end)
      if (newSchedule !== oldNode.meta.schedule) {
        newMd = patchScheduleForNode(newMd, oldNode, newSchedule)
      }
    }

    if (newMd !== mdValue) onMdChange(newMd)
  }
</script>

<div class="calendar-tab">
  <CalendarView
    items={calendarItems}
    {storage}
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
