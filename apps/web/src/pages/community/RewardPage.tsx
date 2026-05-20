import { useState, useEffect } from "react"
import { Card } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { cn } from "../../../../../shared/utils"
import { apiClient } from "../../lib/api"
import {
  BookOpen, Share2, MessageSquare, Star, MessageCircle, PenLine, Trophy, Award,
  Heart, GraduationCap, CheckCircle, Calendar, Target, Users, Shield, BarChart3,
  ThumbsUp, Medal, Flame, Handshake, Gift, Check, ShoppingBag, Zap,
} from "lucide-react"


type BadgeRarity = "common" | "uncommon" | "rare" | "epic" | "legendary"

type Badge = {
  id: string
  name: string
  url_id: string
  description: string | null
  icon_url: string | null
  color: string | null
  rarity: BadgeRarity | null
  badge_type: string
  criteria: any
  points_awarded: number
  is_secret: boolean
  earned: boolean
  earned_at: string | null
}

type LeaderboardEntry = {
  rank: number
  user_id: string
  username: string
  display_name: string | null
  points: number
  name_color: string | null
  profile_border: string | null
}

type ReputationSummary = {
  total_score: number
  level: number
  level_name: string
  next_level_name: string | null
  points_to_next: number
  rank_percentile: number
}

type BreakdownItem = { category: string; score: number; label: string; icon: string }
type ReputationEvent = { id: string; event_type: string; dimension: string; points_change: number; created_at: string | null }
type ReputationLevel = { id: number; name: string; url_id: string; min_score: number; max_score: number | null; icon: string | null; color: string | null }

type PointsByType = { name: string; url_id: string; icon: string | null; color: string | null; total: number }
type PointsSummary = {
  balance: number
  total_earned: number
  total_spent: number
  points_by_type: PointsByType[]
  streak: { current: number; longest: number; multiplier: number }
  cosmetics?: { profile_border?: string; name_color?: string }
  streak_freeze_count?: number
  active_boost?: { multiplier: number; expires_at: string | null } | null
}
type Transaction = { id: string; points: number; action_type: string; description: string | null; point_type_name: string | null; icon: string | null; color: string | null; created_at: string | null }
type ShopItem = { id: string; name: string; url_id: string; description: string | null; price: number; category: string; item_type: string; icon: string | null; preview_url: string | null; is_giftable: boolean; is_limited: boolean; stock_count: number | null; owned: boolean; is_one_time: boolean; item_value?: any }

type ActiveTab = "points" | "badges" | "leaderboard" | "reputation"


