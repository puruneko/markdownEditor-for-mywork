import { describe, it, expect } from 'vitest'
import { filterClosedProjects } from './filter-closed-projects'
import { parseMarkdown } from '../parser/parse-markdown'

describe('filterClosedProjects', () => {
  it('close: true の見出しセクションを除外する', () => {
    const md = [
      '# 案件A #close',
      '- [ ] タスクA',
      '',
      '# 案件B',
      '- [ ] タスクB',
    ].join('\n')
    const doc = parseMarkdown(md)
    const [{ doc: filtered }] = filterClosedProjects([{ path: 'note.md', doc }])

    expect(filtered.sections).toHaveLength(1)
    expect(filtered.sections[0].title).toBe('案件B')
  })

  it('close: true ではないセクションは変更しない（同一参照。無駄な複製を避ける）', () => {
    const md = '# 案件B\n- [ ] タスクB\n'
    const doc = parseMarkdown(md)
    const sources = [{ path: 'note.md', doc }]
    const filtered = filterClosedProjects(sources)

    expect(filtered[0]).toBe(sources[0])
    expect(filtered[0].doc).toBe(doc)
  })

  it('ネストしたサブセクションが close: true の場合、その配下ごと除外する（親は残る）', () => {
    const md = [
      '# 案件C',
      '- [ ] 親タスク',
      '',
      '## 案件Cの一部 #close',
      '- [ ] 子タスク',
    ].join('\n')
    const doc = parseMarkdown(md)
    const [{ doc: filtered }] = filterClosedProjects([{ path: 'note.md', doc }])

    expect(filtered.sections).toHaveLength(1)
    expect(filtered.sections[0].title).toBe('案件C')
    expect(filtered.sections[0].subSections).toHaveLength(0)
  })

  it('複数ファイル（sources）にまたがって独立にフィルタする', () => {
    const closedMd = '# 案件A #close\n- [ ] タスクA\n'
    const openMd = '# 案件B\n- [ ] タスクB\n'
    const sources = [
      { path: 'closed.md', doc: parseMarkdown(closedMd) },
      { path: 'open.md', doc: parseMarkdown(openMd) },
    ]
    const filtered = filterClosedProjects(sources)

    expect(filtered[0].doc.sections).toHaveLength(0)
    expect(filtered[1].doc.sections).toHaveLength(1)
  })

  it('全セクションが除外された場合、sections は空配列になる（sources 自体は残る）', () => {
    const md = '# 案件A #close\n- [ ] タスクA\n'
    const doc = parseMarkdown(md)
    const filtered = filterClosedProjects([{ path: 'note.md', doc }])

    expect(filtered).toHaveLength(1)
    expect(filtered[0].doc.sections).toEqual([])
  })
})
