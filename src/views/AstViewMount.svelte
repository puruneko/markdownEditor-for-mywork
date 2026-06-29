<script lang="ts">
  import FilterBar from '../lib/query/FilterBar.svelte'
  import { filterNodes, type FilterQuery } from '../lib/query/filter'
  import type { Document, TaskNode } from '../lib/parser/types'
  import type { SourceEntry } from '../lib/viewmodel/contract'

  interface Props {
    sources: SourceEntry[]
    registerUpdater: (fn: (sources: SourceEntry[]) => void) => void
    onNodeClick: (globalKey: string) => void
    onNodePatch: (globalKey: string, patcher: (md: string, doc: Document, node: TaskNode) => string) => Promise<void>
  }

  let { sources: initialSources, registerUpdater }: Props = $props()

  let sources = $state(initialSources)
  let query = $state<FilterQuery>({})

  registerUpdater((newSources) => {
    sources = newSources
  })

  // フィルタ適用（最初のソースのみ表示）
  let filteredDoc = $derived(
    sources.length > 0 ? filterNodes(sources[0].doc, query) : null
  )

  function stringify(val: unknown): string {
    return JSON.stringify(
      val,
      (_key, value) => {
        if (value instanceof Map) {
          return { __type: 'Map', entries: [...value.entries()] }
        }
        return value
      },
      2,
    )
  }
</script>

<div class="ast-mount">
  <div class="filter-bar-row">
    <FilterBar bind:query />
  </div>
  <div class="ast-view">
    <pre class="ast-json">{filteredDoc ? stringify(filteredDoc) : ''}</pre>
  </div>
</div>

<style>
  .ast-mount {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  .filter-bar-row {
    flex-shrink: 0;
    padding: 4px 8px;
    border-bottom: 1px solid var(--background-modifier-border, #444);
    background: var(--background-primary, #1e1e1e);
  }

  .ast-view {
    flex: 1;
    overflow: auto;
    background: var(--background-primary, #1e1e1e);
  }

  .ast-json {
    padding: 12px;
    font-size: 12px;
    white-space: pre-wrap;
    word-break: break-all;
    color: var(--text-normal, #d4d4d4);
    font-family: var(--font-monospace, 'Consolas', monospace);
    margin: 0;
    line-height: 1.5;
  }
</style>