export function RewardPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("points")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [ptsSummary, setPtsSummary] = useState<PointsSummary | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [shopItems, setShopItems] = useState<ShopItem[]>([])
  const [ptsSubTab, setPtsSubTab] = useState<"history" | "shop">("history")
  const [shopCategory, setShopCategory] = useState("all")
  const [purchaseLoading, setPurchaseLoading] = useState<string | null>(null)
  const [confirmItem, setConfirmItem] = useState<ShopItem | null>(null)
  const [activeCosmetics, setActiveCosmetics] = useState<{ profile_border?: string; name_color?: string }>({})

  const [badges, setBadges] = useState<Badge[]>([])
  const [badgeFilter, setBadgeFilter] = useState<"all" | "earned" | "locked">("all")

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])

  const [repSummary, setRepSummary] = useState<ReputationSummary | null>(null)
  const [repBreakdown, setRepBreakdown] = useState<BreakdownItem[]>([])
  const [repEvents, setRepEvents] = useState<ReputationEvent[]>([])
  const [repLevels, setRepLevels] = useState<ReputationLevel[]>([])
  const [showBreakdown, setShowBreakdown] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        setError(null)
        const [ptsData, txData, shopData, badgeData, lbData, sumData, bdData, evData, lvData] = await Promise.all([
          apiClient.get<PointsSummary>("/api/gamification/points/summary"),
          apiClient.get<{ transactions: Transaction[]; total: number }>("/api/gamification/points/history?page_size=50"),
          apiClient.get<{ items: ShopItem[] }>("/api/gamification/shop"),
          apiClient.get<{ badges: Badge[] }>("/api/gamification/badges"),
          apiClient.get<{ leaderboard: LeaderboardEntry[] }>("/api/gamification/leaderboard?limit=20"),
          apiClient.get<ReputationSummary>("/api/reputation/me"),
          apiClient.get<{ breakdown: BreakdownItem[] }>("/api/reputation/me/breakdown"),
          apiClient.get<{ events: ReputationEvent[] }>("/api/reputation/me/events?limit=10"),
          apiClient.get<{ levels: ReputationLevel[] }>("/api/reputation/levels"),
        ])
        setPtsSummary(ptsData)
        setActiveCosmetics(ptsData?.cosmetics ?? {})
        setTransactions(txData?.transactions ?? [])
        setShopItems(shopData?.items ?? [])
        setBadges(badgeData?.badges ?? [])
        setLeaderboard(lbData?.leaderboard ?? [])
        if (sumData) setRepSummary(sumData)
        setRepBreakdown(bdData?.breakdown ?? [])
        setRepEvents(evData?.events ?? [])
        setRepLevels(lvData?.levels ?? [])
      } catch (e: any) {
        setError(e?.message || "Failed to load data")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const balance = ptsSummary?.balance ?? 0
  const streak = ptsSummary?.streak ?? { current: 0, longest: 0, multiplier: 1 }
  const filteredShopItems = shopCategory === "all" ? shopItems : shopItems.filter(i => i.category === shopCategory)

  // buy a shop item, then refresh balance + shop + transaction history and ping the navbar
  async function handlePurchase(itemId: string) {
    setPurchaseLoading(itemId)
    try {
      await apiClient.post(`/api/gamification/shop/${itemId}/purchase`, {})
      const [updated, shopData, txData] = await Promise.all([
        apiClient.get<PointsSummary>("/api/gamification/points/summary"),
        apiClient.get<{ items: ShopItem[] }>("/api/gamification/shop"),
        apiClient.get<{ transactions: Transaction[]; total: number }>("/api/gamification/points/history?page_size=50"),
      ])
      setPtsSummary(updated)
      setActiveCosmetics(updated?.cosmetics ?? {})
      setShopItems(shopData?.items ?? [])
      setTransactions(txData?.transactions ?? [])
      window.dispatchEvent(new Event("points-updated"))
    } catch (e: any) {
      setError(e?.message || "Purchase failed")
    } finally {
      setPurchaseLoading(null)
    }
  }

  function getActionIcon(t: string) {
    const icons: Record<string, React.ReactNode> = {
      daily_study: <BookOpen className="h-5 w-5 text-blue-500" />,
      share_content: <Share2 className="h-5 w-5 text-green-500" />,
      give_feedback: <MessageSquare className="h-5 w-5 text-purple-500" />,
      feedback_helpful: <Star className="h-5 w-5 text-yellow-500" />,
      discussion_reply: <MessageCircle className="h-5 w-5 text-cyan-500" />,
      discussion_post: <PenLine className="h-5 w-5 text-indigo-500" />,
      challenge_complete: <Trophy className="h-5 w-5 text-yellow-600" />,
      challenge_win: <Award className="h-5 w-5 text-yellow-500" />,
      content_liked: <Heart className="h-5 w-5 text-red-500" />,
      mentor_session: <GraduationCap className="h-5 w-5 text-purple-600" />,
      answer_accepted: <CheckCircle className="h-5 w-5 text-green-500" />,
      weekly_share: <Calendar className="h-5 w-5 text-blue-500" />,
      shop_purchase: <ShoppingBag className="h-5 w-5 text-pink-500" />,
    }
    return icons[t] || <Target className="h-5 w-5 text-gray-500" />
  }

  function getShopCatColor(c: string) {
    const m: Record<string, string> = { fun: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300", tools: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300", prosocial: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300", premium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300" }
    return m[c] || "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
  }

  const earnedBadges = badges.filter(b => b.earned)
  const lockedBadges = badges.filter(b => !b.earned)
  const filteredBadges = badgeFilter === "all" ? badges : badgeFilter === "earned" ? earnedBadges : lockedBadges

  function getRarityColor(r: BadgeRarity | null) {
    const c: Record<string, string> = { common: "border-gray-300 bg-gray-50 dark:border-gray-600 dark:bg-gray-800", uncommon: "border-green-300 bg-green-50 dark:border-green-600 dark:bg-green-900/20", rare: "border-blue-300 bg-blue-50 dark:border-blue-600 dark:bg-blue-900/20", epic: "border-purple-300 bg-purple-50 dark:border-purple-600 dark:bg-purple-900/20", legendary: "border-yellow-400 bg-yellow-50 dark:border-yellow-500 dark:bg-yellow-900/20" }
    return c[r || "common"] || c.common
  }

  function getRarityText(r: BadgeRarity | null) {
    const c: Record<string, string> = { common: "text-gray-600 dark:text-gray-400", uncommon: "text-green-600 dark:text-green-400", rare: "text-blue-600 dark:text-blue-400", epic: "text-purple-600 dark:text-purple-400", legendary: "text-yellow-600 dark:text-yellow-400" }
    return c[r || "common"] || c.common
  }

  const totalScore = repSummary?.total_score ?? 0
  const levelName = repSummary?.level_name ?? "Newcomer"
  const nextLevelName = repSummary?.next_level_name
  const pointsToNext = repSummary?.points_to_next ?? 0
  const rankPercentile = repSummary?.rank_percentile ?? 100
  const currentLevelObj = repLevels.find(l => l.name === levelName)
  const currentLevelMax = currentLevelObj?.max_score ?? (totalScore + pointsToNext)
  const currentLevelMin = currentLevelObj?.min_score ?? 0
  const progressInLevel = currentLevelMax > currentLevelMin ? ((totalScore - currentLevelMin) / (currentLevelMax - currentLevelMin)) * 100 : 100

  function getCatIcon(c: string) {
    const icons: Record<string, React.ReactNode> = {
      teaching: <GraduationCap className="h-5 w-5 text-purple-500" />,
      content: <BookOpen className="h-5 w-5 text-blue-500" />,
      feedback: <MessageSquare className="h-5 w-5 text-green-500" />,
      engagement: <Users className="h-5 w-5 text-orange-500" />,
      reliability: <Shield className="h-5 w-5 text-gray-500" />,
    }
    return icons[c] || <BarChart3 className="h-5 w-5 text-gray-500" />
  }
  
  function getCatColor(c: string) { return ({ teaching: "text-purple-600 dark:text-purple-400", content: "text-blue-600 dark:text-blue-400", feedback: "text-green-600 dark:text-green-400", engagement: "text-orange-600 dark:text-orange-400", reliability: "text-gray-600 dark:text-gray-400" } as Record<string, string>)[c] || "text-gray-600" }
  
  function getEvtIcon(t: string) {
    const icons: Record<string, React.ReactNode> = {
      content_shared: <Share2 className="h-5 w-5 text-green-500" />,
      content_liked: <Heart className="h-5 w-5 text-red-500" />,
      content_rated: <Star className="h-5 w-5 text-yellow-500" />,
      feedback_given: <MessageSquare className="h-5 w-5 text-purple-500" />,
      feedback_marked_helpful: <ThumbsUp className="h-5 w-5 text-blue-500" />,
      badge_earned: <Medal className="h-5 w-5 text-yellow-600" />,
      streak_milestone: <Flame className="h-5 w-5 text-orange-500" />,
      mentoring_completed: <GraduationCap className="h-5 w-5 text-purple-600" />,
      mentee_helped: <Handshake className="h-5 w-5 text-teal-500" />,
      challenge_won: <Trophy className="h-5 w-5 text-yellow-600" />,
      challenge_completed: <CheckCircle className="h-5 w-5 text-green-500" />,
      discussion_created: <PenLine className="h-5 w-5 text-indigo-500" />,
      reply_liked: <Heart className="h-5 w-5 text-blue-500" />,
    }
    return icons[t] || <BarChart3 className="h-5 w-5 text-gray-500" />
  }

  function formatDate(d: string | null) {
    if (!d) return ""
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
  }

  const tabs: { id: ActiveTab; label: string }[] = [
    { id: "points", label: "Points & Shop" },
    { id: "badges", label: "Badges" },
    { id: "leaderboard", label: "Leaderboard" },
    { id: "reputation", label: "Reputation" },
  ]

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Rewards & Achievements</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Earn points, collect badges, and build your reputation</p>
          </div>
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Rewards & Achievements</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Earn points, collect badges, and build your reputation</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
          {error}<button onClick={() => setError(null)} className="ml-2 font-medium underline">Dismiss</button>
        </div>
      )}

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <Card><div className="text-center"><div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{balance.toLocaleString()}</div><div className="mt-1 text-sm text-gray-500 dark:text-gray-400">Balance</div>{ptsSummary?.active_boost && (<div className="mt-2 inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2.5 py-1 text-xs font-bold text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300"><Zap className="h-3.5 w-3.5" />{ptsSummary.active_boost.multiplier}x XP Active</div>)}</div></Card>
        <Card><div className="text-center"><div className="text-3xl font-bold text-orange-600 dark:text-orange-400">{streak.current}</div><div className="mt-1 flex items-center justify-center gap-1 text-sm text-gray-500 dark:text-gray-400">Day Streak <Flame className="h-4 w-4 text-orange-500" /></div>{(ptsSummary?.streak_freeze_count ?? 0) > 0 && (<div className="mt-2 flex items-center justify-center gap-1 text-xs font-medium text-cyan-600 dark:text-cyan-400"><Shield className="h-3.5 w-3.5" />{ptsSummary!.streak_freeze_count} Freeze{ptsSummary!.streak_freeze_count! > 1 ? "s" : ""}</div>)}</div></Card>
        <Card><div className="text-center"><div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">{earnedBadges.length}</div><div className="mt-1 text-sm text-gray-500 dark:text-gray-400">Badges</div></div></Card>
        <Card><div className="text-center"><div className="text-3xl font-bold text-purple-600 dark:text-purple-400">{levelName}</div><div className="mt-1 text-sm text-gray-500 dark:text-gray-400">Level</div></div></Card>
      </div>

      <div className="mb-6 flex gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              activeTab === tab.id
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "points" && (
        <>
          <div className="mb-4 flex border-b border-gray-200 dark:border-gray-700">
            {[{ id: "history" as const, label: "History" }, { id: "shop" as const, label: "Rewards Shop" }].map((t) => (
              <button
                key={t.id}
                onClick={() => setPtsSubTab(t.id)}
                className={cn(
                  "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px",
                  ptsSubTab === t.id
                    ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {ptsSubTab === "history" && (
            <Card>
              <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Recent Activities</h2>
              {transactions.length === 0 ? (
                <p className="py-6 text-center text-gray-500 dark:text-gray-400">No transactions yet. Start learning to earn points!</p>
              ) : (
                <div className="space-y-3">
                  {transactions.map((tx) => (
                    <div key={tx.id} className="flex items-center gap-4 rounded-lg border border-gray-100 p-3 dark:border-gray-700">
                      <div className="flex items-center justify-center">{getActionIcon(tx.action_type)}</div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 dark:text-white">{tx.description || tx.action_type.replace(/_/g, " ")}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">{formatDate(tx.created_at)}</div>
                      </div>
                      <div className={cn("font-semibold", tx.points > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
                        {tx.points > 0 ? "+" : ""}{tx.points}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {ptsSubTab === "shop" && (
            <div>
              <div className="mb-4 flex flex-wrap border-b border-gray-200 dark:border-gray-700">
                {["all", ...Array.from(new Set(shopItems.map(i => i.category)))].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setShopCategory(cat)}
                    className={cn(
                      "px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px",
                      shopCategory === cat
                        ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              {filteredShopItems.length === 0 ? (
                <Card><p className="py-6 text-center text-gray-500 dark:text-gray-400">No items in this category.</p></Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filteredShopItems.map((item) => (
                    <Card key={item.id}>
                      <div className="flex flex-col h-full">
                        {item.preview_url ? (
                          <div className="mb-3 overflow-hidden rounded-lg">
                            <img src={item.preview_url} alt={item.name} className="h-40 w-full object-cover" />
                          </div>
                        ) : (
                          <div className="mb-3 flex h-40 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
                            {item.icon ? <span className="text-5xl">{item.icon}</span> : <Gift className="h-12 w-12 text-gray-400" />}
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900 dark:text-white">{item.name}</h3>
                          <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium capitalize", getShopCatColor(item.category))}>{item.category}</span>
                        </div>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{item.description}</p>
                        <div className="mt-auto pt-4 flex items-center justify-between">
                          <div className="font-semibold text-blue-600 dark:text-blue-400">{item.price} pts</div>
                          {item.is_one_time && item.owned ? (
                            (() => {
                              const itemVal = typeof item.item_value === "string" ? JSON.parse(item.item_value || "{}") : (item.item_value || {})
                              let cosmeticAsset: string
                              let equippedValue: string | undefined
                              if (item.item_type === "name_color") {
                                cosmeticAsset = itemVal.color || item.url_id.replace(/-/g, "_")
                                equippedValue = activeCosmetics.name_color
                              } else {
                                cosmeticAsset = itemVal.asset || item.url_id.replace(/-/g, "_")
                                equippedValue = activeCosmetics.profile_border
                              }
                              const isEquipped = equippedValue === cosmeticAsset
                              const isCosmetic = item.item_type === "profile_border" || item.item_type === "name_color"

                              if (!isCosmetic) {
                                return <span className="rounded-lg bg-green-100 px-3 py-1.5 text-sm font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300">Owned</span>
                              }

                              return isEquipped ? (
                                <Button variant="secondary" onClick={async () => {
                                  try {
                                    const res = await apiClient.post<{ cosmetics: typeof activeCosmetics }>(`/api/gamification/cosmetics/equip?cosmetic_type=${item.item_type}`)
                                    if (res?.cosmetics) setActiveCosmetics(res.cosmetics)
                                    window.dispatchEvent(new Event("points-updated"))
                                  } catch { }
                                }}>
                                  <Check className="h-4 w-4 mr-1" /> Equipped
                                </Button>
                              ) : (
                                <Button variant="primary" onClick={async () => {
                                  try {
                                    const res = await apiClient.post<{ cosmetics: typeof activeCosmetics }>(`/api/gamification/cosmetics/equip?cosmetic_type=${item.item_type}&value=${encodeURIComponent(cosmeticAsset)}`)
                                    if (res?.cosmetics) setActiveCosmetics(res.cosmetics)
                                    window.dispatchEvent(new Event("points-updated"))
                                  } catch (e: any) {
                                    setError(e?.message || "Failed to equip")
                                  }
                                }}>
                                  Equip
                                </Button>
                              )
                            })()
                          ) : (
                            <Button variant={balance >= item.price ? "primary" : "secondary"} disabled={balance < item.price || purchaseLoading === item.id} onClick={() => setConfirmItem(item)}>
                              {purchaseLoading === item.id ? "..." : balance >= item.price ? "Redeem" : "Not enough"}
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {activeTab === "badges" && (
        <div>
          <div className="mb-4 flex flex-wrap border-b border-gray-200 dark:border-gray-700">
            {[{ id: "all", label: "All", count: badges.length }, { id: "earned", label: "Earned", count: earnedBadges.length }, { id: "locked", label: "Locked", count: lockedBadges.length }].map((f) => (
              <button
                key={f.id}
                onClick={() => setBadgeFilter(f.id as typeof badgeFilter)}
                className={cn(
                  "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px",
                  badgeFilter === f.id
                    ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
                )}
              >
                {f.label} ({f.count})
              </button>
            ))}
          </div>
          {filteredBadges.length === 0 ? (
            <Card><p className="py-6 text-center text-gray-500 dark:text-gray-400">No badges in this category.</p></Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredBadges.map((badge) => (
                <Card key={badge.id} className={cn("border-2 transition-all", getRarityColor(badge.rarity), !badge.earned && "opacity-50")}>
                  <div className="flex flex-col items-center text-center">
                    <div className={cn("mb-3", !badge.earned && "grayscale")}>{badge.icon_url ? <span className="text-5xl">{badge.icon_url}</span> : <Medal className="h-12 w-12 text-yellow-500" />}</div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{badge.name}</h3>
                    <p className={cn("text-xs font-medium uppercase mt-1", getRarityText(badge.rarity))}>{badge.rarity || "common"}</p>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{badge.description || badge.badge_type}</p>
                    {badge.earned && badge.earned_at && <p className="mt-3 text-xs text-green-600 dark:text-green-400">Earned on {new Date(badge.earned_at).toLocaleDateString()}</p>}
                    {badge.points_awarded > 0 && <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">+{badge.points_awarded} points</p>}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "leaderboard" && (
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Global Leaderboard</h2>
          {leaderboard.length === 0 ? (
            <p className="py-6 text-center text-gray-500 dark:text-gray-400">No leaderboard data yet.</p>
          ) : (
            <div className="space-y-3">
              {leaderboard.map((entry) => (
                <div key={entry.user_id} className="flex items-center gap-4 rounded-lg p-3">
                  <div className={cn("h-10 w-10 rounded-full flex items-center justify-center font-bold",
                    entry.rank === 1 ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300" :
                    entry.rank === 2 ? "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300" :
                    entry.rank === 3 ? "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300" :
                    "bg-gray-50 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                  )}>
                    {entry.rank <= 3 ? <Medal className={cn("h-5 w-5", entry.rank === 1 ? "text-yellow-500" : entry.rank === 2 ? "text-gray-400" : "text-orange-500")} /> : entry.rank}
                  </div>
                  <div
                    className={cn(
                      "h-10 w-10 rounded-full flex items-center justify-center text-white font-medium ring-2",
                      entry.profile_border === "diamond_border"
                        ? "ring-blue-400 ring-offset-2 dark:ring-blue-300"
                        : entry.profile_border === "gold_border"
                          ? "ring-yellow-400 ring-offset-2 dark:ring-yellow-300"
                          : "ring-transparent"
                    )}
                    style={{ backgroundColor: "#6B7280" }}
                  >
                    {(entry.display_name || entry.username).charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <span className="font-medium text-gray-900 dark:text-white" style={entry.name_color ? { color: entry.name_color, textShadow: `0 0 8px ${entry.name_color}60, 0 0 16px ${entry.name_color}30` } : undefined}>{entry.display_name || entry.username}</span>
                    <div className="text-sm text-gray-500 dark:text-gray-400">@{entry.username}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-gray-900 dark:text-white">{entry.points.toLocaleString()}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">points</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {activeTab === "reputation" && (
        <div className="space-y-6">
          <Card>
            <div className="flex flex-col items-center text-center md:flex-row md:text-left md:gap-8">
              <div className="relative flex items-center justify-center">
                <svg className="h-36 w-36" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="8" className="text-gray-200 dark:text-gray-700" />
                  <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="8" className="text-blue-500" strokeDasharray={`${(Math.min(progressInLevel, 100) / 100) * 327} 327`} strokeLinecap="round" transform="rotate(-90 60 60)" />
                </svg>
                <div className="absolute">
                  <div className="text-3xl font-bold text-gray-900 dark:text-white">{totalScore}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">points</div>
                </div>
              </div>
              <div className="mt-4 flex-1 md:mt-0">
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">{levelName}</span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Top {rankPercentile}%</span>
                </div>
                {nextLevelName && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Progress to {nextLevelName}</span>
                      <span className="font-medium text-gray-900 dark:text-white">{pointsToNext} pts to go</span>
                    </div>
                    <div className="mt-1 h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
                      <div className="h-2 rounded-full bg-blue-500 transition-all" style={{ width: `${Math.min(progressInLevel, 100)}%` }} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>

          <Card>
            <button onClick={() => setShowBreakdown(!showBreakdown)} className="flex w-full items-center justify-between text-left">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Score Breakdown</h2>
              <span className="text-gray-500">{showBreakdown ? "▲" : "▼"}</span>
            </button>
            {showBreakdown && (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {repBreakdown.map((item) => (
                  <div key={item.category} className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                    <div className="flex items-center gap-2">
                      {getCatIcon(item.category)}
                      <span className={cn("font-semibold capitalize", getCatColor(item.category))}>{item.label}</span>
                    </div>
                    <div className="mt-2">
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">{item.score}</div>
                      <div className="mt-1 h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-700">
                        <div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${Math.min((item.score / 1000) * 100, 100)}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {repLevels.length > 0 && (
            <Card>
              <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Level Roadmap</h2>
              <div className="space-y-3">
                {repLevels.map((lv) => {
                  const isPast = totalScore >= (lv.max_score ?? Infinity)
                  const isCurrent = lv.name === levelName
                  return (
                    <div key={lv.url_id} className={cn("flex items-center gap-4 rounded-lg p-3 transition-colors", isCurrent ? "bg-blue-50 border border-blue-200 dark:bg-blue-900/20 dark:border-blue-700" : isPast ? "opacity-60" : "")}>
                      <div className={cn("h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold", isCurrent ? "bg-blue-500 text-white" : isPast ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400")}>
                        {isPast ? <Check className="h-4 w-4" /> : isCurrent ? <Star className="h-4 w-4" /> : lv.id}
                      </div>
                      <div className="flex-1">
                        <span className={cn("font-medium", isCurrent ? "text-blue-700 dark:text-blue-300" : "text-gray-900 dark:text-white")}>{lv.name}</span>
                        <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">{lv.min_score}{lv.max_score ? ` - ${lv.max_score}` : "+"} pts</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          )}

          <Card>
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Recent Activity</h2>
            {repEvents.length === 0 ? (
              <p className="py-6 text-center text-gray-500 dark:text-gray-400">No reputation events yet.</p>
            ) : (
              <div className="space-y-3">
                {repEvents.map((ev) => (
                  <div key={ev.id} className="flex items-center gap-4 rounded-lg border border-gray-100 p-3 dark:border-gray-700">
                    <div className="flex items-center justify-center">{getEvtIcon(ev.event_type)}</div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-white capitalize">{ev.event_type.replace(/_/g, " ")}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">{ev.dimension} · {ev.created_at ? new Date(ev.created_at).toLocaleDateString() : ""}</div>
                    </div>
                    <div className={cn("font-semibold", ev.points_change > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
                      {ev.points_change > 0 ? "+" : ""}{ev.points_change}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
      {confirmItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setConfirmItem(null)}>
          <div className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-800" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Confirm Purchase</h3>
            <div className="mt-3 flex items-center gap-3">
              {confirmItem.icon && <span className="text-2xl">{confirmItem.icon === "snowflake" ? "\u2744\uFE0F" : confirmItem.icon === "bolt" ? "\u26A1" : confirmItem.icon === "circle" ? "\uD83D\uDFE1" : confirmItem.icon === "gem" ? "\uD83D\uDC8E" : confirmItem.icon === "fire" ? "\uD83D\uDD25" : "\uD83D\uDED2"}</span>}
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">{confirmItem.name}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{confirmItem.description}</p>
              </div>
            </div>
            <div className="mt-4 rounded-lg bg-gray-50 p-3 dark:bg-gray-700/50">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Price</span>
                <span className="font-semibold text-blue-600 dark:text-blue-400">{confirmItem.price} pts</span>
              </div>
              <div className="mt-1 flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Your balance</span>
                <span className="font-semibold text-gray-900 dark:text-white">{balance} pts</span>
              </div>
              <div className="mt-1 flex justify-between text-sm border-t border-gray-200 dark:border-gray-600 pt-1">
                <span className="text-gray-500 dark:text-gray-400">After purchase</span>
                <span className={cn("font-semibold", balance - confirmItem.price >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500")}>{balance - confirmItem.price} pts</span>
              </div>
            </div>
            <div className="mt-5 flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setConfirmItem(null)}>
                Cancel
              </Button>
              <Button variant="primary" className="flex-1" disabled={purchaseLoading === confirmItem.id} onClick={async () => {
                await handlePurchase(confirmItem.id)
                setConfirmItem(null)
              }}>
                {purchaseLoading === confirmItem.id ? "Purchasing..." : "Confirm"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
