import type { Tokens } from "./types"
import { AUTH_STORAGE_KEY } from "./constants"

const fixTimestamp = (_k: string, v: unknown) =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(v) && !/Z|[+-]\d{2}:\d{2}/.test(v) ? v + "Z" : v

export interface StorageAdapter {
  getItem(key: string): Promise<string | null> | string | null
  setItem(key: string, value: string): Promise<void> | void
  removeItem(key: string): Promise<void> | void
}

export interface NavigationAdapter {
  navigateToLogin(): void
}

function formatApiError(error: any): string | null {
  if (!error) return null
  if (typeof error === "string") return error
  if (error.detail) {
    if (Array.isArray(error.detail)) {
      const parts = error.detail.map((d: any) => {
        if (typeof d === "string") return d
        if (d && d.msg) {
          const loc = Array.isArray(d.loc) ? d.loc.join(".") : String(d.loc)
          return `${loc}: ${d.msg}`
        }
        return JSON.stringify(d)
      })
      return parts.join(" | ")
    }
    if (typeof error.detail === "string") return error.detail
  }
  if (error.message) return String(error.message)
  try {
    return JSON.stringify(error)
  } catch {
    return null
  }
}

type ApiClientConfig = {
  storage: StorageAdapter
  navigation: NavigationAdapter
  baseUrl?: string
}

export class ApiClient {
  private storage: StorageAdapter
  private navigation: NavigationAdapter
  private baseUrl: string
  private refreshPromise: Promise<Tokens | null> | null = null

  constructor(config: ApiClientConfig) {
    this.storage = config.storage
    this.navigation = config.navigation
    this.baseUrl = config.baseUrl || ""
  }

  private async clearAuth(): Promise<void> {
    await this.storage.removeItem(AUTH_STORAGE_KEY)
  }

  async fetch<T = unknown>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T | null> {

    const isFormData = options.body instanceof FormData

    const headers: Record<string, string> = {
      ...(!isFormData && { "Content-Type": "application/json" }),
      ...(options.headers as Record<string, string> || {})
    }

    const url = endpoint.startsWith("http") ? endpoint : `${this.baseUrl}${endpoint}`

    const response = await fetch(url, {
      ...options,
      headers,
      credentials: "include"
    })

    if (response.status === 401) {

      const refreshResponse = await fetch(`${this.baseUrl}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include"
      })

      if (refreshResponse.ok) {

        const retryResponse = await fetch(url, {
          ...options,
          headers,
          credentials: "include"
        })

        if (!retryResponse.ok) {
          const error = await retryResponse.json().catch(() => ({}))
          const msg = formatApiError(error)
          throw new Error(msg || `API error: ${retryResponse.status}`)
        }

        const text = await retryResponse.text()
        return text ? JSON.parse(text, fixTimestamp) : null

      } else {

        await this.clearAuth()
        this.navigation.navigateToLogin()
        return null

      }
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      const msg = formatApiError(error)
      throw new Error(msg || `API error: ${response.status}`)
    }

    const text = await response.text()
    return text ? JSON.parse(text, fixTimestamp) : null

  }

  get<T = unknown>(endpoint: string, options?: RequestInit) {
    return this.fetch<T>(endpoint, { ...options, method: "GET" })
  }

  post<T = unknown>(endpoint: string, data?: unknown, options?: RequestInit) {
    return this.fetch<T>(endpoint, {
      ...options,
      method: "POST",
      body: data ? JSON.stringify(data) : undefined
    })
  }

  patch<T = unknown>(endpoint: string, data?: unknown, options?: RequestInit) {
    return this.fetch<T>(endpoint, {
      ...options,
      method: "PATCH",
      body: data ? JSON.stringify(data) : undefined
    })
  }

  put<T = unknown>(endpoint: string, data?: unknown, options?: RequestInit) {
    return this.fetch<T>(endpoint, {
      ...options,
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined
    })
  }

  delete<T = unknown>(endpoint: string, options?: RequestInit) {
    return this.fetch<T>(endpoint, { ...options, method: "DELETE" })
  }

  upload<T = unknown>(endpoint: string, formData: FormData, options?: RequestInit) {
    return this.fetch<T>(endpoint, {
      ...options,
      method: "POST",
      body: formData
    })
  }

  async download(endpoint: string, options?: RequestInit): Promise<Response> {
    const headers: Record<string, string> = {
      ...(options?.headers as Record<string, string> || {})
    }

    const url = endpoint.startsWith("http") ? endpoint : `${this.baseUrl}${endpoint}`

    const response = await fetch(url, {
      ...options,
      method: "GET",
      headers,
      credentials: "include"
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.detail || `Download failed: ${response.status}`)
    }

    return response
  }

  async getAccessToken(): Promise<string | null> {
    return null
  }

  async isAuthenticated(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/auth/check`, {
        method: "GET",
        credentials: "include"
      })
      return response.ok
    } catch {
      return false
    }
  }

  async getStoredUser<T = unknown>(): Promise<T | null> {
    try {
      const stored = await this.storage.getItem(AUTH_STORAGE_KEY)
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  }
}
