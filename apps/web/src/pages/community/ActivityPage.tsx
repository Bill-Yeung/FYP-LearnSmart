import { useState, useEffect, useCallback } from "react"
import { Card } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { TextField } from "../../components/form/TextField"
import { apiClient } from "../../lib/api"
import { useAuth } from "../../contexts"
import { cn } from "../../../../../shared/utils"
import {
  Share2, Award, Users, Trophy, MessageCircle, Target,
  Flame, FileText, GraduationCap, Heart, UserPlus,
  Newspaper, Pin, ChevronUp, Plus, CheckCircle2, Send,
  Search, Upload, BookOpen, X, Paperclip, Link2, Download, FolderDown
} from "lucide-react"
import type { LucideIcon } from "lucide-react"


type Activity = {
  id: string
  type: string
  user: {
    id: string
    username: string
    display_name: string
    avatar_url: string | null
  }
  content: {
    title: string
    description: string
    link?: string
  }
  entity_type: string
  entity_id: string
  likes: number
  comments: number
  is_liked: boolean
  created_at: string | null
}

type FeedResponse = {
  activities: Activity[]
  total: number
  page: number
  page_size: number
}

type Comment = {
  id: string
  content: string
  user: {
    id: string
    username: string
    display_name: string
    avatar_url: string | null
  }
  created_at: string | null
}

type RequestStatus = "open" | "in_progress" | "completed" | "declined"

type ContentRequest = {
  id: string
  title: string
  description: string | null
  request_type: string
  status: RequestStatus
  total_votes: number
  contribution_count: number
  admin_response: string | null
  created_by: {
    id: string
    name: string
    avatar_url: string | null
  }
  created_at: string | null
  is_voted: boolean
}

type Contribution = {
  id: string
  content: string
  resource_id: string | null
  resource_type: string | null
  user: {
    id: string
    username: string
    display_name: string
    avatar_url: string | null
  }
  created_at: string | null
}

type ListResponse = {
  requests: ContentRequest[]
  total: number
  page: number
  page_size: number
}

type KBSearchResult = {
  id: string
  title: string
  description?: string
  resource_type: string
  source: string
  author?: string | null
}

type AttachedResource = {
  id: string
  title: string
  type: string
}

type PageTab = "feed" | "requests"
type FeedSubView = "all" | "following" | "community" | "classmates"
type ContributeMode = "text" | "knowledge" | "upload"


const ACTIVITY_ICONS: Record<string, LucideIcon> = {
  shared: Share2,
  achieved: Award,
  joined_community: Users,
  completed_challenge: Trophy,
  commented: MessageCircle,
  milestone_reached: Target,
  streak_milestone: Flame,
  created_content: FileText,
  started_mentoring: GraduationCap,
  liked: Heart,
  followed: UserPlus,
}

const ACTIVITY_COLORS: Record<string, string> = {
  shared: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  achieved: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  joined_community: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  completed_challenge: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  commented: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  milestone_reached: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  streak_milestone: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  created_content: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  started_mentoring: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  liked: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",
  followed: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
}

const REQUEST_CATEGORIES = ["content", "tutorial", "flashcard", "mindmap", "study_guide", "other"]
const CATEGORY_LABELS: Record<string, string> = {
  content: "Content", tutorial: "Tutorial", flashcard: "Flashcard",
  mindmap: "Mind Map", study_guide: "Study Guide", other: "Other",
}

function getIcon(type: string): LucideIcon {
  return ACTIVITY_ICONS[type] ?? Pin
}

