import type { Plugin } from 'unified'
import type { Root, ListItem, List, Paragraph, BlockContent } from 'mdast'
import { visit } from 'unist-util-visit'
import { toString } from 'mdast-util-to-string'
import type { Meta } from '../types'
import { META_KEYS, normalizeMetaKey } from '../meta-keys'
import { normalizeSchedule, normalizeDue } from '../schedule-normalize'

declare module 'mdast' {
  interface ListItemData {
    meta?: Partial<Meta>
  }
}

// キー名の直後・コロンの前にのみ `?`（仮置き）を許す（issue-phase004-002）。
// `@schedule ?:` や `@?schedule:` はこの正規表現にマッチせず、既存の不正メタと同様に無視される。
// キー部分は Unicode 文字クラスで日本語キー（`@実施日時:` 等）にも対応する（issue-phase005-001 A-6）。
const META_LINE_RE = /^@([\p{L}\p{N}_]+)(\?)?:\s*(.*)$/u

/** 子リスト（複数行）を値に取れるメタキー（issue-phase005-001 C-1）。 */
const MULTI_VALUE_KEYS: ReadonlySet<string> = new Set([
  META_KEYS.condition,
  META_KEYS.purpose,
  META_KEYS.savepoint,
  META_KEYS.special_note,
])

function applyMetaKey(meta: Partial<Meta>, key: string, value: string, tentative: boolean): void {
  switch (key) {
    case META_KEYS.plan:
      meta.plan = normalizeSchedule(value)
      if (tentative) meta.tentative = { ...meta.tentative, plan: true }
      break
    case META_KEYS.schedule:
      meta.schedule = normalizeSchedule(value)
      if (tentative) meta.tentative = { ...meta.tentative, schedule: true }
      break
    case META_KEYS.due:
      meta.due = normalizeDue(value)
      if (tentative) meta.tentative = { ...meta.tentative, due: true }
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
    case META_KEYS.condition:
      meta.condition = value
      break
    case META_KEYS.purpose:
      meta.purpose = value
      break
    case META_KEYS.savepoint:
      meta.savepoint = value
      break
    case META_KEYS.special_note:
      meta.special_note = value
      break
    case META_KEYS.close:
      // issue-phase010-markdownEditor-006: 値の内容に関わらず、キーの存在自体が true を意味する。
      meta.close = true
      break
  }
}

/** リスト直下の子リストを string[] として読む（C-1: 複数行値）。空行は除外する。 */
function readChildListAsValues(item: ListItem): string[] {
  const childList = item.children.find((c): c is List => c.type === 'list')
  if (!childList) return []
  return childList.children
    .map(child => {
      const p = child.children.find((cc): cc is Paragraph => cc.type === 'paragraph')
      return p ? toString(p) : ''
    })
    .filter(v => v.length > 0)
}

/**
 * リスト項目のうち `- @key: value` 形式のメタ行を `parentMeta` へ畳み込み、
 * 残りを `kept` として返す。listItem の子リスト（ネストされたメタ）だけでなく、
 * 見出し直下のトップレベルリスト（Section メタ。issue-phase010-markdownEditor-006）
 * にも同じ抽出規則を適用するため export する（`src/lib/parser/mdast-to-sections.ts` から再利用）。
 */
export function extractMetaFromList(
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
      const rawKey = match[1]
      const tentative = !!match[2]
      const value = match[3]
      const canonicalKey = normalizeMetaKey(rawKey) ?? rawKey

      if (MULTI_VALUE_KEYS.has(canonicalKey) && value === '') {
        // C-1: 値が空 (`- @完了イメージ:`) かつ子リストがある場合、子リストの各項目を
        // string[] として読み、子リストは消費する（兄弟への付け替えを行わない）。
        const values = readChildListAsValues(item)
        if (values.length > 0) {
          ;(parentMeta as Record<string, unknown>)[canonicalKey] = values
          const otherChildBlocks = item.children.filter(
            c => c.type !== 'paragraph' && c.type !== 'list',
          ) as BlockContent[]
          if (otherChildBlocks.length > 0) injected.push(otherChildBlocks)
          continue
        }
      }

      applyMetaKey(parentMeta, canonicalKey, value, tentative)
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
