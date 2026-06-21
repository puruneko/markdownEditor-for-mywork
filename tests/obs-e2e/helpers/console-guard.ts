import { browser } from '@wdio/globals'

const WARNING_ERROR_PATTERNS = [
  /ReferenceError/,
  /TypeError/,
  /Invalid CalendarItem/,
  /is not defined/,
  /Uncaught/,
]

/**
 * ブラウザコンソールにエラーが出力されていないことを検証する。
 * SEVERE レベルは全件拒否する。
 * WARNING レベルでも既知の問題パターンを拒否する。
 */
export async function assertNoConsoleErrors(): Promise<void> {
  const logs = await browser.getLogs('browser')
  const errors = logs.filter((log: { level: string; message: string }) => {
    if (log.level === 'SEVERE') return true
    if (log.level === 'WARNING') {
      return WARNING_ERROR_PATTERNS.some(p => p.test(log.message))
    }
    return false
  })

  if (errors.length > 0) {
    const messages = errors
      .map((e: { level: string; message: string }) => `  [${e.level}] ${e.message}`)
      .join('\n')
    throw new Error(`コンソールエラーを検出:\n${messages}`)
  }
}
