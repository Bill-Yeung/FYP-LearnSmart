import { useState, useEffect, useCallback, useRef } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Card } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { TextField } from "../../components/form/TextField"
import { ResourcePreviewModal } from "../../components/general/ResourcePreviewModal"
import { cn } from "../../../../../shared/utils"
import { useAuth } from "../../contexts"
import { apiClient } from "../../lib/api"
import { logActivity } from "../../lib/activityLog"
import {
  MessageSquare, BookOpen, Users, Trophy, Settings,
  Heart, Eye, Pin, PinOff, ArrowLeft, X, Plus, Link, Search, Check, Bookmark, Star,
  MapPin, Layers, FileText, Lightbulb, Route, Image as ImageIcon, Square, Trash2, Upload, Download,
  UserCheck, UserX, UserPlus, UserMinus
} from "lucide-react"
import { useConfirmDialog } from "../../components/general/ConfirmDialog"


type TabType = "discussions" | "resources" | "members" | "leaderboard" | "settings"

type Community = {
  id: string
  name: string
  url_id: string
  description: string | null
  community_type: string
  member_count: number
  resource_count: number
  color_theme: string | null
  is_member: boolean
  is_pending?: boolean
  is_invited?: boolean
  invitation_id?: string | null
  my_role: string | null
  pending_count?: number
}

type PendingMember = {
  user_id: string
  username: string
  display_name: string | null
  applied_at: string | null
  type?: "application" | "invitation"
  invited_by?: string | null
}

type Discussion = {
  id: string
  title: string
  content: string
  thread_type: string
  is_pinned: boolean
  view_count: number
  reply_count: number
  like_count: number
  tags: string[]
  created_at: string | null
  last_activity_at: string | null
  author: { id: string; username: string | null; display_name: string | null }
  has_liked?: boolean
}

type Reply = {
  id: string
  thread_id: string
  parent_reply_id: string | null
  content: string
  is_accepted: boolean
  like_count: number
  created_at: string | null
  author: { id: string; username: string | null; display_name: string | null }
  has_liked?: boolean
}

type MemberEntry = {
  user_id: string
  username: string
  display_name: string | null
  role: string
  contribution_points: number
  joined_at: string | null
}

type SharedContentItem = {
  id: string
  user_id: string
  title: string
  description: string | null
  entity_type: string
  entity_id: string
  view_count: number
  download_count: number
  like_count: number
  average_rating: number | null
  rating_count: number
  tags: string[]
  file_url: string | null
  file_size: number | null
  created_at: string | null
  author: { username: string | null; display_name: string | null }
  has_liked?: boolean
  has_saved?: boolean
}

type LeaderEntry = {
  rank: number
  user_id: string
  username: string
  display_name: string | null
  contribution_points: number
}


