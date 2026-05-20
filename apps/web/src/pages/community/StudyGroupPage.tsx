import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { Card } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { TextField } from "../../components/form/TextField"
import { cn } from "../../../../../shared/utils"
import { apiClient } from "../../lib/api"
import {
  Globe, Lock, Mail, GraduationCap, Users, BookOpen,
  Search, Plus, ChevronRight
} from "lucide-react"
import { useAuth } from "../../contexts/AuthContext"


type CommunityType = "public" | "private" | "invite_only" | "course_based"

type Community = {
  id: string
  name: string
  url_id: string
  description: string | null
  community_type: CommunityType
  member_count: number
  resource_count: number
  avatar_url: string | null
  color_theme: string | null
  is_member: boolean
  is_pending?: boolean
  is_invited?: boolean
  invitation_id?: string | null
  my_role?: string | null
  creator_username?: string
  created_at: string | null
}

type CommunitiesResponse = {
  communities: Community[]
  total: number
  page: number
  page_size: number
}

type ClassTeacher = {
  username: string | null
  display_name: string | null
  avatar_url: string | null
}

type ClassItem = {
  id: string
  name: string
  description: string | null
  course_code: string | null
  course_name: string | null
  student_count: number
  created_at: string | null
  teacher: ClassTeacher
}

type Classmate = {
  id: string
  username: string
  email: string | null
  display_name: string | null
  avatar_url: string | null
  joined_at: string | null
}

type Assignment = {
  id: string
  title: string
  description: string | null
  assignment_type: string
  due_at: string | null
  created_at: string | null
}

type PageTab = "communities" | "classes"
type CommunitySubView = "joined" | "discover"


