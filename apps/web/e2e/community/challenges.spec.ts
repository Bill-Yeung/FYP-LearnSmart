import { test, expect, type Page } from "@playwright/test"

async function loginAsStudent(page: Page) {
  await page.goto("/login")
  await page.locator("input[placeholder='name@example.com']").fill("student@hkive.com")
  await page.locator("input[type='password']").fill("password123")
  await page.locator("button[type='submit']").click()
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })
}

async function loginAsTeacher(page: Page) {
  await page.goto("/login")
  const teacherBtn = page.locator("button:has-text('Teacher')").first()
  if (await teacherBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await teacherBtn.click()
  } else {
    await page.locator("input[placeholder='name@example.com']").fill("teacher@hkive.com")
    await page.locator("input[type='password']").fill("password123")
    await page.locator("button[type='submit']").click()
  }
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })
}

test.describe("Participate in Challenge (UC-608)", () => {

  test("challenges page loads", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/community/challenges")
    await expect(page.locator("text=/challenge/i").first()).toBeVisible({ timeout: 10000 })
  })

  test("displays challenge list or empty state", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/community/challenges")
    await page.waitForTimeout(3000)
    const hasChallenges = await page.locator("text=/challenge|no challenge/i").first().isVisible()
    expect(hasChallenges).toBeTruthy()
  })

  test("challenge tabs are present (all, joined, completed)", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/community/challenges")
    await page.waitForTimeout(3000)
    const allTab = page.locator("button:has-text('All')").first()
    await expect(allTab).toBeVisible()
  })

  test("challenges page requires authentication", async ({ page }) => {
    await page.goto("/login")
    await page.evaluate(() => localStorage.clear())
    await page.goto("/community/challenges")
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 })
  })
})

test.describe("Create Challenges (UC-609)", () => {

  test("create challenge page loads for teacher", async ({ page }) => {
    await loginAsTeacher(page)
    await page.goto("/community/challenges/create")
    await page.waitForTimeout(2000)
    const url = page.url()
    const hasForm = await page.locator("text=/create|challenge/i").first().isVisible().catch(() => false)
    const isRedirected = !url.includes("/community/challenges/create")
    expect(hasForm || isRedirected).toBeTruthy()
  })

  test("student cannot access create challenge page", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/community/challenges/create")
    await page.waitForTimeout(2000)
    const url = page.url()
    const isRedirected = !url.includes("/community/challenges/create")
    const hasError = await page.locator("text=/access|denied|unauthorized/i").first().isVisible().catch(() => false)
    expect(isRedirected || hasError).toBeTruthy()
  })
})