function getColor(type: string) {
  return ACTIVITY_COLORS[type] ?? "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return ""
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

function getStatusColor(status: RequestStatus) {
  const colors: Record<RequestStatus, string> = {
    open: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    in_progress: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
    completed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    declined: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  }
  return colors[status]
}

function getStatusLabel(status: RequestStatus) {
  const labels: Record<RequestStatus, string> = {
    open: "Open", in_progress: "In Progress", completed: "Completed", declined: "Declined",
  }
  return labels[status]
}

export function ActivityPage() {
  const { user } = useAuth()
  const [pageTab, setPageTab] = useState<PageTab>("feed")
  const [feedSubView, setFeedSubView] = useState<FeedSubView>("all")

  const [activities, setActivities] = useState<Activity[]>([])
  const [feedLoading, setFeedLoading] = useState(true)
  const [feedError, setFeedError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [expandedComments, setExpandedComments] = useState<string | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [commentText, setCommentText] = useState("")

  const [followingSet, setFollowingSet] = useState<Set<string>>(new Set())

  useEffect(() => {
    async function loadFollowing() {
      try {
        const data = await apiClient.get<{ users: { id: string }[] }>("/api/follows/following?page_size=100")
        setFollowingSet(new Set((data?.users ?? []).map(u => u.id)))
      } catch { }
    }
    loadFollowing()
  }, [])

  // toggle follow/unfollow for a user and update the local set without a refetch
  async function handleFollow(userId: string) {
    try {
      if (followingSet.has(userId)) {
        await apiClient.delete(`/api/follows/${userId}`)
        setFollowingSet(prev => { const next = new Set(prev); next.delete(userId); return next })
      } else {
        await apiClient.post(`/api/follows/${userId}`)
        setFollowingSet(prev => new Set(prev).add(userId))
      }
    } catch { }
  }

  const [reqTab, setReqTab] = useState<"all" | "my">("all")
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [requests, setRequests] = useState<ContentRequest[]>([])
  const [reqLoading, setReqLoading] = useState(false)
  const [reqError, setReqError] = useState<string | null>(null)

  const [expandedRequest, setExpandedRequest] = useState<string | null>(null)
  const [contributions, setContributions] = useState<Contribution[]>([])
  const [contributionText, setContributionText] = useState("")
  const [showContributeForm, setShowContributeForm] = useState<string | null>(null)
  const [contributeMode, setContributeMode] = useState<ContributeMode>("text")
  const [kbQuery, setKbQuery] = useState("")
  const [kbResults, setKbResults] = useState<KBSearchResult[]>([])
  const [kbSearching, setKbSearching] = useState(false)
  const [attachedResource, setAttachedResource] = useState<AttachedResource | null>(null)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [attachedFile, setAttachedFile] = useState<{ id: string; name: string } | null>(null)

  const fetchActivities = useCallback(async (p: number) => {
    setFeedLoading(true)
    setFeedError(null)
    try {
      const feedType = feedSubView
      const params = new URLSearchParams({ feed_type: feedType, page: String(p), page_size: "20" })
      const data = await apiClient.get<FeedResponse>(`/api/activity-feed?${params}`)
      setActivities(data?.activities ?? [])
      setTotal(data?.total ?? 0)
      setPage(p)
    } catch {
      setFeedError("Failed to load activity feed")
    } finally {
      setFeedLoading(false)
    }
  }, [feedSubView])

  useEffect(() => { if (pageTab === "feed") fetchActivities(1) }, [fetchActivities, pageTab])

  async function handleLike(activityId: string) {
    try {
      const res = await apiClient.post<{ liked: boolean }>(`/api/activity-feed/${activityId}/like`)
      if (!res) return
      setActivities(prev =>
        prev.map(a => {
          if (a.id !== activityId) return a
          return { ...a, is_liked: res.liked, likes: a.likes + (res.liked ? 1 : -1) }
        })
      )
    } catch { }
  }

  async function toggleComments(activityId: string) {
    if (expandedComments === activityId) {
      setExpandedComments(null)
      setComments([])
      setCommentText("")
      return
    }
    setExpandedComments(activityId)
    try {
      const data = await apiClient.get<{ comments: Comment[] }>(`/api/activity-feed/${activityId}/comments`)
      setComments(data?.comments ?? [])
    } catch { setComments([]) }
  }

  async function handlePostComment(activityId: string) {
    if (!commentText.trim()) return
    try {
      const params = new URLSearchParams({ content: commentText.trim() })
      await apiClient.post(`/api/activity-feed/${activityId}/comments?${params}`)
      setCommentText("")
      const data = await apiClient.get<{ comments: Comment[] }>(`/api/activity-feed/${activityId}/comments`)
      setComments(data?.comments ?? [])
      setActivities(prev =>
        prev.map(a => a.id === activityId ? { ...a, comments: a.comments + 1 } : a)
      )
    } catch { }
  }

  const hasMore = activities.length > 0 && page * 20 < total

  const fetchRequests = useCallback(async () => {
    setReqLoading(true)
    setReqError(null)
    try {
      const params = new URLSearchParams({ tab: reqTab, page: "1", page_size: "50" })
      const data = await apiClient.get<ListResponse>(`/api/content-requests?${params}`)
      setRequests(data?.requests ?? [])
    } catch {
      setReqError("Failed to load content requests")
    } finally {
      setReqLoading(false)
    }
  }, [reqTab])

  useEffect(() => {
    if (pageTab === "requests") fetchRequests()
  }, [pageTab, fetchRequests])

  async function handleVote(requestId: string) {
    try {
      const res = await apiClient.post<{ voted: boolean }>(`/api/content-requests/${requestId}/vote`)
      if (!res) return
      setRequests(prev =>
        prev.map(r => {
          if (r.id !== requestId) return r
          return { ...r, is_voted: res.voted, total_votes: r.total_votes + (res.voted ? 1 : -1) }
        })
      )
    } catch { }
  }

  function resetContributeForm() {
    setContributionText("")
    setContributeMode("text")
    setKbQuery("")
    setKbResults([])
    setAttachedResource(null)
    setAttachedFile(null)
  }

  async function toggleContributions(requestId: string) {
    if (expandedRequest === requestId) {
      setExpandedRequest(null)
      setContributions([])
      setShowContributeForm(null)
      resetContributeForm()
      return
    }
    setExpandedRequest(requestId)
    setShowContributeForm(null)
    resetContributeForm()
    try {
      const data = await apiClient.get<{ contributions: Contribution[] }>(
        `/api/content-requests/${requestId}/contributions`
      )
      setContributions(data?.contributions ?? [])
    } catch { setContributions([]) }
  }

  // search my saved knowledge-base resources to attach to a contribution
  async function handleKBSearch(query: string) {
    setKbQuery(query)
    if (!query.trim()) { setKbResults([]); return }
    setKbSearching(true)
    try {
      const params = new URLSearchParams({ q: query.trim(), limit: "10" })
      const data = await apiClient.get<{ results: KBSearchResult[] }>(`/api/content-requests/search/resources?${params}`)
      setKbResults(data?.results ?? [])
    } catch { setKbResults([]) } finally { setKbSearching(false) }
  }

  async function handleFileUpload(file: File) {
    setUploadingFile(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("title", file.name)
      formData.append("is_public", "true")
      const data = await apiClient.upload<{ document_id: string }[] | { document_id: string }>(
        "/api/documents/upload", formData
      )
      const docId = Array.isArray(data) ? data[0]?.document_id : data?.document_id
      if (docId) {
        setAttachedFile({ id: docId, name: file.name })
      }
    } catch { } finally { setUploadingFile(false) }
  }

  async function handleContribute(requestId: string) {
    const text = contributionText.trim()
    const resourceId = attachedResource?.id || attachedFile?.id || null
    const resourceType = attachedResource ? attachedResource.type : attachedFile ? "document" : null
    const label = attachedResource?.title || attachedFile?.name || null

    let fullContent = text
    if (label && !text) {
      fullContent = `Attached: ${label}`
    } else if (label && text) {
      fullContent = `${text}\n\nAttached: ${label}`
    }

    if (!fullContent) return
    try {
      const params = new URLSearchParams({ content: fullContent })
      if (resourceId) params.set("resource_id", resourceId)
      if (resourceType) params.set("resource_type", resourceType)
      await apiClient.post(`/api/content-requests/${requestId}/contributions?${params}`)
      resetContributeForm()
      setShowContributeForm(null)
      const data = await apiClient.get<{ contributions: Contribution[] }>(
        `/api/content-requests/${requestId}/contributions`
      )
      setContributions(data?.contributions ?? [])
      setRequests(prev =>
        prev.map(r => {
          if (r.id !== requestId) return r
          return {
            ...r,
            contribution_count: r.contribution_count + 1,
            status: r.status === "open" ? "in_progress" as const : r.status,
          }
        })
      )
    } catch { }
  }

  const [savedResources, setSavedResources] = useState<Set<string>>(new Set())

  async function handleSaveToLibrary(resourceId: string, resourceType: string) {
    try {
      if (resourceType === "document") {
        window.open(`/api/documents/${resourceId}/download`, "_blank")
      } else {
        const params = new URLSearchParams({ resource_id: resourceId, resource_type: resourceType })
        await apiClient.post(`/api/content-requests/contributions/save-resource?${params}`)
        setSavedResources(prev => new Set(prev).add(resourceId))
      }
    } catch { }
  }

  async function handleMarkComplete(requestId: string) {
    try {
      await apiClient.post(`/api/content-requests/${requestId}/complete`)
      setRequests(prev =>
        prev.map(r => r.id === requestId ? { ...r, status: "completed" as const } : r)
      )
    } catch { }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Activities</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            See what's happening and request study materials
          </p>
        </div>
        {pageTab === "requests" && (
          <Button onClick={() => setIsCreateModalOpen(true)}>New Request</Button>
        )}
      </div>

      <div className="mb-6 flex gap-2">
        {([
          { id: "feed" as const, label: "Activity Feed", Icon: Newspaper },
          { id: "requests" as const, label: "Content Requests", Icon: FileText },
        ]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setPageTab(tab.id)}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              pageTab === tab.id
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            )}
          >
            <tab.Icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {pageTab === "feed" && (
        <>
          <div className="mb-4 flex border-b border-gray-200 dark:border-gray-700">
            {([
              { id: "all" as const, label: "All" },
              { id: "following" as const, label: "Following" },
              { id: "classmates" as const, label: "Classmates" },
              { id: "community" as const, label: "Communities" },
            ]).map((sv) => (
              <button
                key={sv.id}
                onClick={() => setFeedSubView(sv.id)}
                className={cn(
                  "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px",
                  feedSubView === sv.id
                    ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
                )}
              >
                {sv.label}
              </button>
            ))}
          </div>

          {feedLoading && (
            <Card><div className="py-12 text-center text-gray-500 dark:text-gray-400">Loading...</div></Card>
          )}
          {feedError && (
            <Card><div className="py-12 text-center text-red-500">{feedError}</div></Card>
          )}

          {!feedLoading && !feedError && activities.length === 0 && (
            <Card>
              <div className="py-12 text-center">
                <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                  <Newspaper className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">No activity yet</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {feedSubView === "following"
                    ? "Follow other users to see their activity here"
                    : feedSubView === "classmates"
                    ? "Join a class to see activity from your classmates"
                    : "Be the first to do something!"}
                </p>
              </div>
            </Card>
          )}

          {!feedLoading && !feedError && activities.length > 0 && (
            <div className="space-y-4">
              {activities.map((activity) => (
                <Card key={activity.id}>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div
                        className="h-10 w-10 rounded-full flex items-center justify-center text-white font-medium flex-shrink-0"
                        style={{ backgroundColor: "#6B7280" }}
                      >
                        {activity.user.avatar_url ? (
                          <img src={activity.user.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                        ) : (
                          activity.user.display_name.charAt(0)
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-gray-900 dark:text-white">{activity.user.display_name}</span>
                          {(() => { const Icon = getIcon(activity.type); return (
                            <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", getColor(activity.type))}>
                              <Icon className="w-3 h-3" /> {activity.content.title}
                            </span>
                          )})()}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          @{activity.user.username} · {formatDate(activity.created_at)}
                        </div>
                      </div>
                      {activity.user.id !== user?.id && (
                        <button
                          onClick={() => handleFollow(activity.user.id)}
                          className={cn(
                            "flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors flex-shrink-0",
                            followingSet.has(activity.user.id)
                              ? "bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-600 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                              : "bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40"
                          )}
                        >
                          {followingSet.has(activity.user.id)
                            ? <><UserPlus className="w-3.5 h-3.5" /> Following</>
                            : <><UserPlus className="w-3.5 h-3.5" /> Follow</>
                          }
                        </button>
                      )}
                    </div>

                    <div className="pl-13">
                      {activity.content.description && (
                        <p className="text-gray-700 dark:text-gray-300">{activity.content.description}</p>
                      )}
                      {activity.content.link && (
                        <a href={activity.content.link} className="mt-2 inline-block text-sm text-blue-600 hover:underline dark:text-blue-400">
                          View →
                        </a>
                      )}
                    </div>

                    <div className="flex items-center gap-6 pt-2 border-t border-gray-100 dark:border-gray-700">
                      <button
                        onClick={() => handleLike(activity.id)}
                        className={cn("flex items-center gap-1.5 text-sm transition-colors",
                          activity.is_liked ? "text-red-500" : "text-gray-500 hover:text-red-500 dark:text-gray-400"
                        )}
                      >
                        <Heart className={cn("w-4 h-4", activity.is_liked && "fill-current")} />
                        <span>{activity.likes}</span>
                      </button>
                      <button
                        onClick={() => toggleComments(activity.id)}
                        className={cn("flex items-center gap-1.5 text-sm transition-colors",
                          expandedComments === activity.id ? "text-blue-500" : "text-gray-500 hover:text-blue-500 dark:text-gray-400"
                        )}
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span>{activity.comments}</span>
                      </button>
                    </div>

                    {expandedComments === activity.id && (
                      <div className="border-t border-gray-100 pt-3 dark:border-gray-700">
                        {comments.length > 0 ? (
                          <div className="space-y-3 mb-3">
                            {comments.map((c) => (
                              <div key={c.id} className="flex gap-2">
                                <div className="h-6 w-6 rounded-full bg-gray-300 flex items-center justify-center text-xs text-white flex-shrink-0">
                                  {c.user.display_name?.charAt(0) ?? "?"}
                                </div>
                                <div>
                                  <span className="text-sm font-medium text-gray-900 dark:text-white">{c.user.display_name}</span>
                                  <span className="ml-2 text-xs text-gray-400">{formatDate(c.created_at)}</span>
                                  <p className="text-sm text-gray-600 dark:text-gray-400">{c.content}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="mb-3 text-sm text-gray-400">No comments yet</p>
                        )}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Add a comment..."
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") handlePostComment(activity.id) }}
                            className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                          />
                          <Button variant="secondary" onClick={() => handlePostComment(activity.id)} disabled={!commentText.trim()}>
                            Post
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}

          {!feedLoading && hasMore && (
            <div className="mt-6 text-center">
              <Button variant="secondary" onClick={() => fetchActivities(page + 1)}>Load More</Button>
            </div>
          )}
        </>
      )}

      {pageTab === "requests" && (
        <>
          {/* Sub-tabs */}
          <div className="mb-4 flex border-b border-gray-200 dark:border-gray-700">
            {([
              { id: "all" as const, label: "All Requests" },
              { id: "my" as const, label: "My Requests" },
            ]).map((sv) => (
              <button
                key={sv.id}
                onClick={() => setReqTab(sv.id)}
                className={cn(
                  "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px",
                  reqTab === sv.id
                    ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
                )}
              >
                {sv.label}
              </button>
            ))}
          </div>

          {reqLoading && (
            <Card><div className="py-12 text-center text-gray-500 dark:text-gray-400">Loading...</div></Card>
          )}
          {reqError && (
            <Card><div className="py-12 text-center text-red-500">{reqError}</div></Card>
          )}

          {!reqLoading && !reqError && requests.length === 0 && (
            <Card>
              <div className="py-12 text-center">
                <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                  <FileText className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">No requests found</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {reqTab === "my" ? "You haven't submitted any requests yet" : "Be the first to request content!"}
                </p>
                <Button className="mt-4" onClick={() => setIsCreateModalOpen(true)}>Create Request</Button>
              </div>
            </Card>
          )}

          {/* Request List */}
          {!reqLoading && !reqError && requests.length > 0 && (
            <div className="space-y-4">
              {requests.map((request) => {
                const isCreator = user?.id === request.created_by.id
                const isOpen = request.status === "open" || request.status === "in_progress"

                return (
                  <Card key={request.id} className="hover:shadow-md transition-shadow">
                    <div className="space-y-3">
                      <div className="flex gap-4">
                        {/* Vote column */}
                        <div className="flex flex-col items-center gap-1">
                          <button
                            onClick={() => handleVote(request.id)}
                            className={cn(
                              "h-8 w-8 rounded flex items-center justify-center transition-colors",
                              request.is_voted
                                ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                                : "bg-gray-100 text-gray-400 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
                            )}
                          >
                            <ChevronUp className="w-4 h-4" />
                          </button>
                          <span className={cn("font-semibold text-lg",
                            request.is_voted ? "text-blue-600 dark:text-blue-400" : "text-gray-700 dark:text-gray-300"
                          )}>
                            {request.total_votes}
                          </span>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-gray-900 dark:text-white">{request.title}</h3>
                            <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", getStatusColor(request.status))}>
                              {getStatusLabel(request.status)}
                            </span>
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                              {CATEGORY_LABELS[request.request_type] ?? request.request_type}
                            </span>
                          </div>
                          {request.description && (
                            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{request.description}</p>
                          )}
                          <div className="mt-3 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                            <span>by {request.created_by.name} · {formatDate(request.created_at)}</span>
                            <button
                              onClick={() => toggleContributions(request.id)}
                              className={cn(
                                "flex items-center gap-1 hover:text-blue-500 transition-colors",
                                expandedRequest === request.id && "text-blue-500"
                              )}
                            >
                              <MessageCircle className="w-3 h-3" />
                              {request.contribution_count} {request.contribution_count === 1 ? "contribution" : "contributions"}
                            </button>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 flex-shrink-0">
                          {isOpen && !isCreator && (
                            <Button
                              variant="secondary"
                              onClick={() => {
                                if (expandedRequest !== request.id) toggleContributions(request.id)
                                setShowContributeForm(request.id)
                              }}
                            >
                              <Plus className="w-4 h-4 mr-1" />
                              Contribute
                            </Button>
                          )}
                          {isCreator && isOpen && (
                            <Button
                              variant="secondary"
                              onClick={() => handleMarkComplete(request.id)}
                            >
                              <CheckCircle2 className="w-4 h-4 mr-1" />
                              Mark Complete
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Expanded contributions */}
                      {expandedRequest === request.id && (
                        <div className="border-t border-gray-100 pt-3 dark:border-gray-700">
                          {contributions.length > 0 ? (
                            <div className="space-y-3 mb-3">
                              {contributions.map((c) => (
                                <div key={c.id} className="flex gap-2">
                                  <div className="h-7 w-7 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-xs text-blue-700 dark:text-blue-300 font-medium flex-shrink-0">
                                    {c.user.display_name?.charAt(0) ?? "?"}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                                        {c.user.display_name}
                                      </span>
                                      <span className="text-xs text-gray-400">{formatDate(c.created_at)}</span>
                                    </div>
                                    <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{c.content}</p>
                                    {c.resource_id && c.resource_type === "document" && (
                                      <button
                                        onClick={() => handleSaveToLibrary(c.resource_id!, "document")}
                                        className="mt-1 inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40 transition-colors"
                                      >
                                        <Download className="w-3 h-3" /> Download file
                                      </button>
                                    )}
                                    {c.resource_id && c.resource_type && c.resource_type !== "document" && (
                                      <button
                                        onClick={() => handleSaveToLibrary(c.resource_id!, c.resource_type!)}
                                        disabled={savedResources.has(c.resource_id!)}
                                        className={cn(
                                          "mt-1 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
                                          savedResources.has(c.resource_id!)
                                            ? "bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400"
                                            : "bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40"
                                        )}
                                      >
                                        <FolderDown className="w-3 h-3" />
                                        {savedResources.has(c.resource_id!) ? "Saved to Library" : `Save ${c.resource_type} to My Library`}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="mb-3 text-sm text-gray-400">No contributions yet. Be the first to help!</p>
                          )}

                          {/* Contribute form */}
                          {showContributeForm === request.id && isOpen && (
                            <div className="mt-3 space-y-3 rounded-lg border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-800 dark:bg-blue-900/10">
                              {/* Mode tabs */}
                              <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 pb-2">
                                {([
                                  { id: "text" as const, label: "Write", icon: Send },
                                  { id: "knowledge" as const, label: "Knowledge Base", icon: BookOpen },
                                  { id: "upload" as const, label: "Upload File", icon: Upload },
                                ] as const).map((m) => (
                                  <button
                                    key={m.id}
                                    onClick={() => setContributeMode(m.id)}
                                    className={cn(
                                      "flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors",
                                      contributeMode === m.id
                                        ? "bg-blue-600 text-white"
                                        : "text-gray-600 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700"
                                    )}
                                  >
                                    <m.icon className="w-3 h-3" /> {m.label}
                                  </button>
                                ))}
                              </div>

                              {/* Attached resource/file badge */}
                              {(attachedResource || attachedFile) && (
                                <div className="flex items-center gap-2 rounded-md bg-green-50 px-3 py-1.5 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-300">
                                  <Paperclip className="w-3.5 h-3.5" />
                                  <span className="flex-1 truncate">
                                    {attachedResource?.title || attachedFile?.name}
                                  </span>
                                  <button
                                    onClick={() => { setAttachedResource(null); setAttachedFile(null) }}
                                    className="text-green-600 hover:text-red-500 dark:text-green-400"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}

                              {/* Text mode */}
                              {contributeMode === "text" && (
                                <textarea
                                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                                  rows={3}
                                  placeholder="Share your knowledge, describe resources, or explain what you can provide..."
                                  value={contributionText}
                                  onChange={(e) => setContributionText(e.target.value)}
                                />
                              )}

                              {/* Knowledge Base search mode */}
                              {contributeMode === "knowledge" && (
                                <div className="space-y-2">
                                  <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                      type="text"
                                      placeholder="Search your knowledge base..."
                                      value={kbQuery}
                                      onChange={(e) => handleKBSearch(e.target.value)}
                                      className="w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                                    />
                                  </div>
                                  {kbSearching && (
                                    <p className="text-xs text-gray-400 px-1">Searching...</p>
                                  )}
                                  {kbResults.length > 0 && (
                                    <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700">
                                      {kbResults.map((r) => (
                                        <button
                                          key={r.id}
                                          onClick={() => {
                                            setAttachedResource({
                                              id: r.id,
                                              title: r.title,
                                              type: r.resource_type,
                                            })
                                            setKbResults([])
                                            setKbQuery("")
                                            setContributeMode("text")
                                          }}
                                          className="w-full flex items-start gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                                        >
                                          <Link2 className="w-4 h-4 mt-0.5 text-blue-500 flex-shrink-0" />
                                          <div className="min-w-0">
                                            <p className="font-medium text-gray-900 dark:text-white truncate">{r.title}</p>
                                            {r.description && (
                                              <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">{r.description}</p>
                                            )}
                                            <span className="text-xs text-gray-400">
                                              {r.resource_type}{r.author ? ` · ${r.author}` : ""}
                                            </span>
                                          </div>
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                  {kbQuery && !kbSearching && kbResults.length === 0 && (
                                    <p className="text-xs text-gray-400 px-1">No results found</p>
                                  )}
                                  <textarea
                                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                                    rows={2}
                                    placeholder="Add a note about the attached resource (optional)..."
                                    value={contributionText}
                                    onChange={(e) => setContributionText(e.target.value)}
                                  />
                                </div>
                              )}

                              {/* Upload file mode */}
                              {contributeMode === "upload" && (
                                <div className="space-y-2">
                                  {!attachedFile && (
                                    <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-gray-300 bg-white px-4 py-6 text-center transition-colors hover:border-blue-400 hover:bg-blue-50/50 dark:border-gray-600 dark:bg-gray-700 dark:hover:border-blue-500 dark:hover:bg-blue-900/10">
                                      <Upload className="w-6 h-6 text-gray-400" />
                                      {uploadingFile ? (
                                        <p className="text-sm text-gray-500">Uploading...</p>
                                      ) : (
                                        <>
                                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                            Click to upload a file
                                          </p>
                                          <p className="text-xs text-gray-400">PDF, Word, images, and more</p>
                                        </>
                                      )}
                                      <input
                                        type="file"
                                        className="hidden"
                                        disabled={uploadingFile}
                                        onChange={(e) => {
                                          const file = e.target.files?.[0]
                                          if (file) handleFileUpload(file)
                                        }}
                                      />
                                    </label>
                                  )}
                                  <textarea
                                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                                    rows={2}
                                    placeholder="Add a note about the uploaded file (optional)..."
                                    value={contributionText}
                                    onChange={(e) => setContributionText(e.target.value)}
                                  />
                                </div>
                              )}

                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  onClick={() => {
                                    setShowContributeForm(null)
                                    resetContributeForm()
                                  }}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  onClick={() => handleContribute(request.id)}
                                  disabled={!contributionText.trim() && !attachedResource && !attachedFile}
                                >
                                  <Send className="w-4 h-4 mr-1" />
                                  Submit
                                </Button>
                              </div>
                            </div>
                          )}

                          {/* Show contribute form trigger if not already showing */}
                          {showContributeForm !== request.id && isOpen && !isCreator && (
                            <button
                              onClick={() => setShowContributeForm(request.id)}
                              className="mt-2 flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                            >
                              <Plus className="w-3.5 h-3.5" /> Add a contribution
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </Card>
                )
              })}
            </div>
          )}

          {/* Create Request Modal */}
          {isCreateModalOpen && (
            <CreateRequestModal onClose={() => setIsCreateModalOpen(false)} onCreated={fetchRequests} />
          )}
        </>
      )}
    </div>
  )
}


function CreateRequestModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("")
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    if (!title.trim()) return
    setSubmitting(true)
    try {
      const params = new URLSearchParams({ title: title.trim() })
      if (category) params.set("request_type", category)
      if (description.trim()) params.set("description", description.trim())
      await apiClient.post(`/api/content-requests?${params}`)
      onCreated()
      onClose()
    } catch { /* ignore */ } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">New Content Request</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Describe what study materials you're looking for</p>

        <div className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Title</label>
            <TextField label="" placeholder="e.g., Need study materials for Data Structures" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
            <select
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              value={category} onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">Select a category</option>
              {REQUEST_CATEGORIES.filter(c => c !== "All").map((cat) => (
                <option key={cat} value={cat}>{CATEGORY_LABELS[cat] ?? cat}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
            <textarea
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              rows={4} placeholder="Describe what specific topics or materials you're looking for..."
              value={description} onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting || !title.trim()}>
            {submitting ? "Submitting..." : "Submit Request"}
          </Button>
        </div>
      </div>
    </div>
  )
}
