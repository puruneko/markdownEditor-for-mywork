import type { App, TFile } from 'obsidian'
import type { Section, Node } from '../lib/parser/types'
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
  private debounceMs: number

  constructor(app: App, debounceMs: number) {
    this.app = app
    this.debounceMs = debounceMs
  }

  setDebounceMs(ms: number): void {
    this.debounceMs = ms
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
      // 内容が変わっていなければ再パース・再通知をスキップする。
      if (content === this.currentMarkdown) return
      const doc = parseMarkdown(content)
      this.currentDoc = doc
      this.currentMarkdown = content
      this.currentFile = file
      this.debugLog(file.path, doc)
      this.notify(doc, file)
    } catch {
      // 読み取りエラーは無視する（ファイルが削除された場合など）。
    }
  }

  private debugLog(filePath: string, doc: Document): void {
    type Count = { tasks: number; scheduled: number }

    const countNodes = (nodes: Node[]): Count => {
      let tasks = 0
      let scheduled = 0
      for (const n of nodes) {
        if (n.type === 'task') {
          tasks++
          if (n.meta?.schedule) scheduled++
          const c = countNodes(n.children)
          tasks += c.tasks
          scheduled += c.scheduled
        } else if (n.type === 'list') {
          const c = countNodes(n.children)
          tasks += c.tasks
          scheduled += c.scheduled
        }
      }
      return { tasks, scheduled }
    }

    const walkSection = (sec: Section): Count => {
      const own = countNodes(sec.children)
      const sub = sec.subSections.reduce<Count>(
        (acc, s) => { const r = walkSection(s); return { tasks: acc.tasks + r.tasks, scheduled: acc.scheduled + r.scheduled } },
        { tasks: 0, scheduled: 0 },
      )
      return { tasks: own.tasks + sub.tasks, scheduled: own.scheduled + sub.scheduled }
    }

    const total = doc.sections.reduce<Count>(
      (acc, s) => { const r = walkSection(s); return { tasks: acc.tasks + r.tasks, scheduled: acc.scheduled + r.scheduled } },
      { tasks: 0, scheduled: 0 },
    )

    console.debug(`[MD-AST] ドキュメント更新: ${filePath}`)
    console.debug(`[MD-AST] セクション数: ${doc.sections.length} | タスク数: ${total.tasks} | スケジュール付き: ${total.scheduled}`)
    console.debug('[MD-AST] セクション一覧:', doc.sections.map(s => `"${s.title}"(depth=${s.depth}, sub=${s.subSections.length})`).join(', '))
    console.log('[MD-AST] Document (full AST):', doc)
  }

  private notify(doc: Document, file: TFile): void {
    this.handlers.forEach(handler => handler(doc, file))
  }

  private getActiveMarkdownFile(): TFile | null {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView)
    return view?.file ?? null
  }
}
