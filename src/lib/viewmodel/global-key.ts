// グローバルキー = sourcePath + '::' + localId
// パネル・クリック・書き戻しはすべてこのキーを経由する。

export function makeGlobalKey(filePath: string, localId: string): string {
  return `${filePath}::${localId}`
}

/** 最後の '::' で分割する（パスに '::' がない前提だが、念のため末尾優先）。 */
export function parseGlobalKey(globalKey: string): { filePath: string; localId: string } {
  const lastSep = globalKey.lastIndexOf('::')
  if (lastSep === -1) throw new Error(`無効な globalKey: ${globalKey}`)
  return {
    filePath: globalKey.slice(0, lastSep),
    localId: globalKey.slice(lastSep + 2),
  }
}
