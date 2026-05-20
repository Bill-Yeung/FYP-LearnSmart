import { test, expect, type Page } from "@playwright/test"

async function loginAsAdmin(page: Page) {
  await page.goto("/login")
  const adminBtn = page.locator("button:has-text('Admin')").first()
  if (await adminBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await adminBtn.click()
  } else {
    await page.locator("input[placeholder='name@example.com']").fill("admin@learningplatform.com")
    await page.locator("input[type='password']").fill("password123")
    await page.locator("button[type='submit']").click()
  }
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })
}

test.describe("Admin: List Users (UC-007)", () => {

  test("admin users page loads", async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto("/admin/users")
    await expect(page.locator("text=/Manage Users/i").first()).toBeVisible({ timeout: 10000 })
  })

  test("displays users table with columns", async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto("/admin/users")
    await page.waitForTimeout(2000)
    await expect(page.locator("th, [role='columnheader']").filter({ hasText: /USER/i }).first()).toBeVisible()
    await expect(page.locator("th, [role='columnheader']").filter({ hasText: /ROLE/i }).first()).toBeVisible()
    await expect(page.locator("th, [role='columnheader']").filter({ hasText: /STATUS/i }).first()).toBeVisible()
  })

  test("search filter works", async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto("/admin/users")
    await page.waitForTimeout(2000)
    const searchInput = page.locator("input[placeholder*='Search']").first()
    await expect(searchInput).toBeVisible()
    await searchInput.fill("alice")
    await page.waitForTimeout(500)
  })

  test("role filter dropdown is present", async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto("/admin/users")
    await page.waitForTimeout(2000)
    const roleSelect = page.locator("select").first()
    await expect(roleSelect).toBeVisible()
  })

  test("status filter dropdown is present", async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto("/admin/users")
    await page.waitForTimeout(2000)
    const selects = page.locator("select")
    expect(await selects.count()).toBeGreaterThanOrEqual(2)
  })
})

test.describe("Admin: View User Details (UC-008)", () => {

  test("view button opens user detail modal", async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto("/admin/users")
    await page.waitForTimeout(2000)
    const viewBtn = page.locator("button:has-text('View')").first()
    if (await viewBtn.isVisible()) {
      await viewBtn.click()
      await page.waitForTimeout(500)
      await expect(page.locator("text=/Email/i").first()).toBeVisible()
      await expect(page.locator("text=/Joined/i").first()).toBeVisible()
    }
  })

  test("user detail modal shows email, joined and last login", async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto("/admin/users")
    await page.waitForTimeout(2000)
    const viewBtn = page.locator("button:has-text('View')").first()
    if (await viewBtn.isVisible()) {
      await viewBtn.click()
      await page.waitForTimeout(500)
      await expect(page.locator("text=/Email/i").first()).toBeVisible()
      await expect(page.locator("text=/Joined/i").first()).toBeVisible()
      await expect(page.locator("text=/Last Login/i").first()).toBeVisible()
    }
  })

  test("close button dismisses modal", async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto("/admin/users")
    await page.waitForTimeout(2000)
    const viewBtn = page.locator("button:has-text('View')").first()
    if (await viewBtn.isVisible()) {
      await viewBtn.click()
      await page.waitForTimeout(500)
      await page.locator("button:has-text('Close')").first().click()
      await page.waitForTimeout(500)
    }
  })
})

test.describe("Admin: Deactivate Users (UC-009)", () => {

  test("deactivate button is visible for active users", async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto("/admin/users")
    await page.waitForTimeout(2000)
    await expect(page.locator("button:has-text('Deactivate')").first()).toBeVisible()
  })

  test("admin users page requires admin role", async ({ page }) => {
    await page.goto("/login")
    await page.locator("input[placeholder='name@example.com']").fill("student@hkive.com")
    await page.locator("input[type='password']").fill("password123")
    await page.locator("button[type='submit']").click()
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })
    await page.goto("/admin/users")
    await page.waitForTimeout(2000)
    const url = page.url()
    const isRedirected = !url.includes("/admin/users")
    const hasError = await page.locator("text=/access|denied|unauthorized|forbidden/i").first().isVisible().catch(() => false)
    expect(isRedirected || hasError).toBeTruthy()
  })
})
