import type { FilterQuery } from './filter'
import type { IndexScope } from '../../sync/ast-index'
import type { Status } from '../parser/types'

export type ParsedQuery = {
  query: FilterQuery
  scope: IndexScope
}

const VALID_STATUSES = new Set<Status>(['todo', 'doing', 'done', 'blocked', 'hold'])

/**
 * task-query コードブロックの DSL テキストを FilterQuery に変換する。
 * 不正な行は無視して残りを適用する（クラッシュしない）。
 *
 * DSL 書式（1 行 1 条件、key: value）:
 *   status: todo,doing
 *   tag: 総務,清掃
 *   due: <=2026-07-05
 *   due: >=2026-07-01
 *   priority: <=2
 *   text: 見積
 *   scope: vault|folder|current
 */
export function parseQueryDsl(text: string): ParsedQuery {
  const query: FilterQuery = {}
  let scope: IndexScope = 'vault'

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const colonIdx = line.indexOf(':')
    if (colonIdx < 0) continue

    const key = line.slice(0, colonIdx).trim().toLowerCase()
    const value = line.slice(colonIdx + 1).trim()
    if (!value) continue

    try {
      parseKeyValue(key, value, query, (s) => { scope = s })
    } catch {
      // 不正な行は無視する
    }
  }

  return { query, scope }
}

function parseKeyValue(
  key: string,
  value: string,
  query: FilterQuery,
  setScope: (s: IndexScope) => void,
): void {
  switch (key) {
    case 'status': {
      const statuses = value
        .split(',')
        .map(s => s.trim().toLowerCase())
        .filter((s): s is Status => VALID_STATUSES.has(s as Status))
      if (statuses.length) query.status = statuses
      break
    }
    case 'tag':
    case 'tags': {
      const tags = value.split(',').map(t => t.trim()).filter(Boolean)
      if (tags.length) query.tags = tags
      break
    }
    case 'due': {
      if (value.startsWith('<=')) {
        const date = value.slice(2).trim()
        if (isValidDate(date)) query.dueBefore = date
      } else if (value.startsWith('>=')) {
        const date = value.slice(2).trim()
        if (isValidDate(date)) query.dueAfter = date
      }
      break
    }
    case 'priority': {
      if (value.startsWith('<=')) {
        const n = parseInt(value.slice(2).trim(), 10)
        if (!isNaN(n) && n > 0) query.priorityMax = n
      }
      break
    }
    case 'text': {
      query.text = value
      break
    }
    case 'scope': {
      const s = value.toLowerCase()
      if (s === 'vault') setScope('vault')
      else if (s === 'folder') setScope('folder')
      else if (s === 'current') setScope('current-file')
      break
    }
  }
}

function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s)
}
