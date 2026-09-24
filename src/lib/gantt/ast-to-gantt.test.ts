import { describe, it, expect } from 'vitest'
import { parseMarkdown } from '../parser/parse-markdown'
import { extractGanttNodes } from './ast-to-gantt'
import { parseGlobalKey } from '../viewmodel/global-key'
import { DateTime } from 'luxon'

// ----------------------------------------------------------------
// ヘルパー: 単一ファイルソースの作成
// ----------------------------------------------------------------
function src(md: string, path = 'test.md') {
  return [{ path, doc: parseMarkdown(md) }]
}

// ----------------------------------------------------------------
// extractGanttNodes
// ----------------------------------------------------------------

describe('extractGanttNodes', () => {
  it('returns empty array when no schedules exist', () => {
    expect(extractGanttNodes(src('- [ ] タスクA\n'))).toEqual([])
  })

  it('converts a scheduled task to GanttNode type=task', () => {
    const nodes = extractGanttNodes(src('- [ ] タスクA\n  - @schedule: 2026-04-01T10:00/2026-04-01T12:00\n'))
    const task = nodes.find(n => n.type === 'task')
    expect(task).toBeDefined()
    expect(task!.name).toBe('タスクA')
    expect(task!.start).toBeDefined()
    expect(task!.end).toBeDefined()
  })

  it('does not include nodes without schedule and without schedule descendants', () => {
    const nodes = extractGanttNodes(src('- [ ] タスクA\n- [ ] タスクB\n  - @schedule: 2026-04-01T10:00/2026-04-01T12:00\n'))
    expect(nodes.every(n => n.name !== 'タスクA')).toBe(true)
  })

  it('creates a project node for depth=1 section with min/max of descendants', () => {
    const nodes = extractGanttNodes(src('# プロジェクト\n\n- [ ] タスク\n  - @schedule: 2026-04-01T10:00/2026-04-01T12:00\n'))
    const project = nodes.find(n => n.type === 'project')
    expect(project).toBeDefined()
    expect(project!.name).toBe('プロジェクト')
    expect(project!.parentId).toBeNull()
    expect(project!.start?.toISO()).toContain('2026-04-01T10:00')
    expect(project!.end?.toISO()).toContain('2026-04-01T12:00')
  })

  it('creates a section node for depth>=2 section with min/max of descendants', () => {
    const nodes = extractGanttNodes(src('# 親\n\n## 子セクション\n\n- [ ] タスク\n  - @schedule: 2026-04-01T10:00/2026-04-01T12:00\n'))
    const section = nodes.find(n => n.type === 'section')
    expect(section).toBeDefined()
    expect(section!.name).toBe('子セクション')
    expect(section!.start?.toISO()).toContain('2026-04-01T10:00')
    expect(section!.end?.toISO()).toContain('2026-04-01T12:00')
  })

  it('creates a subsection node with min/max of child tasks', () => {
    const nodes = extractGanttNodes(src('- 親タスク\n  - [ ] 子タスク\n    - @schedule: 2026-04-01T10:00/2026-04-01T12:00\n'))
    const subsection = nodes.find(n => n.type === 'subsection')
    expect(subsection).toBeDefined()
    expect(subsection!.name).toBe('親タスク')
    expect(subsection!.start?.toISO()).toContain('2026-04-01T10:00')
    expect(subsection!.end?.toISO()).toContain('2026-04-01T12:00')
  })

  it('section start/end spans the full range of multiple child tasks', () => {
    const md = `# プロジェクト\n\n- [ ] タスクA\n  - @schedule: 2026-04-01T10:00/2026-04-01T12:00\n- [ ] タスクB\n  - @schedule: 2026-04-05T14:00/2026-04-05T18:00\n`
    const nodes = extractGanttNodes(src(md))
    const project = nodes.find(n => n.type === 'project')!
    expect(project.start?.toISO()).toContain('2026-04-01T10:00')
    expect(project.end?.toISO()).toContain('2026-04-05T18:00')
  })

  it('sets parentId correctly for nested nodes (both are globalKey)', () => {
    const nodes = extractGanttNodes(src('# プロジェクト\n\n- [ ] タスク\n  - @schedule: 2026-04-01T10:00/2026-04-01T12:00\n'))
    const project = nodes.find(n => n.type === 'project')!
    const task = nodes.find(n => n.type === 'task')!
    expect(task.parentId).toBe(project.id)
    // 両方とも globalKey 形式
    expect(project.id).toContain('::')
    expect(task.parentId).toContain('::')
  })

  it('excludes QuoteNodes', () => {
    const nodes = extractGanttNodes(src('> メモ\n> - メモ内容\n\n- [ ] タスク\n  - @schedule: 2026-04-01T10:00/2026-04-01T12:00\n'))
    expect(nodes.every(n => n.name !== 'メモ')).toBe(true)
  })

  it('skips sections without any schedule descendants', () => {
    const nodes = extractGanttNodes(src('# 予定あり\n\n- [ ] タスク\n  - @schedule: 2026-04-01T10:00/2026-04-01T12:00\n\n# 予定なし\n\n- [ ] メモ\n'))
    expect(nodes.some(n => n.name === '予定あり')).toBe(true)
    expect(nodes.some(n => n.name === '予定なし')).toBe(false)
  })

  it('stores status and schedule in metadata', () => {
    const nodes = extractGanttNodes(src('- [ ] タスク\n  - @schedule: 2026-04-01T10:00/2026-04-01T12:00\n'))
    const task = nodes.find(n => n.type === 'task')!
    expect(task.metadata?.status).toBe('ready')
    expect(task.metadata?.schedule).toBe('2026-04-01T10:00/2026-04-01T12:00')
  })

  it('sets completed=true on the GanttNode when task status is done', () => {
    const nodes = extractGanttNodes(src('- [x] タスク\n  - @schedule: 2026-04-01T10:00/2026-04-01T12:00\n'))
    const task = nodes.find(n => n.type === 'task')!
    expect(task.completed).toBe(true)
  })

  it('sets completed=false on the GanttNode when task status is not done', () => {
    const nodes = extractGanttNodes(src('- [ ] タスク\n  - @schedule: 2026-04-01T10:00/2026-04-01T12:00\n'))
    const task = nodes.find(n => n.type === 'task')!
    expect(task.completed).toBe(false)
  })

  it('does not set start/end for invalid schedule (GR-016)', () => {
    const nodes = extractGanttNodes(src('- [ ] タスク\n  - @schedule: invalid\n'))
    const task = nodes.find(n => n.type === 'task')
    expect(task).toBeDefined()
    expect(task!.start).toBeUndefined()
    expect(task!.end).toBeUndefined()
  })

  it('handles multiple sections and tasks', () => {
    const md = `# セクション1

- [ ] タスクA
  - @schedule: 2026-04-01T10:00/2026-04-01T12:00
- [ ] タスクB
  - @schedule: 2026-04-02T10:00/2026-04-02T12:00

# セクション2

- [ ] タスクC
  - @schedule: 2026-04-03T10:00/2026-04-03T12:00
`
    const nodes = extractGanttNodes(src(md))
    expect(nodes.filter(n => n.type === 'project')).toHaveLength(2)
    expect(nodes.filter(n => n.type === 'task')).toHaveLength(3)
  })

  it('各ノードの id は globalKey 形式（sourcePath::localId）', () => {
    const nodes = extractGanttNodes(src('# P\n\n- [ ] T\n  - @schedule: 2026-04-01T10:00/2026-04-01T12:00\n'))
    for (const node of nodes) {
      const { filePath } = parseGlobalKey(node.id)
      expect(filePath).toBe('test.md')
    }
  })
})

