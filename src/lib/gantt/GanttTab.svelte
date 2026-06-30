<script lang="ts">
  import { GanttChart } from 'svelte-gantt-lib'
  import type { GanttNode, GanttEventHandlers, GanttConfig, GanttExternalDropEvent } from 'svelte-gantt-lib'
  import { extractGanttNodes } from './ast-to-gantt'
  import { patchScheduleForNode, formatSchedule } from '../calendar/markdown-patch'
  import { upsertSchedule } from '../patch/upsert-meta'
  import type { Document, TaskNode } from '../parser/types'
  import type { SourceEntry } from '../viewmodel/contract'
  import { makeGlobalKey } from '../viewmodel/global-key'
  import { MD_TASK_MIME } from '../../editor/task-drag-source'
  import type { TaskDragPayload } from '../../editor/task-drag-source'

  interface Props {
    /** 複数ソース（ファイルパスと Document のペア）— GanttNode 抽出に使用 */
    sources: SourceEntry[]
    /** globalKey を受けて該当ファイルへ書き戻す非同期コールバック */
    onNodePatch: (globalKey: string, patcher: (md: string, doc: Document, node: TaskNode) => string) => Promise<void>
    /** バークリック時に globalKey を通知するコールバック。エディタカーソル移動に使用。 */
    onNodeClick?: (globalKey: string) => void
    /** 外部ドロップ時のデフォルト所要時間（分）。settings.defaultDurationMin から渡す。 */
    defaultDurationMin?: number
  }

  let { sources, onNodePatch, onNodeClick, defaultDurationMin = 60 }: Props = $props()

  let ganttNodes: GanttNode[] = $derived(extractGanttNodes(sources))

  const INITIAL_DAY_WIDTH = 30

  let ganttConfig: GanttConfig = $state({
    mode: 'controlled',
    dayWidth: INITIAL_DAY_WIDTH,
  })

  function handleExternalDrop(e: GanttExternalDropEvent) {
    const raw = e.originalEvent.dataTransfer?.getData(MD_TASK_MIME)
    if (!raw) return

    let payload: TaskDragPayload
    try { payload = JSON.parse(raw) } catch { return }

    const { dropDate } = e
    const endDate = dropDate.plus({ minutes: defaultDurationMin })
    const scheduleValue = formatSchedule(dropDate, endDate)

    const globalKey = makeGlobalKey(payload.sourcePath, payload.nodeId)
    void onNodePatch(globalKey, (md, _doc, node) => upsertSchedule(md, node, scheduleValue))
  }

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
      ganttConfig = { ...ganttConfig, dayWidth: scale * 40 }
    },
    onExternalDrop: handleExternalDrop,
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
