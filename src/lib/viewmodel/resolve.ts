import type { AstIndex } from '../../sync/ast-index'
import type { Document, TaskNode } from '../parser/types'
import { findNodeById } from '../calendar/markdown-patch'
import { parseGlobalKey } from './global-key'

export type ResolvedRef = {
  filePath: string
  localId: string
  node: TaskNode
}

/** globalKey から該当ファイルのノードを解決する。見つからない場合は undefined。 */
export function resolveRef(index: AstIndex, globalKey: string): ResolvedRef | undefined {
  const { filePath, localId } = parseGlobalKey(globalKey)
  const doc = index.getDocument(filePath)
  if (!doc) return undefined
  const node = findNodeById(doc, localId)
  if (!node) return undefined
  return { filePath, localId, node }
}

/**
 * globalKey が示すファイルを読み取り、patcher を適用して書き戻す。
 * patcher は (markdown文字列, Document, TaskNode) → 新markdown文字列 を返す純粋関数。
 * 書き戻しは常に該当ファイルのみに作用し、他ファイルを変更しない。
 */
export async function patchInFile(
  index: AstIndex,
  globalKey: string,
  readFile: (filePath: string) => Promise<string>,
  writeFile: (filePath: string, content: string) => Promise<void>,
  patcher: (md: string, doc: Document, node: TaskNode) => string,
): Promise<void> {
  const { filePath, localId } = parseGlobalKey(globalKey)
  const doc = index.getDocument(filePath)
  if (!doc) return
  const node = findNodeById(doc, localId)
  if (!node) return
  const md = await readFile(filePath)
  const newMd = patcher(md, doc, node)
  if (newMd !== md) await writeFile(filePath, newMd)
}
