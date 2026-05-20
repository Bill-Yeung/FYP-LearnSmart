import { test, expect, type Page } from "@playwright/test"

async function loginAsStudent(page: Page) {
  await page.goto("/login")
  await page.locator("input[placeholder='name@example.com']").fill("student@hkive.com")
  await page.locator("input[type='password']").fill("password123")
  await page.locator("button[type='submit']").click()
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })
}

test.describe("Diagrams List / Generate Concept Diagram (UC-105)", () => {

  test("diagrams page loads", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/knowledge/diagram")
    await expect(page.locator("text=/Diagrams & Maps/i").first()).toBeVisible({ timeout: 10000 })
  })

  test("generate new button is visible", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/knowledge/diagram")
    await page.waitForTimeout(2000)
    await expect(page.locator("button:has-text('Generate New')").first()).toBeVisible()
  })

  test("filter chips are present (All, Knowledge Map, Flowchart, Mind Map, Timeline)", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/knowledge/diagram")
    await page.waitForTimeout(2000)
    await expect(page.locator("button:has-text('All')").first()).toBeVisible()
    await expect(page.locator("button:has-text('Knowledge Map')").first()).toBeVisible()
    await expect(page.locator("button:has-text('Flowchart')").first()).toBeVisible()
  })

  test("generate modal opens on button click", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/knowledge/diagram")
    await page.waitForTimeout(2000)
    await page.locator("button:has-text('Generate New')").first().click()
    await page.waitForTimeout(500)
    await expect(page.locator("text=/Generate New Diagram/i").first()).toBeVisible()
    await expect(page.locator("text=/Diagram Type/i").first()).toBeVisible()
  })

  test("generate modal has source selection options", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/knowledge/diagram")
    await page.waitForTimeout(2000)
    await page.locator("button:has-text('Generate New')").first().click()
    await page.waitForTimeout(500)
    await expect(page.locator("text=/Select Source/i").first()).toBeVisible()
    await expect(page.locator("button:has-text('All Documents')").first()).toBeVisible()
  })

  test("generate modal has title input", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/knowledge/diagram")
    await page.waitForTimeout(2000)
    await page.locator("button:has-text('Generate New')").first().click()
    await page.waitForTimeout(500)
    await expect(page.locator("text=/Title/i").first()).toBeVisible()
  })

  test("generate modal can be cancelled", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/knowledge/diagram")
    await page.waitForTimeout(2000)
    await page.locator("button:has-text('Generate New')").first().click()
    await page.waitForTimeout(500)
    await page.locator("button:has-text('Cancel')").first().click()
    await page.waitForTimeout(500)
    await expect(page.locator("text=/Generate New Diagram/i").first()).not.toBeVisible()
  })

  test("diagrams page requires authentication", async ({ page }) => {
    await page.goto("/login")
    await page.evaluate(() => localStorage.clear())
    await page.goto("/knowledge/diagram")
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 })
  })
})
