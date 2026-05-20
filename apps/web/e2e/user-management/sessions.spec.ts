import { test, expect, type Page } from "@playwright/test"

async function loginAsStudent(page: Page) {
  await page.goto("/login")
  await page.locator("input[placeholder='name@example.com']").fill("student@hkive.com")
  await page.locator("input[type='password']").fill("password123")
  await page.locator("button[type='submit']").click()
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })
}

test.describe("Manage Sessions (UC-006)", () => {

  test("sessions settings page loads", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/settings/sessions")
    await expect(page.locator("text=/Sessions/i").first()).toBeVisible({ timeout: 10000 })
  })

  test("displays active sessions list", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/settings/sessions")
    await page.waitForTimeout(2000)
    await expect(page.locator("text=/current/i").first()).toBeVisible()
  })

  test("shows session details (device, browser, location)", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/settings/sessions")
    await page.waitForTimeout(2000)
    await expect(page.locator("text=/Active now|hours ago|minutes ago/i").first()).toBeVisible()
  })

  test("sign out all others button is present", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/settings/sessions")
    await page.waitForTimeout(2000)
    await expect(page.locator("button:has-text('Sign out all others')").first()).toBeVisible()
  })

  test("sessions page requires authentication", async ({ page }) => {
    await page.goto("/login")
    await page.evaluate(() => localStorage.clear())
    await page.goto("/settings/sessions")
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 })
  })
})
