import { ItemView, WorkspaceLeaf } from 'obsidian'
import type { TFile } from 'obsidian'
import { mount, unmount } from 'svelte'
import type { Component } from 'svelte'
import type { FileSync } from '../sync/file-sync'
import type { EditorEventBus } from '../sync/editor-event-bus'
import type { Document } from '../lib/parser/types'

const EMPTY_DOC: Document = { type: 'document', sections: [], nodeLineMap: new Map() }

// Shadow Root 内に注入するベースリセット CSS。
// Obsidian のグローバル CSS は Shadow DOM の境界を越えないため、
// box-sizing などの基本スタイルをここで再定義する。
// Svelte 5 の append_styles() は anchor.getRootNode() で Shadow Root を
// 検出し、コンポーネントの <style> を自動的に Shadow Root 内に注入する。
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

/**
 * Obsidian サイドパネルビューの共通基底クラス。
 *
 * Shadow DOM でコンポーネントをマウントし、Obsidian のグローバル CSS が
 * ビュー内部に干渉しないよう分離する。
 * サブクラスは getViewClass() / getMountComponent() のみを実装する。
 */
export abstract class ShadowItemView extends ItemView {
  protected fileSync: FileSync
  protected editorEventBus: EditorEventBus
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

  /** Obsidian コンテナに追加する CSS クラス名（例: 'calendar-view'） */
  protected abstract getViewClass(): string

  /** Shadow Root にマウントする Svelte コンポーネント */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected abstract getMountComponent(): Component<ViewMountProps, any, any>

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1] as HTMLElement
    container.empty()
    container.addClass(this.getViewClass())

    // ── Shadow DOM で CSS を完全分離 ──────────────────────────────
    // flex: 1 1 0 + min-height: 0 で Obsidian の flex コンテナ内で残り高さを占有する。
    // shadowHost に高さが無いと Shadow DOM 内の height: 100% が無効になり、
    // overflow: auto なスクロールコンテナが bounded height を持てず sticky が機能しない。
    const shadowHost = container.createEl('div', { cls: 'view-shadow-host' })
    shadowHost.style.cssText = 'flex: 1 1 0; min-height: 0; width: 100%; overflow: hidden;'
    const shadow = shadowHost.attachShadow({ mode: 'open' })

    const resetStyle = document.createElement('style')
    resetStyle.textContent = SHADOW_RESET_CSS
    shadow.appendChild(resetStyle)

    const mountTarget = document.createElement('div')
    mountTarget.style.cssText = 'width:100%;height:100%;display:flex;flex-direction:column;'
    shadow.appendChild(mountTarget)
    // ────────────────────────────────────────────────────────────

    const initialMd = this.fileSync.getCurrentMarkdown() ?? ''
    const initialDoc = this.fileSync.getCurrentDocument() ?? EMPTY_DOC

    const onNodeClick = (nodeId: string): void => {
      const doc = this.fileSync.getCurrentDocument()
      if (!doc) return
      const lineNumber = doc.nodeLineMap.get(nodeId)
      if (lineNumber !== undefined) this.editorEventBus.requestFocusLine(lineNumber)
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
