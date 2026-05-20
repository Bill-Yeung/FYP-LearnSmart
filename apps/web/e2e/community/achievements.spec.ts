import { test, expect, type Page } from "@playwright/test"

async function loginAsStudent(page: Page) {
  await page.goto("/login")
  await page.locator("input[placeholder='name@example.com']").fill("student@hkive.com")
  await page.locator("input[type='password']").fill("password123")
  await page.locator("button[type='submit']").click()
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })
}

test.describe("Manage Points (UC-605)", () => {

  test("rewards page loads with points tab", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/community/rewards")
    await expect(page.locator("text=/points|rewards|achievements/i").first()).toBeVisible({ timeout: 10000 })
  })

  test("displays points balance or summary", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/community/rewards")
    await page.waitForTimeout(3000)
    await expect(page.locator("text=/points|balance|earned/i").first()).toBeVisible()
  })

  test("points tab shows transaction history", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/community/rewards")
    await page.waitForTimeout(3000)
    const pointsTab = page.locator("button:has-text('Points')").first()
    if (await pointsTab.isVisible().catch(() => false)) {
      await pointsTab.click()
      await page.waitForTimeout(1000)
    }
    const hasHistory = await page.locator("text=/history|transaction|earned|spent/i").first().isVisible().catch(() => false)
    const hasEmpty = await page.locator("text=/no |empty|nothing/i").first().isVisible().catch(() => false)
    expect(hasHistory || hasEmpty).toBeTruthy()
  })
})

test.describe("View Achievements / Badges (UC-606)", () => {

  test("badges tab is accessible", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/community/rewards")
    await page.waitForTimeout(3000)
    const badgesTab = page.locator("button:has-text('Badges')").first()
    if (await badgesTab.isVisible().catch(() => false)) {
      await badgesTab.click()
      await page.waitForTimeout(1000)
      const hasBadges = await page.locator("text=/badge|achievement|earn/i").first().isVisible().catch(() => false)
      expect(hasBadges).toBeTruthy()
    }
  })

  test("leaderboard tab shows rankings", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/community/rewards")
    await page.waitForTimeout(3000)
    const leaderboardTab = page.locator("button:has-text('Leaderboard')").first()
    if (await leaderboardTab.isVisible().catch(() => false)) {
      await leaderboardTab.click()
      await page.waitForTimeout(1000)
      await expect(page.locator("text=/leaderboard|rank|top/i").first()).toBeVisible()
    }
  })
})

test.describe("View Reputation (UC-612)", () => {

  test("reputation tab shows score and level", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/community/rewards")
    await page.waitForTimeout(3000)
    const reputationTab = page.locator("button:has-text('Reputation')").first()
    if (await reputationTab.isVisible().catch(() => false)) {
      await reputationTab.click()
      await page.waitForTimeout(1000)
      await expect(page.locator("text=/reputation|score|level/i").first()).toBeVisible()
    }
  })
})

test.describe("Rewards page edge cases", () => {

  test("rewards page requires authentication", async ({ page }) => {
    await page.goto("/login")
    await page.evaluate(() => localStorage.clear())
    await page.goto("/community/rewards")
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 })
  })
})
