import { useState, useEffect, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Card } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { DateInput } from "../../components/ui/DateInput"
import { ResourcePreviewModal } from "../../components/general/ResourcePreviewModal"
import { useConfirmDialog } from "../../components/general/ConfirmDialog"
import { cn } from "../../../../../shared/utils"
import { apiClient } from "../../lib/api"
import { logActivity } from "../../lib/activityLog"
import { useAuth } from "../../contexts/AuthContext"
import {
  ArrowLeft, MessageCircle, Calendar, FolderOpen, Video,
  Clock, Star, Plus, Check, PhoneOff, AlertTriangle,
  Upload, FileText, Link2, Trash2, ExternalLink, Download,
  MapPin, Route, Layers, Lightbulb, Search, X, Bookmark
} from "lucide-react"

type MentorshipDetail = {
  id: string
  subject: string | null
  topic_focus: string | null
  status: string
  sessions_count: number
  started_at: string | null
  chat_room_id: string | null
  is_mentor: boolean
  mentor: { id: string; name: string; avatar_url: string | null; reputation_score: number; subjects: string[] }
  mentee: { id: string; name: string; avatar_url: string | null }
}

type Session = {
  id: string
  mentorship_id: string
  scheduled_by: string
  scheduled_by_name: string
  title: string
  description: string | null
  scheduled_at: string
  duration_minutes: number
  session_type: "chat" | "video"
  status: "proposed" | "confirmed" | "in_progress" | "completed" | "cancelled"
  jitsi_room_id: string | null
  rating: number | null
  rating_comment: string | null
  rated_by: string | null
  created_at: string
}

type Material = {
  id: string
  entity_type: string
  entity_id: string | null
  title: string | null
  note: string | null
  file_url: string | null
  file_size: number | null
  shared_by: string | null
  shared_by_name: string | null
  is_required: boolean
  is_viewed: boolean
  is_completed: boolean
  shared_at: string
}

type Tab = "chat" | "sessions" | "materials" | "video"

function JitsiMeeting({ roomName, displayName, visible, meetingTitle }: { roomName: string; displayName: string; visible: boolean; meetingTitle: string }) {
  const q = encodeURIComponent
  const hash = [
    `userInfo.displayName=%22${q(displayName)}%22`,
    `config.subject=%22${q(meetingTitle)}%22`,
    "config.prejoinConfig.enabled=false",
    "config.startWithAudioMuted=true",
    "config.startWithVideoMuted=false",
    "interfaceConfig.SHOW_JITSI_WATERMARK=false",
  ].join("&")
  const src = `https://jitsi.riot.im/${q(roomName)}#${hash}`

  return (
    <div
      className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700"
      style={{ height: "500px", display: visible ? "block" : "none" }}
    >
      <iframe
        src={src}
        allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-write"
        style={{ width: "100%", height: "100%", border: "none" }}
        title={meetingTitle}
      />
    </div>
  )
}

