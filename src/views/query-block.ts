import { MarkdownRenderChild, MarkdownView } from 'obsidian'
import type { App, MarkdownPostProcessorContext, TFile } from 'obsidian'
import type { AstIndex } from '../sync/ast-index'
import { filterNodes } from '../lib/query/filter'
import { parseQueryDsl } from '../lib/query/parse-query'
import type { Node, Section, TaskNode } from '../lib/parser/types'

type TaskResult = {
  path: string
  task: TaskNode
  line: number
}

const STATUS_LABEL: Record<string, string> = {
  todo: '[ ]',
  done: '[x]',
  doing: '[>]',
  blocked: '[!]',
  hold: '[-]',
}

function collectTasks(nodes: Node[], path: string, lineMap: Map<string, number>, out: TaskResult[]): void {
  for (const node of nodes) {
    if (node.type === 'quote') continue
    if (node.type === 'task') {
      const line = lineMap.get(node.id)
      if (line !== undefined) {
        out.push({ path, task: node, line })
      }
      collectTasks(node.children, path, lineMap, out)
    } else if (node.type === 'list') {
      collectTasks(node.children, path, lineMap, out)
    }
  }
}

function collectFromSection(sec: Section, path: string, lineMap: Map<string, number>, out: TaskResult[]): void {
  collectTasks(sec.children, path, lineMap, out)
  for (const sub of sec.subSections) {
    collectFromSection(sub, path, lineMap, out)
  }
}

class QueryBlockChild extends MarkdownRenderChild {
  private unsubscribe: (() => void) | null = null

  constructor(
    containerEl: HTMLElement,
    private readonly source: string,
    private readonly astIndex: AstIndex,
    private readonly app: App,
  ) {
    super(containerEl)
  }

  onload(): void {
    this.render()
    this.unsubscribe = this.astIndex.onChange(() => this.render())
  }

  onunload(): void {
    this.unsubscribe?.()
    this.unsubscribe = null
  }

  private render(): void {
    const { query, scope } = parseQueryDsl(this.source)
    this.containerEl.empty()
    this.containerEl.addClass('query-block')

    const docs = this.astIndex.getDocuments(scope)
    const results: TaskResult[] = []

    for (const [path, doc] of docs) {
      const filtered = filterNodes(doc, query)
      for (const sec of filtered.sections) {
        collectFromSection(sec, path, doc.nodeLineMap, results)
      }
    }

    if (results.length === 0) {
      const msg = this.containerEl.createEl('p', { cls: 'query-block-empty' })
      msg.textContent = '該当するタスクがありません。'
      return
    }

    const ul = this.containerEl.createEl('ul', { cls: 'query-block-list' })
    for (const { path, task, line } of results) {
      const li = ul.createEl('li', { cls: 'query-block-item' })
      const statusLabel = STATUS_LABEL[task.status] ?? '[ ]'
      const fileName = path.split('/').pop() ?? path
      const span = li.createEl('span', { cls: 'query-block-link' })
      span.textContent = `${statusLabel} ${task.text}  (${fileName}:${line + 1})`
      span.setAttribute('tabindex', '0')
      span.addEventListener('click', () => void this.navigateTo(path, line))
      span.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          void this.navigateTo(path, line)
        }
      })
    }
  }

  private async navigateTo(filePath: string, lineNumber: number): Promise<void> {
    const abstractFile = this.app.vault.getAbstractFileByPath(filePath)
    if (!abstractFile || !('extension' in abstractFile)) return

    const tfile = abstractFile as TFile
    let targetLeaf = this.app.workspace.getMostRecentLeaf()
    if (!targetLeaf) targetLeaf = this.app.workspace.getLeaf(false)
    if (!targetLeaf) return

    await targetLeaf.openFile(tfile)
    this.app.workspace.revealLeaf(targetLeaf)

    const mdView = targetLeaf.view
    if (mdView instanceof MarkdownView) {
      mdView.editor.setCursor({ line: lineNumber, ch: 0 })
      mdView.editor.focus()
    }
  }
}

export function createQueryBlockProcessor(
  app: App,
  astIndex: AstIndex,
): (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => void {
  return (source, el, ctx) => {
    const child = new QueryBlockChild(el, source, astIndex, app)
    ctx.addChild(child)
  }
}
