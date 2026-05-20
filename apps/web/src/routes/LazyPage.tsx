import { Suspense, useEffect } from "react"
import { useLoading } from "../contexts"

type LazyPageProps = {
  children: React.ReactNode
}

export function LazyPage({ children }: LazyPageProps) {

  return (
    <Suspense fallback={<LoadingTrigger />}>
      {children}
    </Suspense>
  )

}

function LoadingTrigger() {

  const { startLoading, stopLoading } = useLoading()

  useEffect(() => {
    startLoading()
    return () => stopLoading()
  }, [startLoading, stopLoading])

  return null
  
}
