<script lang="ts">
  import { extractUnscheduledTasks } from '../lib/tray/extract-unscheduled'
  import { MD_TASK_MIME } from '../editor/task-drag-source'
  import type { TaskDragPayload } from '../editor/task-drag-source'
  import type { Document, TaskNode } from '../lib/parser/types'
  import type { SourceEntry } from '../lib/viewmodel/contract'

  interface Props {
    sources: SourceEntry[]
    registerUpdater: (fn: (sources: SourceEntry[]) => void) => void
    onNodeClick: (globalKey: string) => void
    onNodePatch: (globalKey: string, patcher: (md: string, doc: Document, node: TaskNode) => string) => Promise<void>
  }

  let { sources: initialSources, registerUpdater, onNodeClick }: Props = $props()

  let sources = $state(initialSources)
  registerUpdater((newSources) => { sources = newSources })

  let trayItems = $derived(extractUnscheduledTasks(sources))

  function handleDragStart(e: DragEvent, sourcePath: string, nodeId: string, lineNumber: number) {
    if (!e.dataTransfer) return
    const payload: TaskDragPayload = { sourcePath, line: lineNumber, nodeId }
    e.dataTransfer.setData(MD_TASK_MIME, JSON.stringify(payload))
    e.dataTransfer.effectAllowed = 'copy'
  }

  function basename(path: string): string {
    return path.split('/').pop() ?? path
  }
</script>

<div class="tray-mount">
  <div class="tray-header">
    <span class="tray-title">未スケジュール</span>
    <span class="tray-count">{trayItems.length}</span>
  </div>

  {#if trayItems.length === 0}
    <div class="tray-empty">すべてのタスクに日付が設定されています</div>
  {:else}
    <ul class="tray-list">
      {#each trayItems as item (item.sourcePath + '::' + item.nodeId)}
        <li class="tray-item-wrapper">
          <button
            class="tray-item"
            draggable="true"
            ondragstart={(e) => handleDragStart(e, item.sourcePath, item.nodeId, item.lineNumber)}
            onclick={() => onNodeClick(item.sourcePath + '::' + item.nodeId)}
          >
            <span class="tray-item-text">{item.text}</span>
            <span class="tray-item-source">{basename(item.sourcePath)}</span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .tray-mount {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: var(--background-primary, #1e1e1e);
    font-family: var(--font-interface, system-ui, sans-serif);
  }

  .tray-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--background-modifier-border, #444);
    flex-shrink: 0;
  }

  .tray-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-normal, #ccc);
  }

  .tray-count {
    font-size: 11px;
    padding: 1px 6px;
    border-radius: 10px;
    background: var(--background-modifier-border, #404040);
    color: var(--text-muted, #888);
  }

  .tray-empty {
    padding: 24px 16px;
    font-size: 12px;
    color: var(--text-muted, #888);
    text-align: center;
  }

  .tray-list {
    list-style: none;
    margin: 0;
    padding: 4px 0;
    overflow-y: auto;
    flex: 1 1 0;
  }

  .tray-item-wrapper {
    border-bottom: 1px solid var(--background-modifier-border, #333);
  }

  .tray-item {
    display: flex;
    align-items: baseline;
    gap: 6px;
    padding: 6px 12px;
    width: 100%;
    cursor: grab;
    background: none;
    border: none;
    text-align: left;
    user-select: none;
  }

  .tray-item:hover {
    background: var(--background-modifier-hover, #2a2a2a);
  }

  .tray-item:focus {
    outline: 1px solid var(--interactive-accent, #4ec9b0);
    outline-offset: -1px;
  }

  .tray-item:active {
    cursor: grabbing;
  }

  .tray-item-text {
    flex: 1;
    font-size: 13px;
    color: var(--text-normal, #ccc);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tray-item-source {
    flex-shrink: 0;
    font-size: 10px;
    color: var(--text-faint, #666);
  }
</style>
