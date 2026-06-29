import { ItemView, WorkspaceLeaf, MarkdownView } from 'obsidian'
import type { TFile } from 'obsidian'
import { mount, unmount } from 'svelte'
import type { Component } from 'svelte'
import type { FileSync } from '../sync/file-sync'
import type { AstIndex } from '../sync/ast-index'
import type { EditorEventBus } from '../sync/editor-event-bus'
import type { Document, TaskNode } from '../lib/parser/types'
import type { SourceEntry } from '../lib/viewmodel/contract'
import { parseGlobalKey } from '../lib/viewmodel/global-key'
import { patchInFile } from '../lib/viewmodel/resolve'

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
  sources: SourceEntry[]
  registerUpdater: (fn: (sources: SourceEntry[]) => void) => void
  onNodeClick: (globalKey: string) => void
  onNodePatch: (globalKey: string, patcher: (md: string, doc: Document, node: TaskNode) => string) => Promise<void>
}

export abstract class ShadowItemView extends ItemView {
  protected fileSync: FileSync
  protected astIndex: AstIndex | null
  protected editorEventBus: EditorEventBus
  private component: Record<string, unknown> | null = null
  private updater: ((sources: SourceEntry[]) => void) | null = null
  private offIndex: (() => void) | null = null

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
  }

  protected abstract getViewClass(): string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected abstract getMountComponent(): Component<ViewMountProps, any, any>
  /** サブクラスが追加 props を注入するためのフック。既定は空オブジェクト。 */
  protected getExtraMountProps(): Record<string, unknown> { return {} }

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

    const initialSources = this.getSources()

    const onNodeClick = (globalKey: string): void => {
      void this.navigateToNode(globalKey)
    }

    const onNodePatch = async (
      globalKey: string,
      patcher: (md: string, doc: Document, node: TaskNode) => string,
    ): Promise<void> => {
      if (!this.astIndex) return
      await patchInFile(
        this.astIndex,
        globalKey,
        (fp) => {
          const f = this.app.vault.getAbstractFileByPath(fp) as TFile
          return this.app.vault.read(f)
        },
        (fp, content) => {
          const f = this.app.vault.getAbstractFileByPath(fp) as TFile
          return this.app.vault.modify(f, content)
        },
        patcher,
      )
    }

    this.component = mount(this.getMountComponent(), {
      target: mountTarget,
      props: {
        sources: initialSources,
        registerUpdater: (fn: (sources: SourceEntry[]) => void) => {
          this.updater = fn
        },
        onNodeClick,
        onNodePatch,
        ...this.getExtraMountProps(),
      },
    })

    // AstIndex がある場合はその変更を購読する
    if (this.astIndex) {
      this.offIndex = this.astIndex.onChange(() => {
        if (!this.updater) return
        this.updater(this.getSources())
      })
    } else {
      // astIndex がない場合は fileSync の更新を購読する（単一ファイル fallback）
      this.fileSync.subscribe(this.fileSyncHandler)
    }
  }

  async onClose(): Promise<void> {
    if (this.offIndex) {
      this.offIndex()
      this.offIndex = null
    } else {
      this.fileSync.unsubscribe(this.fileSyncHandler)
    }
    if (this.component) {
      unmount(this.component)
      this.component = null
    }
  }

  private getSources(): SourceEntry[] {
    if (this.astIndex) {
      const docs = this.astIndex.getDocuments()
      return [...docs.entries()].map(([path, doc]) => ({ path, doc }))
    }
    // fallback: fileSync の現在ファイル
    const doc = this.fileSync.getCurrentDocument()
    const file = this.fileSync.getCurrentFile()
    if (doc && file) return [{ path: file.path, doc }]
    return []
  }

  private readonly fileSyncHandler = (doc: Document): void => {
    if (!this.updater) return
    const file = this.fileSync.getCurrentFile()
    if (!file) return
    this.updater([{ path: file.path, doc }])
  }

  private async navigateToNode(globalKey: string): Promise<void> {
    let filePath: string
    let localId: string
    try {
      ;({ filePath, localId } = parseGlobalKey(globalKey))
    } catch {
      return
    }

    // 対象ファイルの Document と行番号を解決する
    const doc = this.astIndex
      ? this.astIndex.getDocument(filePath)
      : this.fileSync.getCurrentDocument()
    if (!doc) return
    const line = doc.nodeLineMap.get(localId)
    if (line === undefined) return

    const currentFilePath = this.fileSync.getCurrentFile()?.path
    if (filePath === currentFilePath) {
      // 同ファイル → editorEventBus 経由でカーソル移動
      this.editorEventBus.requestFocusLine(line)
    } else {
      // 別ファイル → ファイルを開いてからカーソル移動
      const abstractFile = this.app.vault.getAbstractFileByPath(filePath)
      if (!abstractFile) return
      const file = abstractFile as TFile

      // 既存リーフを探す
      let targetLeaf: WorkspaceLeaf | null = null
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ws = this.app.workspace as any
      if (typeof ws.iterateAllLeaves === 'function') {
        ws.iterateAllLeaves((leaf: WorkspaceLeaf) => {
          if (targetLeaf) return
          const view = (leaf as unknown as { view?: { file?: TFile } }).view
          if (view?.file?.path === filePath) targetLeaf = leaf
        })
      }

      if (!targetLeaf) {
        targetLeaf = this.app.workspace.getLeaf(false)
        if (!targetLeaf) return
        await targetLeaf.openFile(file)
      } else {
        this.app.workspace.revealLeaf(targetLeaf)
      }

      const mdView = (targetLeaf as unknown as { view?: MarkdownView }).view
      if (mdView instanceof MarkdownView && mdView.editor) {
        mdView.editor.setCursor({ line, ch: 0 })
        mdView.editor.focus()
      }
    }
  }
}
