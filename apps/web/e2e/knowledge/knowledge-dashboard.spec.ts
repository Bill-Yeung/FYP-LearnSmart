import { test, expect, type Page } from "@playwright/test"

async function loginAsStudent(page: Page) {
  await page.goto("/login")
  await page.locator("input[placeholder='name@example.com']").fill("student@hkive.com")
  await page.locator("input[type='password']").fill("password123")
  await page.locator("button[type='submit']").click()
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })
}

test.describe("Knowledge Dashboard", () => {

  test("dashboard page loads with heading", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/knowledge/dashboard")
    await expect(page.locator("h1:has-text('Knowledge Dashboard')")).toBeVisible({ timeout: 10000 })
    await expect(page.locator("text=/Monitor your document processing/i").first()).toBeVisible()
  })

  test("displays processing stats cards", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/knowledge/dashboard")
    await page.waitForTimeout(3000)
    await expect(page.locator("text=/Pending/i").first()).toBeVisible()
    await expect(page.locator("text=/Completed/i").first()).toBeVisible()
  })

  test("displays failed documents section", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/knowledge/dashboard")
    await page.waitForTimeout(3000)
    await expect(page.locator("text=/Failed Documents/i").first()).toBeVisible()
    const content = page.locator("text=/No failed documents|Retry/i").first()
    await expect(content).toBeVisible()
  })

  test("displays recent activities section", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/knowledge/dashboard")
    await page.waitForTimeout(3000)
    await expect(page.locator("text=/Recent Activities/i").first()).toBeVisible()
    const content = page.locator("text=/No recent activity|ago/i").first()
    await expect(content).toBeVisible()
  })

  test("knowledge dashboard requires authentication", async ({ page }) => {
    await page.goto("/login")
    await page.evaluate(() => localStorage.clear())
    await page.goto("/knowledge/dashboard")
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 })
  })
})
