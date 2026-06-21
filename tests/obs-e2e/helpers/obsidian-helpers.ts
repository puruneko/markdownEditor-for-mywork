import { browser } from '@wdio/globals'

/** Vault 内の Markdown ファイルを Obsidian API で開く。 */
export async function openFile(path: string): Promise<void> {
  await browser.execute((filePath: string) => {
    const app = (window as any).app
    const file = app.vault.getAbstractFileByPath(filePath)
    if (file) {
      void app.workspace.getLeaf(false).openFile(file)
    }
  }, path)
  await browser.pause(500)
}
