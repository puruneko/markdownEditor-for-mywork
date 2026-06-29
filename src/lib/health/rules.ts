import { DateTime } from 'luxon'
import type { Status, TaskNode, Node, Section, Document } from '../parser/types'
import type { SourceEntry } from '../viewmodel/contract'
import { makeGlobalKey } from '../viewmodel/global-key'
import { lintLine } from '../../editor/notation-lint'

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

export type RuleId =
  | 'undated'
  | 'overdue'
  | 'stale'
  | 'unresolved-deps'
  | 'ready-tasks'
  | 'malformed'

export type HealthFinding = {
  ruleId: RuleId
  globalKey: string
  path: string
  line: number
  message: string
}

export type HealthRuleConfig = {
  undated: boolean
  overdue: boolean
  stale: boolean
  unresolvedDeps: boolean
  readyTasks: boolean
  malformed: boolean
}

export type HealthConfig = {
  staleDays: number
  rules: HealthRuleConfig
}

export const DEFAULT_HEALTH_CONFIG: HealthConfig = {
  staleDays: 7,
  rules: {
    undated: true,
    overdue: true,
    stale: true,
    unresolvedDeps: true,
    readyTasks: true,
    malformed: true,
  },
}

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

const INCOMPLETE: ReadonlySet<Status> = new Set(['todo', 'doing', 'blocked', 'hold'])

/** @schedule 終了日（YYYY-MM-DD）。スラッシュがなければ null。 */
function scheduleEndDate(schedule: string): string | null {
  const slash = schedule.indexOf('/')
  if (slash === -1) return null
  return schedule.slice(slash + 1).trim().split('T')[0]
}

/** @schedule 開始日（YYYY-MM-DD）。スラッシュがなければ date 部分をそのまま。 */
function scheduleStartDate(schedule: string): string | null {
  const slash = schedule.indexOf('/')
  const startPart = slash !== -1 ? schedule.slice(0, slash) : schedule
  const datePart = startPart.trim().split('T')[0]
  return datePart || null
}

/** タスクの判定基準日（@schedule 終了日 > @due）*/
function resolveDate(node: TaskNode): string | null {
  if (node.meta?.schedule) {
    const end = scheduleEndDate(node.meta.schedule)
    if (end) return end
  }
  return node.meta?.due ?? null
}

/** @schedule/@due のどちらかを持つか */
function hasDate(node: TaskNode): boolean {
  return !!(node.meta?.schedule || node.meta?.due)
}

/** ドキュメント全体の未完 TaskNode を収集 */
function collectIncompleteNodes(nodes: Node[], path: string, doc: Document): Array<{ node: TaskNode; path: string }> {
  const result: Array<{ node: TaskNode; path: string }> = []
  for (const n of nodes) {
    if (n.type === 'quote') continue
    if (n.type === 'task' && INCOMPLETE.has(n.status)) {
      result.push({ node: n, path })
    }
    if ((n.type === 'task' || n.type === 'list') && n.children.length > 0) {
      result.push(...collectIncompleteNodes(n.children, path, doc))
    }
  }
  return result
}

function collectFromSection(section: Section, path: string, doc: Document): Array<{ node: TaskNode; path: string }> {
  const result = collectIncompleteNodes(section.children, path, doc)
  for (const sub of section.subSections) {
    result.push(...collectFromSection(sub, path, doc))
  }
  return result
}

function collectAllIncomplete(sources: SourceEntry[]): Array<{ node: TaskNode; path: string }> {
  const result: Array<{ node: TaskNode; path: string }> = []
  for (const { path, doc } of sources) {
    for (const section of doc.sections) {
      result.push(...collectFromSection(section, path, doc))
    }
  }
  return result
}

/** 全ソースの全タスク（完了含む）の text 集合を構築 */
function buildAllTaskTexts(sources: SourceEntry[]): Map<string, 'done' | 'incomplete'> {
  const texts = new Map<string, 'done' | 'incomplete'>()
  function scan(nodes: Node[]): void {
    for (const n of nodes) {
      if (n.type === 'quote') continue
      if (n.type === 'task') {
        texts.set(n.text, n.status === 'done' ? 'done' : 'incomplete')
        if (n.children.length > 0) scan(n.children)
      } else if (n.type === 'list' && n.children.length > 0) {
        scan(n.children)
      }
    }
  }
  for (const { doc } of sources) {
    for (const section of doc.sections) {
      scan(section.children)
      for (const sub of section.subSections) {
        scan(sub.children)
      }
    }
  }
  return texts
}

// ----------------------------------------------------------------
// Rule implementations (pure, per-task)
// ----------------------------------------------------------------

/** Rule 1: 未完なのに日付（@schedule/@due）が無い */
function checkUndated(node: TaskNode, path: string): HealthFinding | null {
  if (hasDate(node)) return null
  return {
    ruleId: 'undated',
    globalKey: makeGlobalKey(path, node.id),
    path,
    line: node.lineNumber,
    message: `日付（@schedule / @due）が設定されていません: "${node.text}"`,
  }
}

