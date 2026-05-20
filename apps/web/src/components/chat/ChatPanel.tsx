import { useState, useEffect } from 'react'
import { X, Search, Plus, Users, Hash, MessageCircle, ChevronDown, ChevronUp, GraduationCap } from 'lucide-react'
import { apiClient } from '../../lib/api'
import { ChatConversation } from './ChatConversation'
import { FriendSelector } from './FriendSelector'
import { formatRelativeTime } from '@shared/utils'
import type { ChatRoom } from '@shared/types'

interface ChatPanelProps {
  isOpen: boolean
  onClose: () => void
}

interface ChatRoomExtended extends ChatRoom {
  member_count?: number
  is_muted?: boolean
}

export function ChatPanel({ isOpen, onClose }: ChatPanelProps) {
  const [rooms, setRooms] = useState<ChatRoomExtended[]>([])
  const [selectedRoom, setSelectedRoom] = useState<ChatRoomExtended | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showNewChatMenu, setShowNewChatMenu] = useState(false)

  const [showFriendSelector, setShowFriendSelector] = useState(false)
  const [friendSelectorMode, setFriendSelectorMode] = useState<'single' | 'multiple'>('single')
  const [friendSelectorTitle, setFriendSelectorTitle] = useState('')

  const [showGroupNameDialog, setShowGroupNameDialog] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [pendingGroupFriendIds, setPendingGroupFriendIds] = useState<string[]>([])
  const [isCreatingGroup, setIsCreatingGroup] = useState(false)

  const [isDirectsCollapsed, setIsDirectsCollapsed] = useState(false)
  const [isClassesCollapsed, setIsClassesCollapsed] = useState(false)
  const [isGroupsCollapsed, setIsGroupsCollapsed] = useState(false)
  const [isMentorshipsCollapsed, setIsMentorshipsCollapsed] = useState(false)
  const [isCommunitiesCollapsed, setIsCommunitiesCollapsed] = useState(false)

  // load rooms when panel opens and poll every 10s for updates
  useEffect(() => {
    if (isOpen) {
      fetchRooms(true)
      const interval = setInterval(() => fetchRooms(), 10000)
      return () => clearInterval(interval)
    }
  }, [isOpen])

  const fetchRooms = async (showLoading = false) => {
    if (showLoading) setIsLoading(true)
    try {
      const response = await apiClient.get<{ rooms: ChatRoom[] }>('/api/chat/rooms')
      if (response) {
        setRooms(response.rooms)
      }
    } catch (error) {
      console.error('Failed to fetch chat rooms:', error)
    } finally {
      if (showLoading) setIsLoading(false)
    }
  }

  // open (or create) a direct-message room with a single friend
  const handleDirectMessageSelect = async (friendIds: string[]) => {
    if (friendIds.length === 0) return

    try {
      const response = await apiClient.post<{ room: ChatRoom }>('/api/chat/rooms/direct', {
        recipient_id: friendIds[0]
      })

      if (response) {
        await fetchRooms()
        setSelectedRoom(response.room)
      }
    } catch (error) {
      console.error('Failed to create direct chat:', error)
      alert('Failed to create direct chat')
    }
  }

  const handleGroupChatSelect = async (friendIds: string[]) => {
    if (friendIds.length === 0) return
    setPendingGroupFriendIds(friendIds)
    setGroupName('')
    setShowGroupNameDialog(true)
  }

  const handleCreateGroup = async () => {
    if (!groupName.trim()) return
    setIsCreatingGroup(true)
    try {
      const response = await apiClient.post<{ room: ChatRoom }>('/api/chat/rooms', {
        room_type: 'group',
        name: groupName.trim(),
        is_private: true
      })

      if (response) {
        for (const friendId of pendingGroupFriendIds) {
          await apiClient.post(`/api/chat/rooms/${response.room.id}/members`, {
            user_id: friendId,
            role: 'member'
          })
        }

        await fetchRooms()
        setShowGroupNameDialog(false)
        setSelectedRoom(response.room)
      }
    } catch (error) {
      console.error('Failed to create group chat:', error)
    } finally {
      setIsCreatingGroup(false)
    }
  }

  const openDirectMessageSelector = () => {
    setShowNewChatMenu(false)
    setFriendSelectorMode('single')
    setFriendSelectorTitle('Select Friend for Direct Message')
    setShowFriendSelector(true)
  }

  const openGroupChatSelector = () => {
    setShowNewChatMenu(false)
    setFriendSelectorMode('multiple')
    setFriendSelectorTitle('Select Friends for Group Chat')
    setShowFriendSelector(true)
  }

  // split rooms by type and filter by the search query
  const directMessages = rooms.filter(r => r.room_type === 'direct')
  const classRooms = rooms.filter(r => r.room_type === 'class')
  const groupRooms = rooms.filter(r => r.room_type === 'group')
  const mentorshipRooms = rooms.filter(r => r.room_type === 'mentorship')
  const communityRooms = rooms.filter(r => r.room_type === 'community' || r.room_type === 'channel')

  const filteredDirects = directMessages.filter(room =>
    room.name?.toLowerCase().includes(searchQuery.toLowerCase())
  )
  const filteredClasses = classRooms.filter(room =>
    room.name?.toLowerCase().includes(searchQuery.toLowerCase())
  )
  const filteredGroups = groupRooms.filter(room =>
    room.name?.toLowerCase().includes(searchQuery.toLowerCase())
  )
  const filteredMentorships = mentorshipRooms.filter(room =>
    room.name?.toLowerCase().includes(searchQuery.toLowerCase())
  )
  const filteredCommunities = communityRooms.filter(room =>
    room.name?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getRoomIcon = (type: string) => {
    switch (type) {
      case 'community': return <Users className="w-4 h-4" />
      case 'channel': return <Hash className="w-4 h-4" />
      case 'group': return <Users className="w-4 h-4" />
      case 'class': return <Hash className="w-4 h-4" />
      default: return <MessageCircle className="w-4 h-4" />
    }
  }

  if (selectedRoom) {
    return (
      <div
        className={`
          fixed top-0 right-0 h-full w-full sm:w-[500px] bg-white dark:bg-gray-900
          shadow-2xl z-50
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
          flex flex-col
        `}
      >
        <ChatConversation
          room={selectedRoom}
          onBack={() => { setSelectedRoom(null); fetchRooms() }}
        />
      </div>
    )
  }

  return (
    <>
      {/* Friend Selector Dialog */}
      <FriendSelector
        isOpen={showFriendSelector}
        onClose={() => setShowFriendSelector(false)}
        onSelect={friendSelectorMode === 'single' ? handleDirectMessageSelect : handleGroupChatSelect}
        mode={friendSelectorMode}
        title={friendSelectorTitle}
      />

      {/* Group Name Dialog */}
      {showGroupNameDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowGroupNameDialog(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-[380px] p-6 animate-in zoom-in-95 fade-in duration-200">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
              Create Group
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Enter a name for your group with {pendingGroupFriendIds.length} member{pendingGroupFriendIds.length !== 1 ? 's' : ''}
            </p>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !isCreatingGroup && groupName.trim() && handleCreateGroup()}
              placeholder="Group name..."
              autoFocus
              className="
                w-full px-4 py-2.5 rounded-xl
                bg-gray-100 dark:bg-gray-700
                border-2 border-transparent
                focus:outline-none focus:border-blue-500
                dark:text-white placeholder-gray-400
                transition-all
              "
            />
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowGroupNameDialog(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateGroup}
                disabled={!groupName.trim() || isCreatingGroup}
                className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {isCreatingGroup ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sliding Panel */}
      <div
        className={`
          fixed top-0 right-0 h-full w-full sm:w-[500px]
          bg-gradient-to-b from-white via-gray-50 to-white dark:from-gray-900 dark:via-gray-950 dark:to-gray-900
          shadow-2xl z-50
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
          flex flex-col
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-blue-600" />
            Messages
          </h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setShowNewChatMenu(!showNewChatMenu)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                aria-label="New message"
              >
                <Plus className="w-5 h-5 text-gray-700 dark:text-gray-300" />
              </button>

              {/* Dropdown menu for new chat */}
              {showNewChatMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-10">
                  <button
                    className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors"
                    onClick={openDirectMessageSelector}
                  >
                    <MessageCircle className="w-4 h-4 text-blue-600" />
                    <span className="dark:text-white">New Direct Message</span>
                  </button>
                  <button
                    className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors"
                    onClick={openGroupChatSelector}
                  >
                    <Users className="w-4 h-4 text-green-600" />
                    <span className="dark:text-white">Create Group</span>
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              aria-label="Close chat"
            >
              <X className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="
                w-full pl-11 pr-4 py-3 rounded-xl
                bg-white dark:bg-gray-800
                border-2 border-gray-200 dark:border-gray-700
                focus:outline-none focus:border-purple-500 dark:focus:border-purple-500
                dark:text-white placeholder-gray-400
                shadow-sm focus:shadow-md
                transition-all
              "
            />
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {/* 1. Direct Messages */}
              <div className="border-b dark:border-gray-700">
                <button
                  onClick={() => setIsDirectsCollapsed(!isDirectsCollapsed)}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 text-blue-600" />
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Direct Messages
                    </h3>
                    {filteredDirects.length > 0 && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">({filteredDirects.length})</span>
                    )}
                  </div>
                  {isDirectsCollapsed ? (
                    <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  ) : (
                    <ChevronUp className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  )}
                </button>

                {!isDirectsCollapsed && (
                  filteredDirects.length === 0 ? (
                    <div className="p-6 text-center">
                      <p className="text-sm text-gray-500 dark:text-gray-400">No direct messages</p>
                    </div>
                  ) : (
                    <div className="space-y-1 p-2">
                      {filteredDirects.map((room) => (
                        <button
                          key={room.id}
                          onClick={() => setSelectedRoom(room)}
                          className="w-full p-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-all text-left flex items-center gap-3 group relative"
                        >
                          {/* Avatar with online indicator */}
                          <div className="relative">
                            <div className="w-11 h-11 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 shadow-sm">
                              {room.name?.[0]?.toUpperCase() || 'U'}
                            </div>
                            {room.other_user_online && (
                              <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-gray-900 rounded-full"></span>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-0.5">
                              <h4 className="font-semibold text-sm dark:text-white truncate">
                                {room.name || 'Unknown User'}
                              </h4>
                              {room.last_message_at && (
                                <span className="text-[10px] text-gray-500 dark:text-gray-400 ml-2 flex-shrink-0">
                                  {formatRelativeTime(room.last_message_at)}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                                {room.last_message_preview || 'No messages yet'}
                              </p>
                              {Number(room.unread_count) > 0 && (
                                <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white text-xs font-bold flex-shrink-0">
                                  {room.unread_count > 99 ? '99+' : room.unread_count}
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )
                )}
              </div>

              {/* 2. Classes */}
              <div className="border-b dark:border-gray-700">
                <button
                  onClick={() => setIsClassesCollapsed(!isClassesCollapsed)}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <Hash className="w-4 h-4 text-indigo-600" />
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Classes
                    </h3>
                    {filteredClasses.length > 0 && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">({filteredClasses.length})</span>
                    )}
                  </div>
                  {isClassesCollapsed ? (
                    <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  ) : (
                    <ChevronUp className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  )}
                </button>

                {!isClassesCollapsed && (
                  filteredClasses.length === 0 ? (
                    <div className="p-6 text-center">
                      <p className="text-sm text-gray-500 dark:text-gray-400">No class chats</p>
                    </div>
                  ) : (
                    <div className="space-y-1 p-2">
                      {filteredClasses.map((room) => (
                        <button
                          key={room.id}
                          onClick={() => setSelectedRoom(room)}
                          className="w-full p-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-all text-left flex items-center gap-3 group"
                        >
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center text-white flex-shrink-0 shadow-sm">
                            <Hash className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <h4 className="font-semibold text-sm dark:text-white truncate">
                                {room.name || 'Unnamed Class'}
                              </h4>
                              {Number(room.unread_count) > 0 && (
                                <span className="px-2 py-0.5 rounded-full bg-indigo-600 text-white text-xs font-bold ml-2 flex-shrink-0">
                                  {room.unread_count > 99 ? '99+' : room.unread_count}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{room.member_count || 0} students</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )
                )}
              </div>

              {/* 3. Groups */}
              <div className="border-b dark:border-gray-700">
                <button
                  onClick={() => setIsGroupsCollapsed(!isGroupsCollapsed)}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-green-600" />
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Groups
                    </h3>
                    {filteredGroups.length > 0 && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">({filteredGroups.length})</span>
                    )}
                  </div>
                  {isGroupsCollapsed ? (
                    <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  ) : (
                    <ChevronUp className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  )}
                </button>

                {!isGroupsCollapsed && (
                  filteredGroups.length === 0 ? (
                    <div className="p-6 text-center">
                      <p className="text-sm text-gray-500 dark:text-gray-400">No groups</p>
                    </div>
                  ) : (
                    <div className="space-y-1 p-2">
                      {filteredGroups.map((room) => (
                        <button
                          key={room.id}
                          onClick={() => setSelectedRoom(room)}
                          className="w-full p-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-all text-left flex items-center gap-3 group"
                        >
                          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-teal-500 rounded-lg flex items-center justify-center text-white flex-shrink-0 shadow-sm">
                            <Users className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <h4 className="font-semibold text-sm dark:text-white truncate">
                                {room.name || 'Unnamed Group'}
                              </h4>
                              {Number(room.unread_count) > 0 && (
                                <span className="px-2 py-0.5 rounded-full bg-green-600 text-white text-xs font-bold ml-2 flex-shrink-0">
                                  {room.unread_count > 99 ? '99+' : room.unread_count}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{room.member_count || 0} members</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )
                )}
              </div>

              {/* 4. Mentorships */}
              <div className="border-b dark:border-gray-700">
                <button
                  onClick={() => setIsMentorshipsCollapsed(!isMentorshipsCollapsed)}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-purple-600" />
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Mentorships
                    </h3>
                    {filteredMentorships.length > 0 && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">({filteredMentorships.length})</span>
                    )}
                  </div>
                  {isMentorshipsCollapsed ? (
                    <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  ) : (
                    <ChevronUp className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  )}
                </button>

                {!isMentorshipsCollapsed && (
                  filteredMentorships.length === 0 ? (
                    <div className="p-6 text-center">
                      <p className="text-sm text-gray-500 dark:text-gray-400">No mentorship chats</p>
                    </div>
                  ) : (
                    <div className="space-y-1 p-2">
                      {filteredMentorships.map((room) => (
                        <button
                          key={room.id}
                          onClick={() => setSelectedRoom(room)}
                          className="w-full p-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-all text-left flex items-center gap-3 group"
                        >
                          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-violet-600 rounded-lg flex items-center justify-center text-white flex-shrink-0 shadow-sm">
                            <GraduationCap className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <h4 className="font-semibold text-sm dark:text-white truncate">
                                {room.name || 'Mentorship'}
                              </h4>
                              {Number(room.unread_count) > 0 && (
                                <span className="px-2 py-0.5 rounded-full bg-purple-600 text-white text-xs font-bold ml-2 flex-shrink-0">
                                  {(room.unread_count ?? 0) > 99 ? '99+' : room.unread_count}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                              {room.last_message_preview || 'Mentorship chat'}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )
                )}
              </div>

              {/* 5. Communities */}
              <div>
                <button
                  onClick={() => setIsCommunitiesCollapsed(!isCommunitiesCollapsed)}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-orange-600" />
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Communities
                    </h3>
                    {filteredCommunities.length > 0 && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">({filteredCommunities.length})</span>
                    )}
                  </div>
                  {isCommunitiesCollapsed ? (
                    <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  ) : (
                    <ChevronUp className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  )}
                </button>

                {!isCommunitiesCollapsed && (
                  filteredCommunities.length === 0 ? (
                    <div className="p-6 text-center">
                      <p className="text-sm text-gray-500 dark:text-gray-400">No communities</p>
                    </div>
                  ) : (
                    <div className="space-y-1 p-2">
                      {filteredCommunities.map((room) => (
                        <button
                          key={room.id}
                          onClick={() => setSelectedRoom(room)}
                          className="w-full p-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-all text-left flex items-center gap-3 group"
                        >
                          <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center text-white flex-shrink-0 shadow-sm">
                            {getRoomIcon(room.room_type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <h4 className="font-semibold text-sm dark:text-white truncate">
                                {room.name || 'Unnamed Community'}
                              </h4>
                              {Number(room.unread_count) > 0 && (
                                <span className="px-2 py-0.5 rounded-full bg-orange-600 text-white text-xs font-bold ml-2 flex-shrink-0">
                                  {room.unread_count > 99 ? '99+' : room.unread_count}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{room.member_count || 0} members</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
