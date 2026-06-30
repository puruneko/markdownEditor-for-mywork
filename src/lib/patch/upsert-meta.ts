import type { TaskNode } from '../parser/types'

function getIndent(line: string): number {
  return line.length - line.trimStart().length
}

/**
 * タスク子領域に @schedule または @due メタを挿入または置換する（upsert）。
 *
 * アルゴリズム:
 * 1. node.lineNumber でタスク行を特定し、そのインデント幅を得る。
 * 2. 子の領域 = 直後から「インデントが対象行以下の行が現れる直前」まで（空行はスキップ）。
 * 3. 子領域に既存の同種メタがあれば最初のものを置換。なければ子領域末尾に挿入。
 * 4. 挿入行のインデントは「対象タスク + 2スペース」。
 * 複数 @schedule が存在する場合は最初のものを上書きする。
 */
export function upsertMeta(
  md: string,
  node: TaskNode,
  metaKey: 'schedule' | 'due',
  metaValue: string,
): string {
  const lines = md.split('\n')
  const taskIdx = node.lineNumber
  if (taskIdx < 0 || taskIdx >= lines.length) return md

  const taskIndent = getIndent(lines[taskIdx])
  const childIndent = taskIndent + 2
  const metaPrefix = `- @${metaKey}:`

  let firstExistingIdx = -1
  let insertIdx = taskIdx + 1

  for (let i = taskIdx + 1; i < lines.length; i++) {
    const line = lines[i]
    if (line.trim() === '') continue
    const lineIndent = getIndent(line)
    if (lineIndent <= taskIndent) break
    insertIdx = i + 1
    if (firstExistingIdx === -1 && line.trimStart().startsWith(metaPrefix)) {
      firstExistingIdx = i
    }
  }

  const newMetaLine = ' '.repeat(childIndent) + `${metaPrefix} ${metaValue}`

  if (firstExistingIdx !== -1) {
    lines[firstExistingIdx] = newMetaLine
  } else {
    lines.splice(insertIdx, 0, newMetaLine)
  }

  return lines.join('\n')
}

export function upsertSchedule(md: string, node: TaskNode, scheduleValue: string): string {
  return upsertMeta(md, node, 'schedule', scheduleValue)
}

export function upsertDue(md: string, node: TaskNode, dueValue: string): string {
  return upsertMeta(md, node, 'due', dueValue)
}
