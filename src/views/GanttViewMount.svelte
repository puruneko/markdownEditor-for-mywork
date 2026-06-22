<script lang="ts">
  import GanttTab from '../lib/gantt/GanttTab.svelte'
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

<GanttTab {mdValue} {doc} {onMdChange} {onNodeClick} />
