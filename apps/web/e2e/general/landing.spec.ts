import { test, expect } from "@playwright/test"

test.describe("Landing Page", () => {

  test("loads landing page with app title", async ({ page }) => {
    await page.goto("/")
    await expect(page).toHaveTitle(/LearnSmart/)
  })

  test("displays hero section content", async ({ page }) => {
    await page.goto("/")
    await expect(page.getByRole("heading", { name: /Learn Smarter/i })).toBeVisible()
  })

  test("navigates to login page", async ({ page }) => {
    await page.goto("/")
    const loginLink = page.locator("a[href='/login'], button:has-text('Sign In'), button:has-text('Login'), a:has-text('Sign In'), a:has-text('Login')").first()
    await loginLink.click()
    await expect(page).toHaveURL(/\/login/)
  })

  test("features section is visible", async ({ page }) => {
    await page.goto("/")
    await expect(page.locator("text=Powerful Features")).toBeVisible()
  })
})
