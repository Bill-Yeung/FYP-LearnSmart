import { useState, useEffect } from 'react'
import { X, Search, User, Check } from 'lucide-react'
import { apiClient } from '../../lib/api'

interface FriendSelectorProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (friendIds: string[]) => void
  mode: 'single' | 'multiple'
  title: string
}

interface Friend {
  id: string
  username: string
  email: string
  display_name: string | null
}

export function FriendSelector({ isOpen, onClose, onSelect, mode, title }: FriendSelectorProps) {
  const [friends, setFriends] = useState<Friend[]>([])
  const [selectedFriendIds, setSelectedFriendIds] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      fetchFriends()
      setSelectedFriendIds(new Set())
      setSearchQuery('')
      setError('')
    }
  }, [isOpen])

  // load only accepted friendships for this user
  const fetchFriends = async () => {
    setIsLoading(true)
    setError('')
    try {

      const response = await apiClient.get<{ friendships: any[] }>('/api/friendships')
      if (response) {
        const acceptedFriends = response.friendships
          .filter((f: any) => f.status === 'accepted')
          .map((f: any) => f.friend)
        setFriends(acceptedFriends)
      }
    } catch (err: any) {
      setError('Failed to load friends')
      console.error('Failed to fetch friends:', err)
    } finally {
      setIsLoading(false)
    }
  }

  // single mode picks one, multiple mode toggles selection
  const toggleFriend = (friendId: string) => {
    if (mode === 'single') {
      setSelectedFriendIds(new Set([friendId]))
    } else {
      const newSelection = new Set(selectedFriendIds)
      if (newSelection.has(friendId)) {
        newSelection.delete(friendId)
      } else {
        newSelection.add(friendId)
      }
      setSelectedFriendIds(newSelection)
    }
  }

  const handleConfirm = () => {
    if (selectedFriendIds.size === 0) {
      setError('Please select at least one friend')
      return
    }
    onSelect(Array.from(selectedFriendIds))
    handleClose()
  }

  const handleClose = () => {
    setSelectedFriendIds(new Set())
    setSearchQuery('')
    setError('')
    onClose()
  }

  const filteredFriends = friends.filter(friend =>
    friend.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    friend.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    friend.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none">
      {/* Dialog */}
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-md mx-4 p-6 max-h-[80vh] flex flex-col pointer-events-auto border-2 border-gray-300 dark:border-gray-600">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold dark:text-white">{title}</h2>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          >
            <X className="w-5 h-5 dark:text-gray-300" />
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search friends..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
          />
        </div>

        {/* Friends List */}
        <div className="flex-1 overflow-y-auto mb-4 border border-gray-200 dark:border-gray-700 rounded-lg">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredFriends.length === 0 ? (
            <div className="p-8 text-center">
              <User className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {friends.length === 0 ? 'No friends yet' : 'No matching friends'}
              </p>
            </div>
          ) : (
            <div className="divide-y dark:divide-gray-700">
              {filteredFriends.map((friend) => {
                const isSelected = selectedFriendIds.has(friend.id)
                return (
                  <button
                    key={friend.id}
                    onClick={() => toggleFriend(friend.id)}
                    className={`w-full p-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left flex items-center gap-3 ${
                      isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    }`}
                  >
                    {/* Avatar */}
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0">
                      {friend.username[0].toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium dark:text-white truncate">
                        {friend.display_name || friend.username}
                      </h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        @{friend.username}
                      </p>
                    </div>

                    {/* Checkmark */}
                    {isSelected && (
                      <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>
        )}

        {/* Footer */}
        <div className="flex gap-3">
          <button
            onClick={handleClose}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={selectedFriendIds.size === 0}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {mode === 'single' ? 'Start Chat' : `Create Group (${selectedFriendIds.size})`}
          </button>
        </div>
      </div>
    </div>
  )
}
