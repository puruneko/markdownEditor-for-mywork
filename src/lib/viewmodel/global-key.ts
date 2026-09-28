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

/**
 * `@repeat` オカレンス展開で付与された末尾の `__r<数字>` を除去する。
 * 遷移経路（`ShadowItemView.navigateToNode`）専用。書き戻し経路では使用しないこと
 * （DEC-03: `parseGlobalKey` 自体の意味は変更しない。書き戻しはオカレンスIDを明示的に拒否する）。
 */
export function stripOccurrenceSuffix(localId: string): string {
  return localId.replace(/__r\d+$/, '')
}

/**
 * calendar 側で `@due` のみを持つタスクを期限項目として投影する際に付与した
 * 末尾の `__due` サフィックスを除去する（issue-phase012-markdownEditor-003）。
 * `@repeat` のオカレンスID（`__r<数字>`）とは無関係の別の接尾辞であり、
 * `stripOccurrenceSuffix` では除去できないため、専用の関数として用意する。
 */
export function stripDueSuffix(localId: string): string {
  return localId.replace(/__due$/, '')
}
