import type { Status, Meta } from '../contract/canonical'
export type { Status, Meta }

export type TaskNode = {
  type: 'task'
  id: string
  text: string
  status: Status
  children: Node[]
  parentId?: string
  meta?: Meta
  lineNumber: number         // 0-based absolute line index in source markdown
  // Derived
  hasTaskDescendant: boolean // true if any descendant is a task (self excluded)
  isGroup: boolean           // hasTaskDescendant && children.length > 0
  isLeafTask: boolean        // children.length === 0
  isMemo: false
  depth: number
  path: string[]
}

export type ListNode = {
  type: 'list'
  id: string
  text: string
  children: Node[]
  parentId?: string
  meta?: Meta
  lineNumber: number         // 0-based absolute line index in source markdown
  // Derived
  hasTaskDescendant: boolean
  isGroup: boolean
  isMemo: boolean
  depth: number
  path: string[]
}

export type QuoteNode = {
  type: 'quote'
  id: string
  raw: string
  parentId?: string
  lineNumber: number         // 0-based absolute line index of first quote line
  hasTaskDescendant: false
  isGroup: false
  isMemo: true
}

export type Node = TaskNode | ListNode | QuoteNode

/**
 * issue-phase010-markdownEditor-006: 見出し直下のトップレベルメタ用。`Meta` と同じキー集合・
 * 同じ解析規則を使うが、`close` は Section の場合 `Section.close`（真偽値の専用フィールド）
 * に昇格させるため、`SectionMeta` には含めない。
 */
export type SectionMeta = Omit<Meta, 'close'>

export type Section = {
  type: 'section'
  id: string
  depth: number
  title: string
  lineNumber: number         // 0-based absolute line index of heading; -1 for anonymous section
  parentSectionId?: string
  children: Node[]
  subSections: Section[]
  /**
   * issue-phase010-markdownEditor-006: 案件（Section）がクローズしているかどうか。
   * 見出しタイトル末尾の `#close` タグ、または見出し直下のトップレベルメタ `@close` の
   * いずれかがあれば true。パース結果からの除外は行わない（常に存在する必須フィールド）。
   */
  close: boolean
  /** 見出し直下のトップレベルメタ（`close` を除く）。1個も無い場合はキー自体が存在しない。 */
  meta?: SectionMeta
}

export type Document = {
  type: 'document'
  sections: Section[]
  /** nodeId / sectionId → 0-based absolute line index。クリック→エディタカーソル移動に使用。 */
  nodeLineMap: Map<string, number>
}
