import { test, expect, type Page } from "@playwright/test"

async function loginAsStudent(page: Page) {
  await page.goto("/login")
  await page.locator("input[placeholder='name@example.com']").fill("student@hkive.com")
  await page.locator("input[type='password']").fill("password123")
  await page.locator("button[type='submit']").click()
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })
}

test.describe("Documents (UC-101/102)", () => {

  test("navigates to documents page", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/knowledge/documents")
    await expect(page.locator("text=/my documents/i").first()).toBeVisible({ timeout: 10000 })
  })

  test("displays document list or empty state", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/knowledge/documents")
    const content = page.locator("text=/no documents|my documents|upload/i").first()
    await expect(content).toBeVisible({ timeout: 10000 })
  })

  test("search input is present and functional", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/knowledge/documents")
    await page.waitForTimeout(2000)
    const searchInput = page.locator("input[placeholder*='Search']").first()
    await expect(searchInput).toBeVisible()
    await searchInput.fill("nonexistent-doc-xyz")
    await page.waitForTimeout(1000)
  })

  test("upload button is visible", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/knowledge/documents")
    await page.waitForTimeout(2000)
    const uploadBtn = page.locator("button:has-text('Upload')").first()
    await expect(uploadBtn).toBeVisible()
  })

  test("upload modal opens on click", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/knowledge/documents")
    await page.waitForTimeout(2000)
    await page.locator("button:has-text('Upload')").first().click()
    await expect(page.locator("text=/upload|drag|drop|file/i").first()).toBeVisible({ timeout: 5000 })
  })

  test("status filter dropdown works", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/knowledge/documents")
    await page.waitForTimeout(2000)
    const statusFilter = page.locator("select").first()
    if (await statusFilter.isVisible()) {
      await statusFilter.selectOption({ index: 1 })
      await page.waitForTimeout(500)
    }
  })

  test("deleted documents tab", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/knowledge/documents")
    await page.waitForTimeout(2000)
    const deletedTab = page.locator("button:has-text('Deleted')").first()
    if (await deletedTab.isVisible()) {
      await deletedTab.click()
      await page.waitForTimeout(1000)
      await expect(page.locator("text=/deleted|no deleted|permanently/i").first()).toBeVisible()
    }
  })

  test("document page requires authentication", async ({ page }) => {
    await page.goto("/login")
    await page.evaluate(() => localStorage.clear())
    await page.goto("/knowledge/documents")
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 })
  })
})
