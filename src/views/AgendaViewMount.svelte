<script lang="ts">
  import { DateTime } from 'luxon'
  import { buildAgenda } from '../lib/agenda/ast-to-agenda'
  import type { AgendaTask } from '../lib/agenda/ast-to-agenda'
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
  let now = $state(DateTime.now())

  registerUpdater((newSources) => { sources = newSources })

  // 1分ごとに today を更新してバケツを再計算
  $effect(() => {
    const id = setInterval(() => { now = DateTime.now() }, 60_000)
    return () => clearInterval(id)
  })

  let buckets = $derived(buildAgenda(sources, now))

  const STATUS_LABEL: Record<string, string> = {
    todo: '未着手', doing: '進行中', blocked: 'ブロック', hold: '保留',
  }

  function statusClass(status: string): string {
    return `status-${status}`
  }

  function dateLabel(task: AgendaTask): string {
    return task.date ?? ''
  }
</script>

<div class="agenda-mount">
  <div class="agenda-header">
    <span class="agenda-title">Agenda</span>
    <span class="agenda-date">{now.toFormat('yyyy/MM/dd (EEE)', { locale: 'ja' })}</span>
  </div>

  <div class="agenda-body">

    {#if buckets.overdue.length > 0}
      <section class="bucket bucket-overdue">
        <h3 class="bucket-label">⚠ 期限超過 <span class="count">({buckets.overdue.length})</span></h3>
        {#each buckets.overdue as task (task.globalKey)}
          <button class="task-row" onclick={() => onNodeClick(task.globalKey)}>
            <span class="task-date overdue">{dateLabel(task)}</span>
            <span class={`task-status ${statusClass(task.status)}`}>{STATUS_LABEL[task.status]}</span>
            <span class="task-text">{task.text}</span>
            {#if task.priority !== null}
              <span class="task-priority">P{task.priority}</span>
            {/if}
          </button>
        {/each}
      </section>
    {/if}

    {#if buckets.today.length > 0}
      <section class="bucket bucket-today">
        <h3 class="bucket-label">✓ 今日 <span class="count">({buckets.today.length})</span></h3>
        {#each buckets.today as task (task.globalKey)}
          <button class="task-row" onclick={() => onNodeClick(task.globalKey)}>
            <span class="task-date">{dateLabel(task)}</span>
            <span class={`task-status ${statusClass(task.status)}`}>{STATUS_LABEL[task.status]}</span>
            <span class="task-text">{task.text}</span>
            {#if task.priority !== null}
              <span class="task-priority">P{task.priority}</span>
            {/if}
          </button>
        {/each}
      </section>
    {/if}

    {#if buckets.thisWeek.length > 0}
      <section class="bucket bucket-this-week">
        <h3 class="bucket-label">📅 今週 <span class="count">({buckets.thisWeek.length})</span></h3>
        {#each buckets.thisWeek as task (task.globalKey)}
          <button class="task-row" onclick={() => onNodeClick(task.globalKey)}>
            <span class="task-date">{dateLabel(task)}</span>
            <span class={`task-status ${statusClass(task.status)}`}>{STATUS_LABEL[task.status]}</span>
            <span class="task-text">{task.text}</span>
            {#if task.priority !== null}
              <span class="task-priority">P{task.priority}</span>
            {/if}
          </button>
        {/each}
      </section>
    {/if}

    {#if buckets.undated.length > 0}
      <section class="bucket bucket-undated">
        <h3 class="bucket-label">— 日付なし <span class="count">({buckets.undated.length})</span></h3>
        {#each buckets.undated as task (task.globalKey)}
          <button class="task-row" onclick={() => onNodeClick(task.globalKey)}>
            <span class="task-date"></span>
            <span class={`task-status ${statusClass(task.status)}`}>{STATUS_LABEL[task.status]}</span>
            <span class="task-text">{task.text}</span>
            {#if task.priority !== null}
              <span class="task-priority">P{task.priority}</span>
            {/if}
          </button>
        {/each}
      </section>
    {/if}

    {#if buckets.overdue.length === 0 && buckets.today.length === 0 && buckets.thisWeek.length === 0 && buckets.undated.length === 0}
      <p class="empty-message">タスクがありません。</p>
    {/if}

  </div>
</div>

<style>
  .agenda-mount {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    overflow: hidden;
    font-size: 13px;
    color: var(--text-normal, #222);
    background: var(--background-primary, #fff);
  }

  .agenda-header {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    border-bottom: 1px solid var(--background-modifier-border, #ddd);
    font-weight: 600;
  }

  .agenda-title {
    font-size: 14px;
  }

  .agenda-date {
    font-size: 12px;
    color: var(--text-muted, #888);
  }

  .agenda-body {
    flex: 1 1 0;
    overflow-y: auto;
    padding: 4px 0;
  }

  .bucket {
    padding: 4px 0 8px;
  }

  .bucket-label {
    padding: 4px 12px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted, #888);
    margin: 0;
  }

  .bucket-overdue .bucket-label { color: var(--color-red, #d32f2f); }
  .bucket-today .bucket-label   { color: var(--color-accent, #4a86e8); }

  .count {
    font-weight: 400;
  }

  .task-row {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 4px 12px;
    border: none;
    background: transparent;
    text-align: left;
    cursor: pointer;
    border-radius: 3px;
  }

  .task-row:hover {
    background: var(--background-modifier-hover, #f0f0f0);
  }

  .task-date {
    flex-shrink: 0;
    font-size: 11px;
    color: var(--text-muted, #888);
    width: 72px;
  }

  .task-date.overdue {
    color: var(--color-red, #d32f2f);
    font-weight: 600;
  }

  .task-status {
    flex-shrink: 0;
    font-size: 10px;
    padding: 1px 5px;
    border-radius: 3px;
    background: var(--background-modifier-border, #e0e0e0);
    color: var(--text-muted, #666);
    width: 48px;
    text-align: center;
  }

  .task-status.status-doing   { background: #e3f2fd; color: #1565c0; }
  .task-status.status-blocked { background: #fce4ec; color: #c62828; }
  .task-status.status-hold    { background: #f3e5f5; color: #6a1b9a; }

  .task-text {
    flex: 1 1 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .task-priority {
    flex-shrink: 0;
    font-size: 10px;
    color: var(--text-faint, #aaa);
  }

  .empty-message {
    padding: 24px 12px;
    color: var(--text-muted, #888);
    font-size: 13px;
  }
</style>
