<script lang="ts">
  import { GanttChart, getTickDefinitionForScale } from 'svelte-gantt-lib'
  import type { GanttNode, GanttEventHandlers, GanttConfig } from 'svelte-gantt-lib'
  import { extractGanttNodes } from './ast-to-gantt'
  import { patchScheduleForNode, formatSchedule } from '../calendar/markdown-patch'
  import type { Document, TaskNode } from '../parser/types'
  import type { SourceEntry } from '../viewmodel/contract'

  interface Props {
    /** 複数ソース（ファイルパスと Document のペア）— GanttNode 抽出に使用 */
    sources: SourceEntry[]
    /** globalKey を受けて該当ファイルへ書き戻す非同期コールバック */
    onNodePatch: (globalKey: string, patcher: (md: string, doc: Document, node: TaskNode) => string) => Promise<void>
    /** バークリック時に globalKey を通知するコールバック。エディタカーソル移動に使用。 */
    onNodeClick?: (globalKey: string) => void
  }

  let { sources, onNodePatch, onNodeClick }: Props = $props()

  let ganttNodes: GanttNode[] = $derived(extractGanttNodes(sources))

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

  const handlers: GanttEventHandlers = {
    onBarDrag(_nodeId, _newStart, _newEnd) {
      // ドラッグ中は markdown を更新しない。ライブラリが視覚プレビューを管理する。
    },
    onBarDragEnd(nodeId, finalStart, finalEnd) {
      // nodeId は globalKey
      void onNodePatch(nodeId, (md, _doc, node) => {
        if (!node.meta?.schedule) return md
        const newSchedule = formatSchedule(finalStart, finalEnd)
        if (newSchedule === node.meta.schedule) return md
        return patchScheduleForNode(md, node, newSchedule)
      })
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
