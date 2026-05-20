import { test, expect, type Page } from "@playwright/test"

async function loginAsStudent(page: Page) {
  await page.goto("/login")
  await page.locator("input[placeholder='name@example.com']").fill("student@hkive.com")
  await page.locator("input[type='password']").fill("password123")
  await page.locator("button[type='submit']").click()
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })
}

test.describe("Settings Page", () => {

  test("settings page loads with header and tabs", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/settings")
    await expect(page.locator("h1:has-text('Settings')")).toBeVisible({ timeout: 10000 })
    await expect(page.locator("text=/Manage your account preferences/i")).toBeVisible()
  })

  test("displays all five setting tabs", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/settings")
    await page.waitForTimeout(2000)
    await expect(page.locator("button:has-text('General')")).toBeVisible()
    await expect(page.locator("button:has-text('Sessions')")).toBeVisible()
    await expect(page.locator("button:has-text('Notifications')")).toBeVisible()
    await expect(page.locator("button:has-text('Privacy')")).toBeVisible()
    await expect(page.locator("button:has-text('Memorize')")).toBeVisible()
  })

  test("general tab shows appearance and account sections", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/settings")
    await page.waitForTimeout(2000)
    await expect(page.locator("text=/Appearance/i").first()).toBeVisible()
    await expect(page.locator("text=/Account/i").first()).toBeVisible()
    await expect(page.locator("text=/Color Scheme/i").first()).toBeVisible()
  })

  test("can navigate between tabs", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/settings")
    await page.waitForTimeout(2000)

    await page.locator("button:has-text('Sessions')").click()
    await page.waitForTimeout(500)
    await expect(page.locator("text=/Active Sessions/i").first()).toBeVisible()

    await page.locator("button:has-text('Notifications')").click()
    await page.waitForTimeout(500)
    await expect(page.locator("text=/Notification Preferences/i").first()).toBeVisible()

    await page.locator("button:has-text('Privacy')").click()
    await page.waitForTimeout(500)
    await expect(page.locator("text=/Privacy Settings/i").first()).toBeVisible()
  })

  test("theme toggle buttons are present", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/settings")
    await page.waitForTimeout(2000)
    await expect(page.locator("button:has-text('Light')").first()).toBeVisible()
    await expect(page.locator("button:has-text('Dark')").first()).toBeVisible()
  })

  test("sessions tab shows current session with badge", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/settings")
    await page.waitForTimeout(2000)
    await page.locator("button:has-text('Sessions')").click()
    await page.waitForTimeout(1000)
    await expect(page.locator("text=/Active Sessions/i").first()).toBeVisible()
    await expect(page.locator("text=/Current/i").first()).toBeVisible()
  })

  test("notifications tab shows toggle settings", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/settings")
    await page.waitForTimeout(2000)
    await page.locator("button:has-text('Notifications')").click()
    await page.waitForTimeout(500)
    await expect(page.locator("text=/Email Notifications/i").first()).toBeVisible()
    await expect(page.locator("text=/Push Notifications/i").first()).toBeVisible()
    await expect(page.locator("text=/Study Reminders/i").first()).toBeVisible()
    await expect(page.locator("text=/Community Updates/i").first()).toBeVisible()
  })

  test("settings page requires authentication", async ({ page }) => {
    await page.goto("/login")
    await page.evaluate(() => localStorage.clear())
    await page.goto("/settings")
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 })
  })
})
