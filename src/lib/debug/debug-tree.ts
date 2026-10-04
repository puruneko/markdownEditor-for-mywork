export type DebugKind =
  | 'map' | 'array' | 'object'
  | 'string' | 'number' | 'boolean' | 'null' | 'undefined'

export type DebugTreeNode = {
  key: string
  kind: DebugKind
  summary: string
  children?: DebugTreeNode[]
}

/** 任意の値をデバッグ表示用のツリーへ変換する（Map・配列・循環参照に対応）。 */
export function toDebugTree(value: unknown, key = 'root', seen: WeakSet<object> = new WeakSet()): DebugTreeNode {
  if (value === null) return { key, kind: 'null', summary: 'null' }
  if (value === undefined) return { key, kind: 'undefined', summary: 'undefined' }
  if (typeof value === 'string') return { key, kind: 'string', summary: JSON.stringify(value) }
  if (typeof value === 'number') return { key, kind: 'number', summary: String(value) }
  if (typeof value === 'boolean') return { key, kind: 'boolean', summary: String(value) }
  if (typeof value !== 'object') return { key, kind: 'string', summary: String(value) }

  if (seen.has(value)) return { key, kind: 'object', summary: '[Circular]' }
  seen.add(value)

  let node: DebugTreeNode
  if (value instanceof Map) {
    node = {
      key,
      kind: 'map',
      summary: `Map(${value.size})`,
      children: [...value.entries()].map(([k, v]) => toDebugTree(v, String(k), seen)),
    }
  } else if (Array.isArray(value)) {
    node = {
      key,
      kind: 'array',
      summary: `Array(${value.length})`,
      children: value.map((v, i) => toDebugTree(v, String(i), seen)),
    }
  } else {
    const entries = Object.entries(value as Record<string, unknown>)
    node = {
      key,
      kind: 'object',
      summary: `Object{${entries.length}}`,
      children: entries.map(([k, v]) => toDebugTree(v, k, seen)),
    }
  }
  seen.delete(value)
  return node
}
