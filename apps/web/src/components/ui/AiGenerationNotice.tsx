type AiGenerationNoticeProps = {
  title: string
  description: string
  steps?: string[]
}

export function AiGenerationNotice({
  title,
  description,
  steps = ["Reading your inputs", "Drafting a response", "Polishing the final result"]
}: AiGenerationNoticeProps) {
  return (
    <div className="sticky top-4 z-20" aria-live="polite" aria-busy="true">
      <div className="overflow-hidden rounded-3xl border border-sky-200/80 bg-white/90 shadow-lg shadow-sky-100/60 backdrop-blur dark:border-sky-900/50 dark:bg-gray-950/85 dark:shadow-sky-950/30">
        <div className="bg-gradient-to-r from-sky-500/10 via-cyan-500/10 to-emerald-500/10 px-5 py-4 dark:from-sky-500/15 dark:via-cyan-500/10 dark:to-emerald-500/10">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-sky-500 animate-pulse" />
              <span className="h-2.5 w-2.5 rounded-full bg-cyan-400 animate-pulse" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</p>
          </div>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{description}</p>
        </div>

        <div className="px-5 py-4">
          <div className="grid gap-2 sm:grid-cols-3">
            {steps.map((step) => (
              <div
                key={step}
                className="rounded-2xl border border-gray-200/80 bg-gray-50/90 px-3 py-3 text-sm text-gray-700 dark:border-gray-800 dark:bg-gray-900/70 dark:text-gray-200"
              >
                {step}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
