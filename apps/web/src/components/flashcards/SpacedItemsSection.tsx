import { Button } from "../ui/Button"
import { Card } from "../ui/Card"

type SpacedItems = typeof import("../../configs/flashcardsData").spacedItems

type Props = {
  items: SpacedItems
  onToast: (msg: string) => void
}

export function SpacedItemsSection({ items, onToast }: Props) {
  return (
    <section className="mt-6 grid gap-4 md:grid-cols-3">
      {items.map(item => (
        <Card key={item.title} title={item.title} subtitle={item.detail}>
          <div className="flex flex-wrap gap-2">
            {item.tags.map(tag => (
              <span key={tag} className="rounded-full bg-purple-50 px-2 py-1 text-[11px] font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-200">{tag}</span>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <Button variant="secondary" onClick={() => onToast(`${item.cta} (mock)`)}>{item.cta}</Button>
            <Button variant="ghost" onClick={() => onToast("Edit algorithm weights (mock)")}>Configure</Button>
          </div>
        </Card>
      ))}
    </section>
  )
}
