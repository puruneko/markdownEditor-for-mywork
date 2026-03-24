import { ItemView, WorkspaceLeaf } from 'obsidian'
import type { TFile } from 'obsidian'
import type { Document } from '../lib/parser/types'
import type { FileSync } from '../sync/file-sync'

export const AST_VIEW_TYPE = 'md-ast-editor-ast-view'

export class AstView extends ItemView {
  private fileSync: FileSync
  private pre: HTMLPreElement | null = null
  private onChange: (doc: Document, file: TFile) => void

  constructor(leaf: WorkspaceLeaf, fileSync: FileSync) {
    super(leaf)
    this.fileSync = fileSync
    this.onChange = (doc) => this.render(doc)
  }

  getViewType(): string {
    return AST_VIEW_TYPE
  }

  getDisplayText(): string {
    return 'AST View'
  }

  getIcon(): string {
    return 'code-2'
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1] as HTMLElement
    container.empty()
    container.addClass('ast-view')

    this.pre = container.createEl('pre', { cls: 'ast-json' })
    this.pre.style.cssText = [
      'padding: 12px',
      'overflow: auto',
      'font-size: 12px',
      'white-space: pre-wrap',
      'word-break: break-all',
      'height: 100%',
      'margin: 0',
    ].join(';')

    this.fileSync.subscribe(this.onChange)

    // 既にパース済みのドキュメントがあれば即時表示する。
    const currentDoc = this.fileSync.getCurrentDocument()
    if (currentDoc) {
      this.render(currentDoc)
    } else {
      this.showPlaceholder()
    }
  }

  async onClose(): Promise<void> {
    this.fileSync.unsubscribe(this.onChange)
  }

  private render(doc: Document): void {
    if (!this.pre) return
    this.pre.textContent = JSON.stringify(doc, null, 2)
  }

  private showPlaceholder(): void {
    if (!this.pre) return
    this.pre.textContent = 'Markdownファイルを開いてください。'
  }
}
