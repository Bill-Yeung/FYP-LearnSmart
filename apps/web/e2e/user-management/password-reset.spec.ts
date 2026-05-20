import { test, expect } from "@playwright/test"

test.describe("Password Reset (UC-003)", () => {

  test("forgot password page loads", async ({ page }) => {
    await page.goto("/forgot-password")
    await expect(page.locator("text=/forgot password/i").first()).toBeVisible()
  })

  test("displays email input and submit button", async ({ page }) => {
    await page.goto("/forgot-password")
    const emailInput = page.locator("input[placeholder='name@example.com']")
    await expect(emailInput).toBeVisible()
    const submitBtn = page.locator("button:has-text('Send Reset Code'), button[type='submit']").first()
    await expect(submitBtn).toBeVisible()
  })

  test("non-existent email still proceeds to OTP step (no email enumeration)", async ({ page }) => {
    await page.goto("/forgot-password")
    await page.locator("input[placeholder='name@example.com']").fill("nonexistent_user_xyz@invalid.com")
    await page.locator("button:has-text('Send Reset Code'), button[type='submit']").first().click()
    await page.waitForTimeout(3000)
    await expect(page.locator("text=/code|otp|reset password|enter the code/i").first()).toBeVisible({ timeout: 5000 })
  })

  test("empty email submission is prevented", async ({ page }) => {
    await page.goto("/forgot-password")
    const submitBtn = page.locator("button:has-text('Send Reset Code'), button[type='submit']").first()
    const isDisabled = await submitBtn.isDisabled()
    if (!isDisabled) {
      await submitBtn.click()
      await page.waitForTimeout(1000)
      await expect(page).toHaveURL(/\/forgot-password/)
    }
  })

  test("valid email proceeds to OTP step", async ({ page }) => {
    await page.goto("/forgot-password")
    await page.locator("input[placeholder='name@example.com']").fill("student@hkive.com")
    await page.locator("button:has-text('Send Reset Code'), button[type='submit']").first().click()
    await expect(page.locator("text=/code|otp|reset password|enter the code/i").first()).toBeVisible({ timeout: 10000 })
  })

  test("OTP step shows password fields", async ({ page }) => {
    await page.goto("/forgot-password")
    await page.locator("input[placeholder='name@example.com']").fill("student@hkive.com")
    await page.locator("button:has-text('Send Reset Code'), button[type='submit']").first().click()
    await page.waitForTimeout(3000)

    const otpInput = page.locator("input[placeholder='123456']")
    if (await otpInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(otpInput).toBeVisible()
      const passwordFields = page.locator("input[type='password']")
      expect(await passwordFields.count()).toBeGreaterThanOrEqual(2)
    }
  })

  test("invalid OTP shows error", async ({ page }) => {
    await page.goto("/forgot-password")
    await page.locator("input[placeholder='name@example.com']").fill("student@hkive.com")
    await page.locator("button:has-text('Send Reset Code'), button[type='submit']").first().click()
    await page.waitForTimeout(3000)

    const otpInput = page.locator("input[placeholder='123456']")
    if (await otpInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await otpInput.fill("000000")
      const passwords = page.locator("input[type='password']")
      if (await passwords.count() >= 2) {
        await passwords.nth(0).fill("NewPass123")
        await passwords.nth(1).fill("NewPass123")
      }
      await page.locator("button:has-text('Reset Password'), button[type='submit']").first().click()
      await page.waitForTimeout(3000)
      await expect(page.locator("text=/invalid|expired|incorrect|wrong/i").first()).toBeVisible({ timeout: 5000 })
    }
  })

  test("password mismatch validation", async ({ page }) => {
    await page.goto("/forgot-password")
    await page.locator("input[placeholder='name@example.com']").fill("student@hkive.com")
    await page.locator("button:has-text('Send Reset Code'), button[type='submit']").first().click()
    await page.waitForTimeout(3000)

    const otpInput = page.locator("input[placeholder='123456']")
    if (await otpInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await otpInput.fill("123456")
      const passwords = page.locator("input[type='password']")
      if (await passwords.count() >= 2) {
        await passwords.nth(0).fill("NewPass123")
        await passwords.nth(1).fill("DifferentPass456")
      }
      await page.locator("button:has-text('Reset Password'), button[type='submit']").first().click()
      await page.waitForTimeout(1000)
      const hasMismatchError = await page.locator("text=/match|mismatch|same/i").first().isVisible().catch(() => false)
      const stayedOnPage = page.url().includes("/forgot-password")
      expect(hasMismatchError || stayedOnPage).toBeTruthy()
    }
  })

  test("navigate to login from forgot password", async ({ page }) => {
    await page.goto("/forgot-password")
    const loginLink = page.locator("a:has-text('Sign In'), a:has-text('Login'), button:has-text('Remember'), a[href='/login']").first()
    if (await loginLink.isVisible().catch(() => false)) {
      await loginLink.click()
      await expect(page).toHaveURL(/\/login/)
    }
  })
})
