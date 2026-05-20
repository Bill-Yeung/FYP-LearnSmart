import { lazy, type ReactNode } from "react"
import { Navigate } from "react-router-dom"
import type { UserRole } from "../../../../shared/types"
import { LazyPage } from "./LazyPage"
import { ProtectedLayout } from "../layouts/ProtectedLayout"

const LandingPage = lazy(() => import("../pages/general/LandingPage").then(m => ({ default: m.LandingPage })))
const LoginPage = lazy(() => import("../pages/auth/LoginPage").then(m => ({ default: m.LoginPage })))
const RegisterPage = lazy(() => import("../pages/auth/RegisterPage").then(m => ({ default: m.RegisterPage })))
const ForgotPasswordPage = lazy(() => import("../pages/auth/ForgotPasswordPage").then(m => ({ default: m.ForgotPasswordPage })))
const DashboardPage = lazy(() => import("../pages/general/DashboardPage").then(m => ({ default: m.DashboardPage })))
const ProfilePage = lazy(() => import("../pages/general/ProfilePage").then(m => ({ default: m.ProfilePage })))
const SettingsPage = lazy(() => import("../pages/settings/SettingsPage").then(m => ({ default: m.SettingsPage })))
const GeneralSettingsPage = lazy(() => import("../pages/settings/GeneralSettingsPage").then(m => ({ default: m.GeneralSettingsPage })))
const SessionsSettingsPage = lazy(() => import("../pages/settings/SessionsSettingsPage").then(m => ({ default: m.SessionsSettingsPage })))
const NotificationsSettingsPage = lazy(() => import("../pages/settings/NotificationsSettingsPage").then(m => ({ default: m.NotificationsSettingsPage })))
const PrivacySettingsPage = lazy(() => import("../pages/settings/PrivacySettingsPage").then(m => ({ default: m.PrivacySettingsPage })))
const MemorizePage = lazy(() => import("../pages/settings/MemorizePage").then(m => ({ default: m.MemorizePage })))
const FlashcardsReviewPage = lazy(() => import("../pages/flashcards/FlashcardsReviewPage").then(m => ({ default: m.FlashcardsReviewPage })))
const FlashcardsManagePage = lazy(() => import("../pages/flashcards/FlashcardsManagePage").then(m => ({ default: m.FlashcardsManagePage })))
const FlashcardsCreatePage = lazy(() => import("../pages/flashcards/CreateCardPage").then(m => ({ default: m.default })))
const FlashcardsAIGeneratePage = lazy(() => import("../pages/flashcards/AIGenerateCardsPage").then(m => ({ default: m.default })))
const FlashcardsImportPage = lazy(() => import("../pages/flashcards/ImportCardsPage").then(m => ({ default: m.default })))
const FeynmanTeachBackPage = lazy(() => import("../pages/application/FeynmanTeachBackPage").then(m => ({ default: m.FeynmanTeachBackPage })))
const SimplifyPage = lazy(() => import("../pages/application/SimplifyPage").then(m => ({ default: m.SimplifyPage })))
const PracticeExamQuestionsPage = lazy(() => import("../pages/application/PracticeExamQuestionsPage").then(m => ({ default: m.PracticeExamQuestionsPage })))
const PastPaperImportPage = lazy(() => import("../pages/application/PastPaperImportPage").then(m => ({ default: m.PastPaperImportPage })))
const ErrorLogPage = lazy(() => import("../pages/application/ErrorLogPage").then(m => ({ default: m.ErrorLogPage })))
const AnalysisMistakePage = lazy(() => import("../pages/application/AnalysisMistakePage").then(m => ({ default: m.AnalysisMistakePage })))
const CategorizeErrorPage = lazy(() => import("../pages/application/CategorizeErrorPage").then(m => ({ default: m.CategorizeErrorPage })))
const ScheduleErrorReviewPage = lazy(() => import("../pages/application/ScheduleErrorReviewPage").then(m => ({ default: m.ScheduleErrorReviewPage })))
const VisualizeErrorPatternsPage = lazy(() => import("../pages/application/VisualizeErrorPatternsPage").then(m => ({ default: m.VisualizeErrorPatternsPage })))
const ReExplainPage = lazy(() => import("../pages/application/ReExplainPage").then(m => ({ default: m.ReExplainPage })))
const MixStudyTopicsPage = lazy(() => import("../pages/flashcards/MixStudyTopicsPage").then(m => ({ default: m.MixStudyTopicsPage })))
const MemoryPalacePage = lazy(() => import("../pages/flashcards/MemoryPalacePage").then(m => ({ default: m.MemoryPalacePage })))

