import { createContext, useContext, useState, useCallback, useMemo, useEffect, type ReactNode } from "react"
import type { User } from "../../../../shared/types"
import { AUTH_STORAGE_KEY } from "../../../../shared/constants"

type LoginOptions = {
  email: string
  password: string
}

type AuthContextType = {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  currentSessionId: string | null
  login: (options: LoginOptions) => Promise<User>
  loginFromOAuth: () => Promise<User>
  logout: () => Promise<void>
  updateUser: (updates: Partial<User>) => void
  refreshUser: () => Promise<void>
  clearError: () => void
}

type AuthCheckResponse = {
  authenticated: boolean
  current_session_id?: string | null
}

// storage and user mapping helpers

function loadUserFromStorage(): User | null {
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored) as User
    }
  } catch {
    localStorage.removeItem(AUTH_STORAGE_KEY)
  }
  return null
}

function saveUserToStorage(user: User | null): void {
  if (user) {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user))
  } else {
    localStorage.removeItem(AUTH_STORAGE_KEY)
  }
}

function mapBackendUserToUser(userData: any): User {
  return {
    id: userData.id,
    username: userData.username,
    email: userData.email,
    role: userData.role,
    display_name: userData.display_name,
    preferred_language: userData.preferred_language || "en",
    is_active: userData.is_active,
    email_verified: userData.email_verified,
    domain_level: "beginner",
    difficulty_preference: "medium",
    ai_assistance_level: "moderate",
    created_at: userData.created_at,
    last_login: userData.last_login
  }
}

async function fetchCurrentSessionId(): Promise<string | null> {
  const response = await fetch(`/api/auth/check`, {
    credentials: "include"
  })

  if (!response.ok) return null

  const data = await response.json() as AuthCheckResponse
  return data?.authenticated ? data.current_session_id ?? null : null
}

const AUTH_DEBUG = (import.meta as any)?.env?.DEV ?? false

function logAuth(event: string, details?: Record<string, unknown>): void {
  if (!AUTH_DEBUG) return
  console.info(`[AuthContext] ${new Date().toISOString()} ${event}`, details ?? {})
}


const AuthContext = createContext<AuthContextType | null>(null)

