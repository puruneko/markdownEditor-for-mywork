<script lang="ts">
  import KanbanTab from '../lib/kanban/KanbanTab.svelte'
  import type { Document } from '../lib/parser/types'

  interface Props {
    initialMd: string
    initialDoc: Document
    onMdChange: (md: string) => void
    registerUpdater: (fn: (md: string, doc: Document) => void) => void
    onNodeClick: (nodeId: string) => void
  }

  let { initialMd, initialDoc, onMdChange, registerUpdater, onNodeClick }: Props = $props()

  let mdValue = $state(initialMd)
  let doc = $state(initialDoc)

  registerUpdater((newMd, newDoc) => {
    mdValue = newMd
    doc = newDoc
  })
</script>

<KanbanTab {mdValue} {doc} {onMdChange} {onNodeClick} />
