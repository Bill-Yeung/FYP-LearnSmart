import { test, expect } from "@playwright/test"

async function loginAsStudent(page: import("@playwright/test").Page) {
  await page.goto("/login")
  await page.locator("input[placeholder='name@example.com']").fill("student@hkive.com")
  await page.locator("input[type='password']").fill("password123")
  await page.locator("button[type='submit']").click()
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })
}

test.describe("Dashboard", () => {

  test("dashboard loads after login", async ({ page }) => {
    await loginAsStudent(page)
    await expect(page.locator("body")).toContainText(/dashboard|welcome|learning/i)
  })

  test("sidebar navigation is visible", async ({ page }) => {
    await loginAsStudent(page)
    await expect(page.locator("text=/knowledge|documents|flashcards/i").first()).toBeVisible()
  })

  test("unauthenticated users are redirected from dashboard", async ({ page }) => {
    await page.goto("/login")
    await page.evaluate(() => localStorage.clear())
    await page.goto("/dashboard")
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 })
  })
})
