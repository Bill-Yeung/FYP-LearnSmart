import { test, expect } from "@playwright/test"

test.describe("Authentication", () => {

  test("login page renders form", async ({ page }) => {
    await page.goto("/login")
    await expect(page.locator("input[placeholder='name@example.com']")).toBeVisible()
    await expect(page.locator("input[type='password']")).toBeVisible()
  })

  test("login with invalid credentials shows error", async ({ page }) => {
    await page.goto("/login")

    await page.locator("input[placeholder='name@example.com']").fill("wrong@example.com")
    await page.locator("input[type='password']").fill("wrongpassword")

    await page.locator("button[type='submit']").click()

    await expect(page).toHaveURL(/\/login/)
    await expect(page.locator(".text-red-700, .dark\\:text-red-200").first()).toBeVisible({ timeout: 10000 })
  })

  test("login with valid credentials redirects to dashboard", async ({ page }) => {
    await page.goto("/login")

    await page.locator("input[placeholder='name@example.com']").fill("student@hkive.com")
    await page.locator("input[type='password']").fill("password123")
    await page.locator("button[type='submit']").click()

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })
  })

  test("quick login buttons work", async ({ page }) => {
    await page.goto("/login")

    await page.locator("text=Quick demo login").locator("..").locator("button:has-text('Student')").click()

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })
  })

  test("OAuth buttons are present", async ({ page }) => {
    await page.goto("/login")
    await expect(page.locator("button:has-text('Google')").first()).toBeVisible()
    await expect(page.locator("button:has-text('GitHub')").first()).toBeVisible()
  })

  test("create account button navigates to register", async ({ page }) => {
    await page.goto("/login")
    await page.locator("button:has-text('Create account')").click()
    await expect(page).toHaveURL(/\/register/)
  })
})
