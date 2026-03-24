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
}
