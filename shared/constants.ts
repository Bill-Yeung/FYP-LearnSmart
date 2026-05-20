import type { NavItem, LandingSection } from "./types"

export const API_ENDPOINTS = {

  auth: {
    login: "/api/auth/login",
    register: "/api/auth/register",
    logout: "/api/auth/logout",
    refresh: "/api/auth/refresh",
    me: "/api/auth/me"},

  documents: {
    list: "/api/documents",
    upload: "/api/documents/upload",
    detail: (id: string) => `/api/documents/${id}`,
    delete: (id: string) => `/api/documents/${id}`},

  concepts: {
    list: "/api/concepts",
    search: "/api/concepts/search",
    detail: (id: string) => `/api/concepts/${id}`},

  chat: {
    rooms: "/api/chat/rooms",
    room: (id: string) => `/api/chat/rooms/${id}`,
    messages: (roomId: string) => `/api/chat/rooms/${roomId}/messages`,
    websocket: "/ws/chat"},

  feynman: {
    analyze: "/api/feynman/analyze",
    generateExplanation: "/api/feynman/generate-explanation",
    history: "/api/feynman/history"
  },

  flashcards: {
    review: "/api/flashcards/review",
    generateMnemonic: "/api/flashcards/generate-mnemonic"
  },

  users: {
    profile: "/api/users/profile",
    update: "/api/users/profile"},

  notifications: {
    stream: "/api/notifications/stream"}
    
} as const

export const NAV_ITEMS: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "Features", href: "/#features" },
  { label: "How It Works", href: "/#how-it-works" },
  { label: "Community", href: "/community/studygroups", requiresAuth: true },
  { label: "Application", href: "/application", requiresAuth: true },
  { label: "Assessment", href: "/assessment", requiresAuth: true },
  { label: "My Learning", href: "/dashboard", requiresAuth: true },
  { label: "Admin", href: "/admin", requiresAuth: true, allowedRoles: ["admin"] }
]

