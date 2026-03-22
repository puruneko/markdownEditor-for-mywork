import { test, expect } from '@playwright/test'

// ----------------------------------------------------------------
// Tab UI — Gantt tab
// ----------------------------------------------------------------

test.describe('ガントチャートタブUI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.monaco-editor', { timeout: 10_000 })
  })

  test('初期表示でGanttタブが存在する', async ({ page }) => {
    const ganttTab = page.locator('button.tab-btn', { hasText: 'Gantt' })
    await expect(ganttTab).toBeVisible()
  })

  test('初期表示でGanttタブは非アクティブである', async ({ page }) => {
    const ganttTab = page.locator('button.tab-btn', { hasText: 'Gantt' })
    await expect(ganttTab).not.toHaveClass(/active/)
  })

  test('Ganttタブをクリックするとアクティブになる', async ({ page }) => {
    const ganttTab = page.locator('button.tab-btn', { hasText: 'Gantt' })
    await ganttTab.click()
    await expect(ganttTab).toHaveClass(/active/)
  })

  test('ASTタブクリックで戻るとMonacoが再表示される', async ({ page }) => {
    const ganttTab = page.locator('button.tab-btn', { hasText: 'Gantt' })
    const astTab = page.locator('button.tab-btn', { hasText: 'AST' })
    await ganttTab.click()
    await astTab.click()
    await expect(page.locator('.pane').last().locator('.monaco-editor')).toBeVisible()
  })
})

// ----------------------------------------------------------------
// Gantt display
// ----------------------------------------------------------------

test.describe('ガントチャート表示', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.monaco-editor', { timeout: 10_000 })
  })

  test('Ganttタブに切り替えるとガントチャートが表示される', async ({ page }) => {
    const ganttTab = page.locator('button.tab-btn', { hasText: 'Gantt' })
    await ganttTab.click()
    await expect(page.locator('.gantt-tab')).toBeVisible()
    // GanttChart renders a container element
    await page.waitForTimeout(500)
    await expect(page.locator('.gantt-tab')).toBeVisible()
  })
})

// ----------------------------------------------------------------
// No console errors on gantt tab
// ----------------------------------------------------------------

test.describe('コンソールエラーなし', () => {
  test('ガントチャートタブ表示時にJSエラーが発生しない', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', err => errors.push(err.message))

    await page.goto('/')
    await page.waitForSelector('.monaco-editor', { timeout: 10_000 })

    const ganttTab = page.locator('button.tab-btn', { hasText: 'Gantt' })
    await ganttTab.click()

    await page.waitForTimeout(1000)

    const criticalErrors = errors.filter(e =>
      !e.includes('monaco') &&
      !e.includes('worker') &&
      !e.includes('Cannot use import')
    )
    expect(criticalErrors).toHaveLength(0)
  })
})
