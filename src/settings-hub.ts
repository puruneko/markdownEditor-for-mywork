import type { MdAstEditorPlugin } from './plugin'

/**
 * ビュー別の名前空間を持つ設定ハブ（issue-phase010-markdownEditor-005）。
 * `plugin.settings.viewSettings` の上に構築し、Obsidian の `data.json`
 * （`loadData`/`saveData`）を経由して各ビューの設定を保存・読込・配布する。
 *
 * `plugin.onload()` が `loadSettings()` で `this.settings` を同期的にメモリへ
 * 読み込み済みであることを前提とするため、`get()` は同期で値を返せる。
 * `set()` は `data.json` への保存を非同期・fire-and-forget で行う
 * （呼び出し元の各ビューの `StorageBackend.save()` 等が同期 API を要求するため）。
 */
export class ViewSettingsHub {
  constructor(private readonly plugin: MdAstEditorPlugin) {}

  /** namespace に保存済みの設定値を返す。未保存の場合は空オブジェクト。 */
  get<T extends object>(namespace: string): Partial<T> {
    return (this.plugin.settings.viewSettings[namespace] as Partial<T> | undefined) ?? {}
  }

  /** namespace の設定値を丸ごと置き換えて data.json へ保存する。 */
  set<T extends object>(namespace: string, data: T): void {
    this.plugin.settings.viewSettings[namespace] = data
    void this.plugin.saveSettings()
  }
}
