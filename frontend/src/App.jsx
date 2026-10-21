import { Suspense, lazy, useEffect } from 'react'
import { Helmet } from 'react-helmet-async'
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { AdminRedirect, LanguageLayout, RootLanguageRedirect } from './routes/LanguageRouting.jsx'
import AdminRoute from './routes/AdminRoute.jsx'
import { isDemoEnvironment } from './lib/appEnvironment.js'
import { CallProvider } from './store/CallContext.jsx'
import { initAcquisitionTracking } from './utils/acquisitionTracker.js'

const CHUNK_RELOAD_STORAGE_KEY = 'nest_chunk_reload_ts'
const CHUNK_RELOAD_COOLDOWN_MS = 15000

function shouldReloadForChunkError() {
  if (typeof window === 'undefined') return false
  try {
    const lastReloadAt = Number(window.sessionStorage?.getItem(CHUNK_RELOAD_STORAGE_KEY) || 0)
    const now = Date.now()
    if (now - lastReloadAt < CHUNK_RELOAD_COOLDOWN_MS) {
      return false
    }
    window.sessionStorage?.setItem(CHUNK_RELOAD_STORAGE_KEY, String(now))
    return true
  } catch {
    return false
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (event) => {
    if (shouldReloadForChunkError()) {
      event.preventDefault()
      window.location.reload()
    }
  })
}

function lazyWithRetry(importer) {
  return lazy(async () => {
    try {
      return await importer()
    } catch {
      try {
        await new Promise((resolve) => setTimeout(resolve, 350))
        return await importer()
      } catch (retryError) {
        if (shouldReloadForChunkError()) {
          window.location.reload()
          return new Promise(() => {})
        }
        throw retryError
      }
    }
  })
}

const HomePage = lazyWithRetry(() => import('./pages/HomePage.jsx'))
const LoopPage = lazyWithRetry(() => import('./pages/LoopPage.jsx'))
const LoginPage = lazyWithRetry(() => import('./pages/LoginPage.jsx'))
const SignUpPage = lazyWithRetry(() => import('./pages/SignUpPage.jsx'))
const ResetPasswordPage = lazyWithRetry(() => import('./pages/ResetPasswordPage.jsx'))
const ProfilePage = lazyWithRetry(() => import('./pages/ProfilePage.jsx'))
const ConnectionsPage = lazyWithRetry(() => import('./pages/ConnectionsPage.jsx'))
const EditProfilePage = lazyWithRetry(() => import('./pages/EditProfilePage.jsx'))
const MessagesPage = lazyWithRetry(() => import('./pages/MessagesPage.jsx'))
const NotificationsPage = lazyWithRetry(() => import('./pages/NotificationsPage.jsx'))
const SearchPage = lazyWithRetry(() => import('./pages/SearchPage.jsx'))
const GroupsPage = lazyWithRetry(() => import('./pages/GroupsPage.jsx'))
const ManagedGroupPage = lazyWithRetry(() => import('./pages/ManagedGroupPage.jsx'))
const JoinedGroupPage = lazyWithRetry(() => import('./pages/JoinedGroupPage.jsx'))
const MyReportsPage = lazyWithRetry(() => import('./pages/MyReportsPage.jsx'))
const AdminOverviewPage = lazyWithRetry(() => import('./pages/AdminOverviewPage.jsx'))
const AdminUsersPage = lazyWithRetry(() => import('./pages/AdminUsersPage.jsx'))
const AdminUserDetailPage = lazyWithRetry(() => import('./pages/AdminUserDetailPage.jsx'))
const AdminContentPage = lazyWithRetry(() => import('./pages/AdminContentPage.jsx'))
const AdminCommentsPage = lazyWithRetry(() => import('./pages/AdminCommentsPage.jsx'))
const AdminReportsPage = lazyWithRetry(() => import('./pages/AdminReportsPage.jsx'))
const AdminAuditLogsPage = lazyWithRetry(() => import('./pages/AdminAuditLogsPage.jsx'))
const AdminMessagesPage = lazyWithRetry(() => import('./pages/AdminMessagesPage.jsx'))
const AdminShadowPage = lazyWithRetry(() => import('./pages/AdminShadowPage.jsx'))
const AdminContractsSettingsPage = lazyWithRetry(() => import('./pages/AdminContractsSettingsPage.jsx'))
const AdminNotificationsSettingsPage = lazyWithRetry(
  () => import('./pages/AdminNotificationsSettingsPage.jsx'),
)
const AdminVerificationRequestsPage = lazyWithRetry(
  () => import('./pages/AdminVerificationRequestsPage.jsx'),
)
const AdminCreatorsPage = lazyWithRetry(() => import('./pages/AdminCreatorsPage.jsx'))
const SimpleInfoPage = lazyWithRetry(() => import('./pages/SimpleInfoPage.jsx'))
const MonetizationPage = lazyWithRetry(() => import('./pages/MonetizationPage.jsx'))
const AnonymousLoungePage = lazyWithRetry(() => import('./pages/AnonymousLoungePage.jsx'))
const AboutPage = lazyWithRetry(() => import('./pages/AboutPage.jsx'))
const ContactPage = lazyWithRetry(() => import('./pages/ContactPage.jsx'))
const AdsPage = lazyWithRetry(() => import('./pages/AdsPage.jsx'))
const NotFoundPage = lazyWithRetry(() => import('./pages/NotFoundPage.jsx'))
const PostDetailModal = lazyWithRetry(() => import('./features/posts/PostDetailModal.jsx'))
const AdminLayout = lazyWithRetry(() => import('./layouts/AdminLayout.jsx'))

