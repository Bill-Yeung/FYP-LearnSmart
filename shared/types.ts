export type ThemeMode = "normal" | "classroom" | "detective"
export type ColorScheme = "light" | "dark"

export const THEME_MODE_INFO: Record<ThemeMode, { name: string; description: string; icon: string }> = {
  normal: {
    name: "Normal",
    description: "Clean, modern interface",
    icon: "layout"
  },
  classroom: {
    name: "Classroom",
    description: "Interactive classroom experience - click drawers, open cabinets!",
    icon: "school"
  },
  detective: {
    name: "Detective",
    description: "Sherlock Holmes mystery mode - solve the case of knowledge!",
    icon: "search"
  }
}

export type UserRole = "student" | "teacher" | "admin"
export type CommunityRole = "owner" | "admin" | "moderator" | "member" | "pending"
export type ChatRoomRole = "owner" | "admin" | "member"
export type DomainLevel = "beginner" | "intermediate" | "advanced"
export type DifficultyPreference = "easy" | "medium" | "hard" | "adaptive"
export type AIAssistanceLevel = "minimal" | "moderate" | "full"

export interface User {
  id: string
  username: string
  email: string
  role: UserRole
  display_name: string | null
  preferred_language: string
  is_active: boolean
  email_verified: boolean
  domain_level: DomainLevel
  difficulty_preference: DifficultyPreference
  ai_assistance_level: AIAssistanceLevel
  created_at: string
  last_login: string | null
}

export interface UserProfile {
  user_id: string
  bio: string | null
  avatar_url: string | null
  organization: string | null
  department: string | null
  level: string | null
  personal_interests: string[]
  timezone: string
}

export interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
}

export interface Tokens {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface FeynmanAnalysis {
  missing_terms: string[]
  logical_gaps: string[]
  unclear_reasoning: string[]
  analogies: string[]
  follow_up_questions: string[]
  revised_explanation: string | null
  summary: string | null
  score: number | null
}

export interface FeynmanSession {
  session_id: string
  concept_title: string | null
  created_at: string
  analysis: FeynmanAnalysis
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  has_next: boolean
  has_prev: boolean
}

export type DocumentType =
  | "pdf"
  | "word"
  | "excel"
  | "powerpoint"
  | "image"
  | "audio"
  | "video"
  | "webpage"
  | "text"
  | "zip"

export type ProcessingStatus = "pending" | "processing" | "completed" | "failed"

export interface Document {
  id: string
  title: string
  document_type: DocumentType
  file_size: number
  processing_status: ProcessingStatus
  concepts_extracted: number
  created_at: string
}

export interface NavItem {
  label: string
  href: string
  icon?: string
  requiresAuth?: boolean
  allowedRoles?: UserRole[]
  children?: NavItem[]
}

export interface ChatMessage {
  id: string
  user_id: string
  username: string
  display_name?: string
  content: string
  message_type: string
  created_at: string
  is_edited: boolean
  reactions?: { [emoji: string]: string[] }
  reply_to_id?: string
  read_by?: { [userId: string]: string } | string
  attachments?: Array<{
    file_id: string
    filename: string
    file_size: number
    file_url: string
    content_type: string
  }>
}

export interface ChatRoom {
  id: string
  room_type: string
  name: string | null
  last_message_preview: string | null
  last_message_at?: string | null
  unread_count?: number
  other_user_online?: boolean
  other_user_last_seen?: string
}

export interface LandingSection {
  id: string
  title: string
  subtitle?: string
  component: string
}

export type TargetLevel = "beginner" | "standard" | "advanced" | "all"
export type ContentSource = "system" | "upload"
export type HardRule = "long_script" | "split" | "compress"
export type QuizCountOption = "4-6" | "6-8" | "8-10" | "10-12"
export type PassScoreOption = 60 | 70 | 80 | 90
export type QuizSourceOption = "doc_only" | "doc_ai" | "ai_only"
export type QuizMode = "ai" | "manual"

export type ManualQuizConfig = {
  mcq: number
  fill: number
  code: number
  sort: number
  short: number
}

export type TemplatePayloadStatus = "draft" | "published"

export type TemplatePayload = {
  status?: TemplatePayloadStatus
  basic: {
    name: string
    target_level: TargetLevel
    description?: string
  }
  content: {
    source: ContentSource
    subject?: string | null,
    subject_code?: string | null,
    subject_name?: string | null,
    subjectDbId?: string | null
  }
  difficulty: {
    puzzle_mcq: number;
    puzzle_sorting: number;
    puzzle_fill: number;
  }
  quiz:
    | {
        enabled: false
      }
    | {
        enabled: true
        count_range: QuizCountOption
        pass_score?: PassScoreOption
        source: QuizSourceOption
        mode: QuizMode
        manual_config: ManualQuizConfig | null
      }
}

export type GameTemplate = {
  id: string
  version: number
  status: "draft" | "published"
  created_at: string
  updated_at: string
  basic: TemplatePayload["basic"]
  content: TemplatePayload["content"]
  difficulty: TemplatePayload["difficulty"]
  quiz: TemplatePayload["quiz"]
}
