import { useNavigate } from "react-router-dom"
import { FEATURES, APP_TAGLINE, APP_DESCRIPTION, LANDING_SECTIONS } from "../../../../../shared/constants"
import { cn } from "../../../../../shared/utils"
import { NavBar } from "../../components/layout/NavBar"
import { Footer } from "../../components/layout/Footer"
import { useAuth, useTheme } from "../../contexts"

export function LandingPage() {

  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { colorScheme, toggleColorScheme } = useTheme()

  const handleLogin = () => navigate("/login")
  const handleSignOut = () => {
    logout()
    navigate("/")
  }
  
  const handleNavigate = (href: string) => {
    if (href === "/") {
      const hero = document.getElementById("hero")
      hero?.scrollIntoView({ behavior: "smooth" })
      return
    }
    if (href.startsWith("/#")) {
      const element = document.getElementById(href.slice(2))
      element?.scrollIntoView({ behavior: "smooth" })
      return
    }
    if (href === "/dashboard" && !user) {
      navigate("/login")
      return
    }
    navigate(href)
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <NavBar
        user={user}
        colorScheme={colorScheme}
        onToggleColorScheme={toggleColorScheme}
        onLogin={handleLogin}
        onSignOut={handleSignOut}
        onNavigate={handleNavigate}
      />

      <main className="snap-y snap-mandatory h-screen overflow-y-auto scroll-smooth">
        <HeroSection onGetStarted={handleLogin} onLearnMore={() => handleNavigate("/#features")} />
        <FeaturesSection />
        <HowItWorksSection />
        <ModesSection onGetStarted={handleLogin} />
        <CTASection user={user} onGetStarted={handleLogin} onDashboard={() => navigate("/dashboard")} />
      </main>

      <Footer onNavigate={handleNavigate} />
    </div>
  )
}


function HeroSection({
  onGetStarted,
  onLearnMore}: {
  onGetStarted: () => void
  onLearnMore: () => void}) {
  return (
    <section
      id="hero"
      className="snap-start h-screen flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-blue-600 via-purple-600 to-pink-500"
    >
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
        <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 animate-fade-in">
          {APP_TAGLINE}
        </h1>
        <p className="text-xl md:text-2xl text-white/80 mb-10 max-w-2xl mx-auto">
          {APP_DESCRIPTION}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={onGetStarted}
            className="inline-flex items-center justify-center rounded-lg bg-white text-gray-900 hover:bg-gray-100 px-8 py-3 text-lg font-medium transition"
          >
            Get Started Free
          </button>
          <button
            onClick={onLearnMore}
            className="inline-flex items-center justify-center rounded-lg bg-white border-2 border-white/30 bg-transparent text-gray-900 hover:bg-white/10 px-8 py-3 text-lg font-medium transition"
          >
            Learn More
          </button>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce z-10">
        <svg className="w-6 h-6 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </div>
    </section>
  )
}