describe('extractGanttNodes — サブタスク展開（issue-gantt-phase004-007）', () => {
  const md = '- 親タスク\n  - [ ] 子タスクA\n    - @schedule: 2026-04-01T10:00/2026-04-01T12:00\n  - [ ] 子タスクB（未予定）\n'

  it('expandSubtasks 未指定（既定）: 期間未設定の子タスクは出力されない（完全回帰）', () => {
    const nodes = extractGanttNodes(src(md))
    expect(nodes.some(n => n.name === '子タスクB（未予定）')).toBe(false)
  })

  it('expandSubtasks: false を明示: 期間未設定の子タスクは出力されない', () => {
    const nodes = extractGanttNodes(src(md), undefined, { expandSubtasks: false })
    expect(nodes.some(n => n.name === '子タスクB（未予定）')).toBe(false)
  })

  it('expandSubtasks: false でも、期間ありの子タスクは従来どおり出力される（回帰確認）', () => {
    const nodes = extractGanttNodes(src(md), undefined, { expandSubtasks: false })
    const child = nodes.find(n => n.name === '子タスクA')
    expect(child).toBeDefined()
    expect(child!.type).toBe('task')
    expect(child!.start).toBeDefined()
  })

  it('expandSubtasks: true: 期間未設定の子タスクも type=task・start/end 未設定で出力される', () => {
    const nodes = extractGanttNodes(src(md), undefined, { expandSubtasks: true })
    const child = nodes.find(n => n.name === '子タスクB（未予定）')
    expect(child).toBeDefined()
    expect(child!.type).toBe('task')
    expect(child!.start).toBeUndefined()
    expect(child!.end).toBeUndefined()
  })

  it('expandSubtasks: true: 期間未設定の子タスクの parentId は親タスクの globalKey を指す', () => {
    const nodes = extractGanttNodes(src(md), undefined, { expandSubtasks: true })
    const parent = nodes.find(n => n.name === '親タスク')!
    const child = nodes.find(n => n.name === '子タスクB（未予定）')!
    expect(child.parentId).toBe(parent.id)
  })

  it('expandSubtasks: true でも、@schedule を持たずスケジュール済み子孫も持たないセクションは従来どおり非表示（回帰）', () => {
    const noScheduleMd = '# 予定なし\n\n- [ ] メモ\n'
    const nodes = extractGanttNodes(src(noScheduleMd), undefined, { expandSubtasks: true })
    expect(nodes).toEqual([])
  })

  it('expandSubtasks: true でも @repeat 展開の挙動は変わらない（回帰）', () => {
    const viewRange = {
      start: DateTime.fromISO('2026-04-01T00:00'),
      end: DateTime.fromISO('2026-04-30T23:59'),
    }
    const repeatMd = [
      '- [ ] 毎週金曜',
      '  - @schedule: 2026-04-03T10:00/2026-04-03T11:00',
      '  - @repeat: FREQ=WEEKLY;BYDAY=FR',
    ].join('\n') + '\n'
    const nodes = extractGanttNodes(src(repeatMd), viewRange, { expandSubtasks: true })
    expect(nodes.filter(n => n.type === 'task')).toHaveLength(4)
  })
})

