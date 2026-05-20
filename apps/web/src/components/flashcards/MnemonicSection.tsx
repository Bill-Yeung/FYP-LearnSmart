import { Button } from "../ui/Button"
import { Card } from "../ui/Card"

type MnemonicKits = typeof import("../../configs/flashcardsData").mnemonicKits

type Props = {
  kits: MnemonicKits
  onToast: (msg: string) => void
}

export function MnemonicSection({ kits, onToast }: Props) {
  return (
    <Card title="Mnemonic generator" subtitle="Generate abbreviations, rhymes, and story prompts for tricky items.">
      <div className="space-y-3">
        {kits.map(kit => (
          <div key={kit.title} className={`rounded-xl border border-gray-200 p-3 text-sm dark:border-gray-800 ${kit.tone}`}>
            <div className="font-semibold text-gray-900 dark:text-gray-100">{kit.title}</div>
            <p className="mt-1 text-gray-700 dark:text-gray-300">{kit.sample}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <Button variant="secondary" onClick={() => onToast("Generate mnemonics (mock)")}>Generate</Button>
        <Button variant="ghost" onClick={() => onToast("Edit prompt (mock)")}>Edit prompt</Button>
      </div>
    </Card>
  )
}
