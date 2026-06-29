<script lang="ts">
  import type { FilterQuery } from './filter'
  import type { Status } from '../parser/types'

  let { query = $bindable<FilterQuery>({}) } = $props()

  let expanded = $state(false)

  let statusInput = $state('')
  let tagsInput = $state('')
  let textInput = $state('')
  let priorityInput = $state('')
  let dueBeforeInput = $state('')
  let dueAfterInput = $state('')

  export function countActiveConditions(q: FilterQuery): number {
    return (
      (q.status?.length ? 1 : 0) +
      (q.tags?.length ? 1 : 0) +
      (q.text ? 1 : 0) +
      (q.priorityMax !== undefined ? 1 : 0) +
      (q.dueBefore ? 1 : 0) +
      (q.dueAfter ? 1 : 0) +
      (q.hasSchedule !== undefined ? 1 : 0) +
      (q.hasDate !== undefined ? 1 : 0)
    )
  }

  let activeCount = $derived(countActiveConditions(query))

  function applyQuery(): void {
    const q: FilterQuery = {}
    const statuses = statusInput
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean) as Status[]
    if (statuses.length) q.status = statuses
    const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean)
    if (tags.length) q.tags = tags
    if (textInput.trim()) q.text = textInput.trim()
    const p = Number(priorityInput)
    if (priorityInput !== '' && !isNaN(p)) q.priorityMax = p
    if (dueBeforeInput) q.dueBefore = dueBeforeInput
    if (dueAfterInput) q.dueAfter = dueAfterInput
    query = q
  }

  function clearAll(): void {
    statusInput = ''
    tagsInput = ''
    textInput = ''
    priorityInput = ''
    dueBeforeInput = ''
    dueAfterInput = ''
    query = {}
  }

  function handleFocusOut(e: FocusEvent): void {
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
      expanded = false
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="filter-bar" onfocusout={handleFocusOut}>
  <button
    class="filter-chip"
    class:active={activeCount > 0}
    onclick={() => (expanded = !expanded)}
    type="button"
    aria-label="フィルタ設定"
    aria-expanded={expanded}
  >
    ⛃ フィルタ{#if activeCount > 0}<span class="badge" aria-label="{activeCount}件適用中">{activeCount}</span>{/if}
  </button>

  {#if expanded}
    <div class="filter-panel" role="group" aria-label="フィルタ条件">
      <div class="filter-fields">
        <label class="filter-field">
          <span>ステータス</span>
          <input
            type="text"
            placeholder="todo,doing"
            bind:value={statusInput}
            oninput={applyQuery}
          />
        </label>
        <label class="filter-field">
          <span>タグ</span>
          <input
            type="text"
            placeholder="urgent,総務"
            bind:value={tagsInput}
            oninput={applyQuery}
          />
        </label>
        <label class="filter-field">
          <span>テキスト</span>
          <input
            type="text"
            bind:value={textInput}
            oninput={applyQuery}
          />
        </label>
        <label class="filter-field">
          <span>優先度(以下)</span>
          <input
            type="number"
            min="1"
            max="9"
            bind:value={priorityInput}
            oninput={applyQuery}
          />
        </label>
        <label class="filter-field">
          <span>期日まで</span>
          <input
            type="date"
            bind:value={dueBeforeInput}
            oninput={applyQuery}
          />
        </label>
        <label class="filter-field">
          <span>期日から</span>
          <input
            type="date"
            bind:value={dueAfterInput}
            oninput={applyQuery}
          />
        </label>
      </div>
      {#if activeCount > 0}
        <button class="clear-btn" type="button" onclick={clearAll}>クリア</button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .filter-bar {
    position: relative;
    flex-shrink: 0;
  }

  .filter-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 10px;
    border-radius: 12px;
    border: 1px solid var(--background-modifier-border, #444);
    background: var(--background-secondary, #2d2d2d);
    color: var(--text-muted, #999);
    font-size: 12px;
    cursor: pointer;
    line-height: 1.4;
  }

  .filter-chip.active {
    border-color: var(--interactive-accent, #7c6af7);
    color: var(--interactive-accent, #7c6af7);
  }

  .badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 16px;
    height: 16px;
    padding: 0 3px;
    border-radius: 8px;
    background: var(--interactive-accent, #7c6af7);
    color: var(--text-on-accent, #fff);
    font-size: 10px;
  }

  .filter-panel {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    z-index: 100;
    padding: 8px;
    background: var(--background-primary, #1e1e1e);
    border: 1px solid var(--background-modifier-border, #444);
    border-radius: 6px;
    min-width: 260px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .filter-fields {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .filter-field {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--text-muted, #999);
  }

  .filter-field span {
    flex: 0 0 80px;
    text-align: right;
    font-size: 11px;
  }

  .filter-field input {
    flex: 1;
    padding: 2px 6px;
    background: var(--background-secondary, #2d2d2d);
    border: 1px solid var(--background-modifier-border, #444);
    border-radius: 4px;
    color: var(--text-normal, #d4d4d4);
    font-size: 12px;
    font-family: inherit;
  }

  .clear-btn {
    align-self: flex-end;
    padding: 3px 12px;
    border-radius: 4px;
    border: none;
    background: var(--interactive-accent, #7c6af7);
    color: var(--text-on-accent, #fff);
    font-size: 11px;
    cursor: pointer;
    font-family: inherit;
  }
</style>
