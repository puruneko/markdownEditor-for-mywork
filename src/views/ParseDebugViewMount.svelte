<script lang="ts">
  import DebugTreeNode from '../lib/debug/DebugTreeNode.svelte'
  import { toDebugTree } from '../lib/debug/debug-tree'
  import type { SourceEntry } from '../lib/viewmodel/contract'

  interface Props {
    sources: SourceEntry[]
    registerUpdater: (fn: (sources: SourceEntry[]) => void) => void
  }

  let { sources: initialSources, registerUpdater }: Props = $props()

  // ホストからの更新は保持するのみ。表示は「表示更新」ボタン押下時にだけ反映する。
  // svelte-ignore state_referenced_locally
  let latest: SourceEntry[] = initialSources
  let snapshot = $state<SourceEntry[] | null>(null)
  let updatedAt = $state('')

  // svelte-ignore state_referenced_locally
  registerUpdater((newSources) => {
    latest = newSources
  })

  function refresh(): void {
    snapshot = latest
    updatedAt = new Date().toLocaleTimeString()
  }
</script>

<div class="debug-mount">
  <div class="toolbar">
    <button class="refresh" onclick={refresh}>表示更新</button>
    <span class="stamp">{updatedAt ? `更新: ${updatedAt}` : ''}</span>
  </div>
  <div class="body">
    {#if snapshot === null}
      <p class="hint">「表示更新」を押すと、パース済みオブジェクトを表示します。</p>
    {:else if snapshot.length === 0}
      <p class="hint">表示できるソースがありません。</p>
    {:else}
      {#each snapshot as src (src.path)}
        <DebugTreeNode node={toDebugTree(src.doc, src.path)} open={snapshot.length === 1} />
      {/each}
    {/if}
  </div>
</div>

<style>
  .debug-mount {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: var(--host-bg);
    color: var(--host-text);
  }
  .toolbar {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 8px;
    border-bottom: 1px solid var(--host-border);
    background: var(--host-bg-secondary);
  }
  .refresh {
    padding: 2px 10px;
    border: 1px solid var(--host-border);
    border-radius: 4px;
    background: var(--host-bg);
    color: var(--host-text);
  }
  .refresh:hover { background: var(--host-bg-hover); }
  .stamp { font-size: 12px; color: var(--host-text-muted); }
  .body { flex: 1; overflow: auto; padding: 8px 12px; }
  .hint { color: var(--host-text-muted); font-size: 13px; }
</style>
