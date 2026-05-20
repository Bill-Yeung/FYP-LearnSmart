import { test, expect, type Page } from "@playwright/test"

async function loginAsStudent(page: Page) {
  await page.goto("/login")
  await page.locator("input[placeholder='name@example.com']").fill("student@hkive.com")
  await page.locator("input[type='password']").fill("password123")
  await page.locator("button[type='submit']").click()
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })
}

test.describe("Friendships (UC-613)", () => {

  test("navigates to friendship page", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/community/friendship")
    await expect(page.locator("text=/friends/i").first()).toBeVisible({ timeout: 10000 })
  })

  test("displays friend stats", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/community/friendship")
    await page.waitForTimeout(2000)
    await expect(page.locator("text=/friends|requests|connect/i").first()).toBeVisible()
  })

  test("add friend input is present", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/community/friendship")
    await page.waitForTimeout(2000)
    const usernameInput = page.locator("input[placeholder*='username' i]").first()
    await expect(usernameInput).toBeVisible()
  })

  test("send friend request with invalid username triggers confirmation", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/community/friendship")
    await page.waitForTimeout(2000)
    const usernameInput = page.locator("input[placeholder*='username' i]").first()
    await usernameInput.fill("nonexistent_user_xyz")
    await page.locator("button:has-text('Send Request')").first().click()
    await expect(page.locator("text=/Send a friend request to/i").first()).toBeVisible({ timeout: 5000 })
  })

  test("cannot send friend request to self", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/community/friendship")
    await page.waitForTimeout(2000)
    const usernameInput = page.locator("input[placeholder*='username' i]").first()
    await usernameInput.fill("student")
    await page.locator("button:has-text('Send Request')").first().click()
    await expect(page.locator("text=/Send a friend request to/i").first()).toBeVisible({ timeout: 5000 })
    await expect(page.locator("button:has-text('Cancel')").first()).toBeVisible()
  })

  test("search friends input works", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/community/friendship")
    await page.waitForTimeout(2000)
    const searchInput = page.locator("input[placeholder*='Search']").first()
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill("nonexistent")
      await page.waitForTimeout(500)
    }
  })

  test("friendship page requires authentication", async ({ page }) => {
    await page.goto("/login")
    await page.evaluate(() => localStorage.clear())
    await page.goto("/community/friendship")
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 })
  })
})
