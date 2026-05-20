import { useState, useEffect, useCallback, useRef } from "react"
import { Card } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { TextField } from "../../components/form/TextField"
import { apiClient } from "../../lib/api"
import { useToast } from "../../contexts"


type UserSuggestion = {
  id: string
  username: string
  display_name: string | null
  is_friend: boolean
  is_pending: boolean
}

type FriendUser = {
  id: string
  username: string
  email: string
  display_name: string | null
}

type Friendship = {
  id: string
  user_id: string
  friend_id: string
  status: string
  created_at: string
  updated_at: string | null
  friend: FriendUser
}

type IncomingRequest = {
  id: string
  user_id: string
  friend_id: string
  status: string
  created_at: string
  updated_at: string | null
  sender: FriendUser
}

type FriendshipsResponse = {
  friendships: Friendship[]
  incoming_requests: IncomingRequest[]
}


export function FriendshipPage() {
  const { showToast } = useToast()
  const [friendships, setFriendships] = useState<Friendship[]>([])
  const [incomingRequests, setIncomingRequests] = useState<IncomingRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [addFriendUsername, setAddFriendUsername] = useState("")
  const [addFriendLoading, setAddFriendLoading] = useState(false)
  const [confirmUsername, setConfirmUsername] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const suggestionsRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)

  // pull all friendships and incoming requests in one call
  const fetchFriendships = useCallback(async () => {
    try {
      setError(null)
      const data = await apiClient.get<FriendshipsResponse>("/api/friendships")
      setFriendships(data.friendships)
      setIncomingRequests(data.incoming_requests)
    } catch (e: any) {
      setError(e?.message || "Failed to load friendships")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFriendships()
  }, [fetchFriendships])

  // close the user-suggestion dropdown when clicking anywhere outside it
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // debounced user search: wait 300ms after typing then hit the search-users api
  function handleSearchInput(value: string) {
    setAddFriendUsername(value)
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
        setSuggestions(data.users)
        setShowSuggestions(data.users.length > 0)
      } catch {
        setSuggestions([])
      }
    }, 300)
  }

  function selectSuggestion(user: UserSuggestion) {
    setAddFriendUsername(user.username)
    setShowSuggestions(false)
    setSuggestions([])
  }

  const acceptedFriends = friendships.filter(f => f.status === "accepted")
  const pendingSent = friendships.filter(f => f.status === "pending")

  const filteredAccepted = acceptedFriends.filter(f => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      f.friend.username.toLowerCase().includes(q) ||
      (f.friend.display_name || "").toLowerCase().includes(q)
    )
  })

  const filteredIncoming = incomingRequests.filter(r => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      r.sender.username.toLowerCase().includes(q) ||
      (r.sender.display_name || "").toLowerCase().includes(q)
    )
  })

  // accept an incoming friend request and refresh the lists
  async function handleAccept(friendshipId: string) {
    setActionLoading(friendshipId)
    try {
      await apiClient.post(`/api/friendships/${friendshipId}/accept`, {})
      await fetchFriendships()
    } catch (e: any) {
      setError(e?.message || "Failed to accept request")
    } finally {
      setActionLoading(null)
    }
  }

  // decline (delete) an incoming friend request
  async function handleDecline(friendshipId: string) {
    setActionLoading(friendshipId)
    try {
      await apiClient.delete(`/api/friendships/${friendshipId}`)
      await fetchFriendships()
    } catch (e: any) {
      setError(e?.message || "Failed to decline request")
    } finally {
      setActionLoading(null)
    }
  }

  // remove an existing friend by deleting the friendship
  async function handleUnfriend(friendshipId: string) {
    setActionLoading(friendshipId)
    try {
      await apiClient.delete(`/api/friendships/${friendshipId}`)
      await fetchFriendships()
    } catch (e: any) {
      setError(e?.message || "Failed to remove friend")
    } finally {
      setActionLoading(null)
    }
  }

  // cancel a friend request that we sent but hasn't been accepted yet
  async function handleCancelRequest(friendshipId: string) {
    setActionLoading(friendshipId)
    try {
      await apiClient.delete(`/api/friendships/${friendshipId}`)
      await fetchFriendships()
    } catch (e: any) {
      setError(e?.message || "Failed to cancel request")
    } finally {
      setActionLoading(null)
    }
  }

  function handleSendRequest() {
    if (!addFriendUsername.trim()) return
    setConfirmUsername(addFriendUsername.trim())
  }

  // actually fire the friend-request post after the user clicks confirm in the modal
  async function confirmSendRequest() {
    if (!confirmUsername) return
    setAddFriendLoading(true)
    setConfirmUsername(null)
    try {
      await apiClient.post(`/api/friendships/request?friend_username=${encodeURIComponent(confirmUsername)}`, {})
      showToast("Friend request sent!")
      setAddFriendUsername("")
      await fetchFriendships()
    } catch (e: any) {
      const detail = e?.response?.data?.detail || e?.message || "Failed to send request"
      showToast(detail)
    } finally {
      setAddFriendLoading(false)
    }
  }

  function displayName(user: FriendUser) {
    return user.display_name || user.username
  }

  // turn an iso date into "Today" / "Yesterday" / "Nd ago" / locale string
  function formatDate(dateStr: string) {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    if (diffDays === 0) return "Today"
    if (diffDays === 1) return "Yesterday"
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Friends</h1>
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Friends</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Connect with other learners and grow your network
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
          {error}
          <button onClick={() => setError(null)} className="ml-2 font-medium underline">
            Dismiss
          </button>
        </div>
      )}

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card>
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
              {acceptedFriends.length}
            </div>
            <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">Friends</div>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">
              {incomingRequests.length}
            </div>
            <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">Incoming Requests</div>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-600 dark:text-gray-400">
              {pendingSent.length}
            </div>
            <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">Sent Requests</div>
          </div>
        </Card>
      </div>

      <Card className="mb-6">
        <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
          Add Friend
        </h2>
        <div className="flex gap-3">
          <div className="relative flex-1" ref={suggestionsRef}>
            <TextField
              label=""
              placeholder="Search by username or name..."
              value={addFriendUsername}
              onChange={(e) => handleSearchInput(e.target.value)}
              onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true) }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSendRequest()
                if (e.key === "Escape") setShowSuggestions(false)
              }}
            />
            {showSuggestions && (
              <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
                {suggestions.map((user) => (
                  <button
                    key={user.id}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 first:rounded-t-lg last:rounded-b-lg"
                    onClick={() => !user.is_friend && !user.is_pending && selectSuggestion(user)}
                    disabled={user.is_friend || user.is_pending}
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                      {(user.display_name || user.username).charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {user.display_name || user.username}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        @{user.username}
                      </div>
                    </div>
                    {user.is_friend && (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700 dark:bg-green-900/30 dark:text-green-300">Friend</span>
                    )}
                    {user.is_pending && (
                      <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300">Pending</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button
            variant="primary"
            onClick={handleSendRequest}
            disabled={addFriendLoading || !addFriendUsername.trim()}
          >
            {addFriendLoading ? "Sending..." : "Send Request"}
          </Button>
        </div>
      </Card>

      {confirmUsername && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={() => setConfirmUsername(null)}>
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-sm w-full p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Send Friend Request</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Send a friend request to <span className="font-medium text-gray-900 dark:text-white">{confirmUsername}</span>?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmUsername(null)}
                className="px-4 py-2 text-sm font-medium rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmSendRequest}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-6">
        <TextField
          label=""
          placeholder="Search friends by username or name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="space-y-6">
        {filteredIncoming.length > 0 && (
          <div>
            <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
              Friend Requests ({filteredIncoming.length})
            </h2>
            <div className="space-y-2">
              {filteredIncoming.map((req) => (
                <Card key={req.id}>
                  <div className="flex items-center gap-4">
                    <div
                      className="h-12 w-12 rounded-full flex items-center justify-center text-white font-medium"
                      style={{ backgroundColor: "#6B7280" }}
                    >
                      {displayName(req.sender).charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-white">
                        {displayName(req.sender)}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        @{req.sender.username} · Received {formatDate(req.created_at)}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="primary"
                        onClick={() => handleAccept(req.id)}
                        disabled={actionLoading === req.id}
                      >
                        {actionLoading === req.id ? "..." : "Accept"}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => handleDecline(req.id)}
                        disabled={actionLoading === req.id}
                      >
                        Decline
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        <div>
          <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
            My Friends ({filteredAccepted.length})
          </h2>
          {filteredAccepted.length === 0 ? (
            <Card>
              <div className="py-6 text-center text-gray-500 dark:text-gray-400">
                {searchQuery
                  ? "No friends match your search."
                  : "No friends yet. Send a friend request above!"}
              </div>
            </Card>
          ) : (
            <div className="space-y-2">
              {filteredAccepted.map((friendship) => (
                <Card key={friendship.id}>
                  <div className="flex items-center gap-4">
                    <div
                      className="h-12 w-12 rounded-full flex items-center justify-center text-white font-medium"
                      style={{ backgroundColor: "#6B7280" }}
                    >
                      {displayName(friendship.friend).charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-white">
                        {displayName(friendship.friend)}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        @{friendship.friend.username} · Friends since {formatDate(friendship.created_at)}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        onClick={() => handleUnfriend(friendship.id)}
                        disabled={actionLoading === friendship.id}
                      >
                        {actionLoading === friendship.id ? "..." : "Unfriend"}
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {pendingSent.length > 0 && (
          <div>
            <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
              Sent Requests ({pendingSent.length})
            </h2>
            <div className="space-y-2">
              {pendingSent.map((friendship) => (
                <Card key={friendship.id}>
                  <div className="flex items-center gap-4">
                    <div
                      className="h-12 w-12 rounded-full flex items-center justify-center text-white font-medium"
                      style={{ backgroundColor: "#6B7280" }}
                    >
                      {displayName(friendship.friend).charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-white">
                        {displayName(friendship.friend)}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        @{friendship.friend.username} · Sent {formatDate(friendship.created_at)}
                      </div>
                    </div>
                    <div>
                      <Button
                        variant="ghost"
                        onClick={() => handleCancelRequest(friendship.id)}
                        disabled={actionLoading === friendship.id}
                      >
                        {actionLoading === friendship.id ? "..." : "Cancel"}
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
