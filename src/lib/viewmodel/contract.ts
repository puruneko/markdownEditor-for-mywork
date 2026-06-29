import type { Document } from '../parser/types'

/** エディタ側からパネルへ渡す疎結合の継ぎ目となる型。 */

/** パネルへ渡す単一ソース（ファイルパスと解析済み Document のペア）。 */
export type SourceEntry = {
  path: string
  doc: Document
}

/**
 * パネルアイテムに付与する source タグ。
 * globalKey はパネルの {#each} キー・クリック・書き戻しで使う一意識別子。
 */
export type SourceTagged<T> = T & {
  sourcePath: string
  globalKey: string
}
