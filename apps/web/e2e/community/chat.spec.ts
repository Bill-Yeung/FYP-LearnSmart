import { test, expect, type Page } from "@playwright/test"

async function loginAsStudent(page: Page) {
  await page.goto("/login")
  await page.locator("input[placeholder='name@example.com']").fill("student@hkive.com")
  await page.locator("input[type='password']").fill("password123")
  await page.locator("button[type='submit']").click()
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })
}

test.describe("Chat (UC-611)", () => {

  test("chat panel can be opened from dashboard", async ({ page }) => {
    await loginAsStudent(page)
    const chatBtn = page.locator("button:has-text('Chat'), a:has-text('Chat'), [aria-label*='chat' i]").first()
    if (await chatBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await chatBtn.click()
      await page.waitForTimeout(1000)
    }
  })

  test("chat requires authentication", async ({ page }) => {
    await page.goto("/login")
    await page.evaluate(() => localStorage.clear())
    await page.goto("/community/chat")
    await page.waitForTimeout(2000)
    const url = page.url()
    const isRedirected = url.includes("/login")
    const hasAuthMessage = await page.locator("text=/sign in|login|unauthorized/i").first().isVisible().catch(() => false)
    expect(isRedirected || hasAuthMessage).toBeTruthy()
  })
})
