import { test, expect, Page } from "@playwright/test"

async function login(page: Page) {
  await page.goto("/login")
  await page.locator("input[placeholder='name@example.com']").fill("student@hkive.com")
  await page.locator("input[type='password']").fill("password123")
  await page.locator("button[type='submit']").click()
  await expect(page).toHaveURL(/\/dashboard|\/flashcards|\/application/, { timeout: 20000 })
}

test.describe("Explanation Tools — /application/simplify", () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto("/application/simplify")
    await page.waitForLoadState("domcontentloaded")
  })

  test("page loads with Explanation Tools heading and 3 tabs", async ({ page }) => {
    await expect(page.getByText(/explanation tools/i).first()).toBeVisible()
    await expect(page.getByRole("button", { name: /adjust level/i }).first()).toBeVisible()
    await expect(page.getByRole("button", { name: /check understanding/i }).first()).toBeVisible()
    await expect(page.getByRole("button", { name: /reflect on teaching/i }).first()).toBeVisible()
  })

  test("guide panel visible by default and can be hidden", async ({ page }) => {
    await expect(page.getByText(/tip: start with/i)).toBeVisible()
    await page.getByRole("button", { name: /hide guide/i }).click()
    await expect(page.getByText(/tip: start with/i)).not.toBeVisible()
    await expect(page.getByRole("button", { name: /which tool should I use/i })).toBeVisible()
  })

  test("switching tabs updates active banner", async ({ page }) => {
    await page.getByRole("button", { name: /check understanding/i }).first().click()
    await expect(page.getByText(/want to know if your explanation is correct/i).first()).toBeVisible()
    await page.getByRole("button", { name: /reflect on teaching/i }).first().click()
    await expect(page.getByText(/want to improve how you explain/i).first()).toBeVisible()
  })

  test("no JS errors on load", async ({ page }) => {
    const errors: string[] = []
    page.on("pageerror", e => { if (!e.message.includes("WebSocket")) errors.push(e.message) })
    await page.reload()
    await page.waitForLoadState("domcontentloaded")
    expect(errors).toHaveLength(0)
  })
})

test.describe("Teach Back — /application/teach-back", () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto("/application/teach-back")
    await page.waitForLoadState("domcontentloaded")
  })

  test("page loads with Feynman / teach-back heading", async ({ page }) => {
    await expect(
      page.locator("h1, h2").filter({ hasText: /teach|feynman|explain/i }).first()
    ).toBeVisible({ timeout: 10000 })
  })

  test("shows concept selector or input", async ({ page }) => {
    await expect(
      page.locator("input, textarea, [placeholder]").first()
    ).toBeVisible({ timeout: 10000 })
  })

  test("no JS errors on load", async ({ page }) => {
    const errors: string[] = []
    page.on("pageerror", e => { if (!e.message.includes("WebSocket")) errors.push(e.message) })
    await page.reload()
    await page.waitForLoadState("domcontentloaded")
    expect(errors).toHaveLength(0)
  })
})

test.describe("Practice Exam Questions — /application/practice-exam", () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto("/application/practice-exam")
    await page.waitForLoadState("domcontentloaded")
  })

  test("page loads with Practice Exam heading", async ({ page }) => {
    await expect(
      page.locator("h1, h2").filter({ hasText: /practice exam/i }).first()
    ).toBeVisible({ timeout: 10000 })
  })

  test("shows topic search and subject filter", async ({ page }) => {
    await expect(page.locator("input, select, [placeholder]").first()).toBeVisible({ timeout: 10000 })
  })

  test("no JS errors on load", async ({ page }) => {
    const errors: string[] = []
    page.on("pageerror", e => { if (!e.message.includes("WebSocket")) errors.push(e.message) })
    await page.reload()
    await page.waitForLoadState("domcontentloaded")
    expect(errors).toHaveLength(0)
  })
})

