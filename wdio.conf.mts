import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

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
      args: ['--headless=new', '--disable-gpu', '--no-sandbox'],
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

  afterTest: async function (_test: unknown, _context: unknown, result: { passed: boolean }) {
    // テスト自体がパスした場合でも、コンソールにエラーがあればテスト失敗にする
    if (!result.passed) return

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
