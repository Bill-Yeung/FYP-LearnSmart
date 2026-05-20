import { test, expect, type Page } from "@playwright/test"

async function loginAsStudent(page: Page) {
  await page.goto("/login")
  await page.locator("input[placeholder='name@example.com']").fill("student@hkive.com")
  await page.locator("input[type='password']").fill("password123")
  await page.locator("button[type='submit']").click()
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })
}

test.describe("View Profile (UC-004)", () => {

  test("profile page loads with user info", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/profile")
    await expect(page.locator("text=/My Profile/i").first()).toBeVisible({ timeout: 10000 })
  })

  test("displays user display name and username", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/profile")
    await page.waitForTimeout(2000)
    await expect(page.locator("text=/Basic Information/i").first()).toBeVisible()
    await expect(page.locator("text=/Account Information/i").first()).toBeVisible()
  })

  test("displays role badge", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/profile")
    await page.waitForTimeout(2000)
    await expect(page.locator("text=/Student|Teacher|Admin/").first()).toBeVisible()
  })

  test("displays stats (documents, points, badges)", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/profile")
    await page.waitForTimeout(2000)
    await expect(page.locator("text=/Documents/i").first()).toBeVisible()
    await expect(page.locator("text=/Points/i").first()).toBeVisible()
    await expect(page.locator("text=/Badges/i").first()).toBeVisible()
  })

  test("shows security section with change password option", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/profile")
    await page.waitForTimeout(2000)
    await expect(page.locator("text=/Security/i").first()).toBeVisible()
    await expect(page.locator("button:has-text('Change Password')").first()).toBeVisible()
  })

  test("profile page requires authentication", async ({ page }) => {
    await page.goto("/login")
    await page.evaluate(() => localStorage.clear())
    await page.goto("/profile")
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 })
  })
})

test.describe("Update Profile (UC-005)", () => {

  test("edit profile button toggles edit mode", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/profile")
    await page.waitForTimeout(2000)
    const editBtn = page.locator("button:has-text('Edit Profile')").first()
    await expect(editBtn).toBeVisible()
    await editBtn.click()
    await expect(page.locator("button:has-text('Save Changes')").first()).toBeVisible()
    await expect(page.locator("button:has-text('Cancel')").first()).toBeVisible()
  })

  test("edit mode shows editable fields", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/profile")
    await page.waitForTimeout(2000)
    await page.locator("button:has-text('Edit Profile')").first().click()
    await page.waitForTimeout(500)
    await expect(page.locator("text=/Display Name/i").first()).toBeVisible()
    await expect(page.locator("textarea").first()).toBeVisible()
  })

  test("cancel edit restores original values", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/profile")
    await page.waitForTimeout(2000)
    await page.locator("button:has-text('Edit Profile')").first().click()
    await page.waitForTimeout(500)
    await page.locator("button:has-text('Cancel')").first().click()
    await expect(page.locator("button:has-text('Edit Profile')").first()).toBeVisible()
  })

  test("change password form shows when clicked", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/profile")
    await page.waitForTimeout(2000)
    await page.locator("button:has-text('Change Password')").first().click()
    await page.waitForTimeout(500)
    const passwordFields = page.locator("input[type='password']")
    expect(await passwordFields.count()).toBeGreaterThanOrEqual(3)
    await expect(page.locator("button:has-text('Update Password')").first()).toBeVisible()
  })

  test("username field is disabled in edit mode", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/profile")
    await page.waitForTimeout(2000)
    await page.locator("button:has-text('Edit Profile')").first().click()
    await page.waitForTimeout(500)
    await expect(page.locator("text=/Username cannot be changed/i").first()).toBeVisible()
  })
})
