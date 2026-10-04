/**
 * issue-phase017-markdownEditor-for-mywork-006: ガントのツリーセル編集を Markdown 書き戻し用の patcher に変換する。
 */
import type { DateTime } from 'luxon'
import { formatSchedule, patchTaskTitle } from '../calendar/markdown-patch'
import { upsertSchedule, upsertPlan, upsertDue } from '../patch/upsert-meta'
import type { Document, TaskNode } from '../parser/types'

export interface TreeCellEditEvent {
  /** globalKey */
  nodeId: string
  key: 'name' | 'schedule' | 'plan' | 'due'
  value: string | DateTime | { start: DateTime; end: DateTime }
}

export type NodePatcher = (md: string, doc: Document, node: TaskNode) => string

const fmtDateTime = (dt: DateTime) => dt.toFormat("yyyy-MM-dd'T'HH:mm")

/** 日時値を日付系メタの文字列へ。範囲 → `start/end`、単一 → `start`。文字列はそのまま。 */
export function formatTreeCellDateValue(value: TreeCellEditEvent['value']): string {
  if (typeof value === 'string') return value
  if ('start' in value && 'end' in value) return formatSchedule(value.start, value.end)
  return fmtDateTime(value)
}

/** イベントの key に応じた patcher を返す。値の型が合わない場合は null。 */
export function buildTreeCellEditPatcher(event: TreeCellEditEvent): NodePatcher | null {
  const { key, value } = event
  if (key === 'name') {
    if (typeof value !== 'string') return null
    return (md, _doc, node) => patchTaskTitle(md, node.status, node.text, value)
  }
  const text = formatTreeCellDateValue(value)
  if (key === 'schedule') return (md, _doc, node) => upsertSchedule(md, node, text)
  if (key === 'plan') return (md, _doc, node) => upsertPlan(md, node, text)
  if (key === 'due') return (md, _doc, node) => upsertDue(md, node, text)
  return null
}

/** ツリー日時セルのピッカー初期値。start が null なら空、end が null なら単一、両方あれば期間。 */
export function formatTreeCellPickerInitialValue(start: DateTime | null, end: DateTime | null): string {
  if (!start) return ''
  if (!end) return fmtDateTime(start)
  return formatSchedule(start, end)
}