export const USER_MENU_ITEMS: NavItem[] = [

  { label: "Dashboard", href: "/dashboard", icon: "layout", allowedRoles: ["student"] },
  { label: "Teacher Dashboard", href: "/dashboard", icon: "layout", allowedRoles: ["teacher"] },
  { label: "Admin Dashboard", href: "/dashboard", icon: "layout", allowedRoles: ["admin"] },

  { label: "System Status", href: "/admin/system", icon: "settings", allowedRoles: ["admin"] },
  { label: "Manage Users", href: "/admin/users", icon: "users", allowedRoles: ["admin"] },
  { label: "Content Moderation", href: "/admin/content", icon: "file", allowedRoles: ["admin"] },
  { label: "Audit Log", href: "/admin/audit-log", icon: "file", allowedRoles: ["admin"] },
  { label: "Data Retention", href: "/admin/data-retention", icon: "file", allowedRoles: ["admin"] },
  { label: "Challenges", href: "/community/challenges", icon: "trophy", allowedRoles: ["admin"] },
  {
    label: "Knowledge Base",
    href: "/knowledge",
    icon: "book",
    allowedRoles: ["student", "teacher"],
    children: [
      { label: "Knowledge Dashboard", href: "/knowledge/dashboard", icon: "workflow" },
      { label: "My Documents", href: "/knowledge/documents", icon: "file" },
      { label: "Manage Tags", href: "/knowledge/tags", icon: "tag" },
      { label: "Diagrams & Maps", href: "/knowledge/diagram", icon: "map" }
    ]
  },
  {
    label: "Comprehension",
    href: "/comprehension",
    icon: "brain",
    allowedRoles: ["student"],
    children: [
      { label: "Why/How questions", href: "/comprehension/why-how", icon: "workflow" },
      { label: "Analogies & metaphors", href: "/comprehension/analogies", icon: "target" },
      { label: "Guided brainstorming", href: "/comprehension/brainstorm", icon: "layout" },
      { label: "Socratic dialogue", href: "/comprehension/dialogue", icon: "message" }
    ]
  },
  {
    label: "Memorization",
    href: "/flashcards",
    icon: "cards",
    allowedRoles: ["student"],
    children: [
      { label: "Review Flashcards", href: "/flashcards/review", icon: "cards" },
      { label: "Create Flashcard", href: "/flashcards/create", icon: "plus" },
      { label: "Manage Flashcards", href: "/flashcards/manage", icon: "plus" },
      { label: "Mix Study Topics", href: "/flashcards/mix-study-topics", icon: "cards" },
      { label: "Memory Palace", href: "/flashcards/memory-palace", icon: "layout" },
    ]
  },
  {
    label: "Assessment",
    href: "/application",
    icon: "workflow",
    allowedRoles: ["student"],
    children: [
      { label: "Feynman teach-back", href: "/application/teach-back", icon: "brain" },
      { label: "Simplify & Review", href: "/application/simplify", icon: "file" },
      { label: "Practice Exam Questions", href: "/application/practice-exam", icon: "target" },
      { label: "Import Past Papers", href: "/application/past-paper-import", icon: "file" },
      { label: "Error Log", href: "/application/error-log", icon: "file" },
      { label: "Schedule Error Review", href: "/application/schedule-review", icon: "timer" },
      { label: "Re-explain Correctly", href: "/application/re-explain", icon: "brain" }
    ]
  },
  {
    label: "Progress",
    href: "/progress/analytics",
    icon: "chart",
    allowedRoles: ["student"],
    children: [
      { label: "Overview", href: "/progress/analytics", icon: "layout" },
      { label: "Study plan", href: "/progress/pathway", icon: "workflow" },
      { label: "Group insights", href: "/progress/group", icon: "users" }
    ]
  },

  {
    label: "Planning & Workflow",
    href: "/plan-workflow",
    icon: "brain",
    allowedRoles: ["student"],
    children: [
      { label: "Brain Dashboard", href: "/plan-workflow", icon: "layout" },
      { label: "Study Planner", href: "/plan-workflow/study-planner", icon: "workflow" },
      { label: "Daily Plan", href: "/plan-workflow/daily-plan", icon: "target" },
      { label: "Focus Timer", href: "/plan-workflow/work-timer", icon: "timer" }
    ]
  },

  {
    label: "Social Hub",
    href: "/community",
    icon: "users",
    allowedRoles: ["student", "teacher"],
    children: [
      { label: "Friendship", href: "/community/friendship", icon: "heart", allowedRoles: ["student"] },
      { label: "Mentorship", href: "/community/mentorship", icon: "brain", allowedRoles: ["student", "teacher"] },
      { label: "Study Groups", href: "/community/studygroups", icon: "users", allowedRoles: ["student", "teacher"] },
      { label: "Activities", href: "/community/activities", icon: "activity", allowedRoles: ["student"] },
      { label: "Rewards & Achievements", href: "/community/rewards", icon: "award", allowedRoles: ["student"] },
      { label: "View Challenges", href: "/community/challenges", icon: "trophy", allowedRoles: ["student"] }
    ]
  },
  {
    label: "Script Kill Game",
    href: "/game",
    icon: "game",
    allowedRoles: ["student", "teacher"],
    children: [
      { label: "My Script-Kill Game", href: "/game/my-scripts", icon: "target", allowedRoles: ["student"] },
      { label: "Learn Later List", href: "/game/script-learning", icon: "book", allowedRoles: ["student"] },
      { label: "Generate Game Script", href: "/game/generate-script", icon: "workflow", allowedRoles: ["student"] },
      { label: "My Script Templates", href: "/game/my-templates", icon: "file" },
      { label: "Create Template", href: "/game/create-template", icon: "file" }
    ]
  },
  {
    label: "Classroom",
    href: "/classroom",
    icon: "users",
    allowedRoles: ["teacher"],
    children: [
      { label: "Manage Classes", href: "/classroom/classes", icon: "layout" },
    ]
  },
  {
    label: "Assessment Tools",
    href: "/classroom/questions",
    icon: "workflow",
    allowedRoles: ["teacher"],
    children: [
      { label: "Question Bank", href: "/classroom/questions", icon: "file" },
      { label: "Import Past Papers", href: "/classroom/papers/import", icon: "upload" }
    ]
  },
  { label: "My Calendar", href: "/calendar", icon: "calendar", allowedRoles: ["student", "teacher"] },
  { label: "My Profile", href: "/profile", icon: "user" },
  { label: "Settings", href: "/settings", icon: "settings" }
]

