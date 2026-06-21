import { describe, it, expect } from 'vitest'
import { extractKanbanCards, createKanbanConfig, DEFAULT_KANBAN_CONFIG } from './ast-to-kanban'
import { parseMarkdown } from '../parser/md-to-ast'

describe('extractKanbanCards', () => {
  it('空のドキュメントは空配列を返す', () => {
    const doc = parseMarkdown('')
    expect(extractKanbanCards(doc)).toEqual([])
  })

  it('TaskNodeをKanbanCardに変換する', () => {
    const md = `# プロジェクト\n\n- [ ] タスクA\n- [x] タスクB`
    const doc = parseMarkdown(md)
    const cards = extractKanbanCards(doc)
    expect(cards).toHaveLength(2)
    expect(cards[0].title).toBe('タスクA')
    expect(cards[0].status).toBe('todo')
    expect(cards[0].sectionTitle).toBe('プロジェクト')
    expect(cards[1].title).toBe('タスクB')
    expect(cards[1].status).toBe('done')
  })

  it('ListNodeはスキップし、その子TaskNodeは含む', () => {
    const md = `# セクション\n\n- メモ\n  - [ ] 子タスク`
    const doc = parseMarkdown(md)
    const cards = extractKanbanCards(doc)
    expect(cards).toHaveLength(1)
    expect(cards[0].title).toBe('子タスク')
  })

  it('QuoteNodeはスキップする', () => {
    const md = `# セクション\n\n> 方針\n> - メモ\n\n- [ ] タスク`
    const doc = parseMarkdown(md)
    const cards = extractKanbanCards(doc)
    expect(cards.every(c => c.title !== 'メモ')).toBe(true)
    expect(cards.some(c => c.title === 'タスク')).toBe(true)
  })

  it('metaフィールド(schedule, due, priority, tags)を引き継ぐ', () => {
    const md = [
      '# セクション',
      '',
      '- [ ] タスクA',
      '  - @schedule: 2026-01-01T10:00/2026-01-01T11:00',
      '  - @due: 2026-01-01',
      '  - @priority: 1',
    ].join('\n')
    const doc = parseMarkdown(md)
    const cards = extractKanbanCards(doc)
    const card = cards.find(c => c.title === 'タスクA')
    expect(card).toBeDefined()
    expect(card!.schedule).toBe('2026-01-01T10:00/2026-01-01T11:00')
    expect(card!.due).toBe('2026-01-01')
    expect(card!.priority).toBe(1)
  })

  it('ネストされたTaskNodeを再帰的に展開する', () => {
    const md = `# S\n\n- [ ] 親タスク\n  - [>] 子タスク\n    - [!] 孫タスク`
    const doc = parseMarkdown(md)
    const cards = extractKanbanCards(doc)
    expect(cards).toHaveLength(3)
    const statuses = cards.map(c => c.status)
    expect(statuses).toContain('todo')
    expect(statuses).toContain('doing')
    expect(statuses).toContain('blocked')
  })

  it('各カードのidはユニークなnodeIdを持つ', () => {
    const md = `# S\n\n- [ ] タスクA\n- [x] タスクB`
    const doc = parseMarkdown(md)
    const cards = extractKanbanCards(doc)
    const ids = cards.map(c => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('depthフィールドが正しく設定される', () => {
    const md = `# S\n\n- [ ] 深さ1\n  - [ ] 深さ2`
    const doc = parseMarkdown(md)
    const cards = extractKanbanCards(doc)
    const depths = cards.map(c => c.depth)
    expect(depths[0]).toBeLessThan(depths[1])
  })
})

describe('DEFAULT_KANBAN_CONFIG', () => {
  it('5つのレーンを持つ', () => {
    expect(DEFAULT_KANBAN_CONFIG.lanes).toHaveLength(5)
  })

  it('各レーンのidがステータスに対応している', () => {
    const ids = DEFAULT_KANBAN_CONFIG.lanes.map(l => l.id)
    expect(ids).toContain('todo')
    expect(ids).toContain('doing')
    expect(ids).toContain('done')
    expect(ids).toContain('blocked')
    expect(ids).toContain('hold')
  })

  it('各レーンはステータスeqフィルタを持つ', () => {
    for (const lane of DEFAULT_KANBAN_CONFIG.lanes) {
      const condition = lane.filter.conditions[0] as { key: string; operator: string; value: string }
      expect(condition.key).toBe('status')
      expect(condition.operator).toBe('eq')
      expect(condition.value).toBe(lane.id)
    }
  })

  it('各レーンのupdateRulesはstatusをsetする', () => {
    for (const lane of DEFAULT_KANBAN_CONFIG.lanes) {
      const rule = lane.updateRules[0] as { type: string; key: string; value: string }
      expect(rule.type).toBe('set')
      expect(rule.key).toBe('status')
      expect(rule.value).toBe(lane.id)
    }
  })
})

describe('createKanbanConfig', () => {
  it('groupBy: sectionTitle を設定する', () => {
    const cards = extractKanbanCards(parseMarkdown('# S\n\n- [ ] タスク'))
    const config = createKanbanConfig(cards)
    expect(config.groupBy).toBe('sectionTitle')
  })

  it('カードのsectionTitleからグループを生成する', () => {
    const md = '# セクションA\n\n- [ ] タスク1\n\n# セクションB\n\n- [x] タスク2'
    const cards = extractKanbanCards(parseMarkdown(md))
    const config = createKanbanConfig(cards)
    const groupIds = (config.groups ?? []).map(g => g.id)
    expect(groupIds).toContain('セクションA')
    expect(groupIds).toContain('セクションB')
  })

  it('グループはカード出現順に並ぶ', () => {
    const md = '# A\n\n- [ ] a\n\n# B\n\n- [ ] b\n\n# C\n\n- [ ] c'
    const cards = extractKanbanCards(parseMarkdown(md))
    const config = createKanbanConfig(cards)
    const ids = (config.groups ?? []).map(g => g.id)
    expect(ids).toEqual(['A', 'B', 'C'])
  })

  it('重複するsectionTitleは1グループにまとまる', () => {
    const md = '# S\n\n- [ ] a\n- [ ] b'
    const cards = extractKanbanCards(parseMarkdown(md))
    const config = createKanbanConfig(cards)
    expect(config.groups?.filter(g => g.id === 'S')).toHaveLength(1)
  })

  it('カードなしのときgroups=[]になる', () => {
    const config = createKanbanConfig([])
    expect(config.groups).toEqual([])
  })

  it('空タイトルのsectionは（未分類）ラベルを持つ', () => {
    const md = '- [ ] タスク'
    const cards = extractKanbanCards(parseMarkdown(md))
    const config = createKanbanConfig(cards)
    const unclassified = (config.groups ?? []).find(g => g.id === '')
    expect(unclassified?.label).toBe('（未分類）')
  })

  it('DEFAULT_KANBAN_CONFIGのlanesを引き継ぐ', () => {
    const cards = extractKanbanCards(parseMarkdown('# S\n\n- [ ] タスク'))
    const config = createKanbanConfig(cards)
    expect(config.lanes).toEqual(DEFAULT_KANBAN_CONFIG.lanes)
  })
})
