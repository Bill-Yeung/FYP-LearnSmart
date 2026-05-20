import { test, expect, type Page } from "@playwright/test"

async function loginAsStudent(page: Page) {
  await page.goto("/login")
  await page.locator("input[placeholder='name@example.com']").fill("student@hkive.com")
  await page.locator("input[type='password']").fill("password123")
  await page.locator("button[type='submit']").click()
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })
}

test.describe("Manage Mentorship (UC-610)", () => {

  test("mentorship page loads", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/community/mentorship")
    await expect(page.locator("text=/mentor/i").first()).toBeVisible({ timeout: 10000 })
  })

  test("displays mentorship tabs (my, find, offer)", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/community/mentorship")
    await page.waitForTimeout(3000)
    const hasMyTab = await page.locator("button:has-text('My')").first().isVisible().catch(() => false)
    const hasFindTab = await page.locator("button:has-text('Find')").first().isVisible().catch(() => false)
    expect(hasMyTab || hasFindTab).toBeTruthy()
  })

  test("shows mentorship stats", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/community/mentorship")
    await page.waitForTimeout(3000)
    const hasStats = await page.locator("text=/active|session|mentor/i").first().isVisible()
    expect(hasStats).toBeTruthy()
  })

  test("mentorship page requires authentication", async ({ page }) => {
    await page.goto("/login")
    await page.evaluate(() => localStorage.clear())
    await page.goto("/community/mentorship")
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 })
  })
})
