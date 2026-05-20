import { test, expect, type Page } from "@playwright/test"

async function loginAsStudent(page: Page) {
  await page.goto("/login")
  await page.locator("input[placeholder='name@example.com']").fill("student@hkive.com")
  await page.locator("input[type='password']").fill("password123")
  await page.locator("button[type='submit']").click()
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })
}

test.describe("Processing Dashboard / View Processing Status (UC-102)", () => {

  test("knowledge dashboard page loads", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/knowledge/dashboard")
    await expect(page.locator("text=/Knowledge Dashboard/i").first()).toBeVisible({ timeout: 10000 })
  })

  test("displays processing status categories", async ({ page }) => {
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
  })

  test("displays recent activities section", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/knowledge/dashboard")
    await page.waitForTimeout(3000)
    await expect(page.locator("text=/Recent Activities/i").first()).toBeVisible()
  })

  test("processing dashboard requires authentication", async ({ page }) => {
    await page.goto("/login")
    await page.evaluate(() => localStorage.clear())
    await page.goto("/knowledge/dashboard")
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 })
  })
})
