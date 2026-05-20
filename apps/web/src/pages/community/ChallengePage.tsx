import { useState, useEffect, useCallback } from "react"
import { Card } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { TextField } from "../../components/form/TextField"
import { DateInput } from "../../components/ui/DateInput"
import { cn } from "../../../../../shared/utils"
import { apiClient } from "../../lib/api"
import { logActivity } from "../../lib/activityLog"
import { useAuth } from "../../contexts/AuthContext"


type ChallengeStatus = "draft" | "upcoming" | "active" | "judging" | "completed" | "cancelled"

type CriterionItem = {
  name: string
  description: string
  weight: number
}

type Challenge = {
  id: string
  title: string
  description: string | null
  instructions: string | null
  challenge_type: string
  status: ChallengeStatus
  starts_at: string | null
  ends_at: string | null
  max_participants: number | null
  participant_count: number
  submission_count: number
  rewards: { winner_points?: number; participant_points?: number } | null
  judging_criteria: CriterionItem[] | null
  created_at: string | null
  is_joined: boolean
  my_submission?: {
    title: string | null
    description: string | null
    submitted_at: string | null
    score: number | null
    scores: Record<string, number> | null
    feedback: string | null
    status: string
  }
  community?: { id: string | null; name: string }
}

type ChallengesResponse = {
  challenges: Challenge[]
  total: number
  page: number
  page_size: number
}


