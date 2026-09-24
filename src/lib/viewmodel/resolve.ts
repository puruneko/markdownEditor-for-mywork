import type { AstIndex } from '../../sync/ast-index'
import type { Document, TaskNode } from '../parser/types'
import { findNodeById } from '../calendar/markdown-patch'
import { parseGlobalKey, stripOccurrenceSuffix } from './global-key'

export type ResolvedRef = {
  filePath: string
  localId: string
  node: TaskNode
}

/**
 * 書き戻し経路がオカレンスID（`__r<数字>` サフィックス付き localId）を検出したときに
 * 明示的に投げるエラー。DEC-03: `@repeat` の1オカレンスへの書き戻しはベースの `@schedule` を
 * 書き換えて全オカレンスを一斉にずらす「サイレントなデータ破壊」になるため、無言の undefined 返却
 * ではなく呼び出し元が判別できる形で拒否する。
 */
export class OccurrenceIdRejectedError extends Error {
  constructor(public readonly localId: string) {
    super(`書き戻しはオカレンスID付きのlocalIdを受け付けません: ${localId}`)
    this.name = 'OccurrenceIdRejectedError'
  }
}

function assertNotOccurrenceId(localId: string): void {
  if (stripOccurrenceSuffix(localId) !== localId) {
    throw new OccurrenceIdRejectedError(localId)
  }
}

/**
 * globalKey から該当ファイルのノードを解決する。見つからない場合は undefined。
 * localId がオカレンスID（`__r<数字>` 付き）の場合は `OccurrenceIdRejectedError` を投げる。
 */
export function resolveRef(index: AstIndex, globalKey: string): ResolvedRef | undefined {
  const { filePath, localId } = parseGlobalKey(globalKey)
  assertNotOccurrenceId(localId)
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
 * localId がオカレンスID（`__r<数字>` 付き）の場合は `OccurrenceIdRejectedError` を投げる。
 */
export async function patchInFile(
  index: AstIndex,
  globalKey: string,
  readFile: (filePath: string) => Promise<string>,
  writeFile: (filePath: string, content: string) => Promise<void>,
  patcher: (md: string, doc: Document, node: TaskNode) => string,
): Promise<void> {
  const { filePath, localId } = parseGlobalKey(globalKey)
  assertNotOccurrenceId(localId)
  const doc = index.getDocument(filePath)
  if (!doc) return
  const node = findNodeById(doc, localId)
  if (!node) return
  const md = await readFile(filePath)
  const newMd = patcher(md, doc, node)
  if (newMd !== md) await writeFile(filePath, newMd)
}
