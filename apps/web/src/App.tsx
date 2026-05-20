import { BrowserRouter, Routes, Route } from "react-router-dom"
import LinkPreviewHandler from "./components/general/LinkPreviewHandler"
import { ProtectedRoute } from "./routes/ProtectedRoute"
import { Toast } from "./components/ui/Toast"
import { TopProgressBar } from "./components/ui/TopProgressBar"
import { Chat } from "./components/chat/Chat"
import { GlobalTimerWidget } from "./components/timer/GlobalTimerWidget"
import { AuthProvider, ThemeProvider, ToastProvider, LoadingProvider, NotificationProvider, ChatProvider, TimerProvider, useToast, useLoading, useAuth } from "./contexts"
import { allRoutes, type AppRoute } from "./routes"

function renderRoute(route: AppRoute) {
  const { path, element, requiresAuth, redirectIfAuth, allowedRoles, children } = route

  const wrappedElement = (requiresAuth || redirectIfAuth || allowedRoles) ? (
    <ProtectedRoute
      requiresAuth={requiresAuth}
      redirectIfAuth={redirectIfAuth}
      allowedRoles={allowedRoles}
    >
      {element}
    </ProtectedRoute>
  ) : element

  if (children && children.length > 0) {
    return (
      <Route key={path} path={path} element={wrappedElement}>
        {children.map(renderRoute)}
      </Route>
    )
  }

  return <Route key={path} path={path} element={wrappedElement} />
}

function AppRoutes() {
  return (
    <Routes>
      {allRoutes.map(renderRoute)}
    </Routes>
  )
}

function GlobalToast() {
  const { message, dismissToast } = useToast()
  return <Toast message={message} onDismiss={dismissToast} />
}

function GlobalProgressBar() {
  const { isLoading } = useLoading()
  return <TopProgressBar isLoading={isLoading} />
}

function AppContent() {
  const { user } = useAuth()

  return (
    <>
      <LinkPreviewHandler />
      <GlobalProgressBar />
      <AppRoutes />
      <GlobalToast />
      {user && <GlobalTimerWidget />}
      {user && <Chat />}
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <ToastProvider>
          <LoadingProvider>
            <AuthProvider>
              <NotificationProvider>
                <TimerProvider>
                  <ChatProvider>
                    <AppContent />
                  </ChatProvider>
                </TimerProvider>
              </NotificationProvider>
            </AuthProvider>
          </LoadingProvider>
        </ToastProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