export function MentorshipDetailPage() {
  const { mentorshipId } = useParams<{ mentorshipId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [mentorship, setMentorship] = useState<MentorshipDetail | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [activeTab, setActiveTab] = useState<Tab>("sessions")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [scheduleTitle, setScheduleTitle] = useState("")
  const [scheduleDesc, setScheduleDesc] = useState("")
  const [scheduleDate, setScheduleDate] = useState("")
  const [scheduleTime, setScheduleTime] = useState("")
  const [scheduleDuration, setScheduleDuration] = useState(60)
  const [scheduleType, setScheduleType] = useState<"chat" | "video">("chat")
  const [isScheduling, setIsScheduling] = useState(false)
  const [scheduleConflicts, setScheduleConflicts] = useState<string[]>([])

  const [showRatingModal, setShowRatingModal] = useState(false)
  const [ratingSessionId, setRatingSessionId] = useState("")
  const [ratingValue, setRatingValue] = useState(0)
  const [ratingHover, setRatingHover] = useState(0)
  const [ratingComment, setRatingComment] = useState("")
  const [isRating, setIsRating] = useState(false)

  const [activeVideoSession, setActiveVideoSession] = useState<Session | null>(null)

  const [showShareModal, setShowShareModal] = useState(false)
  const [previewMaterial, setPreviewMaterial] = useState<Material | null>(null)
  const { confirm, dialogProps, ConfirmDialog } = useConfirmDialog()

  const fetchMentorship = useCallback(async () => {
    if (!mentorshipId) return
    try {
      const res = await apiClient.get<{ mentorship: MentorshipDetail }>(`/api/mentorships/${mentorshipId}`)
      if (res?.mentorship) setMentorship(res.mentorship)
    } catch (e: any) {
      setError(e?.message || "Failed to load mentorship")
    }
  }, [mentorshipId])

  const fetchSessions = useCallback(async () => {
    if (!mentorshipId) return
    try {
      const res = await apiClient.get<{ sessions: Session[] }>(`/api/mentorships/${mentorshipId}/sessions`)
      if (res?.sessions) setSessions(res.sessions)
    } catch (e: any) {
      console.error("Failed to load sessions:", e)
    }
  }, [mentorshipId])

  const fetchMaterials = useCallback(async () => {
    if (!mentorshipId) return
    try {
      const res = await apiClient.get<{ materials: Material[] }>(`/api/mentorships/${mentorshipId}/materials`)
      if (res?.materials) setMaterials(res.materials)
    } catch (e: any) {
      console.error("Failed to load materials:", e)
    }
  }, [mentorshipId])

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchMentorship(), fetchSessions(), fetchMaterials()]).finally(() => setLoading(false))
  }, [fetchMentorship, fetchSessions, fetchMaterials])

  // while a video session is active: poll every 10s to detect when the other side ends it
  useEffect(() => {
    if (!activeVideoSession || !mentorshipId) return
    const interval = setInterval(async () => {
      try {
        const res = await apiClient.get<{ sessions: Session[] }>(`/api/mentorships/${mentorshipId}/sessions`)
        const updated = res?.sessions?.find(s => s.id === activeVideoSession.id)
        if (updated && updated.status === "completed") {
          setActiveVideoSession(null)
          setSessions(res?.sessions ?? [])
        }
      } catch { }
    }, 10_000)
    return () => clearInterval(interval)
  }, [activeVideoSession, mentorshipId])

  // when the user picks a date/time/duration in the schedule modal: check the calendar for overlaps
  useEffect(() => {
    if (!scheduleDate || !scheduleTime) { setScheduleConflicts([]); return }
    let cancelled = false
    const check = async () => {
      try {
        const localDt = new Date(`${scheduleDate}T${scheduleTime}`)
        const newStartMs = localDt.getTime()
        const newEndMs = newStartMs + scheduleDuration * 60_000

        const data = await apiClient.get<{ events: { title: string; date: string; time: string | null; meta: Record<string, any> | null }[] }>(
          `/api/calendar/events?start=${scheduleDate}&end=${scheduleDate}`
        )
        if (cancelled || !data?.events) return

        const conflicts: string[] = []
        for (const ev of data.events) {
          if (!ev.time || !ev.date) continue
          const evStartMs = new Date(`${ev.date}T${ev.time}:00Z`).getTime()
          const evDur = ev.meta?.duration_minutes ?? 60
          const evEndMs = evStartMs + evDur * 60_000
          if (newStartMs < evEndMs && newEndMs > evStartMs) {
            conflicts.push(ev.title)
          }
        }
        if (!cancelled) setScheduleConflicts(conflicts)
      } catch { }
    }
    check()
    return () => { cancelled = true }
  }, [scheduleDate, scheduleTime, scheduleDuration])

  const handleScheduleSession = async () => {
    if (!scheduleTitle.trim() || !scheduleDate || !scheduleTime) return
    setIsScheduling(true)
    try {
      const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`).toISOString()
      await apiClient.post(`/api/mentorships/${mentorshipId}/sessions`, {
        title: scheduleTitle.trim(),
        description: scheduleDesc.trim() || null,
        scheduled_at: scheduledAt,
        duration_minutes: scheduleDuration,
        session_type: scheduleType,
      })
      setShowScheduleModal(false)
      setScheduleTitle("")
      setScheduleDesc("")
      setScheduleDate("")
      setScheduleTime("")
      setScheduleDuration(60)
      setScheduleType("chat")
      await fetchSessions()
    } catch (e: any) {
      alert(e?.message || "Failed to schedule session")
    } finally {
      setIsScheduling(false)
    }
  }

  const handleConfirmSession = async (sessionId: string) => {
    try {
      await apiClient.post(`/api/mentorships/${mentorshipId}/sessions/${sessionId}/confirm`, {})
      await fetchSessions()
    } catch (e: any) {
      alert(e?.message || "Failed to confirm session")
    }
  }

  const handleCompleteSession = async (sessionId: string) => {
    try {
      await apiClient.post(`/api/mentorships/${mentorshipId}/sessions/${sessionId}/complete`, {})
      logActivity("mentorship", "session", sessionId)
      await fetchSessions()
      await fetchMentorship()
    } catch (e: any) {
      alert(e?.message || "Failed to complete session")
    }
  }

  const handleCancelSession = async (sessionId: string) => {
    try {
      await apiClient.post(`/api/mentorships/${mentorshipId}/sessions/${sessionId}/cancel`, {})
      await fetchSessions()
    } catch (e: any) {
      alert(e?.message || "Failed to cancel session")
    }
  }

  const handleRateSession = async () => {
    if (ratingValue === 0) return
    setIsRating(true)
    try {
      await apiClient.post(`/api/mentorships/${mentorshipId}/sessions/${ratingSessionId}/rate`, {
        rating: ratingValue,
        comment: ratingComment.trim() || null,
      })
      setShowRatingModal(false)
      setRatingValue(0)
      setRatingComment("")
      await fetchSessions()
    } catch (e: any) {
      alert(e?.message || "Failed to rate session")
    } finally {
      setIsRating(false)
    }
  }

  const openRatingModal = (sessionId: string) => {
    setRatingSessionId(sessionId)
    setRatingValue(0)
    setRatingHover(0)
    setRatingComment("")
    setShowRatingModal(true)
  }

  const handleMaterialShared = async () => {
    setShowShareModal(false)
    await fetchMaterials()
  }

  const handleDeleteMaterial = async (materialId: string) => {
    const yes = await confirm({
      title: "Delete Material",
      message: "Are you sure you want to delete this shared material? This action cannot be undone.",
      confirmLabel: "Delete",
      variant: "danger",
    })
    if (!yes) return
    try {
      await apiClient.delete(`/api/mentorships/${mentorshipId}/materials/${materialId}`)
      await fetchMaterials()
    } catch (e: any) {
      alert(e?.message || "Failed to delete")
    }
  }

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return ""
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  function getMaterialIcon(type: string) {
    const iconMap: Record<string, { icon: typeof FileText; cls: string }> = {
      source:        { icon: FileText,  cls: "text-blue-600 dark:text-blue-400" },
      file:          { icon: FileText,  cls: "text-blue-600 dark:text-blue-400" },
      diagram:       { icon: MapPin,    cls: "text-indigo-600 dark:text-indigo-400" },
      learning_path: { icon: Route,     cls: "text-emerald-600 dark:text-emerald-400" },
      flashcard:     { icon: Layers,    cls: "text-amber-600 dark:text-amber-400" },
      concept:       { icon: Lightbulb, cls: "text-yellow-600 dark:text-yellow-400" },
      link:          { icon: Link2,     cls: "text-green-600 dark:text-green-400" },
    }
    const m = iconMap[type] || { icon: FolderOpen, cls: "text-gray-500 dark:text-gray-400" }
    const Icon = m.icon
    return <Icon className={`h-6 w-6 ${m.cls}`} />
  }

  const otherPerson = mentorship ? (mentorship.is_mentor ? mentorship.mentee : mentorship.mentor) : null
  const upcomingSessions = sessions.filter(s => ["proposed", "confirmed"].includes(s.status))
  const pastSessions = sessions.filter(s => ["completed", "cancelled"].includes(s.status))

  const [sessionConflicts, setSessionConflicts] = useState<Record<string, string[]>>({})

  useEffect(() => {
    if (upcomingSessions.length === 0) { setSessionConflicts({}); return }
    let cancelled = false
    const check = async () => {
      const dates = new Set<string>()
      for (const s of upcomingSessions) {
        const d = new Date(s.scheduled_at)
        dates.add(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`)
      }
      const sorted = [...dates].sort()
      try {
        const data = await apiClient.get<{ events: { id: string; title: string; date: string; time: string | null; meta: Record<string, any> | null }[] }>(
          `/api/calendar/events?start=${sorted[0]}&end=${sorted[sorted.length - 1]}`
        )
        if (cancelled || !data?.events) return
        const conflicts: Record<string, string[]> = {}
        for (const s of upcomingSessions) {
          const sStart = new Date(s.scheduled_at).getTime()
          const sEnd = sStart + s.duration_minutes * 60_000
          const hits: string[] = []
          for (const ev of data.events) {
            if (!ev.time || !ev.date) continue
            if (ev.id === `ms-${s.id}`) continue
            const evStart = new Date(`${ev.date}T${ev.time}:00Z`).getTime()
            const evDur = ev.meta?.duration_minutes ?? 60
            const evEnd = evStart + evDur * 60_000
            if (sStart < evEnd && sEnd > evStart) hits.push(ev.title)
          }
          if (hits.length) conflicts[s.id] = hits
        }
        if (!cancelled) setSessionConflicts(conflicts)
      } catch { }
    }
    check()
    return () => { cancelled = true }
  }, [sessions])

  const getSessionStatusBadge = (status: string) => {
    const map: Record<string, { bg: string; text: string; label: string }> = {
      proposed: { bg: "bg-yellow-100 dark:bg-yellow-900/30", text: "text-yellow-700 dark:text-yellow-300", label: "Proposed" },
      confirmed: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-300", label: "Confirmed" },
      in_progress: { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-300", label: "In Progress" },
      completed: { bg: "bg-gray-100 dark:bg-gray-800", text: "text-gray-700 dark:text-gray-300", label: "Completed" },
      cancelled: { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-300", label: "Cancelled" },
    }
    const s = map[status] || map.proposed
    return <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", s.bg, s.text)}>{s.label}</span>
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <span className="ml-3 text-gray-500 dark:text-gray-400">Loading...</span>
        </div>
      </div>
    )
  }

  if (!mentorship) {
    return (
      <div className="mx-auto max-w-5xl py-12 text-center">
        <p className="text-gray-500 dark:text-gray-400">Mentorship not found</p>
        <Button onClick={() => navigate("/community/mentorship")} className="mt-4">Back to Mentorships</Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <button
          onClick={() => navigate("/community/mentorship")}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-3 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Mentorships
        </button>

        <Card>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 via-violet-500 to-indigo-500 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
              {otherPerson?.name?.[0]?.toUpperCase() || "?"}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                {otherPerson?.name}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {mentorship.subject}
                {mentorship.is_mentor ? " (You are the mentor)" : " (You are the mentee)"}
              </p>
              {mentorship.topic_focus && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 truncate">
                  Focus: {mentorship.topic_focus}
                </p>
              )}
            </div>
            <div className="text-right flex-shrink-0">
              <span className={cn(
                "px-3 py-1 rounded-full text-xs font-medium",
                mentorship.status === "active" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" :
                "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
              )}>
                {mentorship.status.charAt(0).toUpperCase() + mentorship.status.slice(1)}
              </span>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                {mentorship.sessions_count} session{mentorship.sessions_count !== 1 ? "s" : ""} completed
              </p>
            </div>
          </div>
        </Card>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
          {error}
          <button onClick={() => setError(null)} className="ml-2 font-medium underline">Dismiss</button>
        </div>
      )}

      <div className="mb-6 flex gap-2 overflow-x-auto">
        {([
          { id: "sessions" as Tab, label: "Sessions", icon: Calendar },
          { id: "materials" as Tab, label: "Materials", icon: FolderOpen },
          { id: "video" as Tab, label: "Video Room", icon: Video },
          { id: "chat" as Tab, label: "Chat", icon: MessageCircle },
        ]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap",
              activeTab === tab.id
                ? "bg-purple-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "sessions" && (
        <div className="space-y-6">
          {mentorship.status === "active" && (
            <div className="flex justify-end">
              <Button onClick={() => setShowScheduleModal(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Schedule Session
              </Button>
            </div>
          )}

          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Upcoming</h2>
            {upcomingSessions.length === 0 ? (
              <Card><p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No upcoming sessions</p></Card>
            ) : (
              <div className="space-y-3">
                {upcomingSessions.map((session) => (
                  <Card key={session.id}>
                    {sessionConflicts[session.id] && (
                      <div className="-mx-6 -mt-6 mb-4 px-4 py-2 rounded-t-2xl bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-700/50 flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>Conflicts with: {sessionConflicts[session.id].join(", ")}</span>
                      </div>
                    )}
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900 dark:text-white">{session.title}</h3>
                          {getSessionStatusBadge(session.status)}
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-xs font-medium",
                            session.session_type === "video"
                              ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                              : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                          )}>
                            {session.session_type === "video" ? "Video" : "Chat"}
                          </span>
                        </div>
                        {session.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{session.description}</p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(session.scheduled_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(session.scheduled_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                          <span>{session.duration_minutes} min</span>
                          <span>By {session.scheduled_by_name}</span>
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4 flex-shrink-0">
                        {session.status === "proposed" && session.scheduled_by !== user?.id && (
                          <button
                            onClick={() => handleConfirmSession(session.id)}
                            className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700 transition-colors flex items-center gap-1"
                          >
                            <Check className="w-3 h-3" /> Confirm
                          </button>
                        )}
                        {["proposed", "confirmed"].includes(session.status) && (
                          <>
                            {session.status === "confirmed" && (
                              <button
                                onClick={() => handleCompleteSession(session.id)}
                                className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors"
                              >
                                Mark Complete
                              </button>
                            )}
                            {session.session_type === "video" && session.status === "confirmed" && (
                              <button
                                onClick={() => { setActiveVideoSession(session); setActiveTab("video") }}
                                className="px-3 py-1.5 rounded-lg bg-purple-600 text-white text-xs font-medium hover:bg-purple-700 transition-colors flex items-center gap-1"
                              >
                                <Video className="w-3 h-3" /> Join
                              </button>
                            )}
                            <button
                              onClick={() => handleCancelSession(session.id)}
                              className="px-3 py-1.5 rounded-lg bg-red-100 text-red-700 text-xs font-medium hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50 transition-colors"
                            >
                              Cancel
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Past Sessions</h2>
            {pastSessions.length === 0 ? (
              <Card><p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No past sessions yet</p></Card>
            ) : (
              <div className="space-y-3">
                {pastSessions.map((session) => (
                  <Card key={session.id}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900 dark:text-white">{session.title}</h3>
                          {getSessionStatusBadge(session.status)}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                          <span>{new Date(session.scheduled_at).toLocaleDateString()}</span>
                          <span>{session.duration_minutes} min</span>
                          <span>{session.session_type === "video" ? "Video call" : "Chat session"}</span>
                        </div>
                        {session.rating && (
                          <div className="flex items-center gap-1 mt-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={cn("w-4 h-4", star <= session.rating! ? "text-yellow-400 fill-yellow-400" : "text-gray-300")}
                              />
                            ))}
                            {session.rating_comment && (
                              <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">"{session.rating_comment}"</span>
                            )}
                          </div>
                        )}
                      </div>
                      {/* Rate button for mentee on completed unrated sessions */}
                      {session.status === "completed" && !session.rating && !mentorship.is_mentor && (
                        <button
                          onClick={() => openRatingModal(session.id)}
                          className="px-3 py-1.5 rounded-lg bg-yellow-100 text-yellow-700 text-xs font-medium hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 transition-colors flex items-center gap-1 flex-shrink-0"
                        >
                          <Star className="w-3 h-3" /> Rate
                        </button>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "materials" && (
        <div className="space-y-4">
          {mentorship.status === "active" && (
            <div className="flex justify-end">
              <Button onClick={() => setShowShareModal(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Share Resource
              </Button>
            </div>
          )}

          {materials.length === 0 ? (
            <Card>
              <div className="text-center py-8">
                <FolderOpen className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">No shared materials yet</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Share documents, flashcards, links, and more to help each other learn
                </p>
              </div>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {materials.map((material) => (
                <Card key={material.id} className="cursor-pointer transition-shadow hover:shadow-md" onClick={() => setPreviewMaterial(material)}>
                  <div className="flex gap-3">
                    <div className="flex items-center">
                      {getMaterialIcon(material.entity_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 dark:text-white truncate">
                        {material.title || "Untitled Resource"}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        by {material.shared_by_name || "Unknown"}
                      </p>
                      {material.note && (
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300 line-clamp-2">{material.note}</p>
                      )}
                      <div className="mt-2 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                        <span className="capitalize rounded bg-gray-100 px-1.5 py-0.5 dark:bg-gray-700">
                          {material.entity_type.replace("_", " ")}
                        </span>
                        {material.file_size ? <span>{formatFileSize(material.file_size)}</span> : null}
                        <span>{new Date(material.shared_at).toLocaleDateString()}</span>
                        {material.is_required && <span className="text-red-500 font-medium">Required</span>}
                      </div>

                      <div className="mt-3 flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                        {material.entity_type === "link" && material.file_url && (
                          <a
                            href={material.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium bg-gray-100 text-gray-600 hover:bg-green-50 hover:text-green-600 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-green-900/30 dark:hover:text-green-400 transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" /> Open
                          </a>
                        )}
                        {material.entity_type === "file" && material.file_url && (
                          <a
                            href={`/api/mentorships/${mentorshipId}/materials/${material.id}/download`}
                            download={material.title || "download"}
                            className="flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-blue-600 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-blue-900/30 dark:hover:text-blue-400 transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" /> Download
                          </a>
                        )}
                        {material.shared_by !== user?.id && material.entity_id && (
                          <button
                            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors"
                          >
                            <Bookmark className="h-3.5 w-3.5" /> Save to My Library
                          </button>
                        )}
                        {material.shared_by === user?.id && (
                          <button
                            onClick={() => handleDeleteMaterial(material.id)}
                            className="ml-auto flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-600 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ display: activeTab === "video" ? "block" : "none" }}>
        {activeVideoSession ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{activeVideoSession.title}</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Video session with {otherPerson?.name}</p>
              </div>
              <button
                onClick={() => setActiveVideoSession(null)}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors flex items-center gap-2"
              >
                <PhoneOff className="w-4 h-4" /> Leave Call
              </button>
            </div>
            <JitsiMeeting
              roomName={activeVideoSession.jitsi_room_id!}
              displayName={user?.display_name || user?.username || "User"}
              visible={activeTab === "video"}
              meetingTitle={activeVideoSession.title}
            />
            <div className="flex gap-3">
              <button
                onClick={async () => {
                  await handleCompleteSession(activeVideoSession.id)
                  setActiveVideoSession(null)
                }}
                className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors flex items-center gap-2"
              >
                <Check className="w-4 h-4" /> End & Mark Complete
              </button>
            </div>
          </div>
        ) : (
          <Card>
            <div className="text-center py-8">
              <Video className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400 mb-2">No active video session</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Join a video session from the Sessions tab to start a call
              </p>
            </div>
          </Card>
        )}
      </div>

      {activeTab === "chat" && (
        <Card>
          <div className="text-center py-8">
            <MessageCircle className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            {mentorship.chat_room_id ? (
              <>
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  Your mentorship chat is available in the Messages panel
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  Click the chat bubble icon in the bottom-right corner, then find your mentorship under "Mentorships"
                </p>
              </>
            ) : (
              <p className="text-gray-500 dark:text-gray-400">
                Chat room will be created when the mentorship becomes active
              </p>
            )}
          </div>
        </Card>
      )}

      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowScheduleModal(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-[440px] p-6 animate-in zoom-in-95 fade-in duration-200 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Schedule Session</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title *</label>
                <input
                  type="text"
                  value={scheduleTitle}
                  onChange={(e) => setScheduleTitle(e.target.value)}
                  placeholder="e.g., Dynamic Programming Review"
                  autoFocus
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 border-2 border-transparent focus:outline-none focus:border-purple-500 dark:text-white placeholder-gray-400 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <textarea
                  value={scheduleDesc}
                  onChange={(e) => setScheduleDesc(e.target.value)}
                  placeholder="What will you cover in this session?"
                  rows={2}
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 border-2 border-transparent focus:outline-none focus:border-purple-500 dark:text-white placeholder-gray-400 transition-all resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date *</label>
                  <DateInput
                    value={scheduleDate}
                    onChange={setScheduleDate}
                    min={new Date().toISOString().split("T")[0]}
                    className="w-full px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 border-2 border-transparent focus:outline-none focus:border-purple-500 dark:text-white transition-all"
                    placeholder="Select date"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Time *</label>
                  <input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 border-2 border-transparent focus:outline-none focus:border-purple-500 dark:text-white transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Duration</label>
                  <select
                    value={scheduleDuration}
                    onChange={(e) => setScheduleDuration(Number(e.target.value))}
                    className="w-full px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 border-2 border-transparent focus:outline-none focus:border-purple-500 dark:text-white transition-all"
                  >
                    <option value={30}>30 min</option>
                    <option value={60}>1 hour</option>
                    <option value={90}>1.5 hours</option>
                    <option value={120}>2 hours</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setScheduleType("chat")}
                      className={cn(
                        "flex-1 px-3 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-1",
                        scheduleType === "chat"
                          ? "bg-purple-600 text-white"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                      )}
                    >
                      <MessageCircle className="w-3.5 h-3.5" /> Chat
                    </button>
                    <button
                      onClick={() => setScheduleType("video")}
                      className={cn(
                        "flex-1 px-3 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-1",
                        scheduleType === "video"
                          ? "bg-purple-600 text-white"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                      )}
                    >
                      <Video className="w-3.5 h-3.5" /> Video
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {scheduleConflicts.length > 0 && (
              <div className="mt-4 px-3 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>Conflicts with: {scheduleConflicts.join(", ")}</span>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowScheduleModal(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleScheduleSession}
                disabled={!scheduleTitle.trim() || !scheduleDate || !scheduleTime || isScheduling}
                className="flex-1 px-4 py-2.5 rounded-xl bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {isScheduling ? "Scheduling..." : "Schedule"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showRatingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowRatingModal(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-[380px] p-6 animate-in zoom-in-95 fade-in duration-200">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Rate Session</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">How was your session with {mentorship.mentor.name}?</p>

            {/* Star rating */}
            <div className="flex justify-center gap-2 mb-4">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRatingValue(star)}
                  onMouseEnter={() => setRatingHover(star)}
                  onMouseLeave={() => setRatingHover(0)}
                  className="transition-transform hover:scale-110"
                >
                  <Star
                    className={cn(
                      "w-8 h-8 transition-colors",
                      star <= (ratingHover || ratingValue)
                        ? "text-yellow-400 fill-yellow-400"
                        : "text-gray-300 dark:text-gray-600"
                    )}
                  />
                </button>
              ))}
            </div>

            <textarea
              value={ratingComment}
              onChange={(e) => setRatingComment(e.target.value)}
              placeholder="Optional: leave a comment..."
              rows={3}
              className="w-full px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 border-2 border-transparent focus:outline-none focus:border-yellow-500 dark:text-white placeholder-gray-400 transition-all resize-none"
            />

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowRatingModal(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleRateSession}
                disabled={ratingValue === 0 || isRating}
                className="flex-1 px-4 py-2.5 rounded-xl bg-yellow-500 text-white hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {isRating ? "Submitting..." : "Submit Rating"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showShareModal && mentorshipId && (
        <ShareResourceModal
          mentorshipId={mentorshipId}
          onClose={() => setShowShareModal(false)}
          onShared={handleMaterialShared}
        />
      )}

      {previewMaterial && (
        <ResourcePreviewModal
          isOpen={!!previewMaterial}
          onClose={() => setPreviewMaterial(null)}
          entityType={previewMaterial.entity_type}
          entityId={previewMaterial.entity_id}
          title={previewMaterial.title || "Untitled Resource"}
          note={previewMaterial.note}
          url={previewMaterial.entity_type === "link" ? previewMaterial.file_url : undefined}
          fileUrl={previewMaterial.entity_type === "file" ? `/api/mentorships/${mentorshipId}/materials/${previewMaterial.id}/download` : undefined}
          fileSize={previewMaterial.file_size}
        />
      )}

      <ConfirmDialog {...dialogProps} />
    </div>
  )
}

type EntityItem = { id: string; title: string; subtitle?: string }

const MENTORSHIP_RESOURCE_TYPES = [
  { value: "source", label: "Document", icon: FileText, endpoint: "/api/documents?page_size=100&status=completed", extract: (d: any) => (d.documents || []).map((x: any) => ({ id: String(x.id), title: x.document_name, subtitle: x.document_type })) },
  { value: "diagram", label: "Diagram", icon: MapPin, endpoint: "/api/diagrams?page_size=100", extract: (d: any) => (d.diagrams || []).map((x: any) => ({ id: x.id, title: x.title || "Untitled Diagram", subtitle: x.diagram_type })) },
  { value: "learning_path", label: "Learning Path", icon: Route, endpoint: "/api/learning-paths?page_size=100", extract: (d: any) => (d.learning_paths || []).map((x: any) => ({ id: x.id, title: x.title, subtitle: x.target_concept_title })) },
  { value: "flashcard", label: "Flashcard", icon: Layers, endpoint: "/api/flashcards/review", extract: (d: any) => (Array.isArray(d) ? d : []).map((x: any) => ({ id: x.id, title: x.front, subtitle: x.topic || x.card_type })) },
  { value: "concept", label: "Concept", icon: Lightbulb, endpoint: "/api/documents/concepts/all", extract: (d: any) => (d.concepts || []).map((x: any) => ({ id: x.id, title: x.title || "Untitled", subtitle: x.concept_type })) },
  { value: "link", label: "External Link", icon: Link2, endpoint: null, extract: () => [] },
  { value: "file", label: "Upload File", icon: Upload, endpoint: null, extract: () => [] },
] as const

function ShareResourceModal({
  mentorshipId, onClose, onShared,
}: {
  mentorshipId: string; onClose: () => void; onShared: () => void
}) {
  const [step, setStep] = useState<"type" | "select">("type")
  const [entityType, setEntityType] = useState("")
  const [items, setItems] = useState<EntityItem[]>([])
  const [loadingItems, setLoadingItems] = useState(false)
  const [selectedItem, setSelectedItem] = useState<EntityItem | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [manualTitle, setManualTitle] = useState("")
  const [manualNote, setManualNote] = useState("")
  const [linkUrl, setLinkUrl] = useState("")

  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [fileTitle, setFileTitle] = useState("")
  const [fileNote, setFileNote] = useState("")

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  async function handleSelectType(type: typeof MENTORSHIP_RESOURCE_TYPES[number]) {
    setEntityType(type.value)
    setSelectedItem(null)
    setSearchQuery("")
    setError(null)

    if (type.endpoint) {
      setLoadingItems(true)
      setStep("select")
      try {
        const data = await apiClient.get<any>(type.endpoint)
        setItems(type.extract(data))
      } catch (e: any) {
        setError(e?.message || "Failed to load items")
        setItems([])
      } finally {
        setLoadingItems(false)
      }
    } else {
      setItems([])
      setStep("select")
    }
  }

  const filteredItems = items.filter((i) =>
    i.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    i.subtitle?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const isFileUpload = entityType === "file"
  const isLinkEntry = entityType === "link"
  const isManualEntry = isFileUpload || isLinkEntry

  async function handleShare() {
    setSubmitting(true)
    setError(null)
    try {
      if (isFileUpload) {
        if (!uploadFile) return
        const formData = new FormData()
        formData.append("file", uploadFile)
        if (fileTitle.trim()) formData.append("title", fileTitle.trim())
        if (fileNote.trim()) formData.append("note", fileNote.trim())
        const res = await fetch(`/api/mentorships/${mentorshipId}/materials/upload`, {
          method: "POST",
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
          body: formData,
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.detail || "Upload failed")
        }
      } else if (isLinkEntry) {
        await apiClient.post(`/api/mentorships/${mentorshipId}/materials/link`, {
          url: linkUrl.trim(),
          title: manualTitle.trim() || undefined,
          note: manualNote.trim() || undefined,
        })
      } else {
        await apiClient.post(`/api/mentorships/${mentorshipId}/materials/resource`, {
          entity_type: entityType,
          entity_id: selectedItem!.id,
          title: selectedItem!.title,
          note: manualNote.trim() || undefined,
        })
      }
      onShared()
    } catch (e: any) {
      setError(e?.message || "Failed to share")
    } finally {
      setSubmitting(false)
    }
  }

  const canShare = isFileUpload
    ? !!uploadFile
    : isLinkEntry
    ? linkUrl.trim().length > 0
    : !!selectedItem

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl dark:bg-gray-800 flex flex-col" style={{ maxHeight: "80vh" }}>
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {step === "type" ? "Share Resource" : entityType === "file" ? "Upload File" : "Select Item to Share"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">{error}</div>
        )}

        {step === "type" && (
          <div className="flex-1 overflow-y-auto p-6">
            <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
              What type of resource would you like to share?
            </p>
            <div className="grid grid-cols-2 gap-3">
              {MENTORSHIP_RESOURCE_TYPES.map((rt) => {
                const Icon = rt.icon
                return (
                  <button
                    key={rt.value}
                    type="button"
                    onClick={() => handleSelectType(rt)}
                    className="flex items-center gap-3 rounded-lg border-2 border-gray-200 p-4 text-left transition-colors hover:border-blue-400 hover:bg-blue-50 dark:border-gray-600 dark:hover:border-blue-500 dark:hover:bg-blue-900/20"
                  >
                    <Icon className="h-6 w-6 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                    <span className="font-medium text-gray-900 dark:text-white">{rt.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {step === "select" && (
          <div className="flex-1 overflow-y-auto p-6">
            <button
              onClick={() => { setStep("type"); setEntityType(""); setSelectedItem(null) }}
              className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <ArrowLeft className="h-4 w-4" /> Back to types
            </button>

            {isFileUpload ? (
              <div className="space-y-4">
                <label className="flex items-center justify-center w-full h-28 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 cursor-pointer transition-colors bg-gray-50 dark:bg-gray-700/50">
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) {
                        setUploadFile(f)
                        if (!fileTitle) setFileTitle(f.name)
                      }
                    }}
                  />
                  {uploadFile ? (
                    <div className="text-center">
                      <FileText className="w-8 h-8 text-blue-500 mx-auto mb-1" />
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate max-w-[300px]">{uploadFile.name}</p>
                      <p className="text-xs text-gray-400">{formatSize(uploadFile.size)}</p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <Upload className="w-8 h-8 text-gray-400 mx-auto mb-1" />
                      <p className="text-sm text-gray-500 dark:text-gray-400">Click to select a file</p>
                      <p className="text-xs text-gray-400">Max 50MB</p>
                    </div>
                  )}
                </label>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Title</label>
                  <input
                    type="text"
                    placeholder="Give it a name..."
                    value={fileTitle}
                    onChange={(e) => setFileTitle(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Note</label>
                  <textarea
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    rows={2}
                    placeholder="Optional description..."
                    value={fileNote}
                    onChange={(e) => setFileNote(e.target.value)}
                  />
                </div>
              </div>
            ) : isLinkEntry ? (
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Title</label>
                  <input
                    type="text"
                    placeholder="Name this link"
                    value={manualTitle}
                    onChange={(e) => setManualTitle(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">URL *</label>
                  <input
                    type="url"
                    placeholder="https://example.com"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    autoFocus
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Note</label>
                  <textarea
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    rows={2}
                    placeholder="Describe this resource..."
                    value={manualNote}
                    onChange={(e) => setManualNote(e.target.value)}
                  />
                </div>
              </div>
            ) : (
              <>
                {items.length > 5 && (
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                )}

                {loadingItems ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                    <span className="ml-2 text-sm text-gray-500">Loading your items...</span>
                  </div>
                ) : filteredItems.length === 0 ? (
                  <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    {items.length === 0 ? "You don't have any items of this type yet." : "No items match your search."}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filteredItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedItem(selectedItem?.id === item.id ? null : item)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg border-2 px-4 py-3 text-left transition-colors",
                          selectedItem?.id === item.id
                            ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/30"
                            : "border-transparent hover:bg-gray-50 dark:hover:bg-gray-700/50"
                        )}
                      >
                        {selectedItem?.id === item.id ? (
                          <Check className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                        ) : (
                          <div className="h-5 w-5 rounded border-2 border-gray-300 dark:border-gray-500 flex-shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-gray-900 dark:text-white truncate">{item.title}</div>
                          {item.subtitle && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">{item.subtitle}</div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {selectedItem && (
                  <div className="mt-4">
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Note (optional)</label>
                    <textarea
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      rows={2}
                      placeholder="Add a note for your mentoring partner..."
                      value={manualNote}
                      onChange={(e) => setManualNote(e.target.value)}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {step === "select" && (
          <div className="border-t border-gray-200 px-6 py-4 dark:border-gray-700 flex justify-end gap-3">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={handleShare} disabled={submitting || !canShare}>
              {submitting ? "Sharing..." : "Share"}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
