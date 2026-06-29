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
    expect(task.metadata?.status).toBe('todo')
    expect(task.metadata?.schedule).toBe('2026-04-01T10:00/2026-04-01T12:00')
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