const CalendarPage = lazy(() => import("../pages/general/CalendarPage").then(m => ({ default: m.CalendarPage })))
const ConsolidatedReasoningLab = lazy(() => import("../pages/general/ConsolidatedReasoningLab").then(m => ({ default: m.ConsolidatedReasoningLab })))
const SmartPracticeEngine = lazy(() => import("../pages/application/SmartPracticeEngine").then(m => ({ default: m.SmartPracticeEngine })))
const IntelligentErrorHub = lazy(() => import("../pages/application/IntelligentErrorHub").then(m => ({ default: m.IntelligentErrorHub })))

const WhyHowQuestionsPage = lazy(() => import("../pages/comprehension/WhyHowQuestionsPage").then(m => ({ default: m.WhyHowQuestionsPage })))
const AnalogiesMetaphorsPage = lazy(() => import("../pages/comprehension/AnalogiesMetaphorsPage").then(m => ({ default: m.AnalogiesMetaphorsPage })))
const GuidedBrainstormPage = lazy(() => import("../pages/comprehension/GuidedBrainstormPage").then(m => ({ default: m.GuidedBrainstormPage })))  
const SocraticDialoguePage = lazy(() => import("../pages/comprehension/SocraticDialoguePage").then(m => ({ default: m.SocraticDialoguePage })))

const AnalyticsDashboardPage = lazy(() => import("../pages/progress/AnalyticsDashboardPage").then(m => ({ default: m.AnalyticsDashboardPage })))
const LearningPathwayPage = lazy(() => import("../pages/progress/LearningPathwayPage").then(m => ({ default: m.LearningPathwayPage })))
const GroupAnalyticsPage = lazy(() => import("../pages/progress/GroupAnalyticsPage").then(m => ({ default: m.GroupAnalyticsPage })))

const DocumentListPage = lazy(() => import("../pages/knowledge/DocumentListPage").then(m => ({ default: m.DocumentListPage })))
const DocumentDetailsPage = lazy(() => import("../pages/knowledge/DocumentDetailsPage").then(m => ({ default: m.DocumentDetailsPage })))
const TagManagementPage = lazy(() => import("../pages/knowledge/TagManagementPage").then(m => ({ default: m.TagManagementPage })))
const DiagramsListPage = lazy(() => import("../pages/knowledge/DiagramsListPage").then(m => ({ default: m.DiagramsListPage })))
const DiagramDetailPage = lazy(() => import("../pages/knowledge/DiagramDetailPage").then(m => ({ default: m.DiagramDetailPage })))
const ProcessingDashboardPage = lazy(() => import("../pages/knowledge/ProcessingDashboardPage").then(m => ({ default: m.ProcessingDashboardPage })))
const DocumentAnalyticsPage = lazy(() => import("../pages/knowledge/DocumentAnalyticsPage").then(m => ({ default: m.DocumentAnalyticsPage })))
const ConceptComparisonPage = lazy(() => import("../pages/knowledge/ConceptComparisonPage").then(m => ({ default: m.ConceptComparisonPage })))

const StudyGroupPage = lazy(() => import("../pages/community/StudyGroupPage").then(m => ({ default: m.StudyGroupPage })))
const CommunityDetailPage = lazy(() => import("../pages/community/CommunityDetailPage").then(m => ({ default: m.CommunityDetailPage })))
const RewardPage = lazy(() => import("../pages/community/RewardPage").then(m => ({ default: m.RewardPage })))
const FriendshipPage = lazy(() => import("../pages/community/FriendshipPage").then(m => ({ default: m.FriendshipPage })))
const ActivityPage = lazy(() => import("../pages/community/ActivityPage").then(m => ({ default: m.ActivityPage })))
const ChallengePage = lazy(() => import("../pages/community/ChallengePage").then(m => ({ default: m.ChallengePage })))
const MentorshipPage = lazy(() => import("../pages/community/MentorshipPage").then(m => ({ default: m.MentorshipPage })))
const MentorshipDetailPage = lazy(() => import("../pages/community/MentorshipDetailPage").then(m => ({ default: m.MentorshipDetailPage })))
const ClassDetailPage = lazy(() => import("../pages/community/ClassDetailPage").then(m => ({ default: m.ClassDetailPage })))