export const USER_DROPDOWN_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "layout" },
  { label: "My Profile", href: "/profile", icon: "user" },
  { label: "Settings", href: "/settings", icon: "settings" }
]

export const LANDING_SECTIONS: LandingSection[] = [
  {
    id: "hero",
    title: "Learn Smarter, Not Harder",
    subtitle: "Transform any document into interactive learning experiences",
    component: "HeroSection"
  },
  {
    id: "features",
    title: "Powerful Features",
    subtitle: "Everything you need to master any subject",
    component: "FeaturesSection"
  },
  {
    id: "how-it-works",
    title: "How It Works",
    subtitle: "Three simple steps to better learning",
    component: "HowItWorksSection"
  },
  {
    id: "modes",
    title: "Choose Your Style",
    subtitle: "Learn the way that suits you best. Switch anytime!",
    component: "ModesSection"
  },
  {
    id: "cta",
    title: "Ready to Transform Your Learning?",
    subtitle: "Join thousands of students who are already learning smarter. Start for free today.",
    component: "CTASection"
  }
]

export const FEATURES = [
  {
    id: "document-processing",
    title: "Smart Document Processing",
    description: "Upload PDFs, Word docs, PowerPoints, and more. Our AI extracts key concepts automatically.",
    icon: "file-text"
  },
  {
    id: "concept-extraction",
    title: "AI Concept Extraction",
    description: "Advanced AI identifies and organizes concepts, creating a knowledge graph for deeper understanding.",
    icon: "brain"
  },
  {
    id: "flashcards",
    title: "Auto-Generated Flashcards",
    description: "Automatically create flashcards from your documents with spaced repetition for optimal retention.",
    icon: "cards"
  },
  {
    id: "practice",
    title: "Interactive Practice",
    description: "Quiz yourself with AI-generated questions that adapt to your learning progress.",
    icon: "target"
  },
  {
    id: "community",
    title: "Learning Community",
    description: "Share resources, discuss concepts, and learn together with peers in your field.",
    icon: "users"
  },
  {
    id: "analytics",
    title: "Progress Analytics",
    description: "Track your learning journey with detailed insights and personalized recommendations.",
    icon: "chart"
  }
]

export const APP_NAME = "LearnSmart"
export const APP_TAGLINE = "Learn Smarter, Not Harder"
export const APP_DESCRIPTION = "Transform any document into interactive learning experiences with AI-powered concept extraction, flashcards, and practice questions."

export const THEME_STORAGE_KEY = "learnsmart-theme"
export const AUTH_STORAGE_KEY = "learnsmart-auth"
export const TOKEN_STORAGE_KEY = "learnsmart-tokens"

export const UPLOAD = {
  maxFileSize: 50 * 1024 * 1024,
  acceptedTypes: {
    pdf: ".pdf",
    word: ".doc,.docx",
    excel: ".xls,.xlsx",
    powerpoint: ".ppt,.pptx",
    image: ".jpg,.jpeg,.png,.gif,.webp",
    audio: ".mp3,.wav,.m4a,.ogg",
    video: ".mp4,.webm,.mov",
    text: ".txt,.md"
  },
  acceptAll: ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.webp,.mp3,.wav,.m4a,.ogg,.mp4,.webm,.mov,.txt,.md,.zip"
} as const