export function ChallengePage() {
  const { user } = useAuth()
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"all" | "joined" | "completed">("all")
  const [statusFilter, setStatusFilter] = useState<"all" | ChallengeStatus>("all")
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null)

  const isAdmin = user?.role === "admin"

  const fetchChallenges = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams({ page: "1", page_size: "50" })
      if (activeTab === "joined") params.set("joined", "true")
      if (activeTab === "completed") params.set("status", "completed")
      const data = await apiClient.get<ChallengesResponse>(`/api/challenges?${params}`)
      setChallenges(data?.challenges ?? [])
    } catch (e: any) {
      setError(e?.message || "Failed to load challenges")
    } finally {
      setLoading(false)
    }
  }, [activeTab])

  useEffect(() => {
    fetchChallenges()
  }, [fetchChallenges])

  async function handleJoin(challengeId: string, e: React.MouseEvent) {
    e.stopPropagation()
    try {
      await apiClient.post(`/api/challenges/${challengeId}/join`, {})
      logActivity("challenge", "join", challengeId)
      await fetchChallenges()
    } catch (err: any) {
      setError(err?.message || "Failed to join challenge")
    }
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return ""
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    })
  }

  function getTimeRemaining(endDate: string | null) {
    if (!endDate) return ""
    const end = new Date(endDate)
    const now = new Date()
    const diffMs = end.getTime() - now.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    if (diffMs < 0) return "Ended"
    if (diffDays > 0) return `${diffDays}d ${diffHours}h left`
    return `${diffHours}h left`
  }

  function getStatusColor(status: ChallengeStatus) {
    const colors: Record<string, string> = {
      upcoming: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
      active: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
      completed: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
      cancelled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
      draft: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
      judging: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
    }
    return colors[status] || colors.active
  }

  function getTypeIcon(type: string) {
    return <ChallengeTypeIcon type={type} />
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Challenges</h1>
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Challenges</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Participate in challenges to earn points and badges
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setIsCreateModalOpen(true)}>Create Challenge</Button>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
          {error}
          <button onClick={() => setError(null)} className="ml-2 font-medium underline">Dismiss</button>
        </div>
      )}

      <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
        <div className="flex gap-2">
          {[
            { id: "all", label: "All Challenges" },
            ...(user?.role !== "admin" ? [{ id: "joined", label: "My Challenges" }] : []),
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
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
            Status
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="upcoming">Upcoming</option>
            <option value="completed">Completed</option>
            <option value="judging">Judging</option>
          </select>
        </div>
      </div>

      {/* filter and list challenges */}
      {(() => {
        const filtered = challenges.filter(c =>
          statusFilter !== "all" ? c.status === statusFilter : true
        )
        return filtered.length === 0 ? (
        <Card>
          <div className="py-12 text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <TrophyIcon className="h-8 w-8 text-yellow-500" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">No challenges found</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Check back later for new challenges</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((challenge) => (
            <Card
              key={challenge.id}
              className="cursor-pointer transition-shadow hover:shadow-lg"
              onClick={() => setSelectedChallenge(challenge)}
            >
              <div className="flex gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/20">{getTypeIcon(challenge.challenge_type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-900 dark:text-white">{challenge.title}</h3>
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium capitalize", getStatusColor(challenge.status))}>
                      {challenge.status}
                    </span>
                    {challenge.my_submission?.score != null ? (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300">
                        Graded
                      </span>
                    ) : challenge.my_submission ? (
                      <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300">
                        Submitted
                      </span>
                    ) : challenge.is_joined ? (
                      <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                        Joined
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                    {challenge.description}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                    {challenge.community && (
                      <span className="inline-flex items-center gap-1">
                        <MapPinIcon className="h-3.5 w-3.5" />
                        {challenge.community.name}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <UsersIcon className="h-3.5 w-3.5" />
                      {challenge.participant_count} participants
                    </span>
                    {challenge.rewards?.winner_points && (
                      <span className="inline-flex items-center gap-1">
                        <TrophyIcon className="h-3.5 w-3.5 text-yellow-500" />
                        {challenge.rewards.winner_points} pts
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <CalendarIcon className="h-3.5 w-3.5" />
                      {formatDate(challenge.starts_at)} - {formatDate(challenge.ends_at)}
                    </span>
                    {challenge.status === "active" && (
                      <span className="inline-flex items-center gap-1 font-medium text-orange-600 dark:text-orange-400">
                        <ClockIcon className="h-3.5 w-3.5" />
                        {getTimeRemaining(challenge.ends_at)}
                      </span>
                    )}
                  </div>
                  {challenge.my_submission && (
                    <div className="mt-2 rounded-lg bg-gray-50 p-2 dark:bg-gray-800">
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        Your submission: {challenge.my_submission.score != null
                          ? `Score: ${challenge.my_submission.score}/100`
                          : "Pending review"}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  {user?.role !== "admin" && challenge.status === "active" && !challenge.is_joined && (
                    <Button onClick={(e) => handleJoin(challenge.id, e)}>Join</Button>
                  )}
                  {user?.role !== "admin" && challenge.status === "active" && challenge.is_joined && !challenge.my_submission && (
                    <Button onClick={(e) => { e.stopPropagation(); setSelectedChallenge(challenge) }}>Submit</Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )
      })()}

      {selectedChallenge && (
        <ChallengeDetailModal
          challenge={selectedChallenge}
          onClose={(changed?: boolean) => { setSelectedChallenge(null); if (changed) fetchChallenges() }}
        />
      )}

      {isCreateModalOpen && (
        <CreateChallengeModal
          onClose={() => setIsCreateModalOpen(false)}
          onCreated={() => { setIsCreateModalOpen(false); fetchChallenges() }}
        />
      )}
    </div>
  )
}

function ChallengeDetailModal({ challenge: initialChallenge, onClose }: { challenge: Challenge; onClose: (changed?: boolean) => void }) {
  const { user } = useAuth()
  const [challenge, setChallenge] = useState(initialChallenge)
  const [didChange, setDidChange] = useState(false)
  const [submissionTitle, setSubmissionTitle] = useState("")
  const [submissionDesc, setSubmissionDesc] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // keep checking for the grade every 3s
  useEffect(() => {
    const isPending = challenge.my_submission && challenge.my_submission.score == null
    if (!isPending) return

    const interval = setInterval(async () => {
      try {
        const data = await apiClient.get<{ challenge: Challenge }>(`/api/challenges/${challenge.id}`)
        if (data?.challenge) {
          setChallenge(data.challenge)
          if (data.challenge.my_submission?.score != null) {
            logActivity("challenge", "complete", data.challenge.id, { score: data.challenge.my_submission.score })
            clearInterval(interval)
          }
        }
      } catch {}
    }, 3000)

    return () => clearInterval(interval)
  }, [challenge.id, challenge.my_submission?.score])

  async function handleSubmit() {
    if (!submissionTitle.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const params = new URLSearchParams({ title: submissionTitle.trim() })
      if (submissionDesc.trim()) params.set("description", submissionDesc.trim())
      await apiClient.post(`/api/challenges/${challenge.id}/submissions?${params}`, {})
      logActivity("challenge", "attempt", challenge.id)
      setDidChange(true)
      const data = await apiClient.get<{ challenge: Challenge }>(`/api/challenges/${challenge.id}`)
      if (data?.challenge) setChallenge(data.challenge)
    } catch (e: any) {
      setError(e?.message || "Failed to submit")
    } finally {
      setSubmitting(false)
    }
  }

  const winnerPts = challenge.rewards?.winner_points || 0
  const participantPts = challenge.rewards?.participant_points || 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{challenge.title}</h2>
            {challenge.community && (
              <p className="text-sm text-gray-500 dark:text-gray-400">{challenge.community.name}</p>
            )}
          </div>
          <button onClick={() => onClose(didChange)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">{error}</div>
        )}

        <div className="mt-4 space-y-4">
          <div>
            <h3 className="font-medium text-gray-900 dark:text-white">Description</h3>
            <p className="mt-1 text-gray-600 dark:text-gray-300">{challenge.description}</p>
          </div>

          {challenge.instructions && (
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">Instructions</h3>
              <p className="mt-1 text-gray-600 dark:text-gray-300">{challenge.instructions}</p>
            </div>
          )}

          {Array.isArray(challenge.judging_criteria) && challenge.judging_criteria.length > 0 && (
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">Judging Criteria</h3>
              <div className="mt-2 space-y-2">
                {challenge.judging_criteria.map((c) => (
                  <div key={c.name} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-700">
                    <div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{c.name}</span>
                      {c.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">{c.description}</p>
                      )}
                    </div>
                    <span className="text-xs font-medium text-blue-600 dark:text-blue-400">{c.weight}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-700">
              <div className="text-sm text-gray-500 dark:text-gray-400">Winner Reward</div>
              <div className="text-lg font-bold text-yellow-600 dark:text-yellow-400">{winnerPts} points</div>
            </div>
            <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-700">
              <div className="text-sm text-gray-500 dark:text-gray-400">Participation Reward</div>
              <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{participantPts} points</div>
            </div>
          </div>

          {user?.role !== "admin" && challenge.status === "active" && challenge.is_joined && !challenge.my_submission && (
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">Submit Your Work</h3>
              <div className="mt-2 space-y-2">
                <TextField
                  label=""
                  placeholder="Submission title"
                  value={submissionTitle}
                  onChange={(e) => setSubmissionTitle(e.target.value)}
                />
                <textarea
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  rows={4}
                  placeholder="Describe your solution..."
                  value={submissionDesc}
                  onChange={(e) => setSubmissionDesc(e.target.value)}
                />
                <div className="flex justify-end">
                  <Button onClick={handleSubmit} disabled={submitting || !submissionTitle.trim()}>
                    {submitting ? "Submitting..." : "Submit"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {challenge.my_submission && (
            <div className="space-y-3">
              <h3 className="font-medium text-gray-900 dark:text-white">Your Submission</h3>

              {/* Show what was submitted */}
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
                {challenge.my_submission.title && (
                  <p className="font-medium text-gray-900 dark:text-white">{challenge.my_submission.title}</p>
                )}
                {challenge.my_submission.description && (
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{challenge.my_submission.description}</p>
                )}
                <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                  Submitted {challenge.my_submission.submitted_at
                    ? new Date(challenge.my_submission.submitted_at).toLocaleDateString()
                    : ""}
                </p>
              </div>

              {challenge.my_submission.score != null ? (
                <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-green-700 dark:text-green-300">
                      Overall Score
                    </span>
                    <span className="text-2xl font-bold text-green-700 dark:text-green-300">
                      {challenge.my_submission.score}/100
                    </span>
                  </div>

                  {challenge.my_submission.scores && typeof challenge.my_submission.scores === "object" && !Array.isArray(challenge.my_submission.scores) && (
                    <div className="mt-3 space-y-2">
                      {Object.entries(challenge.my_submission.scores)
                        .filter(([, v]) => typeof v === "number")
                        .map(([name, score]) => (
                        <div key={name}>
                          <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                            <span>{name}</span>
                            <span>{score}/100</span>
                          </div>
                          <div className="mt-0.5 h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-600">
                            <div
                              className="h-1.5 rounded-full bg-green-500"
                              style={{ width: `${Math.min(score, 100)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {challenge.my_submission.feedback && (
                    <div className="mt-3 border-t border-green-200 pt-3 dark:border-green-800">
                      <p className="text-xs font-medium text-gray-700 dark:text-gray-300">AI Feedback</p>
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        {challenge.my_submission.feedback}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-lg bg-yellow-50 p-3 dark:bg-yellow-900/20">
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    Pending AI review...
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <Button variant="ghost" onClick={() => onClose(didChange)}>Close</Button>
        </div>
      </div>
    </div>
  )
}


const DEFAULT_CRITERIA: CriterionItem[] = [
  { name: "Relevance", description: "How well the submission addresses the challenge topic", weight: 25 },
  { name: "Quality", description: "Overall quality, depth, and thoroughness", weight: 25 },
  { name: "Clarity", description: "How clear and well-structured the submission is", weight: 25 },
  { name: "Creativity", description: "Originality and creative approach", weight: 25 },
]
// only admin can access to this function
function CreateChallengeModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [instructions, setInstructions] = useState("")
  const [challengeType, setChallengeType] = useState("creative")
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    return d.toISOString().split("T")[0]
  })
  const [endDate, setEndDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 7)
    return d.toISOString().split("T")[0]
  })
  const [winnerPoints, setWinnerPoints] = useState("100")
  const [participantPoints, setParticipantPoints] = useState("10")
  const [criteria, setCriteria] = useState<CriterionItem[]>(DEFAULT_CRITERIA)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function updateCriterion(index: number, field: keyof CriterionItem, value: string | number) {
    setCriteria(prev => prev.map((c, i) => i === index ? { ...c, [field]: value } : c))
  }

  function addCriterion() {
    setCriteria(prev => [...prev, { name: "", description: "", weight: 25 }])
  }

  function removeCriterion(index: number) {
    setCriteria(prev => prev.filter((_, i) => i !== index))
  }

  async function handleCreate() {
    if (!title.trim()) return
    setCreating(true)
    setError(null)
    try {
      const validCriteria = criteria.filter(c => c.name.trim())

      await apiClient.post(`/api/challenges`, {
        title: title.trim(),
        challenge_type: challengeType,
        starts_at: new Date(startDate).toISOString(),
        ends_at: new Date(endDate).toISOString(),
        description: description.trim() || undefined,
        instructions: instructions.trim() || undefined,
        winner_points: winnerPoints ? parseInt(winnerPoints) : undefined,
        participant_points: participantPoints ? parseInt(participantPoints) : undefined,
        judging_criteria: validCriteria.length > 0 ? validCriteria : undefined,
      })
      onCreated()
    } catch (e: any) {
      setError(e?.message || "Failed to create challenge")
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Create Challenge</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Create a new challenge for your community
        </p>

        {error && (
          <div className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">{error}</div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Challenge Name</label>
            <TextField label="" placeholder="e.g., Weekly Coding Challenge" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
            <textarea
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              rows={2}
              placeholder="What should participants do?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Start Date</label>
            <DateInput
              value={startDate}
              onChange={setStartDate}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">End Date</label>
            <DateInput
              value={endDate}
              onChange={setEndDate}
              min={startDate}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Winner Points</label>
            <TextField label="" type="number" value={winnerPoints} onChange={(e) => setWinnerPoints(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Participation Points</label>
            <TextField label="" type="number" value={participantPoints} onChange={(e) => setParticipantPoints(e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Challenge Type</label>
            <div className="flex gap-2">
              {[
                { value: "creative", label: "Creative", icon: <PaletteIcon className="h-5 w-5" /> },
                { value: "quiz", label: "Quiz", icon: <QuestionIcon className="h-5 w-5" /> },
                { value: "teaching", label: "Teaching", icon: <GraduationCapIcon className="h-5 w-5" /> },
              ].map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setChallengeType(type.value)}
                  className={cn(
                    "flex-1 rounded-lg border p-2 text-center transition-colors",
                    challengeType === type.value
                      ? "border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                      : "border-gray-200 text-gray-500 hover:border-gray-300 dark:border-gray-600 dark:text-gray-400"
                  )}
                >
                  <div className="flex justify-center">{type.icon}</div>
                  <div className="mt-1 text-xs font-medium text-gray-700 dark:text-gray-300">{type.label}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Instructions (optional)</label>
            <textarea
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              rows={2}
              placeholder="Detailed instructions..."
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
            />
          </div>
          <div className="col-span-2">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Judging Criteria</label>
              <button
                type="button"
                onClick={addCriterion}
                className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                + Add Criterion
              </button>
            </div>
            <div className="space-y-2">
              {criteria.map((c, i) => (
                <div key={i} className="flex gap-2 items-center rounded-lg border border-gray-200 p-2 dark:border-gray-600">
                  <input
                    type="text"
                    placeholder="Criterion name"
                    value={c.name}
                    onChange={(e) => updateCriterion(i, "name", e.target.value)}
                    className="flex-1 rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={c.weight}
                      onChange={(e) => updateCriterion(i, "weight", parseInt(e.target.value) || 0)}
                      className="w-14 rounded border border-gray-300 bg-white px-1 py-1 text-center text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    />
                    <span className="text-xs text-gray-500">%</span>
                  </div>
                  {criteria.length > 1 && (
                    <button type="button" onClick={() => removeCriterion(i)} className="text-gray-400 hover:text-red-500">
                      <XIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {criteria.length > 0 && (
              <p className={cn(
                "mt-1 text-xs",
                Math.abs(criteria.reduce((s, c) => s + c.weight, 0) - 100) < 0.01
                  ? "text-green-600 dark:text-green-400"
                  : "text-orange-600 dark:text-orange-400"
              )}>
                Total: {criteria.reduce((s, c) => s + c.weight, 0)}%
                {Math.abs(criteria.reduce((s, c) => s + c.weight, 0) - 100) >= 0.01 && " (should be 100%)"}
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleCreate} disabled={creating || !title.trim()}>
            {creating ? "Creating..." : "Create Challenge"}
          </Button>
        </div>
      </div>
    </div>
  )
}

type IconProps = { className?: string }

function TrophyIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  )
}

function MapPinIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" />
    </svg>
  )
}

function UsersIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function CalendarIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="4" rx="2" /><path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h18" />
    </svg>
  )
}

function ClockIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function XIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
    </svg>
  )
}

function PaletteIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="13.5" cy="6.5" r="0.5" fill="currentColor" /><circle cx="17.5" cy="10.5" r="0.5" fill="currentColor" />
      <circle cx="8.5" cy="7.5" r="0.5" fill="currentColor" /><circle cx="6.5" cy="12.5" r="0.5" fill="currentColor" />
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2Z" />
    </svg>
  )
}

function QuestionIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" />
    </svg>
  )
}

function GraduationCapIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z" />
      <path d="M22 10v6" /><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5" />
    </svg>
  )
}

function BrainIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
      <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
      <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" /><path d="M12 18v-5.5" />
    </svg>
  )
}

function BuildingIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect width="16" height="20" x="4" y="2" rx="2" /><path d="M9 22v-4h6v4" />
      <path d="M8 6h.01" /><path d="M16 6h.01" /><path d="M12 6h.01" />
      <path d="M12 10h.01" /><path d="M12 14h.01" /><path d="M16 10h.01" />
      <path d="M16 14h.01" /><path d="M8 10h.01" /><path d="M8 14h.01" />
    </svg>
  )
}

function CardIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="3" rx="2" /><path d="M3 9h18" /><path d="M9 21V9" />
    </svg>
  )
}

function UserIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  )
}

function SwordsIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5" /><line x1="13" x2="19" y1="19" y2="13" />
      <line x1="16" x2="20" y1="16" y2="20" /><line x1="19" x2="21" y1="21" y2="19" />
      <polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5" /><line x1="5" x2="9" y1="14" y2="18" />
      <line x1="7" x2="4" y1="17" y2="20" /><line x1="3" x2="5" y1="19" y2="21" />
    </svg>
  )
}

function HandshakeIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="m11 17 2 2a1 1 0 1 0 3-3" /><path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4" />
      <path d="m21 3 1 11h-2" /><path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3" /><path d="M3 4h8" />
    </svg>
  )
}

function ChallengeTypeIcon({ type }: { type: string }) {
  const cls = "h-6 w-6 text-blue-600 dark:text-blue-400"
  switch (type) {
    case "mnemonic": return <BrainIcon className={cls} />
    case "memory_palace": return <BuildingIcon className={cls} />
    case "flashcard": return <CardIcon className={cls} />
    case "quiz": return <QuestionIcon className={cls} />
    case "teaching": return <GraduationCapIcon className={cls} />
    case "creative": return <PaletteIcon className={cls} />
    case "individual": return <UserIcon className={cls} />
    case "team_battle": return <SwordsIcon className={cls} />
    case "collaborative": return <HandshakeIcon className={cls} />
    default: return <TrophyIcon className={cls} />
  }
}
