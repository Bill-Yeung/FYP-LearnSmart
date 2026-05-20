import { useState, useEffect } from "react"

export type ConceptItem = { name: string; color?: string | null }

export function useConceptsList() {
  const [concepts, setConcepts] = useState<ConceptItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await fetch("/api/documents/knowledge-map/data", { credentials: "include" })
        if (!res.ok) return
        const data = await res.json()
        const list: ConceptItem[] = (data.concepts || []).map((c: any) => ({
          name: c.title || c.name || "Untitled",
          color: c.color ?? null,
        }))
        if (mounted) setConcepts(list)
      } catch {
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  return { concepts, loading }
}
