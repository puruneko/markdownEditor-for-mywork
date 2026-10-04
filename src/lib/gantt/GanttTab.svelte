<script lang="ts">
  import { GanttChart } from 'svelte-gantt-lib'
  import type { GanttNode, GanttEventHandlers, GanttConfig, GanttExternalDropEvent } from 'svelte-gantt-lib'
  import { extractGanttNodes } from './ast-to-gantt'
  import { patchScheduleForNode, formatSchedule } from '../calendar/markdown-patch'
  import { mergeInitialGanttConfig, mergePersistedGanttConfig } from './gantt-config-merge'
  import { buildTreeCellEditPatcher, formatTreeCellPickerInitialValue } from './tree-cell-edit'
  import { openTreeDatePicker } from './tree-date-picker'
  import { onDestroy } from 'svelte'
  import type { DateTime } from 'luxon'
  import type { TreeCellEditEvent } from './tree-cell-edit'
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
    /** サブタスク展開表示。settings.ganttExpandSubtasks から渡す（アプリ既定 true。prop 省略時のみ false）。 */
    expandSubtasks?: boolean
    /** 日付ピッカーの分刻み（settings.minuteStep）。 */
    minuteStep?: number
    /** 保存済みの Gantt 設定（issue-phase017-004）。 */
    initialGanttConfig?: Partial<GanttConfig>
    /** 設定変更時の保存コールバック（保存対象キーのみ・既存保存値とマージ済み）。 */
    onGanttConfigChange?: (cfg: Partial<GanttConfig>) => void
  }

  let { sources, onNodePatch, onNodeClick, defaultDurationMin = 60, expandSubtasks = false, minuteStep = 15, initialGanttConfig, onGanttConfigChange }: Props = $props()

  // viewRange は常に undefined（@repeat タスクは展開されない）。issue-phase010-markdownEditor-008
  // で審議し、現状維持を決定した（documents/external-data-contract.spec.md 注釈 A-10 参照）。
  let ganttNodes: GanttNode[] = $derived(extractGanttNodes(sources, undefined, { expandSubtasks }))

  const INITIAL_DAY_WIDTH = 30

  let ganttConfig: GanttConfig = $state(
    mergeInitialGanttConfig(
      { mode: 'controlled', dayWidth: INITIAL_DAY_WIDTH, defaultDurationMinutes: defaultDurationMin },
      initialGanttConfig,
    ),
  )
  let persistedGanttConfig: Partial<GanttConfig> = { ...(initialGanttConfig ?? {}) }

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

  // ライブラリ側で追加されるハンドラ（issue-phase017-ganttchart-004/006）。
  type ExtendedHandlers = GanttEventHandlers & {
    onConfigChange?: (updates: Partial<GanttConfig>) => void
    onTreeCellEdit?: (event: TreeCellEditEvent) => void
    onTreeDateCellEditRequest?: (req: {
      nodeId: string
      key: 'schedule' | 'plan' | 'due'
      start: DateTime | null
      end: DateTime | null
      anchorEl: HTMLElement
      done: () => void
    }) => void
  }

  // 同時に開けるピッカーは1つ。
  let closePicker: (() => void) | null = null
  onDestroy(() => closePicker?.())

  const handlers: ExtendedHandlers = {
    onConfigChange(updates) {
      ganttConfig = { ...ganttConfig, ...updates }
      persistedGanttConfig = mergePersistedGanttConfig(persistedGanttConfig, updates)
      onGanttConfigChange?.(persistedGanttConfig)
    },
    onTreeCellEdit(event) {
      const patcher = buildTreeCellEditPatcher(event)
      if (patcher) void onNodePatch(event.nodeId, patcher)
    },
    onTreeDateCellEditRequest(req) {
      closePicker?.()
      closePicker = openTreeDatePicker({
        initialValue: formatTreeCellPickerInitialValue(req.start, req.end),
        minuteStep,
        anchorEl: req.anchorEl,
        onCommit: (value) => {
          const patcher = buildTreeCellEditPatcher({ nodeId: req.nodeId, key: req.key, value })
          if (patcher) void onNodePatch(req.nodeId, patcher)
        },
        done: () => {
          closePicker = null
          req.done()
        },
      })
    },
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
    onSchedule(nodeId, start, end) {
      // nodeId は globalKey（期間なしサブタスク行。issue-gantt-phase004-008）
      const scheduleValue = formatSchedule(start, end)
      void onNodePatch(nodeId, (md, _doc, node) => upsertSchedule(md, node, scheduleValue))
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
