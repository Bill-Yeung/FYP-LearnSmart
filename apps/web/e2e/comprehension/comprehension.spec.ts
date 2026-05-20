import { expect, test, type Page } from "@playwright/test"

const mockUser = {
  id: "user-123",
  username: "student",
  email: "student@example.com",
  role: "student",
  display_name: "Student User",
  preferred_language: "en",
  is_active: true,
  email_verified: true,
  domain_level: "beginner",
  difficulty_preference: "medium",
  ai_assistance_level: "moderate",
  created_at: "2024-01-01T00:00:00Z",
  last_login: null,
}

async function bootstrapAuthenticatedPage(page: Page) {
  await page.addInitScript((user) => {
    class MockEventSource {
      onopen: ((this: EventSource, ev: Event) => unknown) | null = null
      onmessage: ((this: EventSource, ev: MessageEvent) => unknown) | null = null
      onerror: ((this: EventSource, ev: Event) => unknown) | null = null

      constructor(_url: string, _init?: EventSourceInit) {}
      close() {}
      addEventListener() {}
      removeEventListener() {}
    }

    Object.defineProperty(window, "EventSource", {
      value: MockEventSource,
      configurable: true,
    })
  }, mockUser)

  await page.route("**/api/auth/check", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ authenticated: false }),
    })
  })

  await page.route("**/api/auth/login", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ access_token: "demo-token" }),
    })
  })

  await page.route("**/api/users/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockUser),
    })
  })

  await page.route("**/api/notifications", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ notifications: [], unread_count: 0 }),
    })
  })

  await page.route("**/api/flashcards/schedule", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    })
  })

  await page.route("**/api/timer/tasks", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    })
  })

  await page.route("**/api/subjects", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        { id: "subject-bio", code: "BIO", name: "Biology" },
      ]),
    })
  })

  await page.route("**/api/documents?**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        documents: [
          {
            id: "doc-1",
            document_name: "Photosynthesis Notes",
            subjects: [{ id: "subject-bio", code: "BIO", name: "Biology" }],
          },
        ],
      }),
    })
  })

  await page.route("**/api/documents/doc-1/concepts?**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        concepts: [
          { id: "concept-1", title: "Photosynthesis" },
          { id: "concept-2", title: "Chlorophyll" },
        ],
      }),
    })
  })
}

async function gotoProtectedRoute(page: Page, path: string) {
  await page.goto("/login")
  await page.getByRole("button", { name: "Student" }).click()
  await expect(page).toHaveURL(/\/dashboard/)
  await page.goto(path)
}

test.describe("Comprehension Flows", () => {
  test("generates why/how questions from source content", async ({ page }) => {
    await bootstrapAuthenticatedPage(page)
    await page.route("**/api/ai/call", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          response: JSON.stringify({
            questions: [
              {
                type: "why",
                difficulty: "medium",
                question: "Why is chlorophyll important?",
                rationale: "It focuses on the role chlorophyll plays in photosynthesis.",
                focus: "chlorophyll",
              },
              {
                type: "how",
                difficulty: "medium",
                question: "How does photosynthesis store energy?",
                rationale: "It asks for the mechanism linking light to glucose production.",
              },
            ],
          }),
        }),
      })
    })

    await gotoProtectedRoute(page, "/comprehension/why-how")

    await expect(page.getByRole("heading", { name: "Why/How Question Generator" })).toBeVisible()
    await page.getByPlaceholder("Paste notes, a textbook excerpt, or a transcript...").fill(
      "Photosynthesis uses chlorophyll to capture light energy and store it as glucose."
    )
    await page.getByRole("button", { name: "Generate questions" }).click()

    await expect(page.getByText("2 questions ready")).toBeVisible()
    await expect(page.getByText("Why is chlorophyll important?")).toBeVisible()
    await expect(page.getByText("How does photosynthesis store energy?")).toBeVisible()
  })

  test("turns brainstorm notes into structured notes", async ({ page }) => {
    await bootstrapAuthenticatedPage(page)
    await page.route("**/api/ai/call", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          response: JSON.stringify({
            title: "Photosynthesis study notes",
            summary: "Photosynthesis converts light into stored chemical energy.",
            sections: [
              {
                heading: "What",
                content: "It is the process plants use to make glucose.",
                bullets: ["Occurs in chloroplasts"],
              },
            ],
            next_steps: ["Review the light-dependent reactions"],
          }),
        }),
      })
    })

    await gotoProtectedRoute(page, "/comprehension/brainstorm")

    await expect(page.getByRole("heading", { name: "Guided Brainstorming" })).toBeVisible()
    await page.getByLabel("Topic").fill("Photosynthesis")
    await page.getByPlaceholder("Add a bullet...").fill("Occurs in chloroplasts")
    await page.getByRole("button", { name: "Add" }).click()
    await page.getByRole("button", { name: "Generate structured notes" }).click()

    await expect(page.getByText("# Photosynthesis study notes")).toBeVisible()
    await expect(page.getByText("## What")).toBeVisible()
    await expect(page.getByText("- Occurs in chloroplasts")).toBeVisible()
  })

  test("appends a tutor response in Socratic dialogue", async ({ page }) => {
    await bootstrapAuthenticatedPage(page)
    await page.route("**/api/ai/call", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          response: JSON.stringify({
            assistant_message: "What role does the concentration gradient play here?",
          }),
        }),
      })
    })

    await gotoProtectedRoute(page, "/comprehension/dialogue")

    await expect(page.getByRole("heading", { name: "Socratic Dialogue" })).toBeVisible()
    await page.getByLabel("Concept").fill("Osmosis")
    await page.getByPlaceholder("Write your explanation or your next answer here...").fill(
      "Water moves across a membrane from high concentration to low concentration."
    )
    await page.getByRole("button", { name: "Send response" }).click()

    await expect(
      page.getByText("Water moves across a membrane from high concentration to low concentration.")
    ).toBeVisible()
    await expect(
      page.getByText("What role does the concentration gradient play here?")
    ).toBeVisible()
  })
})