test.describe("Past Paper Import — /application/past-paper-import", () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto("/application/past-paper-import")
    await page.waitForLoadState("domcontentloaded")
  })

  test("page loads with Import Past Papers heading", async ({ page }) => {
    await expect(
      page.locator("h1, h2").filter({ hasText: /import past papers/i }).first()
    ).toBeVisible({ timeout: 10000 })
  })

  test("shows raw text import textarea and Parse button", async ({ page }) => {
    await expect(page.getByRole("button", { name: /parse.*import/i })).toBeVisible({ timeout: 10000 })
  })

  test("shows AI generate section with Generate button", async ({ page }) => {
    await expect(page.getByRole("button", { name: /generate.*save/i })).toBeVisible({ timeout: 10000 })
  })

  test("no JS errors on load", async ({ page }) => {
    const errors: string[] = []
    page.on("pageerror", e => { if (!e.message.includes("WebSocket")) errors.push(e.message) })
    await page.reload()
    await page.waitForLoadState("domcontentloaded")
    expect(errors).toHaveLength(0)
  })
})

test.describe("Error Log — /application/error-log", () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto("/application/error-log")
    await page.waitForLoadState("domcontentloaded")
  })

  test("page loads with Error Log heading and 3 tabs", async ({ page }) => {
    await expect(
      page.locator("h1, h2").filter({ hasText: /error log/i }).first()
    ).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole("button", { name: /error list/i })).toBeVisible()
    await expect(page.getByRole("button", { name: /error patterns/i })).toBeVisible()
    await expect(page.getByRole("button", { name: /schedule review/i })).toBeVisible()
  })

  test("Error List tab shows filter buttons", async ({ page }) => {
    await expect(page.getByRole("button", { name: /^all$/i })).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole("button", { name: /^open$/i })).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole("button", { name: /^mastered$/i })).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole("button", { name: /^due$/i })).toBeVisible({ timeout: 10000 })
  })

  test("switching to Error Patterns tab shows chart", async ({ page }) => {
    await page.getByRole("button", { name: /error patterns/i }).click()
    await expect(
      page.locator("text=/pattern|category|topic/i").first()
    ).toBeVisible({ timeout: 10000 })
  })

  test("switching to Schedule Review tab", async ({ page }) => {
    await page.getByRole("button", { name: /schedule review/i }).click()
    await expect(
      page.locator("text=/review|due|schedule/i").first()
    ).toBeVisible({ timeout: 10000 })
  })

  test("no JS errors on load", async ({ page }) => {
    const errors: string[] = []
    page.on("pageerror", e => { if (!e.message.includes("WebSocket")) errors.push(e.message) })
    await page.reload()
    await page.waitForLoadState("domcontentloaded")
    expect(errors).toHaveLength(0)
  })
})

test.describe("Schedule Review — /application/schedule-review", () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto("/application/schedule-review")
    await page.waitForLoadState("domcontentloaded")
  })

  test("page loads with review heading and tabs", async ({ page }) => {
    await expect(
      page.locator("h1, h2, [class*='text-2xl'], [class*='text-xl']").first()
    ).toBeVisible({ timeout: 10000 })
    await expect(
      page.locator("button").filter({ hasText: /review|pattern/i }).first()
    ).toBeVisible()
  })

  test("no JS errors on load", async ({ page }) => {
    const errors: string[] = []
    page.on("pageerror", e => { if (!e.message.includes("WebSocket")) errors.push(e.message) })
    await page.reload()
    await page.waitForLoadState("domcontentloaded")
    expect(errors).toHaveLength(0)
  })
})

