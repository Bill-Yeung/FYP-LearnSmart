import { useMemo, useState } from "react"
import { Button } from "../ui/Button"
import { Card } from "../ui/Card"

const topicsFallback = ["Physics", "Chemistry", "Biology", "Mathematics", "Computer Science", "History"]

type Props = {
  topics?: string[]
  onToast: (msg: string) => void
}

type GeneratedCard = { id: string; front: string; back: string }

export function SampleDeckGenerator({ topics = topicsFallback, onToast }: Props) {
  const [topic, setTopic] = useState(topics[0] ?? "Physics")
  const [cards, setCards] = useState<GeneratedCard[]>([])

  const preview = useMemo(() => cards.slice(0, 5), [cards])

  // build 20 throwaway cards for the chosen topic (mock only)
  function generate() {
    const next = Array.from({ length: 20 }, (_, i) => ({
      id: `${topic}-${i + 1}`,
      front: `${topic}: Concept ${i + 1}`,
      back: `${topic}: Key idea ${i + 1} with a concise explanation.`
    }))
    setCards(next)
    onToast(`Generated 20 sample ${topic} flashcards (mock)`)
  }

  return (
    <Card title="Generate sample deck" subtitle="Pick a topic and create 20 sample flashcards for dry runs.">
      <div className="flex flex-col gap-3">
        <div className="grid gap-2 sm:grid-cols-[1fr,auto]">
          <select
            value={topic}
            onChange={e => setTopic(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          >
            {topics.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <Button onClick={generate}>Generate 20 cards</Button>
        </div>

        {cards.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Preview (first 5 of 20)</div>
            <div className="mt-2 space-y-2">
              {preview.map(card => (
                <div key={card.id} className="rounded-lg border border-gray-200 bg-white p-2 dark:border-gray-800 dark:bg-gray-950">
                  <div className="text-xs font-semibold text-gray-700 dark:text-gray-200">{card.front}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">{card.back}</div>
                </div>
              ))}
            </div>
            <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">All 20 cards generated (mock).</div>
          </div>
        )}
      </div>
    </Card>
  )
}
