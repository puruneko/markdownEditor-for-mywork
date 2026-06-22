import { describe, it, expect } from 'vitest'
import { parseMarkdown } from './parse-markdown'
import type { TaskNode, ListNode, QuoteNode } from './types'

describe('parseMarkdown', () => {
  it('parses a simple leaf task', () => {
    const doc = parseMarkdown('- [ ] タスク')
    const section = doc.sections[0]
    const node = section.children[0] as TaskNode

    expect(node.type).toBe('task')
    expect(node.text).toBe('タスク')
    expect(node.status).toBe('todo')
    expect(node.isLeafTask).toBe(true)
    expect(node.isGroup).toBe(false)
    expect(node.hasTaskDescendant).toBe(false)
  })

  it('parses all status markers', () => {
    const md = [
      '- [ ] todo',
      '- [x] done',
      '- [X] done-uppercase',
      '- [>] doing',
      '- [!] blocked',
      '- [-] hold',
    ].join('\n')
    const { sections } = parseMarkdown(md)
    const nodes = sections[0].children as TaskNode[]
    expect(nodes[0].status).toBe('todo')
    expect(nodes[1].status).toBe('done')
    expect(nodes[2].status).toBe('done')
    expect(nodes[3].status).toBe('doing')
    expect(nodes[4].status).toBe('blocked')
    expect(nodes[5].status).toBe('hold')
  })

  it('parses a task group (task with child tasks)', () => {
    const md = `- [ ] 親タスク\n  - [ ] 子タスク`
    const { sections } = parseMarkdown(md)
    const parent = sections[0].children[0] as TaskNode

    expect(parent.type).toBe('task')
    expect(parent.isLeafTask).toBe(false)
    expect(parent.isGroup).toBe(true)
    expect(parent.hasTaskDescendant).toBe(true)
    expect(parent.children).toHaveLength(1)

    const child = parent.children[0] as TaskNode
    expect(child.isLeafTask).toBe(true)
    expect(child.isGroup).toBe(false)
  })

  it('parses a list group (list with task descendants)', () => {
    const md = `- フェーズ\n  - [ ] タスク`
    const { sections } = parseMarkdown(md)
    const group = sections[0].children[0] as ListNode

    expect(group.type).toBe('list')
    expect(group.isGroup).toBe(true)
    expect(group.isMemo).toBe(false)
    expect(group.hasTaskDescendant).toBe(true)
  })

  it('parses a memo (list with no task descendants)', () => {
    const md = `- メモ\n  - 詳細`
    const { sections } = parseMarkdown(md)
    const memo = sections[0].children[0] as ListNode

    expect(memo.type).toBe('list')
    expect(memo.isMemo).toBe(true)
    expect(memo.isGroup).toBe(false)
    expect(memo.hasTaskDescendant).toBe(false)
  })

  it('parses @meta fields', () => {
    const md = `- [ ] タスク\n  - @schedule: 2026-04-01T10:00/12:00\n  - @priority: 2`
    const { sections } = parseMarkdown(md)
    const node = sections[0].children[0] as TaskNode

    expect(node.meta?.schedule).toBe('2026-04-01T10:00/2026-04-01T12:00')
    expect(node.meta?.priority).toBe(2)
    expect(node.isLeafTask).toBe(true)
  })

  it('parses @dependsOn as string array', () => {
    const md = `- [ ] タスク\n  - @dependsOn: taskA, taskB, taskC`
    const { sections } = parseMarkdown(md)
    const node = sections[0].children[0] as TaskNode
    expect(node.meta?.dependsOn).toEqual(['taskA', 'taskB', 'taskC'])
    expect(node.isLeafTask).toBe(true)
  })

  it('parses @tags as string array', () => {
    const md = `- [ ] タスク\n  - @tags: frontend, urgent`
    const { sections } = parseMarkdown(md)
    const node = sections[0].children[0] as TaskNode
    expect(node.meta?.tags).toEqual(['frontend', 'urgent'])
    expect(node.isLeafTask).toBe(true)
  })

  it('parses all @meta keys together', () => {
    const md = [
      '- [ ] タスク',
      '  - @schedule: 2026-06-01T10:00/12:00',
      '  - @due: 2026-06-30',
      '  - @priority: 1',
      '  - @dependsOn: A, B',
      '  - @tags: x, y',
    ].join('\n')
    const { sections } = parseMarkdown(md)
    const node = sections[0].children[0] as TaskNode
    expect(node.meta?.schedule).toBe('2026-06-01T10:00/2026-06-01T12:00')
    expect(node.meta?.due).toBe('2026-06-30')
    expect(node.meta?.priority).toBe(1)
    expect(node.meta?.dependsOn).toEqual(['A', 'B'])
    expect(node.meta?.tags).toEqual(['x', 'y'])
    expect(node.isLeafTask).toBe(true)
  })

  it('treats blockquote as raw/memo', () => {
    const md = `> 補足説明`
    const { sections } = parseMarkdown(md)
    const quote = sections[0].children[0] as QuoteNode

    expect(quote.type).toBe('quote')
    expect(quote.raw).toBe('補足説明')
    expect(quote.isMemo).toBe(true)
    expect(quote.hasTaskDescendant).toBe(false)
  })

  it('does NOT treat task inside blockquote as a task', () => {
    const md = `> - [ ] タスク`
    const { sections } = parseMarkdown(md)
    const quote = sections[0].children[0] as QuoteNode
    expect(quote.type).toBe('quote')
  })

  it('parses headings as sections', () => {
    const md = `# プロジェクトA\n- [ ] T1\n\n# プロジェクトB\n- [ ] T2`
    const { sections } = parseMarkdown(md)

    expect(sections).toHaveLength(2)
    expect(sections[0].title).toBe('プロジェクトA')
    expect(sections[1].title).toBe('プロジェクトB')
  })

  it('parses heading title with inline code', () => {
    const md = `# My \`code\` section\n- [ ] タスク`
    const { sections } = parseMarkdown(md)
    expect(sections[0].title).toBe('My code section')
  })

  it('nests sub-sections correctly', () => {
    const md = `# A\n- item\n\n## B\n- task`
    const { sections } = parseMarkdown(md)

    expect(sections).toHaveLength(1)
    expect(sections[0].title).toBe('A')
    expect(sections[0].subSections).toHaveLength(1)
    expect(sections[0].subSections[0].title).toBe('B')
    expect(sections[0].subSections[0].parentSectionId).toBe(sections[0].id)
  })

  it('parses > blockquote as child comment of a task', () => {
    const md = `- [ ] タスク\n  > コメント行1\n  > コメント行2\n`
    const { sections } = parseMarkdown(md)
    const task = sections[0].children[0] as TaskNode

    expect(task.type).toBe('task')
    expect(task.children).toHaveLength(1)
    const quote = task.children[0] as QuoteNode
    expect(quote.type).toBe('quote')
    expect(quote.raw).toBe('コメント行1\nコメント行2')
    expect(quote.isMemo).toBe(true)
  })

  it('parses both > and - as comments alongside @meta', () => {
    const md = `- [ ] タスク\n  - @schedule: 2026-04-01T10:00/12:00\n  > blockquoteコメント\n  - listコメント\n`
    const { sections } = parseMarkdown(md)
    const task = sections[0].children[0] as TaskNode

    expect(task.meta?.schedule).toBe('2026-04-01T10:00/2026-04-01T12:00')
    expect(task.children).toHaveLength(2)
    const quote = task.children[0] as QuoteNode
    expect(quote.type).toBe('quote')
    const listMemo = task.children[1] as ListNode
    expect(listMemo.type).toBe('list')
    expect(listMemo.isMemo).toBe(true)
  })

  it('attaches lineNumber to nodes (absolute 0-based)', () => {
    const md = `# セクション\n\n- [ ] タスクA\n  - @schedule: 2026-04-01T10:00/12:00\n- リストB\n`
    const doc = parseMarkdown(md)
    const section = doc.sections[0]
    expect(section.lineNumber).toBe(0)

    const taskA = section.children[0] as TaskNode
    expect(taskA.lineNumber).toBe(2)

    const listB = section.children[1]
    expect(listB.lineNumber).toBe(4)
  })

  it('attaches lineNumber to QuoteNode', () => {
    const md = `- [ ] タスク\n  > コメント\n`
    const doc = parseMarkdown(md)
    const task = doc.sections[0].children[0] as TaskNode
    expect(task.lineNumber).toBe(0)
    const quote = task.children[0]
    expect(quote.lineNumber).toBe(1)
  })

  it('builds nodeLineMap covering all nodes and named sections', () => {
    const md = `# セクション\n\n- [ ] タスク\n`
    const doc = parseMarkdown(md)
    const section = doc.sections[0]
    const task = section.children[0] as TaskNode

    expect(doc.nodeLineMap.get(section.id)).toBe(0)
    expect(doc.nodeLineMap.get(task.id)).toBe(2)
  })

  it('anonymous section has lineNumber -1 and is not in nodeLineMap', () => {
    const md = `- [ ] タスク\n`
    const doc = parseMarkdown(md)
    const section = doc.sections[0]
    expect(section.lineNumber).toBe(-1)
    expect(doc.nodeLineMap.has(section.id)).toBe(false)
  })

  it('generates unique IDs for siblings with same text', () => {
    const md = `- [ ] タスク\n- [ ] タスク`
    const { sections } = parseMarkdown(md)
    const [a, b] = sections[0].children as TaskNode[]
    expect(a.id).not.toBe(b.id)
  })

  it('full example: Webアプリ開発 structure', () => {
    const md = `# Webアプリ開発

> 方針

- 企画
  - [x] 要件整理
    - @schedule: 2026-04-01T10:00/2026-04-01T12:00
    - [x] 機能洗い出し
  - メモ
    - MVP重視

- 設計
  - [ ] 画面設計
    - [ ] ワイヤー作成
    - [ ] UIレビュー

## 運用

- 監視
  - [ ] ログ監視
`
    const doc = parseMarkdown(md)
    expect(doc.sections).toHaveLength(1)
    const main = doc.sections[0]
    expect(main.title).toBe('Webアプリ開発')
    expect(main.subSections[0].title).toBe('運用')

    const kikaku = main.children[1] as ListNode
    expect(kikaku.text).toBe('企画')
    expect(kikaku.isGroup).toBe(true)

    const youken = kikaku.children[0] as TaskNode
    expect(youken.text).toBe('要件整理')
    expect(youken.isGroup).toBe(true)
    expect(youken.meta?.schedule).toBe('2026-04-01T10:00/2026-04-01T12:00')

    const kinou = youken.children[0] as TaskNode
    expect(kinou.text).toBe('機能洗い出し')
    expect(kinou.isLeafTask).toBe(true)

    const memo = kikaku.children[1] as ListNode
    expect(memo.text).toBe('メモ')
    expect(memo.isMemo).toBe(true)
  })

  it('normalizes 2-digit year in @schedule', () => {
    const md = `- [ ] タスク\n  - @schedule: 26-06-01T10:00/26-06-01T11:00\n`
    const { sections } = parseMarkdown(md)
    const node = sections[0].children[0] as TaskNode
    expect(node.meta?.schedule).toBe('2026-06-01T10:00/2026-06-01T11:00')
  })

  it('normalizes omitted minutes in @schedule', () => {
    const md = `- [ ] タスク\n  - @schedule: 2026-06-01T10/2026-06-01T11\n`
    const { sections } = parseMarkdown(md)
    const node = sections[0].children[0] as TaskNode
    expect(node.meta?.schedule).toBe('2026-06-01T10:00/2026-06-01T11:00')
  })

  it('normalizes time-continuation in @schedule', () => {
    const md = `- [ ] タスク\n  - @schedule: 26-06-27T08:00/12:00\n`
    const { sections } = parseMarkdown(md)
    const node = sections[0].children[0] as TaskNode
    expect(node.meta?.schedule).toBe('2026-06-27T08:00/2026-06-27T12:00')
  })

  it('normalizes day-continuation in @schedule', () => {
    const md = `- [ ] タスク\n  - @schedule: 26-06-01/05\n`
    const { sections } = parseMarkdown(md)
    const node = sections[0].children[0] as TaskNode
    expect(node.meta?.schedule).toBe('2026-06-01/2026-06-05')
  })

  it('normalizes 2-digit year in @due', () => {
    const md = `- [ ] タスク\n  - @due: 26-06-30\n`
    const { sections } = parseMarkdown(md)
    const node = sections[0].children[0] as TaskNode
    expect(node.meta?.due).toBe('2026-06-30')
  })

  it('parses children indented with 4 spaces', () => {
    const md = `- [ ] 親タスク\n    - [ ] 子タスク`
    const { sections } = parseMarkdown(md)
    const parent = sections[0].children[0] as TaskNode
    expect(parent.isGroup).toBe(true)
    expect(parent.children).toHaveLength(1)
    expect((parent.children[0] as TaskNode).text).toBe('子タスク')
  })

  it('parses @meta indented with 4 spaces', () => {
    const md = `- [ ] タスク\n    - @schedule: 2026-06-01T10:00/2026-06-01T11:00\n    - @due: 2026-06-01\n`
    const { sections } = parseMarkdown(md)
    const node = sections[0].children[0] as TaskNode
    expect(node.meta?.schedule).toBe('2026-06-01T10:00/2026-06-01T11:00')
    expect(node.meta?.due).toBe('2026-06-01')
    expect(node.isLeafTask).toBe(true)
  })

  it('parses 3-level hierarchy with 4-space indent', () => {
    const md = [
      '- グループ',
      '    - [ ] 親タスク',
      '        - [ ] 子タスク',
    ].join('\n')
    const { sections } = parseMarkdown(md)
    const group = sections[0].children[0] as ListNode
    expect(group.isGroup).toBe(true)
    const parent = group.children[0] as TaskNode
    expect(parent.text).toBe('親タスク')
    expect(parent.isGroup).toBe(true)
    const child = parent.children[0] as TaskNode
    expect(child.text).toBe('子タスク')
    expect(child.isLeafTask).toBe(true)
  })

  it('parses siblings independently of each other\'s child indent', () => {
    const md = [
      '- [ ] タスクA',
      '  - @due: 2026-06-01',
      '- [ ] タスクB',
      '    - @due: 2026-06-02',
    ].join('\n')
    const { sections } = parseMarkdown(md)
    const [a, b] = sections[0].children as TaskNode[]
    expect(a.meta?.due).toBe('2026-06-01')
    expect(b.meta?.due).toBe('2026-06-02')
  })

  it('parses blockquote child indented with 4 spaces', () => {
    const md = `- [ ] タスク\n    > コメント\n`
    const { sections } = parseMarkdown(md)
    const task = sections[0].children[0] as TaskNode
    expect(task.children).toHaveLength(1)
    expect(task.children[0].type).toBe('quote')
    expect((task.children[0] as QuoteNode).raw).toBe('コメント')
  })

  it('parses child indented with 1 tab', () => {
    const md = '- [ ] 親タスク\n\t- [ ] 子タスク'
    const { sections } = parseMarkdown(md)
    const parent = sections[0].children[0] as TaskNode
    expect(parent.isGroup).toBe(true)
    expect(parent.children).toHaveLength(1)
    expect((parent.children[0] as TaskNode).text).toBe('子タスク')
  })

  it('parses @meta indented with 1 tab', () => {
    const md = '- [ ] タスク\n\t- @schedule: 2026-06-01T10:00/2026-06-01T11:00\n\t- @due: 2026-06-01'
    const { sections } = parseMarkdown(md)
    const node = sections[0].children[0] as TaskNode
    expect(node.meta?.schedule).toBe('2026-06-01T10:00/2026-06-01T11:00')
    expect(node.meta?.due).toBe('2026-06-01')
    expect(node.isLeafTask).toBe(true)
  })

  it('parses 3-level hierarchy with tab indent', () => {
    const md = '- グループ\n\t- [ ] 親タスク\n\t\t- [ ] 子タスク'
    const { sections } = parseMarkdown(md)
    const group = sections[0].children[0] as ListNode
    expect(group.isGroup).toBe(true)
    const parent = group.children[0] as TaskNode
    expect(parent.text).toBe('親タスク')
    expect(parent.isGroup).toBe(true)
    const child = parent.children[0] as TaskNode
    expect(child.text).toBe('子タスク')
    expect(child.isLeafTask).toBe(true)
  })

  it('parses blockquote child indented with 1 tab', () => {
    const md = '- [ ] タスク\n\t> コメント'
    const { sections } = parseMarkdown(md)
    const task = sections[0].children[0] as TaskNode
    expect(task.children).toHaveLength(1)
    expect((task.children[0] as QuoteNode).type).toBe('quote')
    expect((task.children[0] as QuoteNode).raw).toBe('コメント')
  })

  it('treats tab-indented and space-indented siblings as equivalent structure', () => {
    const mdTab = '- [ ] タスクA\n\t- @due: 2026-06-10\n- [ ] タスクB\n\t- @due: 2026-06-11'
    const mdSpc = '- [ ] タスクA\n    - @due: 2026-06-10\n- [ ] タスクB\n    - @due: 2026-06-11'
    const docTab = parseMarkdown(mdTab)
    const docSpc = parseMarkdown(mdSpc)
    const [a1, b1] = docTab.sections[0].children as TaskNode[]
    const [a2, b2] = docSpc.sections[0].children as TaskNode[]
    expect(a1.meta?.due).toBe(a2.meta?.due)
    expect(b1.meta?.due).toBe(b2.meta?.due)
  })

  it('handles abbreviated dates with tab-indented @meta', () => {
    const md = '- [ ] タスク\n\t- @schedule: 26-06-27T08/12\n\t- @due: 26-06-27'
    const { sections } = parseMarkdown(md)
    const node = sections[0].children[0] as TaskNode
    expect(node.meta?.schedule).toBe('2026-06-27T08:00/2026-06-27T12:00')
    expect(node.meta?.due).toBe('2026-06-27')
  })

  it('recognizes top-level tasks even when indented with tab (no parent)', () => {
    const md = '\t- [ ] タスク'
    const { sections } = parseMarkdown(md)
    expect(sections[0].children).toHaveLength(1)
    const task = sections[0].children[0] as TaskNode
    expect(task.type).toBe('task')
    expect(task.text).toBe('タスク')
  })

  it('recognizes multiple top-level tasks all at tab indent', () => {
    const md = '\t- [ ] T1\n\t- [ ] T2\n\t- [ ] T3'
    const { sections } = parseMarkdown(md)
    const tasks = sections[0].children as TaskNode[]
    expect(tasks).toHaveLength(3)
    expect(tasks.map(t => t.text)).toEqual(['T1', 'T2', 'T3'])
  })

  it('re-injects tasks that landed under a @meta line due to mixed indent', () => {
    const md = [
      '- [ ] T1',
      '  - @due: 2026-06-01',
      '\t- [ ] T2',
      '\t  - @due: 2026-06-02',
    ].join('\n')
    const { sections } = parseMarkdown(md)
    const t1 = sections[0].children[0] as TaskNode
    expect(t1.meta?.due).toBe('2026-06-01')
    expect(t1.children).toHaveLength(1)
    const t2 = t1.children[0] as TaskNode
    expect(t2.type).toBe('task')
    expect(t2.text).toBe('T2')
    expect(t2.meta?.due).toBe('2026-06-02')
  })

  it('re-injects when multiple siblings have @meta at different indent widths', () => {
    const md = [
      '- [ ] T1',
      '  - @due: 2026-06-01',
      '- [ ] T2',
      '    - @due: 2026-06-02',
    ].join('\n')
    const { sections } = parseMarkdown(md)
    const [t1, t2] = sections[0].children as TaskNode[]
    expect(t1.meta?.due).toBe('2026-06-01')
    expect(t2.meta?.due).toBe('2026-06-02')
  })
})
