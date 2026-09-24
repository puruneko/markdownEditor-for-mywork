import { describe, it, expect } from 'vitest'
import { parseMarkdown } from './parse-markdown'
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
          status: 'ready',
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
      { status: 'planning' as const,    marker: '[?]' },
      { status: 'ready' as const,       marker: '[ ]' },
      { status: 'done' as const,        marker: '[x]' },
      { status: 'in_progress' as const, marker: '[>]' },
      { status: 'waiting' as const,     marker: '[!]' },
      { status: 'deferred' as const,    marker: '[/]' },
      { status: 'cancelled' as const,   marker: '[-]' },
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
          status: 'ready', children: [],
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

  it('serializes nested tasks with tab indentation', () => {
    const md = `- [ ] 親\n  - [x] 子`
    const doc = parseMarkdown(md)
    const result = serializeAst(doc)
    expect(result).toContain('- [ ] 親')
    // Serializer outputs tabs (matching Obsidian's native Tab-key behavior)
    expect(result).toContain('\t- [x] 子')
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

  it('@repeat フィールドをシリアライズする', () => {
    const md = [
      '- [ ] 繰り返しタスク',
      '  - @schedule: 2026-04-03T10:00/2026-04-03T11:00',
      '  - @repeat: FREQ=WEEKLY;BYDAY=FR',
    ].join('\n') + '\n'
    const doc = parseMarkdown(md)
    const result = serializeAst(doc)
    expect(result).toContain('- @repeat: FREQ=WEEKLY;BYDAY=FR')
  })

  it('ラウンドトリップ: @repeat が消えない・変形しない', () => {
    const md = [
      '- [ ] 定期作業',
      '  - @schedule: 2026-04-03T10:00/2026-04-03T12:00',
      '  - @repeat: FREQ=WEEKLY;BYDAY=MO,FR;INTERVAL=2',
    ].join('\n') + '\n'
    const doc = parseMarkdown(md)
    const roundtripped = parseMarkdown(serializeAst(doc))
    const task = roundtripped.sections[0].children[0] as any
    expect(task.meta?.repeat).toBe('FREQ=WEEKLY;BYDAY=MO,FR;INTERVAL=2')
  })

  // ──────────────────────────────────────────────────────
  // issue-phase004-002: @plan・仮置き `?`・@due 期間のラウンドトリップ
  // ──────────────────────────────────────────────────────

  it('serializes @plan', () => {
    const md = `- [ ] タスク\n  - @plan: 2026-07-07/2026-07-11\n`
    const doc = parseMarkdown(md)
    expect(serializeAst(doc)).toContain('- @plan: 2026-07-07/2026-07-11')
  })

  it('roundtrip: @plan?（仮置き）が一字一句戻る', () => {
    // シリアライザは常にタブでインデントする（既存の tab-based serializer 仕様）ため、
    // 入力もタブで与えて完全な文字列一致（一字一句）を確認する。
    const md = '- [ ] タスク\n\t- @plan?: 2026-07-07/2026-07-11\n'
    const doc = parseMarkdown(md)
    const result = serializeAst(doc)
    expect(result).toBe(md)
  })

  it('roundtrip: @schedule?（仮置き）が一字一句戻る', () => {
    const md = '- [ ] タスク\n\t- @schedule?: 2026-07-10T10:00/2026-07-10T11:00\n'
    const doc = parseMarkdown(md)
    const result = serializeAst(doc)
    expect(result).toBe(md)
  })

  it('roundtrip: @due?（仮置き）が一字一句戻る', () => {
    const md = '- [ ] タスク\n\t- @due?: 2026-07-10\n'
    const doc = parseMarkdown(md)
    const result = serializeAst(doc)
    expect(result).toBe(md)
  })

  it('roundtrip: 期間の @due が一字一句戻る', () => {
    const md = '- [ ] タスク\n\t- @due: 2026-07-10/2026-07-15\n'
    const doc = parseMarkdown(md)
    const result = serializeAst(doc)
    expect(result).toBe(md)
  })

  it('serializes plan/schedule/due together in plan → schedule → due order', () => {
    const doc: Document = {
      type: 'document',
      sections: [{
        type: 'section', id: 's1', depth: 0, title: '', lineNumber: -1, close: false,
        children: [{
          type: 'task', id: 'n1', text: 'タスク',
          status: 'ready', children: [], lineNumber: 0,
          meta: {
            plan: '2026-07-01/2026-07-31',
            schedule: '2026-07-10T10:00/2026-07-10T12:00',
            due: '2026-07-31',
          },
          hasTaskDescendant: false, isGroup: false, isLeafTask: true, isMemo: false,
          depth: 1, path: ['タスク[0]'],
        }],
        subSections: [],
      }],
      nodeLineMap: new Map(),
    }
    const lines = serializeAst(doc).split('\n')
    const planIdx = lines.findIndex(l => l.includes('@plan'))
    const scheduleIdx = lines.findIndex(l => l.includes('@schedule'))
    const dueIdx = lines.findIndex(l => l.includes('@due'))
    expect(planIdx).toBeLessThan(scheduleIdx)
    expect(scheduleIdx).toBeLessThan(dueIdx)
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
    // Key structural elements must be preserved (serializer uses tabs)
    expect(result).toContain('# Webアプリ開発')
    expect(result).toContain('- 企画')
    expect(result).toContain('\t- [x] 要件整理')
    expect(result).toContain('\t\t- @schedule: 2026-04-01T10:00/2026-04-01T12:00')
    expect(result).toContain('\t\t- [x] 機能洗い出し')
    expect(result).toContain('\t- メモ')
    expect(result).toContain('\t\t- MVP重視')
    expect(result).toContain('- 設計')
    expect(result).toContain('\t- [ ] 画面設計')
    expect(result).toContain('\t\t- [ ] ワイヤー作成')
    expect(result).toContain('\t\t- [ ] UIレビュー')
  })

  // ──────────────────────────────────────────────────────
  // issue-phase005-001: 7状態のラウンドトリップ・複数行メタ値のラウンドトリップ
  // ──────────────────────────────────────────────────────

  it('roundtrip: 7状態すべてについて、パース→シリアライズで元の記法へ戻る', () => {
    const markers = ['[?]', '[ ]', '[>]', '[!]', '[/]', '[x]', '[-]']
    for (const marker of markers) {
      const md = `- ${marker} タスク\n`
      const doc = parseMarkdown(md)
      expect(serializeAst(doc)).toBe(md)
    }
  })

  it('roundtrip: @condition の複数行値（string[]）が一字一句戻る', () => {
    // シリアライザはカノニカル英字キーのみを書き出す（日本語エイリアスは解析時に消費され、
    // どのエイリアスで書かれたかは AST に残らないため、英字キーの入力でラウンドトリップを確認する）。
    const md = [
      '- [ ] タスク',
      '\t- @condition:',
      '\t\t- 資料Aが承認された',
      '\t\t- 資料Bが承認された',
    ].join('\n') + '\n'
    const doc = parseMarkdown(md)
    const result = serializeAst(doc)
    expect(result).toBe(md)
  })

  it('日本語エイリアス @完了イメージ の複数行値は、シリアライズ時にカノニカルキー @condition へ正規化される', () => {
    const md = [
      '- [ ] タスク',
      '\t- @完了イメージ:',
      '\t\t- 資料Aが承認された',
      '\t\t- 資料Bが承認された',
    ].join('\n') + '\n'
    const doc = parseMarkdown(md)
    const result = serializeAst(doc)
    expect(result).toContain('- @condition:')
    expect(result).toContain('\t\t- 資料Aが承認された')
    expect(result).toContain('\t\t- 資料Bが承認された')
  })

  it('serializes condition/purpose/savepoint/special_note as single-line values', () => {
    const doc: Document = {
      type: 'document',
      sections: [{
        type: 'section', id: 's1', depth: 0, title: '', lineNumber: -1, close: false,
        children: [{
          type: 'task', id: 'n1', text: 'タスク',
          status: 'ready', children: [], lineNumber: 0,
          meta: {
            condition: '資料が承認された状態',
            purpose: '顧客満足度の向上',
            savepoint: '一次レビュー完了時点',
            special_note: '予算超過に注意',
          },
          hasTaskDescendant: false, isGroup: false, isLeafTask: true, isMemo: false,
          depth: 1, path: ['タスク[0]'],
        }],
        subSections: [],
      }],
      nodeLineMap: new Map(),
    }
    const md = serializeAst(doc)
    expect(md).toContain('- @condition: 資料が承認された状態')
    expect(md).toContain('- @purpose: 顧客満足度の向上')
    expect(md).toContain('- @savepoint: 一次レビュー完了時点')
    expect(md).toContain('- @special_note: 予算超過に注意')
  })
})
