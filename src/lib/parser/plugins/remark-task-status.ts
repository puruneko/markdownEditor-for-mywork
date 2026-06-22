import type { Plugin } from 'unified'
import type { Root, ListItem, Paragraph } from 'mdast'
import { visit } from 'unist-util-visit'
import { toString } from 'mdast-util-to-string'
import type { Status } from '../types'

declare module 'mdast' {
  interface ListItemData {
    taskStatus?: Status | null
    taskText?: string
  }
}

const CUSTOM_MARKER_RE = /^\[([>!\-])\] ([\s\S]+)$/

function markerToStatus(marker: string): Status | null {
  if (marker === '>') return 'doing'
  if (marker === '!') return 'blocked'
  if (marker === '-') return 'hold'
  return null
}

const remarkTaskStatus: Plugin<[], Root> = () => (tree) => {
  visit(tree, 'listItem', (node: ListItem) => {
    node.data ??= {}

    if (node.checked === true) {
      node.data.taskStatus = 'done'
      return
    }
    if (node.checked === false) {
      node.data.taskStatus = 'todo'
      return
    }

    // checked === null: check for custom markers in first paragraph
    const firstPara = node.children.find((c): c is Paragraph => c.type === 'paragraph')
    if (!firstPara) {
      node.data.taskStatus = null
      return
    }

    const text = toString(firstPara)
    const match = text.match(CUSTOM_MARKER_RE)
    if (match) {
      node.data.taskStatus = markerToStatus(match[1])
      node.data.taskText = match[2]
    } else {
      node.data.taskStatus = null
    }
  })
}

export default remarkTaskStatus
