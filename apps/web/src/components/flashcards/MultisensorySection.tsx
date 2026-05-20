import { Button } from "../ui/Button"
import { Card } from "../ui/Card"

type SensoryOptions = typeof import("../../configs/flashcardsData").sensoryOptions

type Props = {
  options: SensoryOptions
  onToast: (msg: string) => void
}

export function MultisensorySection({ options, onToast }: Props) {
  return (
    <Card title="Multisensory encoding" subtitle="Enrich cards with audio, tactile hints, and images for vivid recall.">
      <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
        {options.map(opt => (
          <div key={opt.label} className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-900">
            <div className="font-medium text-gray-900 dark:text-gray-100">{opt.label}</div>
            <p className="text-xs text-gray-600 dark:text-gray-400">{opt.desc}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <Button variant="secondary" aria-label="Attach media" onClick={() => onToast("Attach media (demo)")}></Button>
        <Button variant="ghost" onClick={() => onToast("Record audio (mock)")}>Record audio</Button>
      </div>
    </Card>
  )
}
