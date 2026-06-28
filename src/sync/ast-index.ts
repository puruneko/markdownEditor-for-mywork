import type { App, TFile } from 'obsidian'
import { parseMarkdown } from '../lib/parser/parse-markdown'
import type { Document, Node, Section, TaskNode } from '../lib/parser/types'

// ──────────────────────────────────────────────────────
// Public types
// ──────────────────────────────────────────────────────

export type IndexScope = 'vault' | 'folder' | 'current-file'

export type TaskEntry = { path: string; node: TaskNode }

export type IndexChangeHandler = () => void

// ──────────────────────────────────────────────────────
// Internal helpers
// ──────────────────────────────────────────────────────

function collectTaskNodes(nodes: Node[], path: string, out: TaskEntry[]): void {
  for (const node of nodes) {
    if (node.type === 'task') {
      out.push({ path, node })
      collectTaskNodes(node.children, path, out)
    } else if (node.type === 'list') {
      collectTaskNodes(node.children, path, out)
    }
  }
}

function collectTaskNodesFromSection(sec: Section, path: string, out: TaskEntry[]): void {
  collectTaskNodes(sec.children, path, out)
  for (const sub of sec.subSections) {
    collectTaskNodesFromSection(sub, path, out)
  }
}

// ──────────────────────────────────────────────────────
// AstIndex
// ──────────────────────────────────────────────────────

/**
 * Vault 内の複数 Markdown をパースし `path → Document` 索引として保持するクラス。
 * ファイル変更時は変更ファイルのみ差分更新し、他ファイルの Document 参照は維持する。
 */
export class AstIndex {
  private readonly app: App
  private readonly index: Map<string, Document> = new Map()
  private readonly handlers: Set<IndexChangeHandler> = new Set()
  private readonly debounceTimers: Map<string, ReturnType<typeof setTimeout>> = new Map()
  private readonly debounceMs: number
  private readonly scope: IndexScope
  private readonly scopeFolder: string
  private currentFilePath: string | null = null

  constructor(app: App, options: {
    debounceMs: number
    scope: IndexScope
    scopeFolder?: string
  }) {
    this.app = app
    this.debounceMs = options.debounceMs
    this.scope = options.scope
    this.scopeFolder = options.scopeFolder ?? ''
  }

  /** 'current-file' スコープ時に参照するファイルパスを更新する。 */
  setCurrentFilePath(path: string | null): void {
    this.currentFilePath = path
  }

  /** 初期走査を実行し vault イベントを購読する。 */
  async start(): Promise<void> {
    this.app.vault.on('modify', this.handleModify)
    this.app.vault.on('create', this.handleCreate)
    this.app.vault.on('delete', this.handleDelete)
    this.app.vault.on('rename', this.handleRename)
    await this.initialScan()
  }

  /** vault イベントを解除してタイマーを破棄する。 */
  stop(): void {
    this.app.vault.off('modify', this.handleModify)
    this.app.vault.off('create', this.handleCreate)
    this.app.vault.off('delete', this.handleDelete)
    this.app.vault.off('rename', this.handleRename)
    for (const t of this.debounceTimers.values()) clearTimeout(t)
    this.debounceTimers.clear()
    this.handlers.clear()
  }

  /** 指定パスの Document を返す。索引にない場合は undefined。 */
  getDocument(path: string): Document | undefined {
    return this.index.get(path)
  }

  /**
   * スコープ内の全 Document を返す。
   * scope 省略時はコンストラクタで指定したスコープを使う。
   */
  getDocuments(scope?: IndexScope): Map<string, Document> {
    const s = scope ?? this.scope
    if (s === 'vault') {
      return new Map(this.index)
    }
    if (s === 'folder') {
      const result = new Map<string, Document>()
      for (const [p, d] of this.index) {
        if (p.startsWith(this.scopeFolder)) result.set(p, d)
      }
      return result
    }
    // current-file
    const result = new Map<string, Document>()
    if (this.currentFilePath !== null) {
      const doc = this.index.get(this.currentFilePath)
      if (doc) result.set(this.currentFilePath, doc)
    }
    return result
  }

  /**
   * スコープ内の全タスクノードを返す。
   * scope 省略時はコンストラクタで指定したスコープを使う。
   */
  getAllTaskNodes(scope?: IndexScope): TaskEntry[] {
    const docs = this.getDocuments(scope)
    const result: TaskEntry[] = []
    for (const [path, doc] of docs) {
      for (const section of doc.sections) {
        collectTaskNodesFromSection(section, path, result)
      }
    }
    return result
  }

  /**
   * ノードの 0-based 行番号を返す。
   * 索引にない path または nodeId の場合は undefined。
   */
  resolveLine(path: string, nodeId: string): number | undefined {
    return this.index.get(path)?.nodeLineMap.get(nodeId)
  }

  /** 索引変更を購読する。返却関数で解除できる。 */
  onChange(cb: IndexChangeHandler): () => void {
    this.handlers.add(cb)
    return () => this.handlers.delete(cb)
  }

  // ── Private ──────────────────────────────────────────

  private readonly handleModify = (file: TFile): void => {
    if (!this.isInScope(file.path)) return
    this.scheduleUpdate(file)
  }

  private readonly handleCreate = (file: TFile): void => {
    if (!this.isInScope(file.path)) return
    void this.updateFile(file)
  }

  private readonly handleDelete = (file: TFile): void => {
    this.removeFile(file.path)
  }

  // Obsidian の rename イベントは (file: TAbstractFile, oldPath: string)。
  // TFile として扱い extension で .md を判定する。
  private readonly handleRename = (file: TFile, oldPath: string): void => {
    this.index.delete(oldPath)
    if (file.extension === 'md' && this.isInScope(file.path)) {
      void this.updateFile(file)
    } else {
      // 旧パスのエントリが消えたことを通知する。
      if (this.index.has(oldPath)) this.notify()
    }
  }

  private isInScope(path: string): boolean {
    if (this.scope === 'vault') return true
    if (this.scope === 'folder') return path.startsWith(this.scopeFolder)
    return path === this.currentFilePath
  }

  private async initialScan(): Promise<void> {
    const files = (this.app.vault as unknown as { getMarkdownFiles(): TFile[] }).getMarkdownFiles()
    for (const file of files) {
      if (this.isInScope(file.path)) {
        await this.updateFile(file)
      }
    }
  }

  private scheduleUpdate(file: TFile): void {
    const existing = this.debounceTimers.get(file.path)
    if (existing !== undefined) clearTimeout(existing)
    const timer = setTimeout(() => {
      this.debounceTimers.delete(file.path)
      void this.updateFile(file)
    }, this.debounceMs)
    this.debounceTimers.set(file.path, timer)
  }

  private async updateFile(file: TFile): Promise<void> {
    if (file.extension !== 'md') return
    try {
      const content = await this.app.vault.read(file)
      const doc = parseMarkdown(content)
      this.index.set(file.path, doc)
      this.notify()
    } catch {
      // 読み取りエラーは無視する（ファイル削除後の遅延更新など）。
    }
  }

  private removeFile(path: string): void {
    if (this.index.has(path)) {
      this.index.delete(path)
      this.notify()
    }
  }

  private notify(): void {
    this.handlers.forEach(h => h())
  }
}
