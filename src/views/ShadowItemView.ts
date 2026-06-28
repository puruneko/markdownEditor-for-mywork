import { ItemView, WorkspaceLeaf, MarkdownView } from 'obsidian'
import type { TFile } from 'obsidian'
import { mount, unmount } from 'svelte'
import type { Component } from 'svelte'
import type { FileSync } from '../sync/file-sync'
import type { AstIndex } from '../sync/ast-index'
import type { EditorEventBus } from '../sync/editor-event-bus'
import type { Document } from '../lib/parser/types'

const EMPTY_DOC: Document = { type: 'document', sections: [], nodeLineMap: new Map() }

const SHADOW_RESET_CSS = `
  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
  :host {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    overflow: hidden;
    font-family: system-ui, -apple-system, sans-serif;
  }
  button {
    font-family: inherit;
    font-size: inherit;
    line-height: normal;
    cursor: pointer;
  }
  [data-is-dnd-shadow-item] {
    opacity: 0.5;
  }
`.trim()

export interface ViewMountProps {
  initialMd: string
  initialDoc: Document
  onMdChange: (newMd: string) => void
  registerUpdater: (fn: (md: string, doc: Document) => void) => void
  onNodeClick: (nodeId: string) => void
}

/** nodeId → {filePath, lineNumber} のクロスファイルナビゲーション用マップ。 */
type NodeToFile = Map<string, { path: string; line: number }>

function buildMergedDoc(astIndex: AstIndex): { doc: Document; nodeToFile: NodeToFile } {
  const docs = astIndex.getDocuments()
  const mergedSections: Document['sections'] = []
  const mergedNodeLineMap = new Map<string, number>()
  const nodeToFile: NodeToFile = new Map()

  for (const [path, doc] of docs) {
    mergedSections.push(...doc.sections)
    for (const [nodeId, line] of doc.nodeLineMap) {
      mergedNodeLineMap.set(nodeId, line)
      nodeToFile.set(nodeId, { path, line })
    }
  }

  return {
    doc: { type: 'document', sections: mergedSections, nodeLineMap: mergedNodeLineMap },
    nodeToFile,
  }
}

export abstract class ShadowItemView extends ItemView {
  protected fileSync: FileSync
  protected astIndex: AstIndex | null
  protected editorEventBus: EditorEventBus
  private component: Record<string, unknown> | null = null
  private updater: ((md: string, doc: Document) => void) | null = null
  private nodeToFile: NodeToFile = new Map()
  private astIndexUnsubscribe: (() => void) | null = null
  private readonly fileSyncHandler: (doc: Document, file: TFile) => void

  constructor(
    leaf: WorkspaceLeaf,
    fileSync: FileSync,
    editorEventBus: EditorEventBus,
    astIndex?: AstIndex,
  ) {
    super(leaf)
    this.fileSync = fileSync
    this.astIndex = astIndex ?? null
    this.editorEventBus = editorEventBus

    // fileSync ハンドラ: AstIndex がある場合も fileSync の変更を受け取り、
    // currentFile の markdown を md 編集バッファとして保持しつつ merged doc で表示する。
    this.fileSyncHandler = (_doc) => {
      if (!this.updater) return
      const currentMd = this.fileSync.getCurrentMarkdown() ?? ''
      if (this.astIndex) {
        const { doc, nodeToFile } = buildMergedDoc(this.astIndex)
        this.nodeToFile = nodeToFile
        this.updater(currentMd, doc)
      } else {
        this.updater(currentMd, _doc)
      }
    }
  }

  protected abstract getViewClass(): string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected abstract getMountComponent(): Component<ViewMountProps, any, any>

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1] as HTMLElement
    container.empty()
    container.addClass(this.getViewClass())

    const shadowHost = container.createEl('div', { cls: 'view-shadow-host' })
    shadowHost.style.cssText = 'flex: 1 1 0; min-height: 0; width: 100%; overflow: hidden;'
    const shadow = shadowHost.attachShadow({ mode: 'open' })

    const resetStyle = document.createElement('style')
    resetStyle.textContent = SHADOW_RESET_CSS
    shadow.appendChild(resetStyle)

    const mountTarget = document.createElement('div')
    mountTarget.style.cssText = 'width:100%;height:100%;display:flex;flex-direction:column;'
    shadow.appendChild(mountTarget)

    // 初期マウントは常に fileSync データを使用（実証済みの動作）
    const initialMd = this.fileSync.getCurrentMarkdown() ?? ''
    const initialDoc = this.fileSync.getCurrentDocument() ?? EMPTY_DOC

    const onNodeClick = (nodeId: string): void => {
      void this.navigateToNode(nodeId)
    }

    this.component = mount(this.getMountComponent(), {
      target: mountTarget,
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

    // fileSync を常に購読（現在ファイルの更新を受け取る）
    this.fileSync.subscribe(this.fileSyncHandler)

    // AstIndex がある場合は追加で購読し、マルチファイル更新をビューに反映する。
    if (this.astIndex) {
      this.astIndexUnsubscribe = this.astIndex.onChange(() => {
        if (!this.updater || !this.astIndex) return
        const { doc, nodeToFile } = buildMergedDoc(this.astIndex)
        this.nodeToFile = nodeToFile
        const currentMd = this.fileSync.getCurrentMarkdown() ?? ''
        this.updater(currentMd, doc)
      })

      // 既にインデックスにデータがあれば即座に反映する。
      // mount() が registerUpdater を同期実行するので this.updater はここで有効。
      const { doc, nodeToFile } = buildMergedDoc(this.astIndex)
      if (doc.sections.length > 0 && this.updater) {
        this.nodeToFile = nodeToFile
        this.updater(initialMd, doc)
      }
    }
  }

  async onClose(): Promise<void> {
    this.fileSync.unsubscribe(this.fileSyncHandler)
    this.astIndexUnsubscribe?.()
    this.astIndexUnsubscribe = null
    if (this.component) {
      unmount(this.component)
      this.component = null
    }
  }

  private async navigateToNode(nodeId: string): Promise<void> {
    const target = this.nodeToFile.get(nodeId)

    if (!target) {
      // AstIndex なし、または単一ファイルモードのフォールバック
      const doc = this.fileSync.getCurrentDocument()
      if (!doc) return
      const line = doc.nodeLineMap.get(nodeId)
      if (line !== undefined) this.editorEventBus.requestFocusLine(line)
      return
    }

    const { path, line } = target
    const currentFile = this.fileSync.getCurrentFile()

    if (currentFile?.path === path) {
      // 同一ファイルなら EditorEventBus 経由で移動
      this.editorEventBus.requestFocusLine(line)
      return
    }

    // 別ファイル: Obsidian workspace API でファイルを開いてカーソル移動
    const abstractFile = this.app.vault.getAbstractFileByPath(path)
    if (!abstractFile || !('extension' in abstractFile)) return

    const tfile = abstractFile as TFile
    let targetLeaf = this.app.workspace.getMostRecentLeaf()
    if (!targetLeaf) targetLeaf = this.app.workspace.getLeaf(false)
    if (!targetLeaf) return

    await targetLeaf.openFile(tfile)
    this.app.workspace.revealLeaf(targetLeaf)

    const mdView = targetLeaf.view
    if (mdView instanceof MarkdownView) {
      mdView.editor.setCursor({ line, ch: 0 })
      mdView.editor.focus()
    }
  }

  private async handleMdChange(newMd: string): Promise<void> {
    const file = this.fileSync.getCurrentFile()
    if (!file) return
    await this.app.vault.modify(file, newMd)
  }
}
