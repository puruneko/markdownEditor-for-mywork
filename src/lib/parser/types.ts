export type Status = 'todo' | 'doing' | 'done' | 'blocked' | 'hold'

export type Meta = {
  schedule?: string
  due?: string
  priority?: number
  dependsOn?: string[]
  tags?: string[]
}

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

export type Section = {
  type: 'section'
  id: string
  depth: number
  title: string
  lineNumber: number         // 0-based absolute line index of heading; -1 for anonymous section
  parentSectionId?: string
  children: Node[]
  subSections: Section[]
}

export type Document = {
  type: 'document'
  sections: Section[]
  /** nodeId / sectionId → 0-based absolute line index。クリック→エディタカーソル移動に使用。 */
  nodeLineMap: Map<string, number>
}