/** Rule 2: 過去日付なのに未完（期限超過） */
function checkOverdue(node: TaskNode, path: string, todayStr: string): HealthFinding | null {
  const date = resolveDate(node)
  if (!date) return null
  if (date >= todayStr) return null
  return {
    ruleId: 'overdue',
    globalKey: makeGlobalKey(path, node.id),
    path,
    line: node.lineNumber,
    message: `期限超過（${date}）: "${node.text}"`,
  }
}

/** Rule 3: [>]（doing）のまま N 日以上放置（停滞） */
function checkStale(node: TaskNode, path: string, todayStr: string, staleDays: number): HealthFinding | null {
  if (node.status !== 'doing') return null
  if (!node.meta?.schedule) return null
  const startDate = scheduleStartDate(node.meta.schedule)
  if (!startDate) return null
  const start = DateTime.fromISO(startDate)
  if (!start.isValid) return null
  const today = DateTime.fromISO(todayStr)
  const elapsed = today.diff(start, 'days').days
  if (elapsed < staleDays) return null
  return {
    ruleId: 'stale',
    globalKey: makeGlobalKey(path, node.id),
    path,
    line: node.lineNumber,
    message: `doing のまま ${Math.floor(elapsed)} 日経過（閾値: ${staleDays} 日）: "${node.text}"`,
  }
}

/** Rule 4: @dependsOn の参照先が未解決 */
function checkUnresolvedDeps(
  node: TaskNode,
  path: string,
  allTexts: Map<string, 'done' | 'incomplete'>,
): HealthFinding[] {
  const deps = node.meta?.dependsOn
  if (!deps || deps.length === 0) return []
  const unresolved = deps.filter(dep => !allTexts.has(dep))
  if (unresolved.length === 0) return []
  return [{
    ruleId: 'unresolved-deps',
    globalKey: makeGlobalKey(path, node.id),
    path,
    line: node.lineNumber,
    message: `@dependsOn の参照先が見つかりません: ${unresolved.map(d => `"${d}"`).join(', ')} — タスク: "${node.text}"`,
  }]
}

/** Rule 5: 依存先がすべて完了し「着手可能」になったタスク */
function checkReadyTasks(
  node: TaskNode,
  path: string,
  allTexts: Map<string, 'done' | 'incomplete'>,
): HealthFinding | null {
  // todo/blocked のみ対象（doing はすでに着手済み）
  if (node.status !== 'todo' && node.status !== 'blocked' && node.status !== 'hold') return null
  const deps = node.meta?.dependsOn
  if (!deps || deps.length === 0) return null
  // 未解決依存があれば ready-tasks 判定をスキップ
  if (deps.some(dep => !allTexts.has(dep))) return null
  // すべての依存先が done
  const allDone = deps.every(dep => allTexts.get(dep) === 'done')
  if (!allDone) return null
  return {
    ruleId: 'ready-tasks',
    globalKey: makeGlobalKey(path, node.id),
    path,
    line: node.lineNumber,
    message: `依存先がすべて完了 — 着手可能になりました: "${node.text}"`,
  }
}

/** Rule 6: 形式不正なメタ（lintLine と同一基準） */
function checkMalformed(node: TaskNode, path: string): HealthFinding[] {
  const findings: HealthFinding[] = []
  const meta = node.meta
  if (!meta) return findings

  const check = (key: string, value: string): void => {
    const lineText = `  - @${key}: ${value}`
    const results = lintLine(lineText, 0)
    if (results.length > 0) {
      findings.push({
        ruleId: 'malformed',
        globalKey: makeGlobalKey(path, node.id),
        path,
        line: node.lineNumber,
        message: `メタ記法の形式不正 (@${key}: ${value}) — ${results[0].message}`,
      })
    }
  }

  if (meta.schedule !== undefined) check('schedule', meta.schedule)
  if (meta.due !== undefined) check('due', meta.due)

  return findings
}

// ----------------------------------------------------------------
// Public API
// ----------------------------------------------------------------

/**
 * 全ルールを実行して HealthFinding[] を返す。
 * today: 固定値で受け取る（テスト容易化）。
 * config: ルール ON/OFF と閾値。
 */
export function runHealthChecks(
  sources: SourceEntry[],
  today: DateTime,
  config: HealthConfig = DEFAULT_HEALTH_CONFIG,
): HealthFinding[] {
  const todayStr = today.toISODate()!
  const findings: HealthFinding[] = []

  const allIncomplete = collectAllIncomplete(sources)
  const allTexts = buildAllTaskTexts(sources)

  for (const { node, path } of allIncomplete) {
    if (config.rules.undated) {
      const f = checkUndated(node, path)
      if (f) findings.push(f)
    }
    if (config.rules.overdue) {
      const f = checkOverdue(node, path, todayStr)
      if (f) findings.push(f)
    }
    if (config.rules.stale) {
      const f = checkStale(node, path, todayStr, config.staleDays)
      if (f) findings.push(f)
    }
    if (config.rules.unresolvedDeps) {
      findings.push(...checkUnresolvedDeps(node, path, allTexts))
    }
    if (config.rules.readyTasks) {
      const f = checkReadyTasks(node, path, allTexts)
      if (f) findings.push(f)
    }
    if (config.rules.malformed) {
      findings.push(...checkMalformed(node, path))
    }
  }

  return findings
}
