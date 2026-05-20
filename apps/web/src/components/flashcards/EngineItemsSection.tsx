import { Button } from "../ui/Button"
import { Card } from "../ui/Card"

type EngineItems = typeof import("../../configs/flashcardsData").engineItems

type Props = {
  items: EngineItems
  onToast: (msg: string) => void
}

export function EngineItemsSection({ items, onToast }: Props) {
  return (
    <section className="mt-6 grid gap-4 md:grid-cols-3">
      {items.map(item => (
        <Card key={item.title} title={item.title} subtitle={item.title === "Create & import" ? "Flashcard engine" : undefined}>
          <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
            {item.bullets.map(b => (
              <li key={b} className="flex items-start gap-2">
                <span className="mt-1 h-2 w-2 rounded-full bg-purple-500" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex gap-2">
            <Button variant="secondary" onClick={() => onToast(`${item.cta} (mock)`)}>{item.cta}</Button>
            <Button variant="ghost" onClick={() => onToast("Add to batch (mock)")}>Add to batch</Button>
          </div>
        </Card>
      ))}
    </section>
  )
}
