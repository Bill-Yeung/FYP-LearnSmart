import { useState, useEffect, useRef } from 'react'
import { X, User, Users, Hash, Globe } from 'lucide-react'
import { apiClient } from '../../lib/api'

interface NewChatDialogProps {
  isOpen: boolean
  onClose: () => void
  onChatCreated: (roomId: string) => void
}

type ChatType = 'direct' | 'group' | 'community' | 'channel'

type SearchUser = {
  id: string
  username: string
  email: string
  display_name: string
}

export function NewChatDialog({ isOpen, onClose, onChatCreated }: NewChatDialogProps) {
  const [chatType, setChatType] = useState<ChatType | null>(null)
  const [recipientEmail, setRecipientEmail] = useState('')
  const [groupName, setGroupName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState('')
  const [searchResults, setSearchResults] = useState<SearchUser[]>([])
  const [selectedUser, setSelectedUser] = useState<SearchUser | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // debounced user-search: wait 300ms after typing, then hit the api
  useEffect(() => {
    if (recipientEmail.length < 2) {
      setSearchResults([])
      setShowDropdown(false)
      return
    }
    if (selectedUser) return

    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await apiClient.get<{ users: SearchUser[] }>(`/api/users/search?q=${encodeURIComponent(recipientEmail)}`)
        setSearchResults(res?.users || [])
        setShowDropdown(true)
      } catch {
        setSearchResults([])
      }
    }, 300)

    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current) }
  }, [recipientEmail, selectedUser])

  if (!isOpen) return null

  // open (or create) a direct chat with the selected user
  const handleCreateDirectChat = async () => {
    if (!selectedUser) {
      setError('Please search and select a user')
      return
    }

    setIsCreating(true)
    setError('')

    try {
      const response = await apiClient.post<{ room: { id: string } }>('/chat/rooms/direct', {
        recipient_id: selectedUser.id
      })

      if (response) {
        onChatCreated(response.room.id)
        handleClose()
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create chat')
    } finally {
      setIsCreating(false)
    }
  }

  // create a group/channel/community room by name
  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      setError('Please enter a group name')
      return
    }

    setIsCreating(true)
    setError('')

    try {
      const response = await apiClient.post<{ room: { id: string } }>('/chat/rooms', {
        room_type: 'group',
        name: groupName,
        is_private: true
      })

      if (response) {
        onChatCreated(response.room.id)
        handleClose()
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create group')
    } finally {
      setIsCreating(false)
    }
  }

  const handleClose = () => {
    setChatType(null)
    setRecipientEmail('')
    setGroupName('')
    setError('')
    setSearchResults([])
    setSelectedUser(null)
    setShowDropdown(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={handleClose}
      />

      {/* Dialog */}
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold dark:text-white">
            {chatType ? `New ${chatType === 'direct' ? 'Direct Message' : chatType.charAt(0).toUpperCase() + chatType.slice(1)}` : 'New Chat'}
          </h2>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          >
            <X className="w-5 h-5 dark:text-gray-300" />
          </button>
        </div>

        {/* Content */}
        {!chatType ? (
          <div className="space-y-3">
            <button
              onClick={() => setChatType('direct')}
              className="w-full p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left flex items-center gap-3"
            >
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-blue-600 dark:text-blue-300" />
              </div>
              <div>
                <h3 className="font-semibold dark:text-white">Direct Message</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Start a 1-on-1 conversation</p>
              </div>
            </button>

            <button
              onClick={() => setChatType('group')}
              className="w-full p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left flex items-center gap-3"
            >
              <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                <Users className="w-5 h-5 text-green-600 dark:text-green-300" />
              </div>
              <div>
                <h3 className="font-semibold dark:text-white">Group Chat</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Create a private group</p>
              </div>
            </button>

            <button
              onClick={() => setChatType('channel')}
              className="w-full p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left flex items-center gap-3"
            >
              <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center">
                <Hash className="w-5 h-5 text-purple-600 dark:text-purple-300" />
              </div>
              <div>
                <h3 className="font-semibold dark:text-white">Channel</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Topic-based discussion</p>
              </div>
            </button>

            <button
              onClick={() => setChatType('community')}
              className="w-full p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left flex items-center gap-3"
            >
              <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900 rounded-full flex items-center justify-center">
                <Globe className="w-5 h-5 text-orange-600 dark:text-orange-300" />
              </div>
              <div>
                <h3 className="font-semibold dark:text-white">Community</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Large public community</p>
              </div>
            </button>
          </div>
        ) : chatType === 'direct' ? (
          <div className="space-y-4">
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                User Email or Username
              </label>
              {selectedUser ? (
                <div className="flex items-center gap-2 px-4 py-2 border border-blue-300 dark:border-blue-600 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                  <div className="flex-1">
                    <span className="font-medium text-gray-900 dark:text-white">{selectedUser.display_name || selectedUser.username}</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">@{selectedUser.username}</span>
                  </div>
                  <button
                    onClick={() => { setSelectedUser(null); setRecipientEmail('') }}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    value={recipientEmail}
                    onChange={(e) => { setRecipientEmail(e.target.value); setSelectedUser(null) }}
                    placeholder="Search by email or username..."
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                  {showDropdown && searchResults.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-lg max-h-48 overflow-y-auto">
                      {searchResults.map(user => (
                        <button
                          key={user.id}
                          onClick={() => {
                            setSelectedUser(user)
                            setRecipientEmail(user.username)
                            setShowDropdown(false)
                          }}
                          className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-600 flex flex-col"
                        >
                          <span className="font-medium text-gray-900 dark:text-white">{user.display_name || user.username}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">@{user.username} &middot; {user.email}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {showDropdown && searchResults.length === 0 && recipientEmail.length >= 2 && (
                    <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-lg px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                      No users found
                    </div>
                  )}
                </>
              )}
            </div>

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setChatType(null)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleCreateDirectChat}
                disabled={isCreating}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isCreating ? 'Creating...' : 'Start Chat'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {chatType.charAt(0).toUpperCase() + chatType.slice(1)} Name
              </label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder={`Enter ${chatType} name`}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setChatType(null)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleCreateGroup}
                disabled={isCreating}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isCreating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
