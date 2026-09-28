import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * issue-phase012-markdownEditor-001: Shadow DOM 内のテーマ遮断の抜けを塞ぐ。
 * Kanban / FilterBar / 各 *ViewMount.svelte が Obsidian の CSS 変数
 * （var(--background-*) / var(--text-*) / var(--interactive-*)）を参照していないことを
 * 静的に検証する（白基調固定という方針に反する再混入を将来にわたって防ぐ回帰テスト）。
 */
const TARGET_FILES = [
  'src/lib/kanban/KanbanTab.svelte',
  'src/lib/query/FilterBar.svelte',
  'src/views/AstViewMount.svelte',
  'src/views/CalendarViewMount.svelte',
  'src/views/GanttViewMount.svelte',
  'src/views/KanbanViewMount.svelte',
]

const OBSIDIAN_VAR_RE = /var\(--(background|text|interactive)-/

describe('Shadow DOM テーマ遮断の静的検証（issue-phase012-markdownEditor-001）', () => {
  for (const relPath of TARGET_FILES) {
    it(`${relPath} に Obsidian の背景/文字/インタラクティブ変数参照が残っていない`, () => {
      const content = readFileSync(resolve(__dirname, '../..', relPath), 'utf-8')
      const matches = content.match(new RegExp(OBSIDIAN_VAR_RE, 'g')) ?? []
      expect(matches).toEqual([])
    })
  }
})
