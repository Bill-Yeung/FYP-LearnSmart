export type KnowledgeModule = {
  id: string
  name: string
  topicCount?: number
}

export type ScopeSelectorProps = {
  selected: string
  onChange: (v: string) => void
  modules?: KnowledgeModule[]
}

export function ScopeSelector({ selected, onChange, modules }: ScopeSelectorProps) {
  const hasModules = modules && modules.length > 0

  return (
    <div className="space-y-3 text-sm">
      <div
        className={`flex cursor-pointer items-start justify-between rounded-lg border px-3 py-2 ${
          selected === "all concepts"
            ? "border-indigo-500 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-900/20"
            : "border-gray-200 bg-gray-50 hover:border-indigo-300 dark:border-gray-700 dark:bg-gray-900/40"
        }`}
        onClick={() => onChange("all concepts")}
      >
        <div className="flex gap-3">
          <input
            type="radio"
            className="mt-1 h-4 w-4"
            checked={selected === "all concepts"}
            onChange={() => onChange("all concepts")}
          />
          <div>
            <div className="font-medium">Generate from full text (all concepts)</div>
            <div className="mt-1 flex flex-wrap gap-1 text-[11px] text-gray-600 dark:text-gray-400">
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
                Scope: all
              </span>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
                Difficulty: auto
              </span>
            </div>
            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Suitable for learning everything at once.
            </div>
          </div>
        </div>
        {hasModules && (
          <span className="self-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
            Recommended
          </span>
        )}
      </div>

      {(modules && modules.length > 0
        ? modules
        : [
            { id: "m1", name: "Concept A (example)", topicCount: 4 },
            { id: "m2", name: "Concept B (example)", topicCount: 5 },
            { id: "m3", name: "Concept C (example)", topicCount: 3 }
          ]
      ).map((m) => {
        const id = m.id
        const label = m.name
        const topic = m.topicCount ?? 0
        return (
          <div
            key={label}
            className={`flex cursor-pointer items-start justify-between rounded-lg border px-3 py-2 ${
              selected === label
                ? "border-indigo-500 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-900/20"
                : "border-gray-200 bg-gray-50 hover:border-indigo-300 dark:border-gray-700 dark:bg-gray-900/40"
            }`}
            onClick={() => onChange(label)}
          >
            <div className="flex gap-3">
              <input
                type="radio"
                className="mt-1 h-4 w-4"
                checked={selected === label}
                onChange={() => onChange(label)}
              />
              <div>
                <div className="font-medium">{label}</div>
                <div className="mt-1 flex flex-wrap gap-1 text-[11px] text-gray-600 dark:text-gray-400">
                  {topic > 0 && (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
                      Key Knowledge points: {topic}
                    </span>
                  )}
                 
                </div>
              </div>
            </div>
            <span className="self-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
              Module
            </span>
          </div>
        )
      })}
    </div>
  )
}
