import { describe, it, expect } from 'vitest'
import { extractKanbanCards, createKanbanConfig, DEFAULT_KANBAN_CONFIG } from './ast-to-kanban'
import { parseMarkdown } from '../parser/parse-markdown'
import { parseGlobalKey } from '../viewmodel/global-key'

// ----------------------------------------------------------------
// ヘルパー: 単一ファイルソースの作成
// ----------------------------------------------------------------
function src(md: string, path = 'test.md') {
  return [{ path, doc: parseMarkdown(md) }]
}

describe('extractKanbanCards', () => {
  it('空のドキュメントは空配列を返す', () => {
    expect(extractKanbanCards(src(''))).toEqual([])
  })

  it('TaskNodeをKanbanCardに変換する', () => {
    const cards = extractKanbanCards(src('# プロジェクト\n\n- [ ] タスクA\n- [x] タスクB'))
    expect(cards).toHaveLength(2)
    expect(cards[0].title).toBe('タスクA')
    expect(cards[0].status).toBe('todo')
    expect(cards[0].sectionTitle).toBe('プロジェクト')
    expect(cards[1].title).toBe('タスクB')
    expect(cards[1].status).toBe('done')
  })

  it('ListNodeはスキップし、その子TaskNodeは含む', () => {
    const cards = extractKanbanCards(src('# セクション\n\n- メモ\n  - [ ] 子タスク'))
    expect(cards).toHaveLength(1)
    expect(cards[0].title).toBe('子タスク')
  })

  it('QuoteNodeはスキップする', () => {
    const cards = extractKanbanCards(src('# セクション\n\n> 方針\n> - メモ\n\n- [ ] タスク'))
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
    const cards = extractKanbanCards(src(md))
    const card = cards.find(c => c.title === 'タスクA')
    expect(card).toBeDefined()
    expect(card!.schedule).toBe('2026-01-01T10:00/2026-01-01T11:00')
    expect(card!.due).toBe('2026-01-01')
    expect(card!.priority).toBe(1)
  })

  it('ネストされたTaskNodeを再帰的に展開する', () => {
    const cards = extractKanbanCards(src('# S\n\n- [ ] 親タスク\n  - [>] 子タスク\n    - [!] 孫タスク'))
    expect(cards).toHaveLength(3)
    const statuses = cards.map(c => c.status)
    expect(statuses).toContain('todo')
    expect(statuses).toContain('doing')
    expect(statuses).toContain('blocked')
  })

  it('各カードのidはグローバルにユニークなglobalKeyを持つ', () => {
    const cards = extractKanbanCards(src('# S\n\n- [ ] タスクA\n- [x] タスクB'))
    const ids = cards.map(c => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('カードのidはglobalKey形式（::を含む）', () => {
    const cards = extractKanbanCards(src('# S\n\n- [ ] タスク'))
    expect(cards[0].id).toContain('::')
    const { filePath } = parseGlobalKey(cards[0].id)
    expect(filePath).toBe('test.md')
  })

  it('sourcePath が正しく設定される', () => {
    const cards = extractKanbanCards(src('# S\n\n- [ ] タスク', 'folder/note.md'))
    expect(cards[0].sourcePath).toBe('folder/note.md')
  })

  it('子QuoteNodeのrawをdescriptionとして設定する', () => {
    const md = ['# セクション', '', '- [ ] タスクA', '  > 説明テキスト'].join('\n')
    const cards = extractKanbanCards(src(md))
    const card = cards.find(c => c.title === 'タスクA')
    expect(card).toBeDefined()
    expect(card!.description).toBe('説明テキスト')
  })

  it('isMemo: trueのListNodeのtextをdescriptionとして設定する', () => {
    const md = ['# セクション', '', '- [ ] タスクA', '  - メモ説明'].join('\n')
    const cards = extractKanbanCards(src(md))
    const card = cards.find(c => c.title === 'タスクA')
    expect(card).toBeDefined()
    expect(card!.description).toBe('メモ説明')
  })

  it('説明情報がない場合はdescriptionをundefinedにする', () => {
    const cards = extractKanbanCards(src('# セクション\n\n- [ ] タスクA'))
    expect(cards[0].description).toBeUndefined()
  })

  it('複数の説明ノードは改行で結合する', () => {
    const md = ['# セクション', '', '- [ ] タスクA', '  > 説明1', '  - メモ説明2'].join('\n')
    const cards = extractKanbanCards(src(md))
    const card = cards.find(c => c.title === 'タスクA')
    expect(card!.description).toContain('説明1')
    expect(card!.description).toContain('メモ説明2')
  })

  it('depthフィールドが正しく設定される', () => {
    const cards = extractKanbanCards(src('# S\n\n- [ ] 深さ1\n  - [ ] 深さ2'))
    const depths = cards.map(c => c.depth)
    expect(depths[0]).toBeLessThan(depths[1])
  })

  it('直接セクション配下のタスクは section=[sectionTitle]', () => {
    const cards = extractKanbanCards(src('# Heading\n\n- [ ] Task'))
    expect(cards[0].section).toEqual(['Heading'])
    expect(cards[0].sectionTitle).toBe('Heading')
    expect(cards[0].groupTitle).toBe('Heading')
  })

  it('ListNode配下のタスクは section=[sectionTitle, listText]', () => {
    const cards = extractKanbanCards(src('# Heading\n\n- List Group\n  - [ ] Task'))
    expect(cards[0].section).toEqual(['Heading', 'List Group'])
    expect(cards[0].sectionTitle).toBe('Heading')
    expect(cards[0].groupTitle).toBe('List Group')
  })

  it('複数のListNodeが並ぶ場合はそれぞれ section に反映される', () => {
    const cards = extractKanbanCards(src('# S\n\n- グループA\n  - [ ] T1\n  - [ ] T2\n- グループB\n  - [ ] T3'))
    expect(cards.find(c => c.title === 'T1')?.section).toEqual(['S', 'グループA'])
    expect(cards.find(c => c.title === 'T2')?.section).toEqual(['S', 'グループA'])
    expect(cards.find(c => c.title === 'T3')?.section).toEqual(['S', 'グループB'])
  })

  it('複数セクションのタスクは各セクションの section を持つ', () => {
    const cards = extractKanbanCards(src('# セクションA\n\n- [ ] T1\n\n# セクションB\n\n- [ ] T2'))
    expect(cards.find(c => c.title === 'T1')?.section).toEqual(['セクションA'])
    expect(cards.find(c => c.title === 'T2')?.section).toEqual(['セクションB'])
  })

  it('H1 > H2 の階層はサブセクションの親 H1 タイトルを section に含む', () => {
    const cards = extractKanbanCards(src('# H1\n\n## H2\n\n- [ ] タスク'))
    expect(cards[0].section).toEqual(['H1', 'H2'])
    expect(cards[0].sectionTitle).toBe('H1')
    expect(cards[0].groupTitle).toBe('H2')
  })

  it('H1 > H2 > ListNode の3階層は全てを section に含む', () => {
    const cards = extractKanbanCards(src('# H1\n\n## H2\n\n- グループ\n  - [ ] タスク'))
    expect(cards[0].section).toEqual(['H1', 'H2', 'グループ'])
    expect(cards[0].sectionTitle).toBe('H1')
    expect(cards[0].groupTitle).toBe('グループ')
  })
})

describe('extractKanbanCards — マルチソース', () => {
  it('複数ファイルのカードを集約し id が全体でユニーク', () => {
    const sources = [
      { path: 'fileA.md', doc: parseMarkdown('# S\n\n- [ ] タスクA\n- [ ] タスクA') },  // 同名タスク
      { path: 'fileB.md', doc: parseMarkdown('# S\n\n- [ ] タスクA') },                 // 別ファイルの同名タスク
    ]
    const cards = extractKanbanCards(sources)
    expect(cards).toHaveLength(3)
    const ids = cards.map(c => c.id)
    expect(new Set(ids).size).toBe(ids.length)  // each_key_duplicate なし
  })

  it('各カードの sourcePath が正しいファイルを指す', () => {
    const sources = [
      { path: 'fileA.md', doc: parseMarkdown('- [ ] TaskA') },
      { path: 'fileB.md', doc: parseMarkdown('- [ ] TaskB') },
    ]
    const cards = extractKanbanCards(sources)
    expect(cards.find(c => c.title === 'TaskA')?.sourcePath).toBe('fileA.md')
    expect(cards.find(c => c.title === 'TaskB')?.sourcePath).toBe('fileB.md')
  })

  it('ソースが空配列の場合は空を返す', () => {
    expect(extractKanbanCards([])).toEqual([])
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
  it('デフォルトで groupBy: section を設定する', () => {
    const cards = extractKanbanCards(src('# S\n\n- [ ] タスク'))
    expect(createKanbanConfig(cards).groupBy).toBe('section')
  })

  it('デフォルトで sectionDepth: 2 を設定する', () => {
    const cards = extractKanbanCards(src('# S\n\n- [ ] タスク'))
    expect(createKanbanConfig(cards).sectionDepth).toBe(2)
  })

  it('groups は Markdown 出現順の order を持つ GroupDefinition[] を返す', () => {
    const cards = extractKanbanCards(src('# S\n\n- グループA\n  - [ ] T1\n- グループB\n  - [ ] T2'))
    const config = createKanbanConfig(cards)
    const ids = config.groups!.map(g => g.id)
    expect(ids.indexOf('S / グループA')).toBeLessThan(ids.indexOf('S / グループB'))
  })

  it('グループ順序が Markdown 記述順と一致する（逆順テスト）', () => {
    const cards = extractKanbanCards(src('# S\n\n- グループB\n  - [ ] T1\n- グループA\n  - [ ] T2'))
    const config = createKanbanConfig(cards)
    const ids = config.groups!.map(g => g.id)
    expect(ids.indexOf('S / グループB')).toBeLessThan(ids.indexOf('S / グループA'))
  })

  it('groupByField 引数でグループフィールドを変更できる', () => {
    const cards = extractKanbanCards(src('# S\n\n- [ ] タスク'))
    expect(createKanbanConfig(cards, 'sectionTitle').groupBy).toBe('sectionTitle')
  })

  it('sectionDepth 引数で深さを変更できる', () => {
    const cards = extractKanbanCards(src('# S\n\n- [ ] タスク'))
    expect(createKanbanConfig(cards, 'section', 1).sectionDepth).toBe(1)
  })

  it('DEFAULT_KANBAN_CONFIGのlanesを引き継ぐ', () => {
    const cards = extractKanbanCards(src('# S\n\n- [ ] タスク'))
    expect(createKanbanConfig(cards).lanes).toEqual(DEFAULT_KANBAN_CONFIG.lanes)
  })
})
