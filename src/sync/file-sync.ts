import type { App, TFile } from 'obsidian'
import { MarkdownView } from 'obsidian'
import { parseMarkdown } from '../lib/parser/md-to-ast'
import type { Document } from '../lib/parser/types'

export type DocumentChangeHandler = (doc: Document, file: TFile) => void

/**
 * アクティブファイルの変更を監視し、ASTに変換してハンドラーに通知する。
 */
export class FileSync {
  private app: App
  private handlers: Set<DocumentChangeHandler> = new Set()
  private currentDoc: Document | null = null
  private currentMarkdown: string | null = null
  private currentFile: TFile | null = null
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private readonly debounceMs = 300

  constructor(app: App) {
    this.app = app
  }

  /** ハンドラーを登録する。 */
  subscribe(handler: DocumentChangeHandler): void {
    this.handlers.add(handler)
  }

  /** ハンドラーを解除する。 */
  unsubscribe(handler: DocumentChangeHandler): void {
    this.handlers.delete(handler)
  }

  /** 現在のDocumentを返す。未解析の場合はnullを返す。 */
  getCurrentDocument(): Document | null {
    return this.currentDoc
  }

  /** 現在のMarkdown文字列を返す。未読み込みの場合はnullを返す。 */
  getCurrentMarkdown(): string | null {
    return this.currentMarkdown
  }

  /** 現在のアクティブファイルを返す。 */
  getCurrentFile(): TFile | null {
    return this.currentFile
  }

  /** イベント監視を開始する。 */
  start(): void {
    this.app.workspace.on('active-leaf-change', this.handleActiveLeafChange)
    this.app.vault.on('modify', this.handleFileModify)

    // 起動時点のアクティブファイルを即時処理する。
    const activeFile = this.getActiveMarkdownFile()
    if (activeFile) {
      void this.parseFile(activeFile)
    }
  }

  /** イベント監視を停止する。 */
  stop(): void {
    this.app.workspace.off('active-leaf-change', this.handleActiveLeafChange)
    this.app.vault.off('modify', this.handleFileModify)
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
    this.handlers.clear()
  }

  private handleActiveLeafChange = (): void => {
    const file = this.getActiveMarkdownFile()
    if (file && file.path !== this.currentFile?.path) {
      void this.parseFile(file)
    } else if (!file && this.currentFile !== null) {
      this.currentDoc = null
      this.currentFile = null
    }
  }

  private handleFileModify = (file: TFile): void => {
    if (file.path !== this.currentFile?.path) return
    // 連続変更をdebounceする。
    if (this.debounceTimer !== null) clearTimeout(this.debounceTimer)
    this.debounceTimer = setTimeout(() => {
      void this.parseFile(file)
    }, this.debounceMs)
  }

  private async parseFile(file: TFile): Promise<void> {
    try {
      const content = await this.app.vault.read(file)
      const doc = parseMarkdown(content)
      this.currentDoc = doc
      this.currentMarkdown = content
      this.currentFile = file
      this.notify(doc, file)
    } catch {
      // 読み取りエラーは無視する（ファイルが削除された場合など）。
    }
  }

  private notify(doc: Document, file: TFile): void {
    this.handlers.forEach(handler => handler(doc, file))
  }

  private getActiveMarkdownFile(): TFile | null {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView)
    return view?.file ?? null
  }
}
