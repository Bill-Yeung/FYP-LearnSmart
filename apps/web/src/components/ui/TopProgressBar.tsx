import { useEffect, useState } from "react"

type TopProgressBarProps = {
  isLoading: boolean
}

export function TopProgressBar({ isLoading }: TopProgressBarProps) {

  const [progress, setProgress] = useState(0)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>
    let timeout: ReturnType<typeof setTimeout>

    if (isLoading) {

      setVisible(true)
      setProgress(0)
      interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) return prev
          if (prev < 30) return prev + 10
          if (prev < 60) return prev + 5
          return prev + 2
        })
      }, 100)
    } else {
      setProgress(100)
      timeout = setTimeout(() => {
        setVisible(false)
        setProgress(0)
      }, 300)
    }

    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [isLoading])

  if (!visible && progress === 0) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] h-1 bg-transparent">
      <div
        className="h-full bg-blue-500 transition-all duration-200 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  )
  
}
