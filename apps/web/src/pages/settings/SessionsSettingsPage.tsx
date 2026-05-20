import { useState } from "react"
import { Card } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"

type Session = {
  id: string
  device: string
  browser: string
  location: string
  lastActive: string
  isCurrent: boolean
}

const MOCK_SESSIONS: Session[] = [
  { id: "1", device: "MacBook Pro", browser: "Chrome", location: "Home", lastActive: "Active now", isCurrent: true },
  { id: "2", device: "iPhone", browser: "Safari", location: "Work", lastActive: "2 hours ago", isCurrent: false }
]

export function SessionsSettingsPage() {
  const [sessions, setSessions] = useState<Session[]>(MOCK_SESSIONS)

  function removeSession(id: string) {
    setSessions(prev => prev.filter(s => s.id !== id))
  }

  function removeAllOthers() {
    setSessions(prev => prev.filter(s => s.isCurrent))
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Sessions</h1>
        <p className="text-sm text-gray-500">Manage your active sessions and sign out other devices</p>
      </div>

      <Card>
        <div className="flex justify-between items-center mb-4">
          <div />
          <div>
            <Button variant="danger" onClick={removeAllOthers} disabled={sessions.filter(s => !s.isCurrent).length === 0}>Sign out all others</Button>
          </div>
        </div>

        <div className="space-y-3">
          {sessions.map(s => (
            <div key={s.id} className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <div className="font-medium">{s.device} {s.isCurrent && <span className="text-xs text-green-600">(current)</span>}</div>
                <div className="text-sm text-gray-500">{s.browser} · {s.location}</div>
                <div className="text-xs text-gray-400">{s.lastActive}</div>
              </div>
              {!s.isCurrent && <Button variant="ghost" onClick={() => removeSession(s.id)}>Remove</Button>}
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

export default SessionsSettingsPage
