import { Button } from "../ui/Button"
import { Card } from "../ui/Card"
import type { ComprehensionHistoryRecord } from "../../hooks/useComprehensionHistory"

type Props<TPayload> = {
  items: ComprehensionHistoryRecord<TPayload>[]
  onRestore: (item: ComprehensionHistoryRecord<TPayload>) => void
  onRemove: (id: string) => void
  onClearAll: () => void
  emptyText: string
}

export function ComprehensionHistoryPanel<TPayload>({
  items,
  onRestore,
  onRemove,
  onClearAll,
  emptyText
}: Props<TPayload>) {
  return (
    <Card
      title="Saved Work"
      subtitle="Click a saved item to restore its inputs and generated output."
      rightSlot={
        items.length > 0 ? (
          <Button variant="ghost" onClick={onClearAll} className="w-full sm:w-auto">
            Clear saved work
          </Button>
        ) : null
      }
    >
      {items.length === 0 ? (
        <p className="text-sm text-gray-600 dark:text-gray-400">{emptyText}</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-gray-300 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-950 dark:hover:border-gray-700 dark:hover:bg-gray-900"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {item.title}
                  </p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {new Date(item.updatedAt).toLocaleString([], {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit"
                    })}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onRestore(item)}
                className="mt-3 block w-full rounded-lg text-left focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10"
              >
                <p className="line-clamp-2 text-sm text-gray-700 dark:text-gray-300">
                  {item.preview}
                </p>
              </button>

              {item.meta && item.meta.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.meta.map((label) => (
                    <span
                      key={label}
                      className="rounded-full border border-gray-200 px-2.5 py-1 text-[11px] font-medium text-gray-600 dark:border-gray-800 dark:text-gray-300"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-3">
                <Button variant="secondary" onClick={() => onRestore(item)} className="w-full sm:w-auto">
                  Restore
                </Button>
                <Button variant="ghost" onClick={() => onRemove(item.id)} className="w-full sm:w-auto">
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