describe('extractGanttNodes — @repeat 展開', () => {
  const viewRange = {
    start: DateTime.fromISO('2026-04-01T00:00'),
    end: DateTime.fromISO('2026-04-30T23:59'),
  }

  it('@repeat あり・viewRange あり: 各オカレンスが独立した task ノードとして展開される', () => {
    const md = [
      '- [ ] 毎週金曜',
      '  - @schedule: 2026-04-03T10:00/2026-04-03T11:00',
      '  - @repeat: FREQ=WEEKLY;BYDAY=FR',
    ].join('\n') + '\n'
    const nodes = extractGanttNodes(src(md), viewRange)
    const tasks = nodes.filter(n => n.type === 'task')
    // 4月の金曜: 3,10,17,24 = 4件
    expect(tasks).toHaveLength(4)
  })

  it('@repeat あり・viewRange あり: オカレンスの id が __r{index} サフィックスを持つ', () => {
    const md = [
      '- [ ] 繰り返し',
      '  - @schedule: 2026-04-03T10:00/2026-04-03T11:00',
      '  - @repeat: FREQ=WEEKLY;BYDAY=FR',
    ].join('\n') + '\n'
    const nodes = extractGanttNodes(src(md), viewRange).filter(n => n.type === 'task')
    nodes.forEach((n, idx) => {
      expect(n.id).toMatch(new RegExp(`__r${idx}$`))
    })
  })

  it('@repeat あり・viewRange あり: オカレンスの duration が初回 @schedule と一致する', () => {
    const md = [
      '- [ ] 繰り返し',
      '  - @schedule: 2026-04-03T09:00/2026-04-03T11:00',
      '  - @repeat: FREQ=WEEKLY;BYDAY=FR',
    ].join('\n') + '\n'
    const nodes = extractGanttNodes(src(md), viewRange).filter(n => n.type === 'task')
    nodes.forEach(n => {
      const durationMs = n.end!.toMillis() - n.start!.toMillis()
      expect(durationMs).toBe(2 * 60 * 60 * 1000) // 2時間
    })
  })

  it('@repeat あり: 各オカレンスに completed が親タスクの status から設定される', () => {
    const md = [
      '- [x] 毎週金曜',
      '  - @schedule: 2026-04-03T10:00/2026-04-03T11:00',
      '  - @repeat: FREQ=WEEKLY;BYDAY=FR',
    ].join('\n') + '\n'
    const nodes = extractGanttNodes(src(md), viewRange).filter(n => n.type === 'task')
    nodes.forEach(n => {
      expect(n.completed).toBe(true)
    })
  })

  it('@repeat あり・viewRange なし: task ノードを出力しない', () => {
    const md = [
      '- [ ] 繰り返し',
      '  - @schedule: 2026-04-03T10:00/2026-04-03T11:00',
      '  - @repeat: FREQ=WEEKLY;BYDAY=FR',
    ].join('\n') + '\n'
    const nodes = extractGanttNodes(src(md))
    expect(nodes.filter(n => n.type === 'task')).toHaveLength(0)
  })

  it('@repeat 不正値: 展開スキップ（例外を投げない）', () => {
    const md = [
      '- [ ] 不正repeat',
      '  - @schedule: 2026-04-03T10:00/2026-04-03T11:00',
      '  - @repeat: INVALID_RRULE',
    ].join('\n') + '\n'
    expect(() => extractGanttNodes(src(md), viewRange)).not.toThrow()
    expect(extractGanttNodes(src(md), viewRange).filter(n => n.type === 'task')).toHaveLength(0)
  })

  it('@repeat なしタスクは従来どおり（回帰）', () => {
    const md = '- [ ] タスク\n  - @schedule: 2026-04-01T10:00/2026-04-01T12:00\n'
    const tasks = extractGanttNodes(src(md), viewRange).filter(n => n.type === 'task')
    expect(tasks).toHaveLength(1)
    expect(tasks[0].id).not.toMatch(/__r\d+$/)
  })
})

