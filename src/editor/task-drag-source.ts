import { EditorView } from '@codemirror/view'
import type { Extension } from '@codemirror/state'
import type { Document } from '../lib/parser/types'

export const MD_TASK_MIME = 'application/x-md-task'

export interface TaskDragPayload {
  sourcePath: string
  line: number
  nodeId: string
}

export interface DragSourceState {
  sourcePath: string
  doc: Document
}

const TASK_LINE_RE = /^\s*- \[[ xX>!\-]\] /

/**
 * CM6 エディタをタスク行のドラッグ源にする Extension を生成する。
 * タスク行（- [x] ... 形式）で dragstart が起きたとき、
 * DataTransfer に MD_TASK_MIME ペイロードを追加する。
 * タスク以外の行（メモ/見出し/メタ行/引用）ではドラッグを設定しない。
 */
export function createTaskDragSourceExtension(
  getState: () => DragSourceState | null,
): Extension {
  return EditorView.domEventHandlers({
    dragstart(event, view) {
      if (!event.dataTransfer) return

      const state = getState()
      if (!state) return

      const selHead = view.state.selection.main.head
      const cmLine = view.state.doc.lineAt(selHead)

      if (!TASK_LINE_RE.test(cmLine.text)) return

      // CM6 は 1-based、nodeLineMap は 0-based
      const lineNum = cmLine.number - 1

      let nodeId: string | undefined
      for (const [id, ln] of state.doc.nodeLineMap) {
        if (ln === lineNum) { nodeId = id; break }
      }
      if (!nodeId) return

      const payload: TaskDragPayload = {
        sourcePath: state.sourcePath,
        line: lineNum,
        nodeId,
      }
      event.dataTransfer.setData(MD_TASK_MIME, JSON.stringify(payload))
    },
  })
}
