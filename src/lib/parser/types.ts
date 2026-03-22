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
  parentSectionId?: string
  children: Node[]
  subSections: Section[]
}

export type Document = {
  type: 'document'
  sections: Section[]
}
