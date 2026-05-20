import { createContext, useContext, useState, useCallback, useMemo, useEffect, type ReactNode } from "react"
import type { ColorScheme } from "../../../../shared/types"
import { THEME_STORAGE_KEY } from "../../../../shared/constants"

type ThemeContextType = {
  colorScheme: ColorScheme
  isDark: boolean
  toggleColorScheme: () => void
  setColorScheme: (scheme: ColorScheme) => void
}

const ThemeContext = createContext<ThemeContextType | null>(null)

type ThemeProviderProps = {
  children: ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  
  const [colorScheme, setColorScheme] = useState<ColorScheme>(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY)
    return saved === "dark" ? "dark" : "light"
  })

  const isDark = useMemo(() => colorScheme === "dark", [colorScheme])

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark)
    localStorage.setItem(THEME_STORAGE_KEY, colorScheme)
  }, [colorScheme, isDark])

  const toggleColorScheme = useCallback(() => {
    setColorScheme(prev => prev === "dark" ? "light" : "dark")
  }, [])

  const value = useMemo<ThemeContextType>(() => ({
    colorScheme,
    isDark,
    toggleColorScheme,
    setColorScheme,
  }), [colorScheme, isDark, toggleColorScheme])

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )

}

export function useTheme(): ThemeContextType {

  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }
  return context
  
}
