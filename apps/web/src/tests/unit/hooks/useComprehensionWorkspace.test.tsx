import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useComprehensionWorkspace } from "../../../hooks/useComprehensionWorkspace"
import { apiClient } from "../../../lib/api"

vi.mock("../../../lib/api", () => ({
  apiClient: {
    get: vi.fn(),
  },
}))

describe("useComprehensionWorkspace", () => {
  const mockedGet = vi.mocked(apiClient.get)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("loads subjects and documents, then fetches concepts for the selected document", async () => {
    mockedGet.mockImplementation(async (url: string) => {
      if (url === "/api/subjects") {
        return [
          { id: "subject-bio", code: "BIO", name: "Biology" },
          { id: "subject-chem", code: "CHEM", name: "Chemistry" },
        ]
      }

      if (url === "/api/documents?page=1&page_size=100&status=completed") {
        return {
          documents: [
            {
              id: "doc-1",
              document_name: "Cell structure notes",
              subjects: [{ id: "subject-bio", code: "BIO", name: "Biology" }],
            },
          ],
        }
      }

      if (url === "/api/documents/doc-1/concepts?page_size=50") {
        return {
          concepts: [
            { id: "concept-1", title: "Cell membrane" },
            { id: "concept-2", title: "Mitochondria" },
          ],
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    })

    const { result } = renderHook(() => useComprehensionWorkspace())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.subjects).toHaveLength(2)
    expect(result.current.documents).toHaveLength(1)

    act(() => {
      result.current.setSelectedDocumentId("doc-1")
    })

    await waitFor(() => {
      expect(result.current.documentConceptLabels).toEqual(["Cell membrane", "Mitochondria"])
    })
    expect(result.current.selectedDocument?.document_name).toBe("Cell structure notes")
  })

  it("filters documents by subject and clears an invalid selected document", async () => {
    mockedGet.mockImplementation(async (url: string) => {
      if (url === "/api/subjects") {
        return [
          { id: "subject-bio", code: "BIO", name: "Biology" },
          { id: "subject-chem", code: "CHEM", name: "Chemistry" },
        ]
      }

      if (url === "/api/documents?page=1&page_size=100&status=completed") {
        return {
          documents: [
            {
              id: "doc-bio",
              document_name: "Photosynthesis",
              subjects: [{ id: "subject-bio", code: "BIO", name: "Biology" }],
            },
            {
              id: "doc-chem",
              document_name: "Stoichiometry",
              subjects: [{ id: "subject-chem", code: "CHEM", name: "Chemistry" }],
            },
          ],
        }
      }

      if (url === "/api/documents/doc-chem/concepts?page_size=50") {
        return {
          concepts: [{ id: "concept-3", title: "Moles" }],
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    })

    const { result } = renderHook(() => useComprehensionWorkspace())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    act(() => {
      result.current.setSelectedDocumentId("doc-chem")
    })

    await waitFor(() => {
      expect(result.current.documentConceptLabels).toEqual(["Moles"])
    })

    act(() => {
      result.current.setSelectedSubjectId("subject-bio")
    })

    await waitFor(() => {
      expect(result.current.documents.map((document) => document.id)).toEqual(["doc-bio"])
      expect(result.current.selectedDocumentId).toBe("")
      expect(result.current.documentConceptLabels).toEqual([])
    })
  })
})