function LegacyVerificationRedirect() {
  const { lang = 'tr' } = useParams()
  return <Navigate to={`/${lang}/profile`} replace />
}

function RouteFallback({ overlay = false }) {
  if (overlay) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
        role="status"
        aria-live="polite"
      >
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-card/90 px-5 py-3 shadow-xl backdrop-blur-md">
          <span className="size-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
          <span className="text-xs font-medium text-text/80">Yükleniyor...</span>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen bg-bg text-text transition-colors"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="mx-auto max-w-[1500px] px-3 md:px-5">
        <div className="flex gap-6 pt-3 md:pt-4">
          {/* Desktop Left Sidebar Skeleton */}
          <aside className="hidden w-[240px] shrink-0 space-y-4 py-3 md:block">
            <div className="h-10 w-32 animate-pulse rounded-xl bg-secondary/80" />
            <div className="space-y-2 pt-2">
              <div className="h-11 w-full animate-pulse rounded-xl bg-secondary/60" />
              <div className="h-11 w-full animate-pulse rounded-xl bg-secondary/60" />
              <div className="h-11 w-full animate-pulse rounded-xl bg-secondary/60" />
              <div className="h-11 w-full animate-pulse rounded-xl bg-secondary/60" />
              <div className="h-11 w-full animate-pulse rounded-xl bg-secondary/60" />
            </div>
          </aside>

          {/* Center Content Skeleton */}
          <main className="min-w-0 flex-1 max-w-[700px] space-y-4 py-3">
            {/* Story Rail Skeleton */}
            <div className="flex gap-3 overflow-hidden rounded-2xl border border-border/60 bg-card/50 p-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex flex-col items-center gap-1.5 shrink-0">
                  <div className="size-14 animate-pulse rounded-full bg-secondary" />
                  <div className="h-2.5 w-10 animate-pulse rounded bg-secondary/70" />
                </div>
              ))}
            </div>

            {/* Post Skeleton Cards */}
            <div className="rounded-2xl border border-border/60 bg-card/60 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="size-10 animate-pulse rounded-full bg-secondary" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-3.5 w-28 animate-pulse rounded bg-secondary" />
                  <div className="h-2.5 w-16 animate-pulse rounded bg-secondary/60" />
                </div>
              </div>
              <div className="space-y-2 pt-1">
                <div className="h-3 w-full animate-pulse rounded bg-secondary/70" />
                <div className="h-3 w-4/5 animate-pulse rounded bg-secondary/70" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-secondary/70" />
              </div>
              <div className="h-48 w-full animate-pulse rounded-xl bg-secondary/40 pt-2" />
            </div>

            <div className="rounded-2xl border border-border/60 bg-card/60 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="size-10 animate-pulse rounded-full bg-secondary" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-3.5 w-24 animate-pulse rounded bg-secondary" />
                  <div className="h-2.5 w-20 animate-pulse rounded bg-secondary/60" />
                </div>
              </div>
              <div className="space-y-2 pt-1">
                <div className="h-3 w-full animate-pulse rounded bg-secondary/70" />
                <div className="h-3 w-3/4 animate-pulse rounded bg-secondary/70" />
              </div>
            </div>
          </main>

          {/* Right Rail Skeleton */}
          <aside className="hidden w-[310px] shrink-0 space-y-4 py-3 xl:block">
            <div className="h-11 w-full animate-pulse rounded-xl bg-secondary/60" />
            <div className="h-56 w-full animate-pulse rounded-2xl border border-border/60 bg-card/50 p-4" />
            <div className="h-64 w-full animate-pulse rounded-2xl border border-border/60 bg-card/50 p-4" />
          </aside>
        </div>
      </div>
    </div>
  )
}

