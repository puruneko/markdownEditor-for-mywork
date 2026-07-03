import { browser } from '@wdio/globals'
import * as path from 'path'
import * as fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SCREENSHOT_DIR = path.resolve(__dirname, '../screenshots')

/**
 * 現在の Obsidian ウィンドウ全体のスクリーンショットを保存する。
 * 「目視確認の証跡」用 — テスト成功時でも見た目を人間がレビューしたい箇所で呼ぶ。
 * 保存先: tests/obs-e2e/screenshots/<name>.png（.gitignore 済み）
 */
export async function captureView(name: string): Promise<string> {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
  const safe = name.replace(/[^\p{L}\p{N}_-]+/gu, '_')
  const file = path.join(SCREENSHOT_DIR, `${safe}.png`)
  await browser.saveScreenshot(file)
  return file
}
