import { useState, useEffect } from "react"
import { Card } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"

export function PrivacySettingsPage() {
  const [visibility, setVisibility] = useState<'public'|'friends'|'private'>('public')
  const [showOnline, setShowOnline] = useState(true)

  useEffect(() => {
    try {
      const raw = localStorage.getItem('settings-privacy')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed.visibility) setVisibility(parsed.visibility)
        setShowOnline(Boolean(parsed.showOnline))
      }
    } catch (e) {}
  }, [])

  function save() {
    try {
      localStorage.setItem('settings-privacy', JSON.stringify({ visibility, showOnline }))
      alert('Saved')
    } catch (e) { alert('Failed to save') }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Privacy</h1>
        <p className="text-sm text-gray-500">Profile visibility and privacy options</p>
      </div>

      <Card>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Profile Visibility</label>
            <div className="flex gap-2">
              {(['public','friends','private'] as const).map(v => (
                <button key={v} onClick={() => setVisibility(v)} className={`rounded-lg border px-3 py-2 ${visibility===v? 'border-purple-500 bg-purple-50' : 'border-gray-200'}`}>
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Show Online Status</div>
              <div className="text-sm text-gray-500">Let others see when you're online</div>
            </div>
            <button onClick={() => setShowOnline(s => !s)} className={`inline-flex h-6 w-11 items-center rounded-full ${showOnline ? 'bg-purple-600' : 'bg-gray-300'}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white ${showOnline ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          <div className="flex justify-end"><Button onClick={save}>Save</Button></div>
        </div>
      </Card>
    </div>
  )
}

export default PrivacySettingsPage
