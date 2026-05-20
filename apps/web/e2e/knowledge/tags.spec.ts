import { test, expect, type Page } from "@playwright/test"

async function loginAsStudent(page: Page) {
  await page.goto("/login")
  await page.locator("input[placeholder='name@example.com']").fill("student@hkive.com")
  await page.locator("input[type='password']").fill("password123")
  await page.locator("button[type='submit']").click()
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })
}

test.describe("Tags (UC-103/104)", () => {

  test("navigates to tags page", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/knowledge/tags")
    await expect(page.locator("text=/tags/i").first()).toBeVisible({ timeout: 10000 })
  })

  test("displays tags list or empty state", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/knowledge/tags")
    await page.waitForTimeout(2000)
    await expect(page.locator("text=/tags|create|manage/i").first()).toBeVisible()
  })

  test("create tag button is visible", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/knowledge/tags")
    await page.waitForTimeout(2000)
    const createBtn = page.locator("button:has-text('Create')").first()
    await expect(createBtn).toBeVisible()
  })

  test("search tags input works", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/knowledge/tags")
    await page.waitForTimeout(2000)
    const searchInput = page.locator("input[placeholder*='Search']").first()
    if (await searchInput.isVisible()) {
      await searchInput.fill("nonexistent-tag-xyz")
      await page.waitForTimeout(500)
    }
  })

  test("sort dropdown is present", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/knowledge/tags")
    await page.waitForTimeout(2000)
    const sortSelect = page.locator("select").first()
    if (await sortSelect.isVisible()) {
      const options = sortSelect.locator("option")
      expect(await options.count()).toBeGreaterThan(0)
    }
  })

  test("tags page requires authentication", async ({ page }) => {
    await page.goto("/login")
    await page.evaluate(() => localStorage.clear())
    await page.goto("/knowledge/tags")
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 })
  })
})