export function CommunityDetailPage() {
  const { user } = useAuth()
  const { communityId } = useParams()
  const navigate = useNavigate()

  const { confirm: confirmDialog, dialogProps: confirmDialogProps, ConfirmDialog } = useConfirmDialog()

  const [community, setCommunity] = useState<Community | null>(null)
  const [discussions, setDiscussions] = useState<Discussion[]>([])
  const [resources, setResources] = useState<SharedContentItem[]>([])
  const [members, setMembers] = useState<MemberEntry[]>([])
  const [leaderboard, setLeaderboard] = useState<LeaderEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState<TabType>("discussions")
  const [isCreateThreadOpen, setIsCreateThreadOpen] = useState(false)
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false)
  const [selectedDiscussion, setSelectedDiscussion] = useState<Discussion | null>(null)
  const [isShareResourceOpen, setIsShareResourceOpen] = useState(false)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [membersVisible, setMembersVisible] = useState(20)
  const [pendingMembers, setPendingMembers] = useState<PendingMember[]>([])
  const [pendingActionLoading, setPendingActionLoading] = useState<string | null>(null)
  const [followingSet, setFollowingSet] = useState<Set<string>>(new Set())

  useEffect(() => {
    async function loadFollowing() {
      try {
        const data = await apiClient.get<{ users: { id: string }[] }>("/api/follows/following?page_size=100")
        setFollowingSet(new Set((data?.users ?? []).map((u: { id: string }) => u.id)))
      } catch { }
    }
    loadFollowing()
  }, [])

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

  const fetchCommunity = useCallback(async () => {
    if (!communityId) return
    try {
      setError(null)
      const data = await apiClient.get<{ community: Community }>(`/api/communities/${communityId}`)
      setCommunity(data?.community ?? null)
    } catch (e: any) {
      setError(e?.message || "Failed to load community")
    } finally {
      setLoading(false)
    }
  }, [communityId])

  const fetchDiscussions = useCallback(async () => {
    if (!community) return
    try {
      const data = await apiClient.get<{ threads: Discussion[] }>(
        `/api/discussions?community_id=${community.id}&page_size=50`
      )
      setDiscussions(data?.threads ?? [])
    } catch { }
  }, [community])

  const fetchResources = useCallback(async () => {
    if (!community) return
    try {
      const data = await apiClient.get<{ items: SharedContentItem[] }>(
        `/api/shared-content?community_id=${community.id}&page_size=50`
      )
      setResources(data?.items ?? [])
    } catch { }
  }, [community])

  const fetchMembers = useCallback(async () => {
    if (!communityId) return
    try {
      const data = await apiClient.get<{ members: MemberEntry[] }>(
        `/api/communities/${communityId}/members?page_size=100`
      )
      setMembers(data?.members ?? [])
    } catch { }
  }, [communityId])

  const fetchPendingMembers = useCallback(async () => {
    if (!communityId || !community?.my_role || !["owner", "admin", "moderator"].includes(community.my_role)) {
      setPendingMembers([])
      return
    }
    try {
      const data = await apiClient.get<{ pending: PendingMember[] }>(
        `/api/communities/${communityId}/pending`
      )
      setPendingMembers(data?.pending ?? [])
    } catch { }
  }, [communityId, community?.my_role])

  const fetchLeaderboard = useCallback(async () => {
    if (!communityId) return
    try {
      const data = await apiClient.get<{ leaderboard: LeaderEntry[] }>(
        `/api/communities/${communityId}/leaderboard?limit=20`
      )
      setLeaderboard(data?.leaderboard ?? [])
    } catch { }
  }, [communityId])

  useEffect(() => { fetchCommunity() }, [fetchCommunity])

  useEffect(() => {
    if (!community) return
    if (activeTab === "discussions") fetchDiscussions()
    else if (activeTab === "resources") fetchResources()
    else if (activeTab === "members") { fetchMembers(); fetchPendingMembers() }
    else if (activeTab === "leaderboard") fetchLeaderboard()
    else if (activeTab === "settings") fetchMembers()
  }, [community, activeTab, fetchDiscussions, fetchResources, fetchMembers, fetchPendingMembers, fetchLeaderboard])

  // private communities go through "apply", everything else is a direct join
  async function handleJoin() {
    if (!communityId || !community) return
    try {
      if (community.community_type === "private") {
        await apiClient.post(`/api/communities/${communityId}/apply`, {})
      } else {
        await apiClient.post(`/api/communities/${communityId}/join`, {})
      }
      await fetchCommunity()
    } catch (e: any) { setError(e?.message || "Failed to join") }
  }

  async function handleApproveMember(userId: string) {
    if (!communityId) return
    setPendingActionLoading(userId)
    try {
      await apiClient.post(`/api/communities/${communityId}/members/${userId}/approve`, {})
      await Promise.all([fetchPendingMembers(), fetchMembers(), fetchCommunity()])
    } catch (e: any) { setError(e?.message || "Failed to approve member") }
    finally { setPendingActionLoading(null) }
  }

  async function handleRejectMember(userId: string) {
    if (!communityId) return
    setPendingActionLoading(userId)
    try {
      await apiClient.post(`/api/communities/${communityId}/members/${userId}/reject`, {})
      await Promise.all([fetchPendingMembers(), fetchCommunity()])
    } catch (e: any) { setError(e?.message || "Failed to reject member") }
    finally { setPendingActionLoading(null) }
  }

  async function handleLeave() {
    if (!communityId) return
    try {
      await apiClient.post(`/api/communities/${communityId}/leave`, {})
      await fetchCommunity()
    } catch (e: any) { setError(e?.message || "Failed to leave") }
  }

  async function handleLikeThread(threadId: string) {
    try {
      await apiClient.post(`/api/discussions/${threadId}/like`, {})
      await fetchDiscussions()
    } catch { }
  }

  async function handlePinThread(threadId: string, currentlyPinned: boolean) {
    try {
      await apiClient.post(`/api/discussions/${threadId}/pin?pinned=${!currentlyPinned}`, {})
      await fetchDiscussions()
    } catch { }
  }

  async function handleLikeResource(contentId: string) {
    try {
      await apiClient.post(`/api/shared-content/${contentId}/like`, {})
      await fetchResources()
    } catch { }
  }

  async function handleSaveResource(contentId: string, entityType?: string) {
    try {
      await apiClient.post(`/api/shared-content/${contentId}/save`, {})
      if (entityType === "flashcard") {
        logActivity("flashcard", "obtain", contentId)
      }
      await fetchResources()
    } catch { }
  }

  async function handleDeleteResource(contentId: string) {
    const yes = await confirmDialog({
      title: "Delete Resource",
      message: "Are you sure you want to delete this shared resource? This action cannot be undone.",
      confirmLabel: "Delete",
      variant: "danger",
    })
    if (!yes) return
    try {
      await apiClient.delete(`/api/shared-content/${contentId}`)
      await fetchResources()
    } catch { }
  }

  const isPrivileged = community?.my_role === "owner" || community?.my_role === "admin"
  const isOwner = community?.my_role === "owner"
  const canModerate = isPrivileged || community?.my_role === "moderator"

  function formatDate(dateStr: string | null) {
    if (!dateStr) return ""
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    if (diffDays === 0) return "Today"
    if (diffDays === 1) return "Yesterday"
    if (diffDays < 7) return `${diffDays} days ago`
    return date.toLocaleDateString()
  }

  function getRoleBadge(role: string) {
    const colors: Record<string, string> = {
      owner: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
      admin: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
      moderator: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
      member: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300"
    }
    return colors[role] || colors.member
  }

  const [previewResource, setPreviewResource] = useState<SharedContentItem | null>(null)

  function getEntityIcon(type: string) {
    const iconMap: Record<string, typeof MapPin> = {
      diagram: MapPin, flashcard: Layers, source: FileText, vr_scenario: Square,
      concept: Lightbulb, learning_path: Route, extracted_media: ImageIcon,
      note: FileText, link: Link, file: FileText,
    }
    const Icon = iconMap[type] || BookOpen
    return <Icon className="h-6 w-6 text-gray-500 dark:text-gray-400" />
  }

  function authorName(author: { username: string | null; display_name: string | null }) {
    return author.display_name || author.username || "Unknown"
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

  if (!community) {
    return (
      <div className="mx-auto max-w-5xl">
        <Card>
          <div className="py-12 text-center text-gray-500 dark:text-gray-400">
            Community not found.
            <button onClick={() => navigate("/community/studygroups")} className="ml-2 text-blue-600 underline">
              Back to communities
            </button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <button
          onClick={() => navigate("/community/studygroups")}
          className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Communities
        </button>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
            {error}
            <button onClick={() => setError(null)} className="ml-2 font-medium underline">Dismiss</button>
          </div>
        )}

        <Card>
          <div className="flex gap-4">
            <div
              className="h-20 w-20 rounded-xl flex items-center justify-center text-white font-bold text-3xl flex-shrink-0"
              style={{ backgroundColor: community.color_theme || "#3B82F6" }}
            >
              {community.name.charAt(0)}
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{community.name}</h1>
              <p className="mt-1 text-gray-500 dark:text-gray-400">
                {community.description || "No description"}
              </p>
              <div className="mt-3 flex items-center gap-6 text-sm text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1"><Users className="h-4 w-4" /> {community.member_count} members</span>
                <span className="flex items-center gap-1"><BookOpen className="h-4 w-4" /> {community.resource_count} resources</span>
                <span className="flex items-center gap-1 capitalize">{community.community_type.replace("_", " ")}</span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {community.is_member ? (
                <>
                  <Button variant="secondary" onClick={() => { fetchMembers(); setIsInviteModalOpen(true) }}>Invite</Button>
                  {community.my_role !== "owner" && (
                    <Button variant="ghost" onClick={() => setShowLeaveConfirm(true)}>Leave</Button>
                  )}
                </>
              ) : community.is_invited && community.invitation_id ? (
                <div className="flex gap-2">
                  <Button onClick={async () => {
                    try {
                      await apiClient.post(`/api/communities/me/invitations/${community.invitation_id}/accept`, {})
                      fetchCommunity()
                    } catch (err: any) { setError(err?.message || "Failed to accept") }
                  }}>Accept Invite</Button>
                  <Button variant="secondary" onClick={async () => {
                    try {
                      await apiClient.post(`/api/communities/me/invitations/${community.invitation_id}/decline`, {})
                      navigate("/community")
                    } catch (err: any) { setError(err?.message || "Failed to decline") }
                  }}>Decline</Button>
                </div>
              ) : community.is_pending ? (
                <span className="text-sm font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-4 py-2 rounded-lg">
                  Application Pending
                </span>
              ) : community.community_type === "invite_only" ? (
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-4 py-2 rounded-lg">
                  Invite Only
                </span>
              ) : (
                <Button onClick={handleJoin}>
                  {community.community_type === "private" ? "Apply to Join" : "Join Community"}
                </Button>
              )}
            </div>
          </div>
        </Card>
      </div>

      {!community.is_member && (
        <Card className="text-center py-10">
          <p className="text-gray-500 dark:text-gray-400">
            {community.is_invited ? "Accept the invitation above to view community content." : community.is_pending ? "Your application is pending approval." : "Join this community to view its content."}
          </p>
        </Card>
      )}

      {/* Tabs */}
      {community.is_member && <div className="mb-6 flex gap-2 border-b border-gray-200 dark:border-gray-700">
        {[
          { id: "discussions", label: "Discussions", Icon: MessageSquare },
          { id: "resources", label: "Resources", Icon: BookOpen },
          { id: "members", label: "Members", Icon: Users, badge: community.pending_count || 0 },
          { id: "leaderboard", label: "Leaderboard", Icon: Trophy },
          ...(isPrivileged ? [{ id: "settings", label: "Settings", Icon: Settings }] : []),
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            className={cn(
              "flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors",
              activeTab === tab.id
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            )}
          >
            <tab.Icon className="h-4 w-4" />
            {tab.label}
            {"badge" in tab && (tab as any).badge > 0 && (
              <span className="ml-1 rounded-full bg-amber-500 px-1.5 py-0.5 text-xs font-bold text-white leading-none">
                {(tab as any).badge}
              </span>
            )}
          </button>
        ))}
      </div>}

      {community.is_member && activeTab === "discussions" && (
        <div>
          <div className="mb-4 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Discussions</h2>
            {community.is_member && (
              <Button onClick={() => setIsCreateThreadOpen(true)}>New Thread</Button>
            )}
          </div>

          {discussions.length === 0 ? (
            <Card>
              <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                No discussions yet. Start a new thread!
              </div>
            </Card>
          ) : (
            <div className="space-y-3">
              {discussions.map((d) => (
                <Card
                  key={d.id}
                  className="cursor-pointer transition-shadow hover:shadow-md"
                  onClick={() => setSelectedDiscussion(d)}
                >
                  <div className="flex gap-4">
                    <div
                      className="h-10 w-10 rounded-full flex items-center justify-center text-white font-medium flex-shrink-0"
                      style={{ backgroundColor: "#6B7280" }}
                    >
                      {authorName(d.author).charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {d.is_pinned && <Pin className="h-4 w-4 text-yellow-500" />}
                        <h3 className="font-medium text-gray-900 dark:text-white">{d.title}</h3>
                      </div>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 line-clamp-1">
                        {d.content}
                      </p>
                      <div className="mt-2 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                        <span>{authorName(d.author)}</span>
                        <span>{formatDate(d.created_at)}</span>
                        <span className="flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" /> {d.reply_count} replies</span>
                        <button
                          className={cn("flex items-center gap-1", d.has_liked ? "text-red-500" : "hover:text-red-500")}
                          onClick={(e) => { e.stopPropagation(); handleLikeThread(d.id) }}
                        >
                          <Heart className={cn("h-3.5 w-3.5", d.has_liked && "fill-red-500")} /> {d.like_count}
                        </button>
                        {canModerate && (
                          <button
                            className="flex items-center gap-1 rounded border border-gray-300 px-2 py-0.5 text-xs font-medium text-gray-600 hover:bg-yellow-50 hover:border-yellow-400 hover:text-yellow-700 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-yellow-900/20 dark:hover:text-yellow-300"
                            onClick={(e) => { e.stopPropagation(); handlePinThread(d.id, d.is_pinned) }}
                          >
                            {d.is_pinned ? <><PinOff className="h-3 w-3" /> Unpin</> : <><Pin className="h-3 w-3" /> Pin</>}
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

      {community.is_member && activeTab === "resources" && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Shared Resources</h2>
            {community.is_member && (
              <Button onClick={() => setIsShareResourceOpen(true)}>
                <Plus className="mr-1 h-4 w-4" /> Share Resource
              </Button>
            )}
          </div>

          {resources.length === 0 ? (
            <Card>
              <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                No shared resources yet.
              </div>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {resources.map((r) => (
                <Card key={r.id} className="transition-shadow hover:shadow-md cursor-pointer" onClick={() => setPreviewResource(r)}>
                  <div className="flex gap-3">
                    <div className="flex items-center">{getEntityIcon(r.entity_type)}</div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 dark:text-white truncate">{r.title}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        by {authorName(r.author)}
                      </p>
                      {r.description && (
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300 line-clamp-2">{r.description}</p>
                      )}
                      <div className="mt-2 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                        <span className="capitalize rounded bg-gray-100 px-1.5 py-0.5 dark:bg-gray-700">
                          {r.entity_type.replace("_", " ")}
                        </span>
                        {r.average_rating != null && (
                          <span className="flex items-center gap-0.5">
                            <Star className="h-3 w-3 text-yellow-500" /> {r.average_rating.toFixed(1)}
                          </span>
                        )}
                        <span>{formatDate(r.created_at)}</span>
                      </div>

                      <div className="mt-3 flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleLikeResource(r.id)}
                          className={cn(
                            "flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                            r.has_liked
                              ? "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                              : "bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-600 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                          )}
                        >
                          <Heart className={cn("h-3.5 w-3.5", r.has_liked && "fill-current")} />
                          {r.like_count}
                        </button>

                        <span className="text-xs text-gray-400">{r.download_count} saved</span>

                        {r.entity_type === "file" && r.file_url && (
                          <a
                            href={`/api/shared-content/${r.id}/file`}
                            download={r.title || "download"}
                            className="flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-blue-600 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-blue-900/30 dark:hover:text-blue-400 transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" /> Download
                          </a>
                        )}

                        {user && r.user_id !== user.id && (
                          <button
                            onClick={() => !r.has_saved && handleSaveResource(r.id, r.entity_type)}
                            disabled={r.has_saved}
                            className={cn(
                              "ml-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                              r.has_saved
                                ? "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 cursor-default"
                                : "bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                            )}
                          >
                            {r.has_saved ? (
                              <><Check className="h-3.5 w-3.5" /> Saved</>
                            ) : (
                              <><Bookmark className="h-3.5 w-3.5" /> Save to My Library</>
                            )}
                          </button>
                        )}
                        {user && r.user_id === user.id && (
                          <button
                            onClick={() => handleDeleteResource(r.id)}
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

      {community.is_member && activeTab === "members" && (
        <div>
          {canModerate && pendingMembers.length > 0 && (
            <div className="mb-6">
              <h2 className="mb-3 text-lg font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-2">
                Pending ({pendingMembers.length})
              </h2>
              <div className="space-y-2">
                {pendingMembers.map((pm) => (
                  <Card key={pm.user_id}>
                    <div className="flex items-center gap-4">
                      <div
                        className="h-10 w-10 rounded-full flex items-center justify-center text-white font-medium"
                        style={{ backgroundColor: "#F59E0B" }}
                      >
                        {(pm.display_name || pm.username).charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <span className="font-medium text-gray-900 dark:text-white">
                          {pm.display_name || pm.username}
                        </span>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          @{pm.username} &middot; {pm.type === "invitation"
                            ? <>Invited by {pm.invited_by} {pm.applied_at ? new Date(pm.applied_at).toLocaleDateString() : ""}</>
                            : <>Applied {pm.applied_at ? new Date(pm.applied_at).toLocaleDateString() : "recently"}</>
                          }
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {pm.type === "invitation" ? (
                          <span className="text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-lg">
                            Awaiting Response
                          </span>
                        ) : (
                          <>
                            <button
                              onClick={() => handleApproveMember(pm.user_id)}
                              disabled={pendingActionLoading === pm.user_id}
                              className="flex items-center gap-1 rounded-lg bg-green-50 px-3 py-1.5 text-sm font-medium text-green-700 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/40 disabled:opacity-50"
                            >
                              <UserCheck className="h-4 w-4" /> Approve
                            </button>
                            <button
                              onClick={() => handleRejectMember(pm.user_id)}
                              disabled={pendingActionLoading === pm.user_id}
                              className="flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 disabled:opacity-50"
                            >
                              <UserX className="h-4 w-4" /> Reject
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Members ({members.length})
            </h2>
          </div>

          {members.length === 0 ? (
            <Card>
              <div className="py-8 text-center text-gray-500 dark:text-gray-400">No members.</div>
            </Card>
          ) : (
            <div className="space-y-2">
              {members.slice(0, membersVisible).map((m) => (
                <Card key={m.user_id}>
                  <div className="flex items-center gap-4">
                    <div
                      className="h-12 w-12 rounded-full flex items-center justify-center text-white font-medium"
                      style={{ backgroundColor: "#6B7280" }}
                    >
                      {(m.display_name || m.username).charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-white">
                          {m.display_name || m.username}
                        </span>
                        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium capitalize", getRoleBadge(m.role))}>
                          {m.role}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {m.contribution_points} contribution points
                      </p>
                    </div>
                    {m.user_id !== user?.id && (
                      <button
                        onClick={() => handleFollow(m.user_id)}
                        className={cn(
                          "flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors flex-shrink-0",
                          followingSet.has(m.user_id)
                            ? "bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-600 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                            : "bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40"
                        )}
                      >
                        {followingSet.has(m.user_id)
                          ? <><UserMinus className="w-3.5 h-3.5" /> Following</>
                          : <><UserPlus className="w-3.5 h-3.5" /> Follow</>
                        }
                      </button>
                    )}
                  </div>
                </Card>
              ))}
              {members.length > membersVisible && (
                <button
                  onClick={() => setMembersVisible((c) => c + 20)}
                  className="w-full rounded-lg border border-gray-200 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:border-gray-700 dark:text-blue-400 dark:hover:bg-blue-900/20"
                >
                  Show more ({members.length - membersVisible} remaining)
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {community.is_member && activeTab === "leaderboard" && (
        <div>
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Community Leaderboard</h2>
          </div>

          <Card>
            {leaderboard.length === 0 ? (
              <div className="py-8 text-center text-gray-500 dark:text-gray-400">No leaderboard data yet.</div>
            ) : (
              <div className="space-y-4">
                {leaderboard.map((entry) => (
                  <div key={entry.user_id} className="flex items-center gap-4">
                    <div className={cn(
                      "h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm",
                      entry.rank === 1 ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300" :
                      entry.rank === 2 ? "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300" :
                      entry.rank === 3 ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" :
                      "bg-gray-50 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                    )}>
                      {entry.rank}
                    </div>
                    <div
                      className="h-10 w-10 rounded-full flex items-center justify-center text-white font-medium"
                      style={{ backgroundColor: "#6B7280" }}
                    >
                      {(entry.display_name || entry.username).charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {entry.display_name || entry.username}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {entry.contribution_points}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400 ml-1">pts</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {community.is_member && activeTab === "settings" && isPrivileged && community && communityId && (
        <SettingsTab
          communityId={communityId}
          community={community}
          members={members}
          isOwner={isOwner}
          currentUserId={user?.id ?? null}
          onRefresh={() => { fetchMembers(); fetchCommunity() }}
          getRoleBadge={getRoleBadge}
        />
      )}

      {isCreateThreadOpen && community && (
        <CreateThreadModal
          communityId={community.id}
          onClose={() => setIsCreateThreadOpen(false)}
          onCreated={() => { setIsCreateThreadOpen(false); fetchDiscussions() }}
        />
      )}

      {isInviteModalOpen && communityId && (
        <InviteModal
          urlId={communityId}
          communityName={community.name}
          existingMemberIds={members.map((m) => m.user_id)}
          onClose={() => { setIsInviteModalOpen(false); fetchMembers(); fetchPendingMembers(); fetchCommunity() }}
        />
      )}

      {/* Discussion Thread Modal */}
      {selectedDiscussion && (
        <DiscussionThreadModal
          discussion={selectedDiscussion}
          onClose={() => { setSelectedDiscussion(null); fetchDiscussions() }}
          formatDate={formatDate}
        />
      )}

      {isShareResourceOpen && community && (
        <ShareResourceModal
          communityId={community.id}
          onClose={() => setIsShareResourceOpen(false)}
          onCreated={() => { setIsShareResourceOpen(false); fetchResources() }}
        />
      )}

      {/* Resource Preview Modal */}
      {previewResource && (
        <ResourcePreviewModal
          isOpen={!!previewResource}
          onClose={() => setPreviewResource(null)}
          entityType={previewResource.entity_type}
          entityId={previewResource.entity_id}
          title={previewResource.title}
          note={previewResource.description}
          url={previewResource.entity_type === "link" ? previewResource.tags?.[0] : undefined}
          fileUrl={previewResource.entity_type === "file" ? `/api/shared-content/${previewResource.id}/file` : undefined}
          fileSize={previewResource.file_size}
        />
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog {...confirmDialogProps} />

      {/* Leave Confirmation */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Leave Community</h3>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Are you sure you want to leave <strong>{community.name}</strong>? You can rejoin later if the community is public.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowLeaveConfirm(false)}>Cancel</Button>
              <Button
                variant="primary"
                className="bg-red-600 hover:bg-red-700"
                onClick={async () => {
                  setShowLeaveConfirm(false)
                  await handleLeave()
                }}
              >
                Leave Community
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


function CreateThreadModal({
  communityId, onClose, onCreated
}: {
  communityId: string; onClose: () => void; onCreated: () => void
}) {
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // post a brand-new discussion thread to this community
  async function handleCreate() {
    if (!title.trim() || !content.trim()) return
    setCreating(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        community_id: communityId,
        title: title.trim(),
        content: content.trim(),
      })
      await apiClient.post(`/api/discussions?${params}`, {})
      onCreated()
    } catch (e: any) {
      setError(e?.message || "Failed to create thread")
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">New Discussion Thread</h2>

        {error && (
          <div className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">{error}</div>
        )}

        <div className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Title</label>
            <TextField
              label=""
              placeholder="What do you want to discuss?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Content</label>
            <textarea
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              rows={5}
              placeholder="Share your thoughts, questions, or ideas..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleCreate} disabled={creating || !title.trim() || !content.trim()}>
            {creating ? "Posting..." : "Post Thread"}
          </Button>
        </div>
      </div>
    </div>
  )
}


type EntityItem = { id: string; title: string; subtitle?: string }

const RESOURCE_TYPES = [
  { value: "source", label: "Document", icon: FileText, endpoint: "/api/documents?page_size=100&status=completed", extract: (d: any) => (d.documents || []).map((x: any) => ({ id: String(x.id), title: x.document_name, subtitle: x.document_type })) },
  { value: "diagram", label: "Diagram", icon: MapPin, endpoint: "/api/diagrams?page_size=100", extract: (d: any) => (d.diagrams || []).map((x: any) => ({ id: x.id, title: x.title || "Untitled Diagram", subtitle: x.diagram_type })) },
  { value: "learning_path", label: "Learning Path", icon: Route, endpoint: "/api/learning-paths?page_size=100", extract: (d: any) => (d.learning_paths || []).map((x: any) => ({ id: x.id, title: x.title, subtitle: x.target_concept_title })) },
  { value: "flashcard", label: "Flashcard", icon: Layers, endpoint: "/api/flashcards/review", extract: (d: any) => (Array.isArray(d) ? d : []).map((x: any) => ({ id: x.id, title: x.front, subtitle: x.topic || x.card_type })) },
  { value: "concept", label: "Concept", icon: Lightbulb, endpoint: "/api/documents/concepts/all", extract: (d: any) => (d.concepts || []).map((x: any) => ({ id: x.id, title: x.title || "Untitled", subtitle: x.concept_type })) },
  { value: "link", label: "External Link", icon: Link, endpoint: null, extract: () => [] },
  { value: "file", label: "Upload File", icon: Upload, endpoint: null, extract: () => [] },
] as const

function ShareResourceModal({
  communityId, onClose, onCreated
}: {
  communityId: string; onClose: () => void; onCreated: () => void
}) {
  const [step, setStep] = useState<"type" | "select">("type")
  const [entityType, setEntityType] = useState("")
  const [items, setItems] = useState<EntityItem[]>([])
  const [loadingItems, setLoadingItems] = useState(false)
  const [selectedItem, setSelectedItem] = useState<EntityItem | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [manualTitle, setManualTitle] = useState("")
  const [manualDescription, setManualDescription] = useState("")
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [linkUrl, setLinkUrl] = useState("")

  async function handleSelectType(type: typeof RESOURCE_TYPES[number]) {
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

  const isManualEntry = entityType === "link" || entityType === "file"

  // share the picked resource: file uploads use multipart, everything else hits the json api
  async function handleShare() {
    setCreating(true)
    setError(null)
    try {
      if (entityType === "file" && uploadFile) {
        const formData = new FormData()
        formData.append("file", uploadFile)
        formData.append("title", manualTitle.trim() || uploadFile.name)
        if (manualDescription.trim()) formData.append("description", manualDescription.trim())
        formData.append("community_id", communityId)
        await apiClient.upload("/api/shared-content/upload", formData)
        onCreated()
        return
      }

      const title = isManualEntry ? manualTitle.trim() : selectedItem!.title
      const entityId = isManualEntry ? crypto.randomUUID() : selectedItem!.id
      const params = new URLSearchParams({
        entity_type: entityType,
        entity_id: entityId,
        title,
        visibility: "public",
      })
      if (isManualEntry && manualDescription.trim()) {
        params.set("description", manualDescription.trim())
      }
      params.append("community_ids", communityId)
      if (entityType === "link" && linkUrl.trim()) {
        params.append("tags", linkUrl.trim())
      }
      await apiClient.post(`/api/shared-content?${params}`, {})
      if (entityType === "flashcard") {
        logActivity("flashcard", "share", selectedItem?.id)
      }
      onCreated()
    } catch (e: any) {
      setError(e?.message || "Failed to share resource")
    } finally {
      setCreating(false)
    }
  }

  const canShare = isManualEntry
    ? entityType === "file" ? !!uploadFile : manualTitle.trim() && (entityType !== "link" || linkUrl.trim())
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
              {RESOURCE_TYPES.map((rt) => {
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

            {isManualEntry ? (
              <div className="space-y-4">
                {entityType === "file" && (
                  <label className="flex items-center justify-center w-full h-28 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 cursor-pointer transition-colors bg-gray-50 dark:bg-gray-700/50">
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0] || null
                        setUploadFile(f)
                        if (f && !manualTitle) setManualTitle(f.name)
                      }}
                    />
                    {uploadFile ? (
                      <div className="text-center">
                        <FileText className="w-8 h-8 text-blue-500 mx-auto mb-1" />
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate max-w-[300px]">{uploadFile.name}</p>
                        <p className="text-xs text-gray-400">
                          {uploadFile.size < 1024 ? `${uploadFile.size} B` : uploadFile.size < 1024 * 1024 ? `${(uploadFile.size / 1024).toFixed(1)} KB` : `${(uploadFile.size / (1024 * 1024)).toFixed(1)} MB`}
                        </p>
                      </div>
                    ) : (
                      <div className="text-center">
                        <Upload className="w-8 h-8 text-gray-400 mx-auto mb-1" />
                        <p className="text-sm text-gray-500 dark:text-gray-400">Click to select a file</p>
                        <p className="text-xs text-gray-400">Max 50MB</p>
                      </div>
                    )}
                  </label>
                )}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Title</label>
                  <TextField
                    label=""
                    placeholder={entityType === "file" ? "Give it a name..." : entityType === "link" ? "Name this link" : "Concept title"}
                    value={manualTitle}
                    onChange={(e) => setManualTitle(e.target.value)}
                  />
                </div>
                {entityType === "link" && (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">URL</label>
                    <TextField
                      label=""
                      placeholder="https://example.com"
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                    />
                  </div>
                )}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
                  <textarea
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    rows={3}
                    placeholder="Describe this resource..."
                    value={manualDescription}
                    onChange={(e) => setManualDescription(e.target.value)}
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
              </>
            )}
          </div>
        )}

        {step === "select" && (
          <div className="border-t border-gray-200 px-6 py-4 dark:border-gray-700 flex justify-end gap-3">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={handleShare} disabled={creating || !canShare}>
              {creating ? "Sharing..." : "Share to Community"}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}


type UserSuggestion = { id: string; username: string; display_name: string | null; is_friend: boolean; is_pending: boolean }

function InviteModal({
  urlId, communityName, existingMemberIds, onClose
}: {
  urlId: string; communityName: string; existingMemberIds: string[]; onClose: () => void
}) {
  const [username, setUsername] = useState("")
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const suggestionsRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // debounced search: wait 300ms after typing then call the user-search endpoint
  function handleSearchInput(value: string) {
    setUsername(value)
    setMsg(null)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (value.trim().length < 1) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await apiClient.get<{ users: UserSuggestion[] }>(
          `/api/friendships/search-users?q=${encodeURIComponent(value.trim())}`
        )
        setSuggestions(data?.users ?? [])
        setShowSuggestions((data?.users ?? []).length > 0)
      } catch {
        setSuggestions([])
      }
    }, 300)
  }

  function selectSuggestion(user: UserSuggestion) {
    setUsername(user.username)
    setShowSuggestions(false)
    setSuggestions([])
  }

  async function handleInvite() {
    if (!username.trim()) return
    setSending(true)
    setMsg(null)
    try {
      const params = new URLSearchParams({ username: username.trim() })
      await apiClient.post(`/api/communities/${urlId}/invite?${params}`, {})
      setMsg({ type: "success", text: `Invitation sent to ${username.trim()}!` })
      setUsername("")
    } catch (e: any) {
      setMsg({ type: "error", text: e?.message || "Failed to invite" })
    } finally {
      setSending(false)
    }
  }

  const memberIdSet = new Set(existingMemberIds)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Invite Members</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Search by username to invite people to {communityName}
        </p>

        <div className="mt-4">
          <div className="flex gap-3">
            <div className="relative flex-1" ref={suggestionsRef}>
              <TextField
                label=""
                placeholder="Search by username or name..."
                value={username}
                onChange={(e) => handleSearchInput(e.target.value)}
                onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true) }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleInvite()
                  if (e.key === "Escape") setShowSuggestions(false)
                }}
              />
              {showSuggestions && (
                <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800 max-h-48 overflow-y-auto">
                  {suggestions.map((u) => {
                    const isMember = memberIdSet.has(u.id)
                    return (
                      <button
                        key={u.id}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 first:rounded-t-lg last:rounded-b-lg disabled:opacity-50"
                        onClick={() => !isMember && selectSuggestion(u)}
                        disabled={isMember}
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                          {(u.display_name || u.username).charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {u.display_name || u.username}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            @{u.username}
                          </div>
                        </div>
                        {isMember && (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700 dark:bg-green-900/30 dark:text-green-300">Member</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
            <Button onClick={handleInvite} disabled={sending || !username.trim()}>
              {sending ? "Adding..." : "Add"}
            </Button>
          </div>

          {msg && (
            <div className={`mt-3 text-sm ${msg.type === "success" ? "text-green-600" : "text-red-600"}`}>
              {msg.text}
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  )
}


function DiscussionThreadModal({
  discussion, onClose, formatDate
}: {
  discussion: Discussion
  onClose: () => void
  formatDate: (d: string | null) => string
}) {
  const [replies, setReplies] = useState<Reply[]>([])
  const [replyContent, setReplyContent] = useState("")
  const [posting, setPosting] = useState(false)
  const [threadLikeCount, setThreadLikeCount] = useState(discussion.like_count)
  const [threadHasLiked, setThreadHasLiked] = useState(discussion.has_liked ?? false)

  function authorName(author: { username: string | null; display_name: string | null }) {
    return author.display_name || author.username || "Unknown"
  }

  useEffect(() => {
    async function load() {
      try {
        const threadData = await apiClient.get<{ thread: Discussion }>(
          `/api/discussions/${discussion.id}`
        )
        if (threadData?.thread) {
          setThreadHasLiked(threadData.thread.has_liked ?? false)
          setThreadLikeCount(threadData.thread.like_count)
        }
        const data = await apiClient.get<{ replies: Reply[] }>(
          `/api/discussions/${discussion.id}/replies?page_size=100`
        )
        setReplies(data?.replies ?? [])
      } catch { }
    }
    load()
  }, [discussion.id])

  async function handleLikeThread() {
    try {
      const res = await apiClient.post<{ liked: boolean; like_count: number }>(
        `/api/discussions/${discussion.id}/like`, {}
      )
      if (res) {
        setThreadLikeCount(res.like_count)
        setThreadHasLiked(res.liked)
      }
    } catch { }
  }

  async function handlePostReply() {
    if (!replyContent.trim()) return
    setPosting(true)
    try {
      const params = new URLSearchParams({ content: replyContent.trim() })
      await apiClient.post(`/api/discussions/${discussion.id}/replies?${params}`, {})
      setReplyContent("")
      const data = await apiClient.get<{ replies: Reply[] }>(
        `/api/discussions/${discussion.id}/replies?page_size=100`
      )
      setReplies(data?.replies ?? [])
    } catch { }
    finally { setPosting(false) }
  }

  async function handleLikeReply(replyId: string) {
    try {
      await apiClient.post(`/api/discussions/replies/${replyId}/like`, {})
      const data = await apiClient.get<{ replies: Reply[] }>(
        `/api/discussions/${discussion.id}/replies?page_size=100`
      )
      setReplies(data?.replies ?? [])
    } catch { }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-4xl rounded-xl bg-white shadow-xl dark:bg-gray-800 h-[80vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Discussion Thread</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {/* Original Post */}
          <div className="border-b border-gray-200 pb-4 dark:border-gray-700">
            <div className="flex gap-3">
              <div
                className="h-10 w-10 rounded-full flex items-center justify-center text-white font-medium flex-shrink-0"
                style={{ backgroundColor: "#6B7280" }}
              >
                {authorName(discussion.author).charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  {discussion.is_pinned && <Pin className="h-4 w-4 text-yellow-500" />}
                  <h3 className="font-semibold text-gray-900 dark:text-white">{discussion.title}</h3>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {authorName(discussion.author)} · {formatDate(discussion.created_at)}
                </p>
                <p className="mt-3 text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{discussion.content}</p>
                <div className="mt-3 flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                  <button
                    onClick={handleLikeThread}
                    className={cn(
                      "flex items-center gap-1 transition-colors",
                      threadHasLiked ? "text-red-500" : "hover:text-red-500"
                    )}
                  >
                    <Heart className={cn("h-4 w-4", threadHasLiked && "fill-red-500")} /> {threadLikeCount}
                  </button>
                  <span className="flex items-center gap-1"><MessageSquare className="h-4 w-4" /> {replies.length} replies</span>
                  <span className="flex items-center gap-1"><Eye className="h-4 w-4" /> {discussion.view_count} views</span>
                </div>
              </div>
            </div>
          </div>

          {/* Replies */}
          <div className="mt-4 space-y-4">
            <h4 className="font-medium text-gray-900 dark:text-white">
              Replies ({replies.length})
            </h4>
            {replies.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">No replies yet. Be the first!</p>
            ) : (
              replies.map((reply) => (
                <div key={reply.id} className="flex gap-3">
                  <div
                    className="h-8 w-8 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0"
                    style={{ backgroundColor: "#6B7280" }}
                  >
                    {authorName(reply.author).charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 rounded-lg bg-gray-50 p-3 dark:bg-gray-700">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {authorName(reply.author)}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDate(reply.created_at)}
                      </p>
                    </div>
                    <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{reply.content}</p>
                    <div className="mt-2 flex items-center gap-3">
                      <button
                        onClick={() => handleLikeReply(reply.id)}
                        className={cn(
                          "flex items-center gap-1 text-xs transition-colors",
                          reply.has_liked ? "text-red-500" : "text-gray-500 hover:text-red-500 dark:text-gray-400"
                        )}
                      >
                        <Heart className={cn("h-3.5 w-3.5", reply.has_liked && "fill-red-500")} /> {reply.like_count}
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Reply Input */}
        <div className="border-t border-gray-200 p-4 dark:border-gray-700">
          <div className="flex gap-3">
            <div className="flex-1">
              <textarea
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                rows={2}
                placeholder="Write a reply..."
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
              />
              <div className="mt-2 flex justify-end">
                <Button disabled={!replyContent.trim() || posting} onClick={handlePostReply}>
                  {posting ? "Posting..." : "Post Reply"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


type PendingAction =
  | { type: "role"; userId: string; userName: string; currentRole: string; newRole: string }
  | { type: "remove"; userId: string; userName: string }
  | { type: "transfer"; userId: string; userName: string }

function SettingsTab({
  communityId, members, isOwner, onRefresh, getRoleBadge
}: {
  communityId: string
  community: Community
  members: MemberEntry[]
  isOwner: boolean
  currentUserId: string | null
  onRefresh: () => void
  getRoleBadge: (role: string) => string
}) {
  const [search, setSearch] = useState("")
  const [visibleCount, setVisibleCount] = useState(20)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [roleModalTarget, setRoleModalTarget] = useState<MemberEntry | null>(null)
  const [selectedRole, setSelectedRole] = useState("")
  const [transferTarget, setTransferTarget] = useState("")
  const [actionLoading, setActionLoading] = useState(false)
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // dispatch the right api call based on the pending action (role/remove/transfer)
  async function executeAction() {
    if (!pendingAction) return
    setActionLoading(true)
    setMsg(null)
    try {
      if (pendingAction.type === "role") {
        await apiClient.patch(
          `/api/communities/${communityId}/members/${pendingAction.userId}/role?role=${pendingAction.newRole}`, {}
        )
        setMsg({ type: "success", text: `${pendingAction.userName} is now ${pendingAction.newRole}` })
      } else if (pendingAction.type === "remove") {
        await apiClient.delete(`/api/communities/${communityId}/members/${pendingAction.userId}`)
        setMsg({ type: "success", text: `${pendingAction.userName} has been removed` })
      } else if (pendingAction.type === "transfer") {
        await apiClient.post(
          `/api/communities/${communityId}/transfer-ownership?new_owner_id=${pendingAction.userId}`, {}
        )
        setMsg({ type: "success", text: `Ownership transferred to ${pendingAction.userName}` })
      }
      onRefresh()
    } catch (e: any) {
      setMsg({ type: "error", text: e?.message || "Action failed" })
    } finally {
      setActionLoading(false)
      setPendingAction(null)
      setRoleModalTarget(null)
      setSelectedRole("")
    }
  }

  const nonOwnerMembers = members.filter((m) => m.role !== "owner")
  const filtered = nonOwnerMembers.filter((m) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (m.display_name || "").toLowerCase().includes(q) || m.username.toLowerCase().includes(q)
  })
  const paginatedMembers = search.trim() ? filtered : filtered.slice(0, visibleCount)
  const hasMore = !search.trim() && filtered.length > visibleCount

  function confirmMessage() {
    if (!pendingAction) return ""
    if (pendingAction.type === "role") {
      return `Change ${pendingAction.userName}'s role from ${pendingAction.currentRole} to ${pendingAction.newRole}?`
    }
    if (pendingAction.type === "remove") {
      return `Remove ${pendingAction.userName} from this community? This cannot be undone.`
    }
    if (pendingAction.type === "transfer") {
      return `Transfer ownership to ${pendingAction.userName}? You will become an admin. This cannot be undone.`
    }
    return ""
  }

  return (
    <div className="space-y-6">
      {msg && (
        <div className={cn(
          "rounded-lg p-3 text-sm",
          msg.type === "success"
            ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300"
            : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300"
        )}>
          {msg.text}
        </div>
      )}

      {pendingAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {pendingAction.type === "role" ? "Change Role" :
               pendingAction.type === "remove" ? "Remove Member" :
               "Transfer Ownership"}
            </h3>
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
              {confirmMessage()}
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setPendingAction(null)} disabled={actionLoading}>
                Cancel
              </Button>
              <Button onClick={executeAction} disabled={actionLoading}>
                {actionLoading ? "Processing..." : "Confirm"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Change Role Modal */}
      {roleModalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Change Role for {roleModalTarget.display_name || roleModalTarget.username}
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Current role: <span className="font-medium capitalize">{roleModalTarget.role}</span>
            </p>
            <div className="mt-4 space-y-2">
              {isOwner && (
                <label className={cn(
                  "flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors",
                  selectedRole === "admin"
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                    : "border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700"
                )}>
                  <input type="radio" name="role" value="admin" checked={selectedRole === "admin"} onChange={() => setSelectedRole("admin")} className="accent-blue-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Admin</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Can manage members and community settings</p>
                  </div>
                </label>
              )}
              <label className={cn(
                "flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors",
                selectedRole === "moderator"
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                  : "border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700"
              )}>
                <input type="radio" name="role" value="moderator" checked={selectedRole === "moderator"} onChange={() => setSelectedRole("moderator")} className="accent-blue-600" />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Moderator</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Can pin discussions and moderate content</p>
                </div>
              </label>
              <label className={cn(
                "flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors",
                selectedRole === "member"
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                  : "border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700"
              )}>
                <input type="radio" name="role" value="member" checked={selectedRole === "member"} onChange={() => setSelectedRole("member")} className="accent-blue-600" />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Member</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Standard community member</p>
                </div>
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => { setRoleModalTarget(null); setSelectedRole("") }}>
                Cancel
              </Button>
              <Button
                disabled={!selectedRole || selectedRole === roleModalTarget.role}
                onClick={() => {
                  const name = roleModalTarget.display_name || roleModalTarget.username
                  setPendingAction({ type: "role", userId: roleModalTarget.user_id, userName: name, currentRole: roleModalTarget.role, newRole: selectedRole })
                  setRoleModalTarget(null)
                }}
              >
                Change Role
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Member Role Management */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Manage Members</h2>
          <span className="text-sm text-gray-500 dark:text-gray-400">{nonOwnerMembers.length} members</span>
        </div>

        {nonOwnerMembers.length > 5 && (
          <div className="mb-3">
            <input
              type="text"
              placeholder="Search members..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>
        )}

        {paginatedMembers.length === 0 ? (
          <Card>
            <div className="py-6 text-center text-gray-500 dark:text-gray-400">
              {search ? "No members match your search." : "No other members to manage."}
            </div>
          </Card>
        ) : (
          <div className="space-y-2">
            {paginatedMembers.map((m) => {
              const name = m.display_name || m.username
              return (
                <Card key={m.user_id}>
                  <div className="flex items-center gap-4">
                    <div
                      className="h-10 w-10 rounded-full flex items-center justify-center text-white font-medium flex-shrink-0"
                      style={{ backgroundColor: "#6B7280" }}
                    >
                      {name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-white">{name}</span>
                        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium capitalize", getRoleBadge(m.role))}>
                          {m.role}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{m.contribution_points} pts</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => { setRoleModalTarget(m); setSelectedRole("") }}
                      >
                        Change Role
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => setPendingAction({ type: "remove", userId: m.user_id, userName: name })}
                      >
                        <span className="text-red-600 dark:text-red-400">Remove</span>
                      </Button>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}

        {hasMore && (
          <button
            onClick={() => setVisibleCount((c) => c + 20)}
            className="mt-3 w-full rounded-lg border border-gray-200 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:border-gray-700 dark:text-blue-400 dark:hover:bg-blue-900/20"
          >
            Show more ({filtered.length - visibleCount} remaining)
          </button>
        )}
      </div>

      {/* Transfer Ownership (Owner only) */}
      {isOwner && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Transfer Ownership</h2>
          <Card>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Transfer ownership to another member. You will become an admin. This cannot be undone.
            </p>
            <div className="flex items-center gap-3">
              <select
                className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                value={transferTarget}
                onChange={(e) => setTransferTarget(e.target.value)}
              >
                <option value="">Select a member...</option>
                {nonOwnerMembers.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.display_name || m.username} ({m.role})
                  </option>
                ))}
              </select>
              <Button
                variant="secondary"
                disabled={!transferTarget}
                onClick={() => {
                  const target = nonOwnerMembers.find((m) => m.user_id === transferTarget)
                  if (target) {
                    setPendingAction({ type: "transfer", userId: target.user_id, userName: target.display_name || target.username })
                  }
                }}
              >
                Transfer
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
