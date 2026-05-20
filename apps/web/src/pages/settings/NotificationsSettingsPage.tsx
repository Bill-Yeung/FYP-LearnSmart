import { useState, useEffect } from "react"
import { Card } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)} className={`inline-flex h-6 w-11 items-center rounded-full ${checked ? 'bg-purple-600' : 'bg-gray-300'}`}>
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}

export function NotificationsSettingsPage() {
  const [email, setEmail] = useState(true)
  const [push, setPush] = useState(true)
  const [reminders, setReminders] = useState(true)
  const [community, setCommunity] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem('settings-notifications')
      if (raw) {
        const parsed = JSON.parse(raw)
        setEmail(Boolean(parsed.email))
        setPush(Boolean(parsed.push))
        setReminders(Boolean(parsed.reminders))
        setCommunity(Boolean(parsed.community))
      }
    } catch (e) {}
  }, [])

  // stash the four toggles back into localStorage and tell the user
  function save() {
    try {
      localStorage.setItem('settings-notifications', JSON.stringify({ email, push, reminders, community }))
      alert('Saved')
    } catch (e) {
      alert('Failed to save')
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Notifications</h1>
        <p className="text-sm text-gray-500">Control email and push notification preferences</p>
      </div>

      <Card>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Email Notifications</div>
              <div className="text-sm text-gray-500">Receive important updates via email</div>
            </div>
            <Toggle checked={email} onChange={setEmail} />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Push Notifications</div>
              <div className="text-sm text-gray-500">Receive notifications in your browser</div>
            </div>
            <Toggle checked={push} onChange={setPush} />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Study Reminders</div>
              <div className="text-sm text-gray-500">Get reminders to review your flashcards</div>
            </div>
            <Toggle checked={reminders} onChange={setReminders} />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Community Updates</div>
              <div className="text-sm text-gray-500">Notifications about community activities</div>
            </div>
            <Toggle checked={community} onChange={setCommunity} />
          </div>

          <div className="flex justify-end">
            <Button onClick={save}>Save</Button>
          </div>
        </div>
      </Card>
    </div>
  )
}

export default NotificationsSettingsPage
