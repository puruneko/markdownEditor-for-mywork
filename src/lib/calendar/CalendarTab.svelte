<script lang="ts">
  import 'svelte-calendar-lib/dist/index.css'
  import { CalendarView } from 'svelte-calendar-lib'
  import type { CalendarItem } from 'svelte-calendar-lib'
  import { DateTime } from 'luxon'
  import { extractCalendarItems } from './ast-to-calendar'
  import { findNodeById, patchSchedule, patchTaskTitle, formatSchedule } from './markdown-patch'
  import type { Document } from '../parser/types'

  interface Props {
    /** Raw markdown string — used as patch target (source of truth) */
    mdValue: string
    /** Parsed AST — used for CalendarItem extraction and node lookup */
    doc: Document
    onMdChange: (newMd: string) => void
  }

  let { mdValue, doc, onMdChange }: Props = $props()

  // Derive CalendarItem[] from AST every time doc changes
  let calendarItems = $derived(extractCalendarItems(doc))

  // ----------------------------------------------------------------
  // #0017: drag move / resize → patch @schedule line only
  // ----------------------------------------------------------------

  function handleItemMove(item: CalendarItem, newStart: DateTime, newEnd: DateTime) {
    if (item.temporal.kind !== 'CalendarDateTimeRange') return
    const oldSchedule = formatSchedule(item.temporal.start, item.temporal.end)
    const newSchedule = formatSchedule(newStart, newEnd)
    onMdChange(patchSchedule(mdValue, oldSchedule, newSchedule))
  }

  function handleItemResize(item: CalendarItem, newStart: DateTime, newEnd: DateTime) {
    if (item.temporal.kind !== 'CalendarDateTimeRange') return
    const oldSchedule = formatSchedule(item.temporal.start, item.temporal.end)
    const newSchedule = formatSchedule(newStart, newEnd)
    onMdChange(patchSchedule(mdValue, oldSchedule, newSchedule))
  }

  // ----------------------------------------------------------------
  // #0018: edit dialog save → patch title and/or @schedule line only
  // ----------------------------------------------------------------

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
        newMd = patchSchedule(newMd, oldNode.meta.schedule, newSchedule)
      }
    }

    if (newMd !== mdValue) onMdChange(newMd)
  }
</script>

<div class="calendar-tab">
  <CalendarView
    items={calendarItems}
    onItemMove={handleItemMove}
    onItemResize={handleItemResize}
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
