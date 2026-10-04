<script lang="ts">
  import type { DebugTreeNode } from './debug-tree'
  import Self from './DebugTreeNode.svelte'

  interface Props {
    node: DebugTreeNode
    open?: boolean
  }

  let { node, open = false }: Props = $props()
</script>

{#if node.children && node.children.length > 0}
  <details class="node" {open}>
    <summary>
      <span class="key">{node.key}</span>
      <span class="kind kind-{node.kind}">{node.summary}</span>
    </summary>
    <div class="children">
      {#each node.children as child}
        <Self node={child} />
      {/each}
    </div>
  </details>
{:else}
  <div class="leaf">
    <span class="key">{node.key}</span>
    <span class="kind kind-{node.kind}">{node.summary}</span>
  </div>
{/if}

<style>
  .node, .leaf {
    font-family: var(--font-monospace, 'Consolas', monospace);
    font-size: 12px;
    line-height: 1.6;
  }
  .leaf { padding-left: 14px; }
  summary { cursor: pointer; }
  .children { margin-left: 14px; border-left: 1px solid var(--host-border); padding-left: 4px; }
  .key { color: var(--host-text); font-weight: 600; margin-right: 6px; }
  .key::after { content: ':'; }
  .kind { color: var(--host-text-muted); word-break: break-all; }
  .kind-string { color: #067d17; }
  .kind-number { color: #1750eb; }
  .kind-boolean { color: #b45309; }
  .kind-map, .kind-array, .kind-object { color: var(--host-accent); }
</style>
