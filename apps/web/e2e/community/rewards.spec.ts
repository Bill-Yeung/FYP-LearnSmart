import { test, expect, type Page } from "@playwright/test"

async function loginAsStudent(page: Page) {
  await page.goto("/login")
  await page.locator("input[placeholder='name@example.com']").fill("student@hkive.com")
  await page.locator("input[type='password']").fill("password123")
  await page.locator("button[type='submit']").click()
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })
}

test.describe("Rewards Page (UC-605/606/612)", () => {

  test("rewards page loads with heading", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/community/rewards")
    await expect(page.locator("h1:has-text('Rewards & Achievements')")).toBeVisible({ timeout: 10000 })
    await expect(page.locator("text=/Earn points, collect badges/i").first()).toBeVisible()
  })

  test("displays stats summary cards", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/community/rewards")
    await page.waitForTimeout(3000)
    await expect(page.locator("text=/Balance/i").first()).toBeVisible()
    await expect(page.locator("text=/Badges/i").first()).toBeVisible()
    await expect(page.locator("text=/Level/i").first()).toBeVisible()
  })

  test("displays tab navigation with all tabs", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/community/rewards")
    await page.waitForTimeout(3000)
    await expect(page.locator("button:has-text('Points & Shop')").first()).toBeVisible()
    await expect(page.locator("button:has-text('Badges')").first()).toBeVisible()
    await expect(page.locator("button:has-text('Leaderboard')").first()).toBeVisible()
    await expect(page.locator("button:has-text('Reputation')").first()).toBeVisible()
  })

  test("can switch to badges tab", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/community/rewards")
    await page.waitForTimeout(3000)
    await page.locator("button:has-text('Badges')").first().click()
    await page.waitForTimeout(1000)
    const hasBadges = await page.locator("text=/badge|achievement|earn|locked/i").first().isVisible().catch(() => false)
    expect(hasBadges).toBeTruthy()
  })

  test("can switch to leaderboard tab", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/community/rewards")
    await page.waitForTimeout(3000)
    await page.locator("button:has-text('Leaderboard')").first().click()
    await page.waitForTimeout(1000)
    await expect(page.locator("text=/leaderboard|rank|top/i").first()).toBeVisible()
  })

  test("rewards page requires authentication", async ({ page }) => {
    await page.goto("/login")
    await page.evaluate(() => localStorage.clear())
    await page.goto("/community/rewards")
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 })
  })
})
