import { browser } from '@wdio/globals'

/** Vault 内の Markdown ファイルを Obsidian API で開き、アクティブになるまで待つ。 */
export async function openFile(path: string): Promise<void> {
  await browser.execute((filePath: string) => {
    const app = (window as any).app
    const file = app.vault.getAbstractFileByPath(filePath)
    if (file) {
      void app.workspace.getLeaf(false).openFile(file)
    }
  }, path)
  await browser.waitUntil(
    async () =>
      browser.execute((filePath: string) => {
        const app = (window as any).app
        return app.workspace.getActiveFile()?.path === filePath
      }, path),
    { timeout: 5000, interval: 200, timeoutMsg: `${path} がアクティブにならない` },
  )
}

/** Vault 内ファイルの内容を読む（存在しなければ null）。 */
export async function readVaultFile(path: string): Promise<string | null> {
  return browser.execute((filePath: string) => {
    const app = (window as any).app
    const file = app.vault.getAbstractFileByPath(filePath)
    return file ? app.vault.read(file) : null
  }, path)
}

/** Vault 内ファイルを作成または上書きする（動的フィクスチャ用。resetVault() で消える）。 */
export async function writeVaultFile(path: string, content: string): Promise<void> {
  await browser.execute(
    async (filePath: string, c: string) => {
      const app = (window as any).app
      const file = app.vault.getAbstractFileByPath(filePath)
      if (file) {
        await app.vault.modify(file, c)
      } else {
        // vault.create の戻り値（TFile）は循環参照を含みシリアライズできないため返さない
        await app.vault.create(filePath, c)
      }
      return null
    },
    path,
    content,
  )
}

/** ファイル内容が before から変化するまで待ち、変化後の内容を返す。 */
export async function waitForFileContentChange(
  path: string,
  before: string,
  timeout = 10000,
): Promise<string> {
  let latest = before
  await browser.waitUntil(
    async () => {
      const now = await readVaultFile(path)
      if (now !== null && now !== before) {
        latest = now
        return true
      }
      return false
    },
    { timeout, interval: 300, timeoutMsg: `${path} の内容が変化しない（書き戻し未実行の疑い）` },
  )
  return latest
}
