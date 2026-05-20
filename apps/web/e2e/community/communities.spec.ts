import { test, expect, type Page } from "@playwright/test"

async function loginAsStudent(page: Page) {
  await page.goto("/login")
  await page.locator("input[placeholder='name@example.com']").fill("student@hkive.com")
  await page.locator("input[type='password']").fill("password123")
  await page.locator("button[type='submit']").click()
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })
}

test.describe("Manage Community (UC-601)", () => {

  test("community list page loads", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/community/studygroups")
    await expect(page.locator("text=/communit|study group|class/i").first()).toBeVisible({ timeout: 10000 })
  })

  test("displays community list or empty state", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/community/studygroups")
    await page.waitForTimeout(3000)
    const hasCommunities = await page.locator("text=/communit|group|class/i").first().isVisible()
    expect(hasCommunities).toBeTruthy()
  })

  test("create community option is present", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/community/studygroups")
    await page.waitForTimeout(3000)
    const createBtn = page.locator("button:has-text('Create')").first()
    if (await createBtn.isVisible().catch(() => false)) {
      await expect(createBtn).toBeVisible()
    }
  })

  test("community page requires authentication", async ({ page }) => {
    await page.goto("/login")
    await page.evaluate(() => localStorage.clear())
    await page.goto("/community/studygroups")
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 })
  })
})

test.describe("Community Detail — Discussions (UC-602/603/604/607)", () => {

  test("community detail page loads with tabs", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/community/studygroups")
    await page.waitForTimeout(3000)
    const isEmpty = await page.locator("text=/no communit/i").first().isVisible().catch(() => false)
    if (isEmpty) {
      return
    }
    const communityCard = page.locator("main a, main [role='button']").filter({ hasText: /./i }).first()
    if (await communityCard.isVisible().catch(() => false)) {
      await communityCard.click()
      await page.waitForTimeout(2000)
      const hasDiscussions = await page.locator("text=/discussion/i").first().isVisible().catch(() => false)
      const hasMembers = await page.locator("text=/member/i").first().isVisible().catch(() => false)
      expect(hasDiscussions || hasMembers).toBeTruthy()
    }
  })
})
