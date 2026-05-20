import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { Card } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { TextField } from "../../components/form/TextField"
import { cn } from "../../../../../shared/utils"
import { apiClient } from "../../lib/api"
import { logActivity } from "../../lib/activityLog"
import { Star } from "lucide-react"


type MentorshipStatus = "pending" | "active" | "completed" | "declined" | "cancelled"

type Mentorship = {
  id: string
  mentor: {
    id: string
    name: string
    avatar_url: string | null
    reputation_score: number
    subjects: string[]
  }
  mentee: {
    id: string
    name: string
    avatar_url: string | null
  }
  subject: string | null
  topic_focus: string | null
  status: MentorshipStatus
  sessions_count: number
  started_at: string | null
  is_mentor: boolean
}

type MentorProfile = {
  id: string
  name: string
  avatar_url: string | null
  reputation_score: number
  subjects: string[]
  bio: string | null
  sessions_completed: number
  rating: number
  is_available: boolean
}

type MentorshipStats = {
  active_count: number
  pending_count: number
  total_sessions: number
}


export function MentorshipPage() {
  const navigate = useNavigate()
  const [mentorships, setMentorships] = useState<Mentorship[]>([])
  const [mentors, setMentors] = useState<MentorProfile[]>([])
  const [stats, setStats] = useState<MentorshipStats>({ active_count: 0, pending_count: 0, total_sessions: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"my" | "find">("my")
  const [searchQuery, setSearchQuery] = useState("")
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false)
  const [selectedMentor, setSelectedMentor] = useState<MentorProfile | null>(null)
  const [isBecomeModalOpen, setIsBecomeModalOpen] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const [msData, statsData] = await Promise.all([
        apiClient.get<{ mentorships: Mentorship[] }>("/api/mentorships/my"),
        apiClient.get<MentorshipStats>("/api/mentorships/stats"),
      ])
      setMentorships(msData?.mentorships ?? [])
      if (statsData) setStats(statsData)
    } catch (e: any) {
      setError(e?.message || "Failed to load mentorships")
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchMentors = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page_size: "50" })
      if (searchQuery) params.set("search", searchQuery)
      const data = await apiClient.get<{ mentors: MentorProfile[] }>(`/api/mentorships/mentors?${params}`)
      setMentors(data?.mentors ?? [])
    } catch { }
  }, [searchQuery])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => { if (activeTab === "find") fetchMentors() }, [activeTab, fetchMentors])

  async function handleAccept(mentorshipId: string) {
    try {
      await apiClient.post(`/api/mentorships/${mentorshipId}/accept`, {})
      await fetchData()
    } catch (e: any) { setError(e?.message || "Failed to accept") }
  }

  async function handleDecline(mentorshipId: string) {
    try {
      await apiClient.post(`/api/mentorships/${mentorshipId}/decline`, {})
      await fetchData()
    } catch (e: any) { setError(e?.message || "Failed to decline") }
  }

  async function handleEnd(mentorshipId: string) {
    try {
      await apiClient.post(`/api/mentorships/${mentorshipId}/end`, {})
      await fetchData()
    } catch (e: any) { setError(e?.message || "Failed to end mentorship") }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Mentorship</h1>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <span className="ml-3 text-gray-500 dark:text-gray-400">Loading...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Mentorship</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Connect with mentors or become a mentor to help others
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
          {error}
          <button onClick={() => setError(null)} className="ml-2 font-medium underline">Dismiss</button>
        </div>
      )}

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">{stats.active_count}</div>
            <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">Active Mentorships</div>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">{stats.pending_count}</div>
            <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">Pending Requests</div>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{stats.total_sessions}</div>
            <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">Total Sessions</div>
          </div>
        </Card>
      </div>

      <div className="mb-6 flex gap-2">
        {[
          { id: "my", label: "My Mentorships" },
          { id: "find", label: "Search for Mentor" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              activeTab === tab.id
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "my" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">My Mentorships</h2>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setActiveTab("find")}>Search for Mentor</Button>
              <Button onClick={() => setIsBecomeModalOpen(true)}>Become a Mentor</Button>
            </div>
          </div>
          <div>
            <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
              As Mentee ({mentorships.filter(m => !m.is_mentor).length})
            </h2>
            {mentorships.filter(m => !m.is_mentor).length === 0 ? (
              <Card>
                <div className="py-6 text-center text-gray-500 dark:text-gray-400">
                  No mentors yet. Search for a mentor to get started!
                </div>
              </Card>
            ) : (
              <div className="space-y-2">
                {mentorships.filter(m => !m.is_mentor).map((ms) => (
                  <Card key={ms.id} className={ms.status === "active" ? "cursor-pointer hover:shadow-md transition-shadow" : ""} onClick={ms.status === "active" ? () => navigate(`/community/mentorship/${ms.id}`) : undefined}>
                    <div className="flex items-center gap-4">
                      <div
                        className="h-12 w-12 rounded-full flex items-center justify-center text-white font-medium"
                        style={{ backgroundColor: "#6B7280" }}
                      >
                        {ms.mentor.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 dark:text-white">
                          {ms.mentor.name}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {ms.subject}{ms.topic_focus ? `: ${ms.topic_focus}` : ""} · <span className={cn("capitalize", ms.status === "active" ? "text-green-600 dark:text-green-400" : ms.status === "pending" ? "text-yellow-600 dark:text-yellow-400" : "")}>{ms.status}</span> · {ms.sessions_count} sessions
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
              As Mentor ({mentorships.filter(m => m.is_mentor).length})
            </h2>
            {mentorships.filter(m => m.is_mentor).length === 0 ? (
              <Card>
                <div className="py-6 text-center text-gray-500 dark:text-gray-400">
                  No mentees yet. Register as a mentor to help others!
                </div>
              </Card>
            ) : (
              <div className="space-y-2">
                {mentorships.filter(m => m.is_mentor).map((ms) => (
                  <Card key={ms.id} className={ms.status === "active" ? "cursor-pointer hover:shadow-md transition-shadow" : ""} onClick={ms.status === "active" ? () => navigate(`/community/mentorship/${ms.id}`) : undefined}>
                    <div className="flex items-center gap-4">
                      <div
                        className="h-12 w-12 rounded-full flex items-center justify-center text-white font-medium"
                        style={{ backgroundColor: "#6B7280" }}
                      >
                        {ms.mentee.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 dark:text-white">
                          {ms.mentee.name}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {ms.subject}{ms.topic_focus ? `: ${ms.topic_focus}` : ""} · <span className={cn("capitalize", ms.status === "active" ? "text-green-600 dark:text-green-400" : ms.status === "pending" ? "text-yellow-600 dark:text-yellow-400" : "")}>{ms.status}</span> · {ms.sessions_count} sessions
                        </div>
                      </div>
                      <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                        {ms.status === "pending" && (
                          <>
                            <Button variant="primary" onClick={() => handleAccept(ms.id)}>Accept</Button>
                            <Button variant="ghost" onClick={() => handleDecline(ms.id)}>Decline</Button>
                          </>
                        )}
                        {ms.status === "active" && (
                          <Button variant="ghost" onClick={() => handleEnd(ms.id)}>End</Button>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "find" && (
        <div className="space-y-6">
          <div>
            <TextField
              label=""
              placeholder="Search mentors by subject..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div>
            <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
              Available Mentors ({mentors.length})
            </h2>
            {mentors.length === 0 ? (
              <Card>
                <div className="py-6 text-center text-gray-500 dark:text-gray-400">
                  No mentors found. Be the first to register as a mentor!
                </div>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {mentors.map((mentor) => (
                  <Card key={mentor.id} className={cn(!mentor.is_available && "opacity-60")}>
                    <div className="flex gap-4">
                      <div
                        className="h-14 w-14 rounded-full flex items-center justify-center text-white font-medium text-lg flex-shrink-0"
                        style={{ backgroundColor: "#6B7280" }}
                      >
                        {mentor.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900 dark:text-white">{mentor.name}</span>
                          {!mentor.is_available && (
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                              Unavailable
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {mentor.subjects.map((subject) => (
                            <span key={subject} className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                              {subject}
                            </span>
                          ))}
                        </div>
                        {mentor.bio && (
                          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 line-clamp-2">{mentor.bio}</p>
                        )}
                        <div className="mt-2 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                          <span className="flex items-center gap-1"><Star className="w-3 h-3" /> {mentor.rating}</span>
                          <span>{mentor.sessions_completed} sessions</span>
                          <span>{mentor.reputation_score} rep</span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <Button
                        variant={mentor.is_available ? "primary" : "secondary"}
                        disabled={!mentor.is_available}
                        onClick={() => { setSelectedMentor(mentor); setIsRequestModalOpen(true) }}
                      >
                        Request Mentorship
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {isRequestModalOpen && selectedMentor && (
        <RequestMentorshipModal
          mentor={selectedMentor}
          onClose={() => { setIsRequestModalOpen(false); setSelectedMentor(null) }}
          onRequested={() => { setIsRequestModalOpen(false); setSelectedMentor(null); fetchData() }}
        />
      )}

      {isBecomeModalOpen && (
        <BecomeMentorModal
          onClose={() => setIsBecomeModalOpen(false)}
          onRegistered={() => { setIsBecomeModalOpen(false); fetchData() }}
        />
      )}
    </div>
  )
}


function RequestMentorshipModal({
  mentor, onClose, onRequested,
}: {
  mentor: MentorProfile; onClose: () => void; onRequested: () => void
}) {
  const [subject, setSubject] = useState("")
  const [topicFocus, setTopicFocus] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleRequest() {
    if (!subject) return
    setSending(true)
    setError(null)
    try {
      const params = new URLSearchParams({ mentor_id: mentor.id, subject })
      if (topicFocus.trim()) params.set("topic_focus", topicFocus.trim())
      await apiClient.post(`/api/mentorships?${params}`, {})
      logActivity("mentorship", "request", mentor.id)
      onRequested()
    } catch (e: any) {
      setError(e?.message || "Failed to send request")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Request Mentorship</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Request {mentor.name} to be your mentor
        </p>

        {error && (
          <div className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">{error}</div>
        )}

        <div className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Subject</label>
            <select
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            >
              <option value="">Select a subject</option>
              {mentor.subjects.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">What do you want to focus on?</label>
            <textarea
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              rows={3}
              placeholder="Describe what you'd like to learn or improve..."
              value={topicFocus}
              onChange={(e) => setTopicFocus(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleRequest} disabled={sending || !subject}>
            {sending ? "Sending..." : "Send Request"}
          </Button>
        </div>
      </div>
    </div>
  )
}


function BecomeMentorModal({
  onClose, onRegistered,
}: {
  onClose: () => void; onRegistered: () => void
}) {
  const [subjects, setSubjects] = useState("")
  const [bio, setBio] = useState("")
  const [registering, setRegistering] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // sign the current user up as a mentor with their listed subjects and bio
  async function handleRegister() {
    if (!subjects.trim()) return
    setRegistering(true)
    setError(null)
    try {
      const params = new URLSearchParams({ subjects: subjects.trim() })
      if (bio.trim()) params.set("bio", bio.trim())
      await apiClient.post(`/api/mentorships/mentors/register?${params}`, {})
      onRegistered()
    } catch (e: any) {
      setError(e?.message || "Failed to register")
    } finally {
      setRegistering(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Become a Mentor</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Share your expertise and help others learn</p>

        {error && (
          <div className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">{error}</div>
        )}

        <div className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Subjects you can teach</label>
            <TextField
              label=""
              placeholder="e.g., Python, Machine Learning, Web Development"
              value={subjects}
              onChange={(e) => setSubjects(e.target.value)}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Separate subjects with commas</p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">About your experience</label>
            <textarea
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              rows={4}
              placeholder="Tell potential mentees about your background and teaching style..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleRegister} disabled={registering || !subjects.trim()}>
            {registering ? "Registering..." : "Register as Mentor"}
          </Button>
        </div>
      </div>
    </div>
  )
}