describe('extractGanttNodes — マルチソース', () => {
  it('複数ファイルのノードを集約し id が全体でユニーク', () => {
    const mdA = '# P\n\n- [ ] T\n  - @schedule: 2026-04-01T10:00/2026-04-01T12:00\n'
    const mdB = '# P\n\n- [ ] T\n  - @schedule: 2026-04-02T10:00/2026-04-02T12:00\n'
    const sources = [
      { path: 'fileA.md', doc: parseMarkdown(mdA) },
      { path: 'fileB.md', doc: parseMarkdown(mdB) },
    ]
    const nodes = extractGanttNodes(sources)
    const ids = nodes.map(n => n.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('ファイル内の parentId 参照が同一ファイルの globalKey を指す', () => {
    const md = '# P\n\n- [ ] T\n  - @schedule: 2026-04-01T10:00/2026-04-01T12:00\n'
    const sources = [
      { path: 'fileA.md', doc: parseMarkdown(md) },
      { path: 'fileB.md', doc: parseMarkdown(md) },
    ]
    const nodes = extractGanttNodes(sources)
    const tasks = nodes.filter(n => n.type === 'task')
    for (const task of tasks) {
      const parentId = task.parentId!
      const parentNode = nodes.find(n => n.id === parentId)
      expect(parentNode).toBeDefined()
      // parentId と task.id は同じファイルを指す
      expect(parseGlobalKey(parentId).filePath).toBe(parseGlobalKey(task.id).filePath)
    }
  })
})

// ----------------------------------------------------------------
// issue-phase005-001 C-2: plan・milestone・tentative・status の投影
// ----------------------------------------------------------------

describe('extractGanttNodes — plan・milestone・tentative・status', () => {
  it('トップレベル status に node.status が設定される', () => {
    const nodes = extractGanttNodes(src('- [>] タスク\n  - @schedule: 2026-04-01T10:00/2026-04-01T12:00\n'))
    const task = nodes.find(n => n.type === 'task')!
    expect(task.status).toBe('in_progress')
  })

  it('@想定期間(@plan) を持つタスクの GanttNode.plan が設定される', () => {
    const nodes = extractGanttNodes(src(
      '- [ ] タスク\n  - @plan: 2026-04-01/2026-04-10\n  - @schedule: 2026-04-05T10:00/2026-04-05T12:00\n',
    ))
    const task = nodes.find(n => n.type === 'task')!
    expect(task.plan?.start.toISODate()).toBe('2026-04-01')
    expect(task.plan?.end.toISODate()).toBe('2026-04-10')
  })

  it('@期限(@due) を持つタスクの milestone が設定される（単一点）', () => {
    const nodes = extractGanttNodes(src(
      '- [ ] タスク\n  - @due: 2026-04-15\n  - @schedule: 2026-04-05T10:00/2026-04-05T12:00\n',
    ))
    const task = nodes.find(n => n.type === 'task')!
    expect(DateTime.isDateTime(task.milestone)).toBe(true)
    expect((task.milestone as DateTime).toISODate()).toBe('2026-04-15')
  })

  it('@期限(@due) が期間の場合、milestone は {start, end} になる', () => {
    const nodes = extractGanttNodes(src(
      '- [ ] タスク\n  - @due: 2026-04-15/2026-04-20\n  - @schedule: 2026-04-05T10:00/2026-04-05T12:00\n',
    ))
    const task = nodes.find(n => n.type === 'task')!
    const milestone = task.milestone as { start: DateTime; end: DateTime }
    expect(milestone.start.toISODate()).toBe('2026-04-15')
    expect(milestone.end.toISODate()).toBe('2026-04-20')
  })

  it('@実施日時?（仮置き）を持つタスクの tentative が true になる', () => {
    const nodes = extractGanttNodes(src(
      '- [ ] タスク\n  - @schedule?: 2026-04-05T10:00/2026-04-05T12:00\n',
    ))
    const task = nodes.find(n => n.type === 'task')!
    expect(task.tentative).toBe(true)
  })

  it('@schedule に ? が無い場合、tentative は未設定', () => {
    const nodes = extractGanttNodes(src(
      '- [ ] タスク\n  - @schedule: 2026-04-05T10:00/2026-04-05T12:00\n',
    ))
    const task = nodes.find(n => n.type === 'task')!
    expect(task.tentative).toBeUndefined()
  })

  it('list（グループ）に @plan があれば plan が設定される。status は設定されない', () => {
    const nodes = extractGanttNodes(src(
      '- グループ\n  - @plan: 2026-04-01/2026-04-10\n  - [ ] タスク\n    - @schedule: 2026-04-05T10:00/2026-04-05T12:00\n',
    ))
    const group = nodes.find(n => n.type === 'subsection')!
    expect(group.plan?.start.toISODate()).toBe('2026-04-01')
    expect(group.status).toBeUndefined()
  })
})

// ----------------------------------------------------------------
// issue-phase010-markdownEditor-008: gantt 投影の可視性述語の拡張
// ----------------------------------------------------------------

describe('extractGanttNodes — 可視性述語の拡張（issue-phase010-markdownEditor-008）', () => {
  it('タスクを持たず、@plan のみを持つリスト項目もチャートに出る（従来は非表示だった回帰修正）', () => {
    const nodes = extractGanttNodes(src('- 案件アイデア\n  - @plan: 2026-05-01/2026-05-10\n'))
    const node = nodes.find(n => n.name === '案件アイデア')
    expect(node).toBeDefined()
    expect(node!.type).toBe('subsection')
    expect(node!.plan?.start.toISODate()).toBe('2026-05-01')
  })

  it('タスクを持たず、@due のみを持つリスト項目もチャートに出る（従来は非表示だった回帰修正）', () => {
    const nodes = extractGanttNodes(src('- 案件アイデア\n  - @due: 2026-05-10\n'))
    const node = nodes.find(n => n.name === '案件アイデア')
    expect(node).toBeDefined()
    expect(node!.type).toBe('subsection')
  })

  it('タスクを持たず、@schedule のみを持つリスト項目もチャートに出る（従来は非表示だった回帰修正）', () => {
    const nodes = extractGanttNodes(src('- 案件アイデア\n  - @schedule: 2026-05-01T10:00/2026-05-01T11:00\n'))
    const node = nodes.find(n => n.name === '案件アイデア')
    expect(node).toBeDefined()
    expect(node!.type).toBe('subsection')
  })

  it('日付メタを一切持たないリスト項目は従来どおり非表示（回帰確認）', () => {
    const nodes = extractGanttNodes(src('- 普通のリスト\n  - ただの子リスト項目\n'))
    expect(nodes.find(n => n.name === '普通のリスト')).toBeUndefined()
  })

  it('タスクを一切持たず、見出し（Section）自身が @plan を持つ場合もチャートに出る（I-07 の Section.meta が前提）', () => {
    const nodes = extractGanttNodes(src('# 案件A\n- @plan: 2026-06-01/2026-06-30\n- 普通のメモ\n'))
    const project = nodes.find(n => n.name === '案件A')
    expect(project).toBeDefined()
    expect(project!.type).toBe('project')
  })

  it('タスクを一切持たず、見出し（Section）自身が @due を持つ場合もチャートに出る', () => {
    const nodes = extractGanttNodes(src('# 案件B\n- @due: 2026-06-30\n- 普通のメモ\n'))
    const project = nodes.find(n => n.name === '案件B')
    expect(project).toBeDefined()
  })

  it('見出し（Section）が日付メタも日付メタを持つ子孫も持たない場合は従来どおり非表示（回帰確認）', () => {
    const nodes = extractGanttNodes(src('# 案件C\n- 普通のメモ\n'))
    expect(nodes.find(n => n.name === '案件C')).toBeUndefined()
  })

  it('新しい GanttNodeType は追加されない（DEC-14: list 由来ノードは既存の type: "subsection" のまま）', () => {
    const nodes = extractGanttNodes(src('- 案件アイデア\n  - @due: 2026-05-10\n'))
    const node = nodes.find(n => n.name === '案件アイデア')!
    expect(['task', 'subsection', 'project', 'section']).toContain(node.type)
  })
})

// ----------------------------------------------------------------
// issue-phase011-markdownEditor-001: チャート領域への実図形描画
// ----------------------------------------------------------------

describe('extractGanttNodes — チャート領域への実図形描画（issue-phase011-markdownEditor-001）', () => {
  it('@schedule のみを持つ（タスクではない）リスト項目に、task と同等の start/end 座標が設定される', () => {
    const nodes = extractGanttNodes(src('- リスト項目\n  - @schedule: 2026-05-01T10:00/2026-05-01T12:00\n'))
    const node = nodes.find(n => n.name === 'リスト項目')!
    expect(node.type).toBe('subsection')
    expect(node.start?.toISO()).toBe(DateTime.fromISO('2026-05-01T10:00').toISO())
    expect(node.end?.toISO()).toBe(DateTime.fromISO('2026-05-01T12:00').toISO())
  })

  it('@due のみを持つ（タスクではない）リスト項目に、milestone（単一点）が設定される', () => {
    const nodes = extractGanttNodes(src('- リスト項目\n  - @due: 2026-05-10\n'))
    const node = nodes.find(n => n.name === 'リスト項目')!
    expect(node.milestone).toBeDefined()
    expect(node.milestone).not.toHaveProperty('start')
    expect((node.milestone as DateTime).toISODate()).toBe('2026-05-10')
  })

  it('@due が期間の場合、リスト項目の milestone は {start, end} になる', () => {
    const nodes = extractGanttNodes(src('- リスト項目\n  - @due: 2026-05-10/2026-05-15\n'))
    const node = nodes.find(n => n.name === 'リスト項目')!
    const milestone = node.milestone as { start: DateTime; end: DateTime }
    expect(milestone.start.toISODate()).toBe('2026-05-10')
    expect(milestone.end.toISODate()).toBe('2026-05-15')
  })

  it('@plan を持つ見出しに、点線枠用の plan 図形データが設定される（start/end 未設定でも良い）', () => {
    const nodes = extractGanttNodes(src('# 案件A\n- @plan: 2026-06-01/2026-06-30\n- 普通のメモ\n'))
    const project = nodes.find(n => n.name === '案件A')!
    expect(project.type).toBe('project')
    expect(project.plan?.start.toISODate()).toBe('2026-06-01')
    expect(project.plan?.end.toISODate()).toBe('2026-06-30')
  })

  it('@due を持つ見出しに、マイルストーン形状の図形データが設定される', () => {
    const nodes = extractGanttNodes(src('# 案件B\n- @due: 2026-06-30\n- 普通のメモ\n'))
    const project = nodes.find(n => n.name === '案件B')!
    expect(project.milestone).toBeDefined()
    expect((project.milestone as DateTime).toISODate()).toBe('2026-06-30')
  })

  it('list・見出しいずれも task 固有の装飾は付与されない（status フィールドが存在しない）', () => {
    const nodes = extractGanttNodes(src(
      '# 案件C\n- @due: 2026-06-30\n- リスト項目\n  - @schedule: 2026-05-01T10:00/2026-05-01T12:00\n',
    ))
    const project = nodes.find(n => n.name === '案件C')!
    const list = nodes.find(n => n.name === 'リスト項目')!
    expect(project.status).toBeUndefined()
    expect(list.status).toBeUndefined()
  })

  it('descendantDateRange の集計対象が拡張され、@schedule を持たず @plan のみを持つ子孫でも祖先グループの範囲に反映される', () => {
    const nodes = extractGanttNodes(src(
      '- [ ] 親タスク\n  - [ ] 子タスク\n    - @plan: 2026-07-01/2026-07-31\n',
    ))
    const parent = nodes.find(n => n.name === '親タスク')!
    expect(parent.start?.toISODate()).toBe('2026-07-01')
    expect(parent.end?.toISODate()).toBe('2026-07-31')
  })

  it('既存の task ノードの通常描画（start/end・milestone・plan）に回帰が無い', () => {
    const nodes = extractGanttNodes(src(
      '- [ ] タスク\n  - @schedule: 2026-04-01T10:00/2026-04-01T12:00\n  - @plan: 2026-04-01/2026-04-10\n  - @due: 2026-04-15\n',
    ))
    const task = nodes.find(n => n.type === 'task')!
    expect(task.start?.toISODate()).toBe('2026-04-01')
    expect(task.end?.toISODate()).toBe('2026-04-01')
    expect(task.plan?.start.toISODate()).toBe('2026-04-01')
    expect((task.milestone as DateTime).toISODate()).toBe('2026-04-15')
  })
})