export function StudyGroupPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isTeacher = user?.role === "teacher"

  const [pageTab, setPageTab] = useState<PageTab>("communities")

  const [communities, setCommunities] = useState<Community[]>([])
  const [comLoading, setComLoading] = useState(true)
  const [comError, setComError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [communitySubView, setCommunitySubView] = useState<CommunitySubView>("joined")
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  const [classes, setClasses] = useState<ClassItem[]>([])
  const [classLoading, setClassLoading] = useState(false)
  const [classError, setClassError] = useState<string | null>(null)
  const [joinCode, setJoinCode] = useState("")
  const [joinLoading, setJoinLoading] = useState(false)
  const [joinMsg, setJoinMsg] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const fetchCommunities = useCallback(async () => {
    try {
      setComLoading(true)
      setComError(null)
      const filter = communitySubView === "discover" ? "discover" : "my"
      const params = new URLSearchParams({ filter, page: "1", page_size: "50" })
      if (searchQuery) params.set("search", searchQuery)
      const data = await apiClient.get<CommunitiesResponse>(`/api/communities?${params}`)
      setCommunities(data?.communities ?? [])
    } catch (e: any) {
      setComError(e?.message || "Failed to load communities")
    } finally {
      setComLoading(false)
    }
  }, [communitySubView, searchQuery])

  useEffect(() => {
    if (pageTab === "communities") fetchCommunities()
  }, [pageTab, fetchCommunities])

  async function handleJoinCommunity(urlId: string, communityType: CommunityType, e: React.MouseEvent) {
    e.stopPropagation()
    try {
      if (communityType === "private") {
        await apiClient.post(`/api/communities/${urlId}/apply`, {})
      } else {
        await apiClient.post(`/api/communities/${urlId}/join`, {})
      }
      await fetchCommunities()
    } catch (err: any) {
      setComError(err?.message || "Failed to join community")
    }
  }

  async function handleInvitationResponse(invitationId: string, accept: boolean, e: React.MouseEvent) {
    e.stopPropagation()
    try {
      const action = accept ? "accept" : "decline"
      await apiClient.post(`/api/communities/me/invitations/${invitationId}/${action}`, {})
      await fetchCommunities()
    } catch (err: any) {
      setComError(err?.message || `Failed to ${accept ? "accept" : "decline"} invitation`)
    }
  }

  const fetchClasses = useCallback(async () => {
    setClassLoading(true)
    setClassError(null)
    try {
      const data = await apiClient.get<{ classes: ClassItem[] }>("/api/classroom/my-classes")
      setClasses(data?.classes ?? [])
    } catch (e: any) {
      setClassError(e?.message || "Failed to load classes")
    } finally {
      setClassLoading(false)
    }
  }, [])

  useEffect(() => {
    if (pageTab === "classes") fetchClasses()
  }, [pageTab, fetchClasses])

  async function handleJoinClass() {
    if (!joinCode.trim()) return
    setJoinLoading(true)
    setJoinMsg(null)
    try {
      const data = await apiClient.post<{ message: string; status?: string }>(`/api/classroom/join?class_code=${encodeURIComponent(joinCode.trim())}`)
      setJoinMsg({ type: "success", text: data?.message || "Request sent!" })
      setJoinCode("")
      if (data?.status === "active") fetchClasses()
    } catch (e: any) {
      setJoinMsg({ type: "error", text: e?.message || "Failed to join class" })
    } finally {
      setJoinLoading(false)
    }
  }

  function getTypeIcon(type: CommunityType) {
    switch (type) {
      case "public": return <Globe className="w-3.5 h-3.5" />
      case "private": return <Lock className="w-3.5 h-3.5" />
      case "invite_only": return <Mail className="w-3.5 h-3.5" />
      case "course_based": return <GraduationCap className="w-3.5 h-3.5" />
    }
  }

  function getTypeLabel(type: CommunityType) {
    switch (type) {
      case "public": return "Public"
      case "private": return "Private"
      case "invite_only": return "Invite Only"
      case "course_based": return "Course"
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Study Groups</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Join communities, share resources, and view your classes
        </p>
      </div>

      <div className="mb-6 flex gap-2">
        {([
          { id: "communities" as const, label: "Communities", icon: Users },
          ...(!isTeacher ? [{ id: "classes" as const, label: "Classes", icon: GraduationCap }] : []),
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
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {pageTab === "communities" && (
        <>
          {comError && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
              {comError}
              <button onClick={() => setComError(null)} className="ml-2 font-medium underline">Dismiss</button>
            </div>
          )}

          <div className="mb-4 flex items-center justify-between">
            <div className="flex border-b border-gray-200 dark:border-gray-700">
              {([
                { id: "joined" as const, label: "Joined" },
                { id: "discover" as const, label: "Discover" },
              ]).map((sv) => (
                <button
                  key={sv.id}
                  onClick={() => setCommunitySubView(sv.id)}
                  className={cn(
                    "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px",
                    communitySubView === sv.id
                      ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
                  )}
                >
                  {sv.label}
                </button>
              ))}
            </div>
            <Button onClick={() => setIsCreateModalOpen(true)}>Create Community</Button>
          </div>

          <div className="mb-4">
            <TextField label="" placeholder="Search communities..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>

          {comLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
              <span className="ml-3 text-gray-500 dark:text-gray-400">Loading...</span>
            </div>
          ) : communities.length === 0 ? (
            <Card>
              <div className="py-12 text-center">
                <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                  <span className="text-3xl">👥</span>
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  {communitySubView === "joined" ? "No communities yet" : "No communities found"}
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {communitySubView === "joined" ? "Join a community or create your own to get started" : "Try a different search term"}
                </p>
              </div>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {communities.map((community) => (
                <Card
                  key={community.id}
                  className="cursor-pointer transition-all hover:shadow-lg hover:border-blue-200 dark:hover:border-blue-800"
                  onClick={() => navigate(`/community/${community.url_id}`)}
                >
                  <div className="flex gap-4">
                    <div
                      className="h-14 w-14 rounded-xl flex items-center justify-center text-white font-bold text-xl flex-shrink-0 shadow-sm"
                      style={{
                        background: `linear-gradient(135deg, ${community.color_theme || "#3B82F6"}, ${community.color_theme ? community.color_theme + "CC" : "#6366F1"})`,
                      }}
                    >
                      {community.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900 dark:text-white truncate">{community.name}</h3>
                        {community.my_role === "owner" && (
                          <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">Owner</span>
                        )}
                        {community.my_role === "admin" && (
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">Admin</span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                        {community.description || "No description"}
                      </p>
                      <div className="mt-2 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1.5">{getTypeIcon(community.community_type)} {getTypeLabel(community.community_type)}</span>
                        <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {community.member_count}</span>
                        <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" /> {community.resource_count}</span>
                      </div>
                    </div>
                    {community.is_invited && community.invitation_id ? (
                      <div className="flex items-center gap-2 self-center" onClick={(e) => e.stopPropagation()}>
                        <Button variant="primary" onClick={(e) => handleInvitationResponse(community.invitation_id!, true, e)}>
                          Accept
                        </Button>
                        <Button variant="secondary" onClick={(e) => handleInvitationResponse(community.invitation_id!, false, e)}>
                          Decline
                        </Button>
                      </div>
                    ) : community.is_pending ? (
                      <span className="self-center text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-1.5 rounded-lg">Pending</span>
                    ) : !community.is_member ? (
                      community.community_type === "invite_only" ? (
                        <span className="self-center text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-3 py-1.5 rounded-lg flex items-center gap-1"><Mail className="w-3 h-3" /> Invite Only</span>
                      ) : (
                        <button
                          className={`self-center flex-shrink-0 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                            community.community_type === "private"
                              ? "border border-purple-300 dark:border-purple-600 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                              : "bg-blue-600 text-white hover:bg-blue-700"
                          }`}
                          onClick={(e) => handleJoinCommunity(community.url_id, community.community_type, e)}
                        >
                          {community.community_type === "private" ? "Apply" : "Join"}
                        </button>
                      )
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-300 dark:text-gray-600 self-center flex-shrink-0" />
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}

          {isCreateModalOpen && (
            <CreateCommunityModal
              onClose={() => setIsCreateModalOpen(false)}
              onCreated={() => { setIsCreateModalOpen(false); setCommunitySubView("joined"); fetchCommunities() }}
            />
          )}
        </>
      )}

      {pageTab === "classes" && !isTeacher && (
        <>
          {classError && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
              {classError}
              <button onClick={() => setClassError(null)} className="ml-2 font-medium underline">Dismiss</button>
            </div>
          )}

          {/* Join a Class */}
          <div className="mb-6 flex items-center gap-3">
            <div className="flex-1 flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 shadow-sm focus-within:ring-2 focus-within:ring-blue-500/30 focus-within:border-blue-400 transition-all">
              <GraduationCap className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <input
                type="text"
                placeholder="Enter course code to join a class..."
                className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 outline-none"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleJoinClass()}
              />
            </div>
            <button
              onClick={handleJoinClass}
              disabled={joinLoading || !joinCode.trim()}
              className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
            >
              {joinLoading ? "Joining..." : "Join Class"}
            </button>
          </div>
          {joinMsg && (
            <p className={cn("mb-4 -mt-3 text-sm", joinMsg.type === "success" ? "text-green-600" : "text-red-600")}>{joinMsg.text}</p>
          )}

          {classLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
              <span className="ml-3 text-gray-500 dark:text-gray-400">Loading...</span>
            </div>
          ) : classes.length === 0 ? (
            <div className="py-16 text-center">
              <div className="mx-auto mb-4 h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 flex items-center justify-center">
                <GraduationCap className="w-8 h-8 text-blue-500 dark:text-blue-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">No classes yet</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Enter a course code above to join your first class
              </p>
            </div>
          ) : (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
                My Classes ({classes.length})
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                {classes.map((cls) => (
                  <Card
                    key={cls.id}
                    className="cursor-pointer transition-all hover:shadow-lg hover:border-blue-200 dark:hover:border-blue-800"
                    onClick={() => navigate(`/community/class/${cls.id}`)}
                  >
                    <div className="flex gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-500 flex items-center justify-center text-white flex-shrink-0 shadow-sm">
                        <GraduationCap className="w-6 h-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900 dark:text-white truncate">{cls.name}</h3>
                          {cls.course_code && (
                            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 flex-shrink-0">
                              {cls.course_code}
                            </span>
                          )}
                        </div>
                        {cls.course_name && (
                          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400 truncate">{cls.course_name}</p>
                        )}
                        <div className="mt-1.5 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                          <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {cls.student_count} students</span>
                          <span className="truncate">{cls.teacher.display_name || cls.teacher.username || "Unknown"}</span>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-300 dark:text-gray-600 self-center flex-shrink-0" />
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}


function CreateCommunityModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [communityType, setCommunityType] = useState<CommunityType>("public")
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // post the new community to the api with name, type and optional description
  async function handleCreate() {
    if (!name.trim()) return
    setCreating(true)
    setError(null)
    try {
      const params = new URLSearchParams({ name: name.trim(), community_type: communityType })
      if (description.trim()) params.set("description", description.trim())
      await apiClient.post(`/api/communities?${params}`, {})
      onCreated()
    } catch (e: any) {
      setError(e?.message || "Failed to create community")
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Create Community</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Start a new learning community for your study group or class</p>

        {error && (
          <div className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">{error}</div>
        )}

        <div className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Community Name</label>
            <TextField label="" placeholder="e.g., Machine Learning Study Group" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
            <textarea
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              rows={3} placeholder="What is this community about?" value={description} onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Community Type</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: "public", label: "Public", icon: "🌐", desc: "Anyone can join" },
                { value: "private", label: "Private", icon: "🔒", desc: "Approval required" },
                { value: "invite_only", label: "Invite Only", icon: "✉️", desc: "By invitation" },
                { value: "course_based", label: "Course", icon: "🎓", desc: "For a class" }
              ].map((type) => (
                <button
                  key={type.value}
                  onClick={() => setCommunityType(type.value as CommunityType)}
                  className={cn(
                    "rounded-lg border p-3 text-left transition-colors",
                    communityType === type.value
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                      : "border-gray-200 hover:border-gray-300 dark:border-gray-600 dark:hover:border-gray-500"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span>{type.icon}</span>
                    <span className="font-medium text-gray-900 dark:text-white">{type.label}</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{type.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleCreate} disabled={creating || !name.trim()}>
            {creating ? "Creating..." : "Create Community"}
          </Button>
        </div>
      </div>
    </div>
  )
}
