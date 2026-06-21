import { ItemView, WorkspaceLeaf } from 'obsidian'
import type { TFile } from 'obsidian'
import { mount, unmount } from 'svelte'
import GanttViewMount from './GanttViewMount.svelte'
import type { FileSync } from '../sync/file-sync'
import type { EditorEventBus } from '../sync/editor-event-bus'
import type { Document } from '../lib/parser/types'

export const GANTT_VIEW_TYPE = 'md-ast-editor-gantt-view'

const EMPTY_DOC: Document = { type: 'document', sections: [], nodeLineMap: new Map() }

export class GanttView extends ItemView {
  private fileSync: FileSync
  private editorEventBus: EditorEventBus
  private component: Record<string, unknown> | null = null
  private updater: ((md: string, doc: Document) => void) | null = null
  private onChange: (doc: Document, file: TFile) => void

  constructor(leaf: WorkspaceLeaf, fileSync: FileSync, editorEventBus: EditorEventBus) {
    super(leaf)
    this.fileSync = fileSync
    this.editorEventBus = editorEventBus
    this.onChange = (doc) => {
      const md = this.fileSync.getCurrentMarkdown() ?? ''
      if (this.updater) this.updater(md, doc)
    }
  }

  getViewType(): string { return GANTT_VIEW_TYPE }
  getDisplayText(): string { return 'Gantt View' }
  getIcon(): string { return 'bar-chart-2' }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1] as HTMLElement
    container.empty()
    container.addClass('gantt-view')

    const initialMd = this.fileSync.getCurrentMarkdown() ?? ''
    const initialDoc = this.fileSync.getCurrentDocument() ?? EMPTY_DOC

    const onNodeClick = (nodeId: string): void => {
      const doc = this.fileSync.getCurrentDocument()
      if (!doc) return
      const lineNumber = doc.nodeLineMap.get(nodeId)
      if (lineNumber !== undefined) this.editorEventBus.requestFocusLine(lineNumber)
    }

    this.component = mount(GanttViewMount, {
      target: container,
      props: {
        initialMd,
        initialDoc,
        onMdChange: (newMd: string) => void this.handleMdChange(newMd),
        registerUpdater: (fn: (md: string, doc: Document) => void) => {
          this.updater = fn
        },
        onNodeClick,
      },
    })

    this.fileSync.subscribe(this.onChange)
  }

  async onClose(): Promise<void> {
    this.fileSync.unsubscribe(this.onChange)
    if (this.component) {
      unmount(this.component)
      this.component = null
    }
  }

  private async handleMdChange(newMd: string): Promise<void> {
    const file = this.fileSync.getCurrentFile()
    if (!file) return
    await this.app.vault.modify(file, newMd)
  }
}
