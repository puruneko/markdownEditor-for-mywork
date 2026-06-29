<script lang="ts">
  import GanttTab from '../lib/gantt/GanttTab.svelte'
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

  let { sources: initialSources, registerUpdater, onNodeClick, onNodePatch }: Props = $props()

  let sources = $state(initialSources)
  let query = $state<FilterQuery>({})

  registerUpdater((newSources) => {
    sources = newSources
  })

  let filteredSources = $derived(
    sources.map(s => ({ path: s.path, doc: filterNodes(s.doc, query) }))
  )
</script>

<div class="gantt-mount">
  <div class="filter-bar-row">
    <FilterBar bind:query />
  </div>
  <GanttTab sources={filteredSources} {onNodePatch} {onNodeClick} />
</div>

<style>
  .gantt-mount {
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
  }
</style>
