import { DateTime } from 'luxon'
import type { Status, TaskNode, Node, Section, Document } from '../parser/types'
import type { SourceEntry } from '../viewmodel/contract'
import { makeGlobalKey } from '../viewmodel/global-key'

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

export type AgendaTask = {
  globalKey: string
  text: string
  status: Status
  /** 日付（YYYY-MM-DD）。@schedule 終了日 > @due の優先順。日付なしは null。 */
  date: string | null
  priority: number | null
  path: string
  lineNumber: number
}

export type AgendaBuckets = {
  overdue: AgendaTask[]
  today: AgendaTask[]
  thisWeek: AgendaTask[]
  undated: AgendaTask[]
}

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

const INCOMPLETE: ReadonlySet<Status> = new Set(['todo', 'doing', 'blocked', 'hold'])

const STATUS_ORDER: Record<Status, number> = {
  todo: 0, doing: 1, blocked: 2, hold: 3, done: 4,
}

/** @schedule 終了日 > @due の優先順で日付文字列（YYYY-MM-DD）を返す。 */
function resolveDate(node: TaskNode): string | null {
  if (node.meta?.schedule) {
    const slash = node.meta.schedule.indexOf('/')
    if (slash !== -1) {
      const endPart = node.meta.schedule.slice(slash + 1).trim()
      // 時刻付き(YYYY-MM-DDTHH:mm)の場合は日付部分だけ
      return endPart.split('T')[0]
    }
  }
  return node.meta?.due ?? null
}

function collectTasksFromNodes(nodes: Node[], path: string, result: AgendaTask[]): void {
  for (const node of nodes) {
    if (node.type === 'quote') continue
    if (node.type === 'task' && INCOMPLETE.has(node.status)) {
      result.push({
        globalKey: makeGlobalKey(path, node.id),
        text: node.text,
        status: node.status,
        date: resolveDate(node),
        priority: node.meta?.priority ?? null,
        path,
        lineNumber: node.lineNumber,
      })
    }
    if ((node.type === 'task' || node.type === 'list') && node.children.length > 0) {
      collectTasksFromNodes(node.children, path, result)
    }
  }
}

function collectTasksFromSection(section: Section, path: string, result: AgendaTask[]): void {
  collectTasksFromNodes(section.children, path, result)
  for (const sub of section.subSections) {
    collectTasksFromSection(sub, path, result)
  }
}

function collectTasksFromDoc(doc: Document, path: string, result: AgendaTask[]): void {
  for (const section of doc.sections) {
    collectTasksFromSection(section, path, result)
  }
}

function sortTasks(tasks: AgendaTask[]): AgendaTask[] {
  return [...tasks].sort((a, b) => {
    // 1. 日付昇順（日付なしは末尾）
    if (a.date !== null && b.date !== null) {
      if (a.date < b.date) return -1
      if (a.date > b.date) return 1
    } else if (a.date !== null) {
      return -1
    } else if (b.date !== null) {
      return 1
    }
    // 2. priority 昇順（未指定は末尾）
    const pa = a.priority ?? Infinity
    const pb = b.priority ?? Infinity
    if (pa !== pb) return pa - pb
    // 3. ステータス順 todo < doing < blocked < hold
    return STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
  })
}

// ----------------------------------------------------------------
// Public API
// ----------------------------------------------------------------

/**
 * 複数ソースの未完タスクを 4 バケツに振り分けて返す。
 * today は固定値で受け取る（テスト容易化）。
 * 週は月曜始まり・日曜終わり（Luxon デフォルト）。
 * today より後の今週内（翌日〜日曜）は thisWeek。今週を超える将来日は表示しない。
 */
export function buildAgenda(sources: SourceEntry[], today: DateTime): AgendaBuckets {
  const todayStr = today.toISODate()!
  // Luxon の endOf('week') は日曜日（ISO week: Mon-Sun）
  const endOfWeekStr = today.endOf('week').toISODate()!
  const tomorrowStr = today.plus({ days: 1 }).toISODate()!

  const all: AgendaTask[] = []
  for (const { path, doc } of sources) {
    collectTasksFromDoc(doc, path, all)
  }

  const overdue: AgendaTask[] = []
  const todayBucket: AgendaTask[] = []
  const thisWeek: AgendaTask[] = []
  const undated: AgendaTask[] = []

  for (const task of all) {
    if (task.date === null) {
      undated.push(task)
    } else if (task.date < todayStr) {
      overdue.push(task)
    } else if (task.date === todayStr) {
      todayBucket.push(task)
    } else if (task.date >= tomorrowStr && task.date <= endOfWeekStr) {
      thisWeek.push(task)
    }
    // 今週を超える日付はどのバケツにも入れない
  }

  return {
    overdue: sortTasks(overdue),
    today: sortTasks(todayBucket),
    thisWeek: sortTasks(thisWeek),
    undated: sortTasks(undated),
  }
}