function FeaturesSection() {
  const section = LANDING_SECTIONS.find(s => s.id === "features")!

  return (
    <section
      id="features"
      className="snap-start min-h-screen flex items-center py-20 bg-gray-50 dark:bg-gray-900"
    >
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            {section.title}
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            {section.subtitle}
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {FEATURES.map((feature, index) => (
            <FeatureCard
              key={feature.id}
              title={feature.title}
              description={feature.description}
              icon={feature.icon}
              delay={index * 100}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

function FeatureCard({
  title,
  description,
  icon,
  delay}: {
  title: string
  description: string
  icon: string
  delay: number}) {
  return (
    <div
      className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center mb-4">
        <FeatureIcon name={icon} />
      </div>
      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{title}</h3>
      <p className="text-gray-600 dark:text-gray-400">{description}</p>
    </div>
  )
}

function HowItWorksSection() {
  const section = LANDING_SECTIONS.find(s => s.id === "how-it-works")!

  const steps = [
    {
      number: "01",
      title: "Upload Your Documents",
      description: "Drop any PDF, Word doc, PowerPoint, or even audio/video files. We support 10+ formats.",
      color: "from-blue-500 to-cyan-500"
    },
    {
      number: "02",
      title: "AI Extracts Concepts",
      description: "Our AI analyzes your content, identifies key concepts, and builds a knowledge graph.",
      color: "from-purple-500 to-pink-500"
    },
    {
      number: "03",
      title: "Learn & Practice",
      description: "Study with auto-generated flashcards, take quizzes, and track your progress.",
      color: "from-orange-500 to-red-500"
    }
  ]

  return (
    <section
      id="how-it-works"
      className="snap-start min-h-screen flex items-center py-20 bg-white dark:bg-gray-950"
    >
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            {section.title}
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            {section.subtitle}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((step, index) => (
            <div key={step.number} className="relative">
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-16 left-full w-full h-0.5 bg-gradient-to-r from-gray-300 to-transparent dark:from-gray-700 -translate-x-4" />
              )}

              <div className="text-center">
                <div className={cn(
                  "w-32 h-32 mx-auto mb-6 rounded-3xl bg-gradient-to-br flex items-center justify-center",
                  step.color
                )}>
                  <span className="text-5xl font-bold text-white">{step.number}</span>
                </div>
                <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">
                  {step.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function ModesSection({ onGetStarted }: { onGetStarted: () => void }) {
  const section = LANDING_SECTIONS.find(s => s.id === "modes")!
  const modes = [
    { name: "Normal", description: "Clean, modern dashboard for focused learning", bg: "from-blue-500 to-purple-500", preview: "bg-white border-2 border-gray-200" },
    { name: "Classroom", description: "Interactive classroom experience", bg: "from-green-500 to-emerald-500", preview: "bg-green-900 border-4 border-amber-600" },
    { name: "Detective", description: "Mystery-solving learning adventure", bg: "from-amber-700 to-stone-800", preview: "bg-amber-100 border-4 border-amber-900 sepia" },
  ]

  return (
    <section
      id="modes"
      className="snap-start min-h-screen flex items-center py-20 bg-gray-50 dark:bg-gray-900"
    >
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            {section.title}
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            {section.subtitle}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {modes.map(mode => (
            <div
              key={mode.name}
              className="relative rounded-3xl p-1 transition-all duration-300 hover:scale-105"
            >
              <div className={cn("rounded-3xl bg-gradient-to-br p-6", mode.bg)}>
                <div className={cn("rounded-xl h-40 mb-4", mode.preview)}>
                  <div className="p-3">
                    <div className="h-3 w-20 bg-gray-300 rounded mb-2" />
                    <div className="h-2 w-32 bg-gray-200 rounded" />
                  </div>
                </div>

                <h3 className="text-2xl font-bold text-white mb-2">{mode.name}</h3>
                <p className="text-white/80 text-sm">{mode.description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-12">
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Choose your preferred learning mode after signing in
          </p>
          <button
            onClick={onGetStarted}
            className="inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:opacity-90 px-8 py-3 text-lg font-medium transition"
          >
            Get Started
          </button>
        </div>
      </div>
    </section>
  )
}

function CTASection({
  user,
  onGetStarted,
  onDashboard}: {
  user: ReturnType<typeof useAuth>["user"]
  onGetStarted: () => void
  onDashboard: () => void}) {

  const section = LANDING_SECTIONS.find(s => s.id === "cta")!

  return (
    <section
      id="cta"
      className="snap-start min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900"
    >
      <div className="max-w-4xl mx-auto px-4 text-center">
        <h2 className="text-4xl md:text-6xl font-bold text-white mb-6">
          {section.title}
        </h2>
        <p className="text-xl text-gray-300 mb-10 max-w-2xl mx-auto">
          {section.subtitle}
        </p>

        {user ? (
          <button
            onClick={onDashboard}
            className="inline-flex items-center justify-center rounded-lg bg-white text-gray-900 hover:bg-gray-100 px-10 py-4 text-xl font-medium transition"
          >
            Go to Dashboard
          </button>
        ) : (
          <button
            onClick={onGetStarted}
            className="inline-flex items-center justify-center rounded-lg bg-white text-gray-900 hover:bg-gray-100 px-10 py-4 text-xl font-medium transition"
          >
            Start Learning Free
          </button>
        )}

        <p className="mt-6 text-gray-400 text-sm">
          No credit card required. Free forever for basic features.
        </p>
      </div>
    </section>
  )
}


function FeatureIcon({ name }: { name: string }) {
  const icons: Record<string, JSX.Element> = {
    "file-text": (
      <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    "brain": (
      <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    "cards": (
      <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
    "target": (
      <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="2" />
      </svg>
    ),
    "users": (
      <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    "chart": (
      <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    )
  }

  return icons[name] || icons["file-text"]

}
