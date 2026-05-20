import { Button } from "../ui/Button"

export type StatsSummaryProps = {
  dueCounts: { today: number; overdue: number; new: number }
  onPrimary: () => void
  onSecondary: () => void
  onSettings?: () => void
  primaryLabel?: string
  showPrimary?: boolean
}

export function StatsSummary({ dueCounts, onPrimary, onSecondary, onSettings, primaryLabel, showPrimary = true }: StatsSummaryProps) {
  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-purple-600 dark:text-purple-300">Memory scheduling</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Spaced repetition and flashcard lab</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            SM-2, Leitner, interleaving, mnemonics, and multisensory encoding keep reviews timely and memorable.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {showPrimary && <Button onClick={onPrimary}>{primaryLabel ?? 'Start review'}</Button>}
          <Button variant="secondary" onClick={onSecondary}>Schedule</Button>
          {onSettings && <Button variant="secondary" onClick={onSettings}>Settings</Button>}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3 text-sm">
        {[{ label: "Due today", value: dueCounts.today }, { label: "Overdue", value: dueCounts.overdue }, { label: "New", value: dueCounts.new }].map(item => (
          <div key={item.label} className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-center dark:border-gray-800 dark:bg-gray-900">
            <div className="text-xs text-gray-500 dark:text-gray-400">{item.label}</div>
            <div className="text-xl font-semibold">{item.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