const ManageClassesPage = lazy(() => import("../pages/teacher/ManageClassesPage").then(m => ({ default: m.ManageClassesPage })))
const TeacherClassDetailPage = lazy(() => import("../pages/teacher/TeacherClassDetailPage").then(m => ({ default: m.TeacherClassDetailPage })))

const TeacherQuestionBankPage = lazy(() => import("../pages/teacher/TeacherQuestionBankPage").then(m => ({ default: m.TeacherQuestionBankPage })))
const TeacherPastPaperImportPage = lazy(() => import("../pages/teacher/TeacherPastPaperImportPage").then(m => ({ default: m.default })))

const AdminDashboard = lazy(() => import("../pages/admin/AdminDashboard").then(m => ({ default: m.AdminDashboard })))
const AdminAuditLog = lazy(() => import("../pages/admin/AdminAuditLog").then(m => ({ default: m.AdminAuditLog })))
const AdminDataRetention = lazy(() => import("../pages/admin/AdminDataRetention").then(m => ({ default: m.AdminDataRetention })))
const ManageUsersPage = lazy(() => import("../pages/admin/ManageUsersPage").then(m => ({ default: m.ManageUsersPage })))
const ManageContentPage = lazy(() => import("../pages/admin/ManageContentPage").then(m => ({ default: m.ManageContentPage })))
const SystemSettingsPage = lazy(() => import("../pages/admin/SystemSettingsPage").then(m => ({ default: m.SystemSettingsPage })))

const CreateTemplatePage = lazy(() => import("../pages/game/CreateTemplatePage").then(m => ({ default: m.CreateTemplatePage })))
const GenerateScriptPage = lazy(() => import("../pages/game/GenerateScriptPage").then(m => ({ default: m.GenerateScriptPage })))
const PlayGamePage = lazy(() => import("../pages/game/PlayGamePage").then(m => ({ default: m.PlayGamePage })))
const MyScriptsPage = lazy(() => import("../pages/game/MyScriptsPage").then(m => ({ default: m.MyScriptsPage })))
const MyTemplatesPage = lazy(() => import("../pages/game/MyTemplatesPage").then(m => ({ default: m.MyTemplatesPage })))
const ScriptReportPage = lazy(() => import("../pages/game/ScriptReportPage").then(m => ({ default: m.ScriptReportPage })))
const GenerateFromBasePage = lazy(() => import("../pages/game/GenerateFromBasePage").then(m => ({ default: m.GenerateFromBasePage })))
const ScriptLearningPage = lazy(() => import("../pages/game/ScriptLearningPage").then(m => ({ default: m.ScriptLearningPage })))
const LearnMorePage = lazy(() => import("../pages/game/LearnMorePage").then(m => ({ default: m.LearnMorePage })))

const BrainDashboardPage = lazy(() => import("../pages/plan_workflow/BrainDashboardPage").then(m => ({ default: m.BrainDashboardPage })))
const StudyPlannerPage = lazy(() => import("../pages/plan_workflow/StudyPlannerPage").then(m => ({ default: m.StudyPlannerPage })))
const DailyPlanPage = lazy(() => import("../pages/plan_workflow/DailyPlanPage").then(m => ({ default: m.DailyPlanPage })))
const WorkTimerPage = lazy(() => import("../pages/plan_workflow/WorkTimerPage").then(m => ({ default: m.default })))
const AssignPlanPage = lazy(() => import("../pages/plan_workflow/AssignPlanPage").then(m => ({ default: m.default })))

const ClassroomModePage = lazy(() => import("../pages/general/ClassroomModePage").then(m => ({ default: m.ClassroomModePage })))
const DetectiveModePage = lazy(() => import("../pages/general/DetectiveModePage").then(m => ({ default: m.DetectiveModePage })))

function withLazyLoading(Component: React.LazyExoticComponent<React.ComponentType<any>>) {
  return (
    <LazyPage>
      <Component />
    </LazyPage>
  )
}

