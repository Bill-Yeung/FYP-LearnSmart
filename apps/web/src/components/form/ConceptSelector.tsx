import { useState, useRef, useEffect } from "react"
import { useConceptsList } from "../../hooks/useConceptsList"

type Props = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label?: string
  hint?: string
  extraConcepts?: string[]
}

export function ConceptSelector({
  value,
  onChange,
  placeholder = "Search or type a concept...",
  label,
  hint,
  extraConcepts = []
}: Props) {
  const { concepts, loading } = useConceptsList()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState(value)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => { setSearch(value) }, [value])

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [])

  const conceptMap = new Map<string, { name: string; color?: string | null }>()
  concepts.forEach((concept) => {
    conceptMap.set(concept.name.toLowerCase(), concept)
  })
  extraConcepts.forEach((name) => {
    const trimmed = name.trim()
    if (trimmed && !conceptMap.has(trimmed.toLowerCase())) {
      conceptMap.set(trimmed.toLowerCase(), { name: trimmed })
    }
  })
  const options = Array.from(conceptMap.values())

  const filtered = search.trim()
    ? options.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
    : options

  function select(name: string) {
    onChange(name)
    setSearch(name)
    setOpen(false)
  }

  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
      )}
      {hint && <p className="text-xs text-gray-400 dark:text-gray-500">{hint}</p>}
      <div ref={ref} className="relative">
        <input
          type="text"
          value={search}
          onChange={e => { setSearch(e.target.value); onChange(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder={loading ? "Loading concepts..." : placeholder}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
        />
        {open && filtered.length > 0 && (
          <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg max-h-52 overflow-y-auto">
            {filtered.map((c, i) => (
              <button
                key={i}
                type="button"
                onMouseDown={() => select(c.name)}
                className="w-full text-left px-3 py-2 text-sm text-gray-800 dark:text-gray-200 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 flex items-center gap-2"
              >
                {c.color && (
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                )}
                {c.name}
              </button>
            ))}
          </div>
        )}
        {open && !loading && filtered.length === 0 && search.trim() && (
          <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg px-3 py-2 text-sm text-gray-400 dark:text-gray-500">
            No matching concepts. You can still type your own.
          </div>
        )}
      </div>
    </div>
  )
}

export default ConceptSelector
