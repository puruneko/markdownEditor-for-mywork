<script lang="ts">
  import { Dashboard } from 'svelte-dashboard-lib'
  import type { Document, TaskNode } from '../lib/parser/types'
  import type { SourceEntry } from '../lib/viewmodel/contract'

  // ShadowItemView は ViewMountProps（onNodePatch・onReload を含む）を渡すが、
  // Dashboard は読み取り専用ビューのため、この2つは受け取るだけで使用しない
  // （issue-phase000-004。svelte-dashboard-lib の DashboardProps に書き戻し相当のフィールドは無い）。
  interface Props {
    sources: SourceEntry[]
    registerUpdater: (fn: (sources: SourceEntry[]) => void) => void
    onNodeClick: (globalKey: string) => void
    onNodePatch: (globalKey: string, patcher: (md: string, doc: Document, node: TaskNode) => string) => Promise<void>
    onReload: () => void
  }

  let { sources, registerUpdater, onNodeClick }: Props = $props()
</script>

<div class="dashboard-mount">
  <Dashboard {sources} {registerUpdater} {onNodeClick} theme="light" />
</div>

<style>
  .dashboard-mount {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    overflow: auto;
  }
</style>