export type AppRoute = {
  path: string
  element: ReactNode
  requiresAuth?: boolean
  redirectIfAuth?: boolean
  allowedRoles?: UserRole[]
  children?: AppRoute[]
}

export const publicRoutes: AppRoute[] = [
  {
    path: "/",
    element: withLazyLoading(LandingPage),
    requiresAuth: false,
    redirectIfAuth: true
  }
]

export const authRoutes: AppRoute[] = [
  {
    path: "/login",
    element: withLazyLoading(LoginPage),
    redirectIfAuth: true
  },
  {
    path: "/register",
    element: withLazyLoading(RegisterPage),
    redirectIfAuth: true
  },
  {
    path: "/forgot-password",
    element: withLazyLoading(ForgotPasswordPage),
    redirectIfAuth: true
  }
]

export const protectedRoutes: AppRoute = {
  path: "/",
  element: <ProtectedLayout />,
  requiresAuth: true,
  children: [
    {
      path: "dashboard",
      element: withLazyLoading(DashboardPage),
      requiresAuth: true
    },
    {
      path: "calendar",
      element: withLazyLoading(CalendarPage),
      requiresAuth: true
    },
    {
      path: "knowledge",
      element: <Navigate to="/knowledge/dashboard" replace />,
      requiresAuth: true
    },
    {
      path: "knowledge/documents",
      element: withLazyLoading(DocumentListPage),
      requiresAuth: true
    },
    {
      path: "knowledge/documents/:documentId",
      element: withLazyLoading(DocumentDetailsPage),
      requiresAuth: true
    },
    {
      path: "knowledge/tags",
      element: withLazyLoading(TagManagementPage),
      requiresAuth: true
    },
    {
      path: "knowledge/diagram",
      element: withLazyLoading(DiagramsListPage),
      requiresAuth: true
    },
    {
      path: "knowledge/diagram/:slug",
      element: withLazyLoading(DiagramDetailPage),
      requiresAuth: true
    },
    {
      path: "knowledge/dashboard",
      element: withLazyLoading(ProcessingDashboardPage),
      requiresAuth: true
    },
    {
      path: "knowledge/documents/:documentId/analytics",
      element: withLazyLoading(DocumentAnalyticsPage),
      requiresAuth: true
    },
    {
      path: "knowledge/concepts/compare",
      element: withLazyLoading(ConceptComparisonPage),
      requiresAuth: true
    },
    {
      path: "comprehension/why-how",
      element: withLazyLoading(WhyHowQuestionsPage),
      requiresAuth: true
    },
    {
      path: "comprehension/analogies",
      element: withLazyLoading(AnalogiesMetaphorsPage),
      requiresAuth: true
    },
    {
      path: "comprehension/brainstorm",
      element: withLazyLoading(GuidedBrainstormPage),
      requiresAuth: true
    },
    {
      path: "comprehension/dialogue",
      element: withLazyLoading(SocraticDialoguePage),
      requiresAuth: true
    },
    {
      path: "progress",
      element: <Navigate to="/progress/analytics" replace />,
      requiresAuth: true
    },
    {
      path: "progress/analytics",
      element: withLazyLoading(AnalyticsDashboardPage),
      requiresAuth: true
    },
    {
      path: "progress/explore",
      element: <Navigate to="/progress/analytics" replace />,
      requiresAuth: true
    },
    {
      path: "progress/pathway",
      element: withLazyLoading(LearningPathwayPage),
      requiresAuth: true
    },
    {
      path: "progress/group",
      element: withLazyLoading(GroupAnalyticsPage),
      requiresAuth: true
    },
    {
      path: "progress/gap-analysis",
      element: <Navigate to="/progress/analytics" replace />,
      requiresAuth: true
    },
    {
      path: "progress/integrations",
      element: <Navigate to="/progress/analytics" replace />,
      requiresAuth: true
    },
    {
      path: "consolidated-reasoning-lab",
      element: withLazyLoading(ConsolidatedReasoningLab),
      requiresAuth: true
    },
    {
      
      path: "smart-practice-engine",
      element: withLazyLoading(SmartPracticeEngine),
      requiresAuth: true
    },
    {
      path: "intelligent-error-hub",
      element: withLazyLoading(IntelligentErrorHub),
      requiresAuth: true
    },
    {
      path: "flashcards/review",
      element: withLazyLoading(FlashcardsReviewPage),
      requiresAuth: true
    },
    {
      path: "flashcards/schedule",
      element: <Navigate to="/calendar" replace />,
      requiresAuth: true
    },
    {
      path: "flashcards/manage",
      element: withLazyLoading(FlashcardsManagePage),
      requiresAuth: true
    },
    {
      path: "flashcards/create",
      element: withLazyLoading(FlashcardsCreatePage),
      requiresAuth: true
    },
    {
      path: "flashcards/generate",
      element: withLazyLoading(FlashcardsAIGeneratePage),
      requiresAuth: true
    },
    {
      path: "flashcards/import",
      element: withLazyLoading(FlashcardsImportPage),
      requiresAuth: true
    },
    
    {
      path: "application/teach-back",
      element: withLazyLoading(FeynmanTeachBackPage),
      requiresAuth: true
    },
    {
      path: "application/simplify",
      element: withLazyLoading(SimplifyPage),
      requiresAuth: true
    },
    {
      path: "application/practice-exam",
      element: withLazyLoading(PracticeExamQuestionsPage),
      requiresAuth: true
    },
    {
      path: "application/past-paper-import",
      element: withLazyLoading(PastPaperImportPage),
      requiresAuth: true
    },
    {
      path: "application/error-log",
      element: withLazyLoading(ErrorLogPage),
      requiresAuth: true
    },
    {
      path: "application/analysis",
      element: withLazyLoading(AnalysisMistakePage),
      requiresAuth: true
    },
    {
      path: "application/categorize",
      element: withLazyLoading(CategorizeErrorPage),
      requiresAuth: true
    },
    {
      path: "application/schedule-review",
      element: withLazyLoading(ScheduleErrorReviewPage),
      requiresAuth: true
    },
    {
      path: "application/visualize",
      element: withLazyLoading(VisualizeErrorPatternsPage),
      requiresAuth: true
    },
    {
      path: "application/re-explain",
      element: withLazyLoading(ReExplainPage),
      requiresAuth: true
    },
    {
      path: "assessment",
      element: <Navigate to="/application/teach-back" replace />,
      requiresAuth: true
    },
    {
      path: "admin",
      element: withLazyLoading(AdminDashboard),
      requiresAuth: true,
      allowedRoles: ["admin"]
    },
    {
      path: "admin/audit-log",
      element: withLazyLoading(AdminAuditLog),
      requiresAuth: true,
      allowedRoles: ["admin"]
    },
    {
      path: "admin/data-retention",
      element: withLazyLoading(AdminDataRetention),
      requiresAuth: true,
      allowedRoles: ["admin"]
    },
    {
      path: "admin/users",
      element: withLazyLoading(ManageUsersPage),
      requiresAuth: true,
      allowedRoles: ["admin"]
    },
    {
      path: "admin/content",
      element: withLazyLoading(ManageContentPage),
      requiresAuth: true,
      allowedRoles: ["admin"]
    },
    {
      path: "admin/system",
      element: withLazyLoading(SystemSettingsPage),
      requiresAuth: true,
      allowedRoles: ["admin"]
    },
    {
      path: "flashcards/mix-study-topics",
      element: withLazyLoading(MixStudyTopicsPage),
      requiresAuth: true
    },
    
    {
      path: "flashcards/memory-palace",
      element: withLazyLoading(MemoryPalacePage),
      requiresAuth: true
    },
    {
      path: "profile",
      element: withLazyLoading(ProfilePage),
      requiresAuth: true
    },
    {
      path: "settings",
      element: withLazyLoading(SettingsPage),
      requiresAuth: true
    },
    {
      path: "settings/general",
      element: withLazyLoading(GeneralSettingsPage),
      requiresAuth: true
    },
    {
      path: "settings/sessions",
      element: withLazyLoading(SessionsSettingsPage),
      requiresAuth: true
    },
    {
      path: "settings/notifications",
      element: withLazyLoading(NotificationsSettingsPage),
      requiresAuth: true
    },
    {
      path: "settings/privacy",
      element: withLazyLoading(PrivacySettingsPage),
      requiresAuth: true
    },
    {
      path: "settings/memorize",
      element: withLazyLoading(MemorizePage),
      requiresAuth: true
    },
    {
      path: "classroom/classes",
      element: withLazyLoading(ManageClassesPage),
      requiresAuth: true,
      allowedRoles: ["teacher"]
    },
    {
      path: "classroom/classes/:classId",
      element: withLazyLoading(TeacherClassDetailPage),
      requiresAuth: true,
      allowedRoles: ["teacher"]
    },
    { path: "classroom/questions", element: withLazyLoading(TeacherQuestionBankPage), requiresAuth: true, allowedRoles: ["teacher"] },
    { path: "classroom/papers/import", element: withLazyLoading(TeacherPastPaperImportPage), requiresAuth: true, allowedRoles: ["teacher"] },
    {
      path: "community/studygroups",
      element: withLazyLoading(StudyGroupPage),
      requiresAuth: true
    },
    {
      path: "community/rewards",
      element: withLazyLoading(RewardPage),
      requiresAuth: true
    },
    {
      path: "community/friendship",
      element: withLazyLoading(FriendshipPage),
      requiresAuth: true
    },
    {
      path: "community/activities",
      element: withLazyLoading(ActivityPage),
      requiresAuth: true
    },
    {
      path: "community/challenges",
      element: withLazyLoading(ChallengePage),
      requiresAuth: true
    },
    {
      path: "community/mentorship",
      element: withLazyLoading(MentorshipPage),
      requiresAuth: true
    },
    {
      path: "community/mentorship/:mentorshipId",
      element: withLazyLoading(MentorshipDetailPage),
      requiresAuth: true
    },
    {
      path: "community/class/:classId",
      element: withLazyLoading(ClassDetailPage),
      requiresAuth: true
    },
    {
      path: "community/:communityId",
      element: withLazyLoading(CommunityDetailPage),
      requiresAuth: true
    },
    {
      path: "game/create-template",
      element: withLazyLoading(CreateTemplatePage),
      requiresAuth: true
    },
    {
      path: "game/generate-script",
      element: withLazyLoading(GenerateScriptPage),
      requiresAuth: true
    },
    {
      path: "game/play",
      element: withLazyLoading(PlayGamePage),
      requiresAuth: true
    },
    {
      path: "game/my-scripts",
      element: withLazyLoading(MyScriptsPage),
      requiresAuth: true
    },
    {
      path: "game/my-templates",
      element: withLazyLoading(MyTemplatesPage),
      requiresAuth: true
    },
    {
      path: "game/script-learning",
      element: withLazyLoading(ScriptLearningPage),
      requiresAuth: true
    },
    {
      path: "game/learn-more",
      element: withLazyLoading(LearnMorePage),
      requiresAuth: true
    },
    {
      path: "game/scripts/:scriptId/report",
      element: withLazyLoading(ScriptReportPage),
      requiresAuth: true
    },
    {
      path: "game/generate-from-base",
      element: withLazyLoading(GenerateFromBasePage),
      requiresAuth: true
    },
    {
      path: "plan-workflow",
      element: withLazyLoading(BrainDashboardPage),
      requiresAuth: true
    },
    {
      path: "plan-workflow/study-planner",
      element: withLazyLoading(StudyPlannerPage),
      requiresAuth: true
    },
    {
      path: "plan-workflow/daily-plan",
      element: withLazyLoading(DailyPlanPage),
      requiresAuth: true
    },
    {
      path: "plan-workflow/work-timer",
      element: withLazyLoading(WorkTimerPage),
      requiresAuth: true
    },
    {
      path: "plan-workflow/assign-plan",
      element: withLazyLoading(AssignPlanPage),
      requiresAuth: true
    }
  ]
}

export const themedModeRoutes: AppRoute[] = [
  {
    path: "/classroom",
    element: withLazyLoading(ClassroomModePage),
    requiresAuth: true,
    allowedRoles: ["student", "teacher"]
  },
  {
    path: "/detective",
    element: withLazyLoading(DetectiveModePage),
    requiresAuth: true,
    allowedRoles: ["student", "teacher"]
  }
]

export const catchAllRoute = {
  path: "*",
  element: <Navigate to="/" replace />
}

export const allRoutes = [
  ...publicRoutes,
  ...authRoutes,
  ...themedModeRoutes,
  protectedRoutes,
  catchAllRoute
]