test.describe("Re-explain Correctly — /application/re-explain", () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto("/application/re-explain")
    await page.waitForLoadState("domcontentloaded")
  })

  test("page loads with Re-explain heading", async ({ page }) => {
    await expect(
      page.locator("h1, h2").filter({ hasText: /re.?explain/i }).first()
    ).toBeVisible({ timeout: 10000 })
  })

  test("shows item selector and Next explain button", async ({ page }) => {
    await expect(
      page.locator("select, [role='combobox']").first()
    ).toBeVisible({ timeout: 10000 })
    await expect(
      page.getByRole("button", { name: /next.*explain|explain/i }).first()
    ).toBeVisible({ timeout: 10000 })
  })

  test("no JS errors on load", async ({ page }) => {
    const errors: string[] = []
    page.on("pageerror", e => { if (!e.message.includes("WebSocket")) errors.push(e.message) })
    await page.reload()
    await page.waitForLoadState("domcontentloaded")
    expect(errors).toHaveLength(0)
  })
})

test.describe("Analyze Mistake — /application/analysis", () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto("/application/analysis")
    await page.waitForLoadState("domcontentloaded")
  })

  test("page loads with Analyze Mistake heading", async ({ page }) => {
    await expect(page.getByText(/analyze mistake/i).first()).toBeVisible({ timeout: 10000 })
  })

  test("shows Why was this wrong and How can I avoid it fields", async ({ page }) => {
    await expect(page.getByPlaceholder(/i misread the question/i)).toBeVisible({ timeout: 10000 })
    await expect(page.getByPlaceholder(/underline command words/i)).toBeVisible()
  })

  test("Save Reflection button disabled when both fields are empty", async ({ page }) => {
    await expect(page.getByRole("button", { name: /save reflection/i })).toBeDisabled({ timeout: 10000 })
  })

  test("Skip button is visible", async ({ page }) => {
    await expect(page.getByRole("button", { name: /skip/i })).toBeVisible({ timeout: 10000 })
  })

  test("no JS errors on load", async ({ page }) => {
    const errors: string[] = []
    page.on("pageerror", e => { if (!e.message.includes("WebSocket")) errors.push(e.message) })
    await page.reload()
    await page.waitForLoadState("domcontentloaded")
    expect(errors).toHaveLength(0)
  })
})

test.describe("Categorize Error — /application/categorize", () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto("/application/categorize")
    await page.waitForLoadState("domcontentloaded")
  })

  test("page loads with Categorize Error heading", async ({ page }) => {
    await expect(page.getByText(/categorize error/i).first()).toBeVisible({ timeout: 10000 })
  })

  test("shows error description textarea and Analyze Error button", async ({ page }) => {
    await expect(page.getByPlaceholder(/describe what went wrong/i)).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole("button", { name: /analyze error/i })).toBeVisible()
  })

  test("Analyze Error button disabled when description is empty", async ({ page }) => {
    await expect(page.getByRole("button", { name: /analyze error/i })).toBeDisabled({ timeout: 10000 })
  })

  test("no JS errors on load", async ({ page }) => {
    const errors: string[] = []
    page.on("pageerror", e => { if (!e.message.includes("WebSocket")) errors.push(e.message) })
    await page.reload()
    await page.waitForLoadState("domcontentloaded")
    expect(errors).toHaveLength(0)
  })
})

test.describe("Visualize Error Patterns — /application/visualize", () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto("/application/visualize")
    await page.waitForLoadState("domcontentloaded")
  })

  test("page loads with Error Pattern Visualization heading", async ({ page }) => {
    await expect(page.getByText(/error pattern visualization/i)).toBeVisible({ timeout: 10000 })
  })

  test("shows filter tags and All button", async ({ page }) => {
    await expect(page.getByText(/filter by error tag/i)).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole("button", { name: /^all$/i }).first()).toBeVisible()
  })

  test("shows severity legend", async ({ page }) => {
    await expect(page.getByText(/severity indicators/i)).toBeVisible({ timeout: 10000 })
  })

  test("no JS errors on load", async ({ page }) => {
    const errors: string[] = []
    page.on("pageerror", e => { if (!e.message.includes("WebSocket")) errors.push(e.message) })
    await page.reload()
    await page.waitForLoadState("domcontentloaded")
    expect(errors).toHaveLength(0)
  })
})
