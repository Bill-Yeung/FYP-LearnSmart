import { useState } from "react"
import { Modal } from "../ui/Modal"
import { Button } from "../ui/Button"

type Props = {
  isOpen: boolean
  onClose: () => void
  onGenerate: (mnemonic: string) => void
  cardFront?: string
}

export function MnemonicModal({ isOpen, onClose, onGenerate, cardFront = "" }: Props) {
  const [input, setInput] = useState(cardFront)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function buildMockMnemonic(text: string) {
    const words = text
      .replace(/[.,\/()]/g, " ")
      .split(/\s+/)
      .filter(Boolean)
    if (!words.length) return ""
    const acronym = words.map(w => w[0].toUpperCase()).join("")
    return `${acronym} — mnemonic: ${words.slice(0, 3).join("/")}`
  }

  async function handleGenerate() {
    if (!input.trim()) {
      setError("Please enter a concept or card text to generate a mnemonic")
      return
    }
    setError(null)
    setGenerating(true)
    await new Promise(r => setTimeout(r, 700))
    const mnemonic = buildMockMnemonic(input.trim()) || "Mnemonic (mock)"
    onGenerate(mnemonic)
    setGenerating(false)
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Generate Mnemonic" size="md">
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">Provide the concept or card text and generate a short mnemonic (mock).</p>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          rows={4}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        />
        {error && <div className="text-sm text-red-600">{error}</div>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleGenerate} disabled={generating}>{generating ? "Generating..." : "Generate"}</Button>
        </div>
      </div>
    </Modal>
  )
}
