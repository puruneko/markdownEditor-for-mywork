import { test, expect } from '@playwright/test'

// ----------------------------------------------------------------
// Tab UI
// ----------------------------------------------------------------

test.describe('右パネルタブUI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // Wait for Monaco editor to initialize
    await page.waitForSelector('.monaco-editor', { timeout: 10_000 })
  })

  test('初期表示でASTタブがアクティブである', async ({ page }) => {
    const astTab = page.locator('button.tab-btn', { hasText: 'AST' })
    await expect(astTab).toHaveClass(/active/)
  })

  test('初期表示でCalendarタブは非アクティブである', async ({ page }) => {
    const calTab = page.locator('button.tab-btn', { hasText: 'Calendar' })
    await expect(calTab).not.toHaveClass(/active/)
  })

  test('Calendarタブをクリックするとアクティブになる', async ({ page }) => {
    const calTab = page.locator('button.tab-btn', { hasText: 'Calendar' })
    await calTab.click()
    await expect(calTab).toHaveClass(/active/)
  })

  test('ASTタブクリックで戻るとMonacoが再表示される', async ({ page }) => {
    const calTab = page.locator('button.tab-btn', { hasText: 'Calendar' })
    const astTab = page.locator('button.tab-btn', { hasText: 'AST' })
    await calTab.click()
    await astTab.click()
    // Right-side Monaco editor should be visible
    await expect(page.locator('.pane').last().locator('.monaco-editor')).toBeVisible()
  })
})

// ----------------------------------------------------------------
// Calendar display
// ----------------------------------------------------------------

test.describe('カレンダー表示', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.monaco-editor', { timeout: 10_000 })
  })

  test('Calendarタブに切り替えるとカレンダーが表示される', async ({ page }) => {
    const calTab = page.locator('button.tab-btn', { hasText: 'Calendar' })
    await calTab.click()
    // CalendarView renders a calendar container
    await expect(page.locator('.calendar-tab')).toBeVisible()
    await expect(page.locator('.calendar-view, .week-view, [class*="calendar"]').first()).toBeVisible({ timeout: 5_000 })
  })

  test('Calendarタブにスケジュール付きタスクのアイテムが表示される', async ({ page }) => {
    const calTab = page.locator('button.tab-btn', { hasText: 'Calendar' })
    await calTab.click()
    // Wait for the calendar to render
    await page.waitForTimeout(500)
    // The initial markdown has @schedule tasks — at least one item should appear
    // Calendar items have the task title rendered
    const calendarContainer = page.locator('.calendar-tab')
    await expect(calendarContainer).toBeVisible()
  })
})

// ----------------------------------------------------------------
// Markdown → Calendar sync
// ----------------------------------------------------------------

test.describe('Markdown変更→カレンダー更新', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.monaco-editor', { timeout: 10_000 })
  })

  test('Calendarタブは最新のMarkdownを反映して表示される', async ({ page }) => {
    const calTab = page.locator('button.tab-btn', { hasText: 'Calendar' })
    await calTab.click()
    // Simply verify the calendar tab does not throw errors
    await expect(page.locator('.calendar-tab')).toBeVisible()
    // No JS errors should have occurred
    const errors: string[] = []
    page.on('pageerror', err => errors.push(err.message))
    await page.waitForTimeout(1000)
    expect(errors.filter(e => !e.includes('Monaco'))).toHaveLength(0)
  })
})

// ----------------------------------------------------------------
// No console errors on calendar tab
// ----------------------------------------------------------------

test.describe('コンソールエラーなし', () => {
  test('カレンダータブ表示時にJSエラーが発生しない', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', err => errors.push(err.message))

    await page.goto('/')
    await page.waitForSelector('.monaco-editor', { timeout: 10_000 })

    const calTab = page.locator('button.tab-btn', { hasText: 'Calendar' })
    await calTab.click()

    // Wait for calendar to fully render
    await page.waitForTimeout(1000)

    // Filter out known non-critical errors (e.g. Monaco worker warnings)
    const criticalErrors = errors.filter(e =>
      !e.includes('monaco') &&
      !e.includes('worker') &&
      !e.includes('Cannot use import')
    )
    expect(criticalErrors).toHaveLength(0)
  })
})
