import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from "react"

type LoadingContextType = {
  isLoading: boolean
  startLoading: () => void
  stopLoading: () => void
}

const LoadingContext = createContext<LoadingContextType | null>(null)

type LoadingProviderProps = {
  children: ReactNode
}

export function LoadingProvider({ children }: LoadingProviderProps) {

  const [isLoading, setIsLoading] = useState(false)
  const startLoading = useCallback(() => setIsLoading(true), [])
  const stopLoading = useCallback(() => setIsLoading(false), [])

  const value = useMemo<LoadingContextType>(() => ({
    isLoading,
    startLoading,
    stopLoading
  }), [isLoading, startLoading, stopLoading])

  return (
    <LoadingContext.Provider value={value}>
      {children}
    </LoadingContext.Provider>
  )

}

export function useLoading(): LoadingContextType {

  const context = useContext(LoadingContext)
  if (!context) {
    throw new Error("useLoading must be used within a LoadingProvider")
  }
  return context
  
}
