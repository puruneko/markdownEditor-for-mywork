import { describe, it, expect } from 'vitest'
import { parseMarkdown } from './md-to-ast'
import { serializeAst } from './ast-to-md'
import type { Document, TaskNode, ListNode } from './types'

describe('serializeAst', () => {
  it('serializes a leaf task', () => {
    const doc: Document = {
      type: 'document',
      sections: [{
        type: 'section',
        id: 's1',
        depth: 0,
        title: '',
        children: [{
          type: 'task',
          id: 'n1',
          text: 'タスク',
          status: 'todo',
          children: [],
          hasTaskDescendant: false,
          isGroup: false,
          isLeafTask: true,
          isMemo: false,
          depth: 1,
          path: ['タスク[0]'],
        }],
        subSections: [],
      }],
    }
    expect(serializeAst(doc)).toBe('- [ ] タスク\n')
  })

  it('serializes all status markers', () => {
    const statuses = [
      { status: 'todo' as const,    marker: '[ ]' },
      { status: 'done' as const,    marker: '[x]' },
      { status: 'doing' as const,   marker: '[>]' },
      { status: 'blocked' as const, marker: '[!]' },
      { status: 'hold' as const,    marker: '[-]' },
    ]
    for (const { status, marker } of statuses) {
      const doc: Document = {
        type: 'document',
        sections: [{
          type: 'section',
          id: 's1',
          depth: 0,
          title: '',
          children: [{
            type: 'task', id: 'n1', text: 'T',
            status, children: [],
            hasTaskDescendant: false, isGroup: false, isLeafTask: true, isMemo: false,
            depth: 1, path: ['T[0]'],
          }],
          subSections: [],
        }],
      }
      expect(serializeAst(doc)).toContain(`- ${marker} T`)
    }
  })

  it('serializes meta fields', () => {
    const doc: Document = {
      type: 'document',
      sections: [{
        type: 'section', id: 's1', depth: 0, title: '',
        children: [{
          type: 'task', id: 'n1', text: 'タスク',
          status: 'todo', children: [],
          meta: { schedule: '2026-04-01T10:00/12:00', priority: 1 },
          hasTaskDescendant: false, isGroup: false, isLeafTask: true, isMemo: false,
          depth: 1, path: ['タスク[0]'],
        }],
        subSections: [],
      }],
    }
    const md = serializeAst(doc)
    expect(md).toContain('- @schedule: 2026-04-01T10:00/12:00')
    expect(md).toContain('- @priority: 1')
  })

  it('serializes nested tasks with correct indentation', () => {
    const md = `- [ ] 親\n  - [x] 子`
    const doc = parseMarkdown(md)
    const result = serializeAst(doc)
    expect(result).toContain('- [ ] 親')
    expect(result).toContain('  - [x] 子')
  })

  it('serializes blockquote', () => {
    const md = `> 補足説明`
    const doc = parseMarkdown(md)
    expect(serializeAst(doc)).toContain('> 補足説明')
  })

  it('serializes section headings', () => {
    const md = `# タイトル\n\n- [ ] タスク`
    const doc = parseMarkdown(md)
    const result = serializeAst(doc)
    expect(result).toContain('# タイトル')
    expect(result).toContain('- [ ] タスク')
  })

  it('roundtrip: MD → AST → MD preserves structure', () => {
    const original = `# Webアプリ開発

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
`
    const doc = parseMarkdown(original)
    const result = serializeAst(doc)
    // Key structural elements must be preserved
    expect(result).toContain('# Webアプリ開発')
    expect(result).toContain('- 企画')
    expect(result).toContain('  - [x] 要件整理')
    expect(result).toContain('    - @schedule: 2026-04-01T10:00/2026-04-01T12:00')
    expect(result).toContain('    - [x] 機能洗い出し')
    expect(result).toContain('  - メモ')
    expect(result).toContain('    - MVP重視')
    expect(result).toContain('- 設計')
    expect(result).toContain('  - [ ] 画面設計')
    expect(result).toContain('    - [ ] ワイヤー作成')
    expect(result).toContain('    - [ ] UIレビュー')
  })
})