function App() {
  const location = useLocation()

  useEffect(() => {
    initAcquisitionTracking()
  }, [])

  const backgroundLocation = location.state?.backgroundLocation
  const normalizedPathname =
    location.pathname.length > 1 && location.pathname.endsWith('/')
      ? location.pathname.slice(0, -1)
      : location.pathname
  const isPrivateOrUtilityRoute = /^\/(tr|en|de|es)\/(admin(?:\/.*)?|messages(?:\/.*)?|notifications(?:\/.*)?|reports(?:\/.*)?|groups(?:\/.*)?|login|signup|reset-password|profile\/(?:edit|verification)(?:\/.*)?)$/i.test(
    normalizedPathname,
  )
  const shouldNoindex = isDemoEnvironment || isPrivateOrUtilityRoute

  return (
    <CallProvider>
      {shouldNoindex ? (
        <Helmet>
          <meta name="robots" content="noindex,nofollow" />
        </Helmet>
      ) : null}

      <Suspense fallback={<RouteFallback />}>
        <Routes location={backgroundLocation || location}>
          <Route path="/" element={<RootLanguageRedirect />} />
          <Route path="/admin" element={<AdminRedirect />} />
          <Route path="/admin/*" element={<AdminRedirect />} />

          <Route path="/:lang" element={<LanguageLayout />}>
            <Route index element={<HomePage />} />
            <Route path="tag/:tagSlug" element={<HomePage />} />
            <Route path="loop" element={<LoopPage />} />
            <Route path="login" element={<LoginPage />} />
            <Route path="signup" element={<SignUpPage />} />
            <Route path="reset-password" element={<ResetPasswordPage />} />
            <Route
              path="admin"
              element={
                <AdminRoute>
                  <AdminLayout />
                </AdminRoute>
              }
            >
              <Route index element={<AdminOverviewPage />} />
              <Route path="users" element={<AdminUsersPage />} />
              <Route path="users/:userId" element={<AdminUserDetailPage />} />
              <Route path="content" element={<AdminContentPage />} />
              <Route path="comments" element={<AdminCommentsPage />} />
              <Route path="reports" element={<AdminReportsPage />} />
              <Route path="verification-requests" element={<AdminVerificationRequestsPage />} />
              <Route path="creators" element={<AdminCreatorsPage />} />
              <Route path="messages" element={<AdminMessagesPage />} />
              <Route path="shadow" element={<AdminShadowPage />} />
              <Route path="audit-logs" element={<AdminAuditLogsPage />} />
              <Route
                path="settings/notifications"
                element={<AdminNotificationsSettingsPage />}
              />
              <Route path="settings/contracts" element={<AdminContractsSettingsPage />} />
            </Route>
            <Route path="messages" element={<MessagesPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="search" element={<SearchPage />} />
            <Route path="groups" element={<GroupsPage />} />
            <Route path="groups/manage/:groupSlug" element={<ManagedGroupPage />} />
            <Route path="groups/joined/:groupSlug" element={<JoinedGroupPage />} />
            <Route path="reports" element={<MyReportsPage />} />
            <Route path="profile/edit" element={<EditProfilePage />} />
            <Route path="profile/verification" element={<LegacyVerificationRedirect />} />
            <Route path="profile/followers" element={<ConnectionsPage connectionType="followers" />} />
            <Route path="profile/following" element={<ConnectionsPage connectionType="following" />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="u/:username/followers" element={<ConnectionsPage connectionType="followers" />} />
            <Route path="u/:username/following" element={<ConnectionsPage connectionType="following" />} />
            <Route path="u/:username" element={<ProfilePage />} />
            <Route
              path="settings"
              element={
                <SimpleInfoPage
                  pageKey="settings"
                  title="Settings"
                  description="Theme, account, privacy, and notification preferences will be managed here."
                />
              }
            />
            <Route
              path="hidden-profile"
              element={<AnonymousLoungePage />}
            />
            <Route
              path="lounge"
              element={<AnonymousLoungePage />}
            />
            <Route
              path="monetization"
              element={<MonetizationPage />}
            />
            <Route
              path="about"
              element={<AboutPage />}
            />
            <Route
              path="contact"
              element={<ContactPage />}
            />
            <Route
              path="ads"
              element={<AdsPage />}
            />
            <Route path="posts/:postId" element={<PostDetailModal />} />
            <Route path="posts/:postId/:slug" element={<PostDetailModal />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/en/" replace />} />
        </Routes>
      </Suspense>

      {backgroundLocation ? (
        <Suspense fallback={<RouteFallback overlay />}>
          <Routes>
            <Route
              path="/:lang/posts/:postId"
              element={
                <LanguageLayout overlayOnly>
                  <PostDetailModal forceOverlay />
                </LanguageLayout>
              }
            />
            <Route
              path="/:lang/posts/:postId/:slug"
              element={
                <LanguageLayout overlayOnly>
                  <PostDetailModal forceOverlay />
                </LanguageLayout>
              }
            />
          </Routes>
        </Suspense>
      ) : null}
    </CallProvider>
  )
}

export default App