type AuthProviderProps = {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const initialUser = useMemo(() => loadUserFromStorage(), [])

  const [user, setUser] = useState<User | null>(() => loadUserFromStorage())
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)

  useEffect(() => {
    const verifyUser = async () => {
      console.log("[AuthVerify] Starting user verification.");
      if (!loadUserFromStorage()) {
        console.log("[AuthVerify] No user in storage. Finishing verification.");
        setIsLoading(false);
        return;
      }

      try {
        console.log("[AuthVerify] User found in storage. Fetching /api/users/me to verify.");
        const [sessionId, res] = await Promise.all([
          fetchCurrentSessionId().catch(() => null),
          fetch(`/api/users/me`, { credentials: "include" })
        ]);
        console.log(`[AuthVerify] /api/users/me responded with status: ${res.status}`);

        if (!res.ok) {
          console.log("[AuthVerify] Token invalid or expired. Clearing user state.");
          setUser(null);
          setCurrentSessionId(null);
        } else {
          const userData = await res.json();
          console.log("[AuthVerify] Token valid. User data received:", userData);
          const user: User = {
            id: userData.id,
            username: userData.username,
            email: userData.email,
            role: userData.role,
            display_name: userData.display_name,
            preferred_language: userData.preferred_language || "en",
            is_active: userData.is_active,
            email_verified: userData.email_verified,
            domain_level: "beginner",
            difficulty_preference: "medium",
            ai_assistance_level: "moderate",
            created_at: userData.created_at,
            last_login: userData.last_login
          };
          setUser(user);
          setCurrentSessionId(sessionId);
        }
      } catch (error) {
        console.error("[AuthVerify] Error during verification:", error);
        setUser(null);
        setCurrentSessionId(null);
      } finally {
        console.log("[AuthVerify] Verification process finished. Setting isLoading to false.");
        setIsLoading(false);
      }
    };

    verifyUser();
  }, []);

  useEffect(() => {
    saveUserToStorage(user)
  }, [user])

  const verifyActiveSession = useCallback(async () => {
    try {
      const response = await fetch(`/api/auth/check`, {
        credentials: "include"
      })

      if (!response.ok) {
        setUser(null)
        setCurrentSessionId(null)
        return false
      }

      const data = await response.json() as AuthCheckResponse
      if (!data?.authenticated) {
        setUser(null)
        setCurrentSessionId(null)
        return false
      }

      setCurrentSessionId(data.current_session_id ?? null)
      return true
    } catch {
      return true
    }
  }, [])

  useEffect(() => {
    if (!user) return

    function handleFocus() {
      void verifyActiveSession()
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void verifyActiveSession()
      }
    }

    window.addEventListener("focus", handleFocus)
    document.addEventListener("visibilitychange", handleVisibilityChange)
    const interval = window.setInterval(() => {
      void verifyActiveSession()
    }, 30000)

    return () => {
      window.removeEventListener("focus", handleFocus)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.clearInterval(interval)
    }
  }, [user, verifyActiveSession])

  useEffect(() => {
    logAuth("provider-mounted", {
      hasStoredUser: initialUser !== null
    })
  }, [initialUser])

  // try to restore session from cookie if no stored user
  useEffect(() => {
    if (initialUser !== null) {
      logAuth("bootstrap-skipped", { reason: "stored-user-present" })
      setIsLoading(false)
      return
    }

    let active = true

    async function hydrateSession() {
      logAuth("bootstrap-start")
      try {
        const sessionResponse = await fetch(`/api/auth/check`, {
          credentials: "include"
        })

        if (!sessionResponse.ok) {
          logAuth("bootstrap-check-error", { status: sessionResponse.status })
          if (active) {
            setUser(null)
          }
          return
        }

        const sessionData = await sessionResponse.json()
        if (active) {
          setCurrentSessionId(sessionData.current_session_id ?? null)
        }
        if (!sessionData?.authenticated) {
          if (active) {
            setUser(null)
            setCurrentSessionId(null)
          }
          logAuth("bootstrap-no-session")
          return
        }

        const response = await fetch(`/api/users/me`, {
          credentials: "include"
        })

        if (!response.ok) {
          if (active) {
            setUser(null)
            setCurrentSessionId(null)
          }
          logAuth("bootstrap-profile-error", { status: response.status })
          return
        }

        const userData = await response.json()
        if (active) {
          setUser(mapBackendUserToUser(userData))
        }
        logAuth("bootstrap-success", {
          userId: userData.id,
          role: userData.role
        })
      } catch {
        logAuth("bootstrap-error")
        if (active) {
          setCurrentSessionId(null)
        }
      } finally {
        if (active) {
          setIsLoading(false)
        }
      }
    }

    hydrateSession()

    return () => {
      active = false
    }
  }, [initialUser])

  const isAuthenticated = useMemo(() => user !== null, [user])

  const login = useCallback(async (options: LoginOptions) => {

    const { email, password } = options
    setIsLoading(true)
    setError(null)

    try {
      logAuth("login-start", { email })

      const loginResponse = await fetch(`/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include"
      })

      if (!loginResponse.ok) {
        let errorMessage = "Invalid email or password"
        try {
          const error = await loginResponse.json()
          errorMessage = error.detail || error.message || "Invalid email or password"
        } catch {
          errorMessage = loginResponse.statusText || "Invalid email or password"
        }
        throw new Error(errorMessage)
      }

      const userResponse = await fetch(`/api/users/me`, {
        credentials: "include"
      })

      if (!userResponse.ok) {
        throw new Error("Failed to fetch user profile")
      }

      const userData = await userResponse.json()

      const user = mapBackendUserToUser(userData)
      const sessionId = await fetchCurrentSessionId().catch(() => null)

      setUser(user)
      setCurrentSessionId(sessionId)
      setError(null)
      logAuth("login-success", {
        userId: user.id,
        role: user.role
      })
      return user
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Login failed"
      setError(errorMessage)
      logAuth("login-failed", { error: errorMessage })
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [])

  // login after oauth callback
  const loginFromOAuth = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      logAuth("oauth-login-start")
      const res = await fetch(`/api/users/me`, { credentials: "include" })
      if (!res.ok) throw new Error("Failed to fetch user profile")
      const userData = await res.json()
      const user = mapBackendUserToUser(userData)
      const sessionId = await fetchCurrentSessionId().catch(() => null)
      setUser(user)
      setCurrentSessionId(sessionId)
      logAuth("oauth-login-success", {
        userId: user.id,
        role: user.role
      })
      return user
    } catch (err) {
      const msg = err instanceof Error ? err.message : "OAuth login failed"
      setError(msg)
      logAuth("oauth-login-failed", { error: msg })
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    logAuth("logout-start", {
      userId: user?.id ?? null
    })
    try {
      await fetch(`/api/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include"
      })
    } catch {
    }
    setUser(null)
    setCurrentSessionId(null)
    logAuth("logout-finished")
  }, [user?.id])

  const updateUser = useCallback((updates: Partial<User>) => {
    setUser(prev => prev ? { ...prev, ...updates } : null)
  }, [])

  const refreshUser = useCallback(async () => {
    const response = await fetch(`/api/users/me`, {
      credentials: "include"
    })

    if (!response.ok) {
      setUser(null)
      setCurrentSessionId(null)
      throw new Error("Failed to refresh user profile")
    }

    const userData = await response.json()
    setUser(mapBackendUserToUser(userData))
  }, [])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const value = useMemo<AuthContextType>(() => ({
    user,
    isAuthenticated,
    isLoading,
    error,
    currentSessionId,
    login,
    loginFromOAuth,
    logout,
    updateUser,
    refreshUser,
    clearError
  }), [user, isAuthenticated, isLoading, error, currentSessionId, login, loginFromOAuth, logout, updateUser, refreshUser, clearError])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )

}


export function useAuth(): AuthContextType {
  
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context

}
