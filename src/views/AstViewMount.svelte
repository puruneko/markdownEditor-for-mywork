<script lang="ts">
  import type { Document } from '../lib/parser/types'

  interface Props {
    initialDoc: Document
    registerUpdater: (fn: (md: string, doc: Document) => void) => void
    initialMd?: string
    onMdChange?: (md: string) => void
    onNodeClick?: (nodeId: string) => void
  }

  let { initialDoc, registerUpdater }: Props = $props()

  let doc = $state(initialDoc)

  registerUpdater((_md, newDoc) => {
    doc = newDoc
  })

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

<div class="ast-view">
  <pre class="ast-json">{stringify(doc)}</pre>
</div>

<style>
  .ast-view {
    width: 100%;
    height: 100%;
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
