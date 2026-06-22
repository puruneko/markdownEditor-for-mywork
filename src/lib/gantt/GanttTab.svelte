<script lang="ts">
  import { GanttChart, getTickDefinitionForScale } from 'svelte-gantt-lib'
  import type { GanttNode, GanttEventHandlers, GanttConfig } from 'svelte-gantt-lib'
  import { extractGanttNodes } from './ast-to-gantt'
  import { findNodeById, patchScheduleForNode, formatSchedule } from '../calendar/markdown-patch'
  import type { Document } from '../parser/types'

  interface Props {
    /** Raw markdown string — used as patch target (source of truth) */
    mdValue: string
    /** Parsed AST — used for GanttNode extraction and node lookup */
    doc: Document
    onMdChange: (newMd: string) => void
    /** バークリック時にノードIDを通知するコールバック。エディタカーソル移動に使用。 */
    onNodeClick?: (nodeId: string) => void
  }

  let { mdValue, doc, onMdChange, onNodeClick }: Props = $props()

  // Derive GanttNode[] from AST every time doc changes
  let ganttNodes: GanttNode[] = $derived(extractGanttNodes(doc))

  // ----------------------------------------------------------------
  // dragSnapDivision = 1 / minorInterval_days (1 minor tick per snap)
  // ----------------------------------------------------------------

  const INITIAL_DAY_WIDTH = 30

  function snapDivisionForScale(scale: number): number {
    const tickDef = getTickDefinitionForScale(scale)
    const minorDays = tickDef.minorInterval.as('days')
    return 1 / minorDays
  }

  let ganttConfig: GanttConfig = $state({
    mode: 'controlled',
    dayWidth: INITIAL_DAY_WIDTH,
    dragSnapDivision: snapDivisionForScale(INITIAL_DAY_WIDTH / 40),
  })

  // ----------------------------------------------------------------
  // #0024: bar drag → patch @schedule line only
  // ----------------------------------------------------------------

  const handlers: GanttEventHandlers = {
    onBarDrag(_nodeId, _newStart, _newEnd) {
      // ドラッグ中は markdown を更新しない。ライブラリが視覚プレビューを管理する。
    },
    onBarDragEnd(nodeId, finalStart, finalEnd) {
      const node = findNodeById(doc, nodeId)
      if (!node || !node.meta?.schedule) return
      const newSchedule = formatSchedule(finalStart, finalEnd)
      if (newSchedule === node.meta.schedule) return
      onMdChange(patchScheduleForNode(mdValue, node, newSchedule))
    },
    onBarClick(ganttNode) {
      onNodeClick?.(ganttNode.id)
    },
    onZoomChange(scale) {
      ganttConfig = {
        ...ganttConfig,
        dayWidth: scale * 40,
        dragSnapDivision: snapDivisionForScale(scale),
      }
    },
  }
</script>

<div class="gantt-tab">
  <GanttChart
    nodes={ganttNodes}
    {handlers}
    config={ganttConfig}
  />
</div>

<style>
  .gantt-tab {
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: #fff;
  }
</style>
