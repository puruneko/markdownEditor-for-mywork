import * as path from 'path'
import * as fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// OBS_E2E_HEADED=1 でヘッドレスを解除し、WSLg 上に Obsidian ウィンドウを表示する（目視デバッグ用）
const headed = !!process.env.OBS_E2E_HEADED

export const config: WebdriverIO.Config = {
  runner: 'local',
  framework: 'mocha',
  specs: ['./tests/obs-e2e/**/*.e2e.ts'],
  maxInstances: 1,

  capabilities: [{
    browserName: 'obsidian',
    browserVersion: 'latest',
    'wdio:obsidianOptions': {
      installerVersion: 'earliest',
      plugins: [path.resolve(__dirname, '.')],
      vault: path.resolve(__dirname, 'test/vaults/simple'),
    },
    'goog:chromeOptions': {
      args: headed
        ? ['--no-sandbox']
        : ['--headless=new', '--disable-gpu', '--no-sandbox'],
    },
  }],

  services: ['obsidian'],
  reporters: ['obsidian'],
  cacheDir: path.resolve(__dirname, '.obsidian-cache'),

  mochaOpts: {
    ui: 'bdd',
    timeout: 60000,
  },

  logLevel: 'warn',
  waitforTimeout: 10000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,

  afterTest: async function (test: { title?: string }, _context: unknown, result: { passed: boolean }) {
    // 失敗時はスクリーンショットを保存する（目視確認の証跡）
    if (!result.passed) {
      const dir = path.resolve(__dirname, 'tests/obs-e2e/screenshots')
      fs.mkdirSync(dir, { recursive: true })
      const name = (test?.title ?? 'unknown').replace(/[^\p{L}\p{N}_-]+/gu, '_').slice(0, 80)
      try {
        await (globalThis as any).browser.saveScreenshot(path.join(dir, `FAILED_${name}.png`))
      } catch { /* スクリーンショット失敗はテスト結果に影響させない */ }
      return
    }

    const logs = await (globalThis as any).browser.getLogs('browser')
    const WARNING_PATTERNS = [
      /ReferenceError/,
      /TypeError/,
      /Invalid CalendarItem/,
      /is not defined/,
      /Uncaught/,
    ]
    const errors = logs.filter((log: { level: string; message: string }) => {
      if (log.level === 'SEVERE') return true
      if (log.level === 'WARNING') {
        return WARNING_PATTERNS.some((p: RegExp) => p.test(log.message))
      }
      return false
    })
    if (errors.length > 0) {
      const messages = errors
        .map((e: { level: string; message: string }) => `  [${e.level}] ${e.message}`)
        .join('\n')
      throw new Error(`コンソールエラーを検出:\n${messages}`)
    }
  },
}
