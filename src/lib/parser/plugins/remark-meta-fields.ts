import type { Plugin } from 'unified'
import type { Root, ListItem, List, BlockContent } from 'mdast'
import { visit } from 'unist-util-visit'
import { toString } from 'mdast-util-to-string'
import type { Meta } from '../types'
import { META_KEYS } from '../meta-keys'
import { normalizeSchedule, normalizeDue } from '../schedule-normalize'

declare module 'mdast' {
  interface ListItemData {
    meta?: Partial<Meta>
  }
}

const META_LINE_RE = /^@(\w+):\s*(.*)$/

function applyMetaKey(meta: Partial<Meta>, key: string, value: string): void {
  switch (key) {
    case META_KEYS.schedule:
      meta.schedule = normalizeSchedule(value)
      break
    case META_KEYS.due:
      meta.due = normalizeDue(value)
      break
    case META_KEYS.priority:
      meta.priority = parseInt(value, 10)
      break
    case META_KEYS.dependsOn:
      meta.dependsOn = value.split(',').map(s => s.trim())
      break
    case META_KEYS.tags:
      meta.tags = value.split(',').map(s => s.trim())
      break
    case META_KEYS.repeat:
      meta.repeat = value.trim()
      break
  }
}

function extractMetaFromList(
  list: List,
  parentMeta: Partial<Meta>,
): { kept: ListItem[]; injected: BlockContent[][] } {
  const kept: ListItem[] = []
  const injected: BlockContent[][] = []

  for (const item of list.children) {
    const firstPara = item.children.find(c => c.type === 'paragraph')
    if (!firstPara) {
      kept.push(item)
      continue
    }
    const text = toString(firstPara)
    const match = text.match(META_LINE_RE)
    if (match) {
      applyMetaKey(parentMeta, match[1], match[2])
      // Re-inject any children the @meta item accidentally captured (mixed indent)
      const childBlocks = item.children.filter(c => c.type !== 'paragraph') as BlockContent[]
      if (childBlocks.length > 0) injected.push(childBlocks)
    } else {
      kept.push(item)
    }
  }

  return { kept, injected }
}

const remarkMetaFields: Plugin<[], Root> = () => (tree) => {
  visit(tree, 'listItem', (node: ListItem) => {
    const meta: Partial<Meta> = {}
    const reinjected: BlockContent[] = []
    const newChildren: typeof node.children = []

    for (const child of node.children) {
      if (child.type === 'list') {
        const { kept, injected } = extractMetaFromList(child as List, meta)
        if (kept.length > 0) {
          newChildren.push({ ...child, children: kept } as List)
        }
        for (const blocks of injected) {
          reinjected.push(...blocks)
        }
      } else {
        newChildren.push(child)
      }
    }

    // Append re-injected blocks (children of @meta items) into this node's children
    if (reinjected.length > 0) {
      newChildren.push(...reinjected)
    }

    node.children = newChildren
    if (Object.keys(meta).length > 0) {
      node.data ??= {}
      node.data.meta = meta
    }
  })
}

export default remarkMetaFields
