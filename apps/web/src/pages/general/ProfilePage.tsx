import { useState, useEffect } from "react"
import { Button } from "../../components/ui/Button"
import { Card } from "../../components/ui/Card"
import { TextField } from "../../components/form/TextField"
import { useAuth, useToast } from "../../contexts"
import { cn } from "../../../../../shared/utils"
import { apiClient } from "../../lib/api"


export function ProfilePage() {
  const { user, updateUser } = useAuth()
  const { showToast } = useToast()

  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(false)

  const [displayName, setDisplayName] = useState(user?.display_name || "")
  const [bio, setBio] = useState("")

  const [profileBorder, setProfileBorder] = useState<string | null>(null)
  const [nameColor, setNameColor] = useState<string | null>(null)
  const [ownedBorders, setOwnedBorders] = useState<{ value: string; name: string }[]>([])

  useEffect(() => {
    async function loadProfile() {
      try {
        const response = await apiClient.get<{ bio?: string }>("/api/users/me/profile")
        if (response?.bio) {
          setBio(response.bio)
        }
      } catch (error) {
        console.error("Failed to load profile:", error)
      }
    }
    async function loadCosmetics() {
      try {
        const data = await apiClient.get<{ cosmetics?: { profile_border?: string; name_color?: string } }>("/api/gamification/points/summary")
        if (data?.cosmetics) {
          setProfileBorder(data.cosmetics.profile_border ?? null)
          setNameColor(data.cosmetics.name_color ?? null)
        }
        const inv = await apiClient.get<{ items: { name: string; url_id: string; item_type: string }[] }>("/api/gamification/inventory")
        if (inv?.items) {
          const borders = inv.items.filter(i => i.item_type === "profile_border").map(i => ({
            value: i.url_id === "gold-border" ? "gold_border" : i.url_id === "diamond-border" ? "diamond_border" : i.url_id,
            name: i.name,
          }))
          setOwnedBorders(borders)
        }
      } catch { }
    }
    loadProfile()
    loadCosmetics()
  }, [])

  const [showPasswordChange, setShowPasswordChange] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  async function handleSaveProfile() {
    setLoading(true)
    try {
      await apiClient.patch("/api/users/me", { display_name: displayName })

      await apiClient.patch(`/api/users/me/profile?bio=${encodeURIComponent(bio)}`)

      updateUser({ display_name: displayName })

      showToast("Profile updated successfully!")
      setIsEditing(false)
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to update profile")
    } finally {
      setLoading(false)
    }
  }

  async function handleChangePassword() {
    if (!currentPassword || !newPassword || !confirmPassword) {
      showToast("Please fill in all password fields")
      return
    }
    if (newPassword !== confirmPassword) {
      showToast("New passwords do not match")
      return
    }
    if (newPassword.length < 8) {
      showToast("Password must be at least 8 characters")
      return
    }

    setLoading(true)
    try {
      await apiClient.post("/api/users/me/change-password", {
        current_password: currentPassword,
        new_password: newPassword
      })

      showToast("Password changed successfully!")
      setShowPasswordChange(false)
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to change password")
    } finally {
      setLoading(false)
    }
  }

  function handleCancelEdit() {
    setDisplayName(user?.display_name || "")
    setIsEditing(false)
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          My Profile
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          View and manage your account information
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-1">
          <Card>
            <div className="flex flex-col items-center text-center">
              <div className="relative">
                <div
                  className="h-24 w-24 rounded-full flex items-center justify-center text-white text-3xl font-bold"
                  style={{
                    backgroundColor: "#6B7280",
                    ...(profileBorder === "gold_border"
                      ? { boxShadow: "0 0 0 4px #facc15, 0 0 0 6px #f59e0b" }
                      : profileBorder === "diamond_border"
                        ? { boxShadow: "0 0 0 4px #60a5fa, 0 0 0 6px #3b82f6" }
                        : {}),
                  }}
                >
                  {(user?.display_name || "U").charAt(0).toUpperCase()}
                </div>
                {isEditing && (
                  <button
                    className="absolute bottom-0 right-0 rounded-full bg-purple-600 p-2 text-white hover:bg-purple-700 transition-colors"
                    onClick={() => showToast("Avatar upload coming soon")}
                  >
                    <CameraIcon className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Border switcher  */}
              {ownedBorders.length > 0 && (
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  <button
                    onClick={async () => {
                      try {
                        await apiClient.post("/api/gamification/cosmetics/equip?cosmetic_type=profile_border")
                        setProfileBorder(null)
                        window.dispatchEvent(new Event("points-updated"))
                        showToast("Border removed")
                      } catch { }
                    }}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-medium border transition-colors",
                      !profileBorder
                        ? "bg-gray-200 border-gray-400 text-gray-800 dark:bg-gray-700 dark:border-gray-500 dark:text-white"
                        : "border-gray-200 text-gray-500 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
                    )}
                  >
                    None
                  </button>
                  {ownedBorders.map((b) => (
                    <button
                      key={b.value}
                      onClick={async () => {
                        try {
                          await apiClient.post(`/api/gamification/cosmetics/equip?cosmetic_type=profile_border&value=${b.value}`)
                          setProfileBorder(b.value)
                          window.dispatchEvent(new Event("points-updated"))
                          showToast(`${b.name} equipped!`)
                        } catch (e: any) {
                          showToast(e?.message || "Failed to equip")
                        }
                      }}
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-medium border transition-colors",
                        profileBorder === b.value
                          ? b.value === "gold_border"
                            ? "bg-yellow-100 border-yellow-400 text-yellow-800 dark:bg-yellow-900/30 dark:border-yellow-500 dark:text-yellow-300"
                            : "bg-blue-100 border-blue-400 text-blue-800 dark:bg-blue-900/30 dark:border-blue-500 dark:text-blue-300"
                          : "border-gray-200 text-gray-500 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
                      )}
                    >
                      {b.name}
                    </button>
                  ))}
                </div>
              )}

              <h2
                className="mt-4 text-xl font-bold text-gray-900 dark:text-white"
                style={nameColor ? { color: nameColor, textShadow: `0 0 10px ${nameColor}50, 0 0 20px ${nameColor}25` } : undefined}
              >
                {user?.display_name || "User"}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                @{user?.username || "username"}
              </p>

              <span className={cn(
                "mt-2 rounded-full px-3 py-1 text-xs font-medium",
                user?.role === "admin"
                  ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                  : user?.role === "teacher"
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                    : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
              )}>
                {user?.role?.charAt(0).toUpperCase()}{user?.role?.slice(1)}
              </span>

              <div className="mt-6 grid w-full grid-cols-3 gap-2 border-t border-gray-200 pt-4 dark:border-gray-700">
                <div className="text-center">
                  <div className="text-lg font-bold text-gray-900 dark:text-white">12</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Documents</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-gray-900 dark:text-white">156</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Points</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-gray-900 dark:text-white">8</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Badges</div>
                </div>
              </div>

              {!isEditing && (
                <Button
                  className="mt-4 w-full"
                  variant="secondary"
                  onClick={() => setIsEditing(true)}
                >
                  Edit Profile
                </Button>
              )}
            </div>
          </Card>
        </div>

        <div className="md:col-span-2 space-y-6">
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Basic Information
              </h3>
              {isEditing && (
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={handleCancelEdit} disabled={loading}>
                    Cancel
                  </Button>
                  <Button onClick={handleSaveProfile} disabled={loading}>
                    {loading ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-4">
              {isEditing ? (
                <>
                  <TextField
                    label="Display Name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                  <TextField
                    label="Username"
                    value={user?.username || ""}
                    disabled
                    hint="Username cannot be changed"
                  />
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Bio
                    </label>
                    <textarea
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      rows={3}
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Tell us about yourself..."
                    />
                  </div>
                </>
              ) : (
                <>
                  <ProfileField label="Display Name" value={user?.display_name || "Not set"} />
                  <ProfileField label="Username" value={`@${user?.username || "username"}`} />
                  <ProfileField label="Bio" value={bio || "No bio yet"} />
                </>
              )}
            </div>
          </Card>

          <Card>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Account Information
            </h3>
            <div className="space-y-4">
              <ProfileField label="Email" value={user?.email || "Not set"} />
              <ProfileField label="Role" value={user?.role?.charAt(0).toUpperCase() + (user?.role?.slice(1) || "")} />
              <ProfileField label="Member Since" value="January 2024" />
              <ProfileField label="Last Login" value="Today at 10:30 AM" />
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Security
              </h3>
              {!showPasswordChange && (
                <Button variant="secondary" onClick={() => setShowPasswordChange(true)}>
                  Change Password
                </Button>
              )}
            </div>

            {showPasswordChange ? (
              <div className="space-y-4">
                <TextField
                  label="Current Password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                />
                <TextField
                  label="New Password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                />
                <TextField
                  label="Confirm New Password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                />
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setShowPasswordChange(false)
                      setCurrentPassword("")
                      setNewPassword("")
                      setConfirmPassword("")
                    }}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleChangePassword} disabled={loading}>
                    {loading ? "Updating..." : "Update Password"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                    <ShieldIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      Password Protected
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Last changed 30 days ago
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}


function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start">
      <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-sm font-medium text-gray-900 dark:text-white text-right max-w-[60%]">
        {value}
      </span>
    </div>
  )
}

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  )
}
