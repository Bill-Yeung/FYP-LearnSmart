import { Button } from "../ui/Button"
import { Card } from "../ui/Card"

type InterleaveTracks = typeof import("../../configs/flashcardsData").interleaveTracks

type Props = {
  tracks: InterleaveTracks
  onToast: (msg: string) => void
}

export function InterleaveSection({ tracks, onToast }: Props) {
  return (
    <Card title="Interleaved practice" subtitle="Mix topics to boost transfer and reduce overfitting to one subject.">
      <div className="space-y-3">
        {tracks.map(track => (
          <div key={track.name} className={`rounded-xl bg-gradient-to-r ${track.accent} p-[1px]`}>
            <div className="rounded-[11px] bg-white p-3 dark:bg-gray-950">
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{track.name}</div>
              <p className="text-xs text-gray-600 dark:text-gray-400">{track.desc}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-gray-600 dark:text-gray-400">
                {track.steps.map((step: string) => (
                  <span key={step} className="rounded-full bg-gray-100 px-2 py-1 dark:bg-gray-900">{step}</span>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <Button variant="secondary" onClick={() => onToast(`Launch ${track.name} (mock)`)}>Launch</Button>
                <Button variant="ghost" onClick={() => onToast("Save preset (mock)")}>Save preset</Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
