import { Suspense, lazy } from 'react'
import { Helmet } from 'react-helmet-async'
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { LanguageLayout, RootLanguageRedirect } from './routes/LanguageRouting.jsx'
import AdminRoute from './routes/AdminRoute.jsx'
import { isDemoEnvironment } from './lib/appEnvironment.js'

const HomePage = lazy(() => import('./pages/HomePage.jsx'))
const LoopPage = lazy(() => import('./pages/LoopPage.jsx'))
const LoginPage = lazy(() => import('./pages/LoginPage.jsx'))
const SignUpPage = lazy(() => import('./pages/SignUpPage.jsx'))
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage.jsx'))
const ProfilePage = lazy(() => import('./pages/ProfilePage.jsx'))
const ConnectionsPage = lazy(() => import('./pages/ConnectionsPage.jsx'))
const EditProfilePage = lazy(() => import('./pages/EditProfilePage.jsx'))
const MessagesPage = lazy(() => import('./pages/MessagesPage.jsx'))
const NotificationsPage = lazy(() => import('./pages/NotificationsPage.jsx'))
const SearchPage = lazy(() => import('./pages/SearchPage.jsx'))
const GroupsPage = lazy(() => import('./pages/GroupsPage.jsx'))
const ManagedGroupPage = lazy(() => import('./pages/ManagedGroupPage.jsx'))
const JoinedGroupPage = lazy(() => import('./pages/JoinedGroupPage.jsx'))
const MyReportsPage = lazy(() => import('./pages/MyReportsPage.jsx'))
const AdminOverviewPage = lazy(() => import('./pages/AdminOverviewPage.jsx'))
const AdminUsersPage = lazy(() => import('./pages/AdminUsersPage.jsx'))
const AdminUserDetailPage = lazy(() => import('./pages/AdminUserDetailPage.jsx'))
const AdminContentPage = lazy(() => import('./pages/AdminContentPage.jsx'))
const AdminCommentsPage = lazy(() => import('./pages/AdminCommentsPage.jsx'))
const AdminReportsPage = lazy(() => import('./pages/AdminReportsPage.jsx'))
const AdminAuditLogsPage = lazy(() => import('./pages/AdminAuditLogsPage.jsx'))
const AdminContractsSettingsPage = lazy(() => import('./pages/AdminContractsSettingsPage.jsx'))
const AdminNotificationsSettingsPage = lazy(
  () => import('./pages/AdminNotificationsSettingsPage.jsx'),
)
const AdminVerificationRequestsPage = lazy(
  () => import('./pages/AdminVerificationRequestsPage.jsx'),
)
const SimpleInfoPage = lazy(() => import('./pages/SimpleInfoPage.jsx'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage.jsx'))
const PostDetailModal = lazy(() => import('./features/posts/PostDetailModal.jsx'))
const AdminLayout = lazy(() => import('./layouts/AdminLayout.jsx'))

function LegacyVerificationRedirect() {
  const { lang = 'tr' } = useParams()
  return <Navigate to={`/${lang}/profile`} replace />
}

function RouteFallback({ overlay = false }) {
  if (overlay) {
    return (
      <div
        className="fixed inset-0 z-50 bg-zinc-950/45 px-4 py-4 backdrop-blur-sm"
        role="status"
        aria-live="polite"
      >
        <div className="mx-auto flex h-full w-full max-w-[min(1200px,calc(100vw-2rem))] items-center justify-center rounded-[32px] border border-white/10 bg-white/92 shadow-2xl dark:border-white/10 dark:bg-zinc-950/92">
          <div className="flex items-center gap-3 text-sm font-medium text-zinc-500 dark:text-zinc-300">
            <span className="size-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-white" />
            Yükleniyor...
          </div>
        </div>
      </div>
    )
  }

  return (
    <main
      className="min-h-screen bg-zinc-50 px-4 py-10 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="mx-auto flex max-w-3xl items-center justify-center rounded-[32px] border border-zinc-200 bg-white/90 px-6 py-20 shadow-sm dark:border-white/10 dark:bg-zinc-900/85">
        <div className="flex items-center gap-3 text-sm font-medium text-zinc-500 dark:text-zinc-300">
          <span className="size-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-white" />
          Sayfa hazırlanıyor...
        </div>
      </div>
    </main>
  )
}

function App() {
  const location = useLocation()
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
    <>
      {shouldNoindex ? (
        <Helmet>
          <meta name="robots" content="noindex,nofollow" />
        </Helmet>
      ) : null}

      <Suspense fallback={<RouteFallback />}>
        <Routes location={backgroundLocation || location}>
          <Route path="/" element={<RootLanguageRedirect />} />

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
              element={
                <SimpleInfoPage
                  pageKey="hiddenProfile"
                  title="Hidden Profile"
                  description="This page will hold privacy visibility controls and account discovery options."
                />
              }
            />
            <Route
              path="monetization"
              element={
                <SimpleInfoPage
                  pageKey="monetization"
                  title="Monetization"
                  description="Creator earnings, payouts, and eligibility tracking will live on this screen."
                />
              }
            />
            <Route
              path="about"
              element={
                <SimpleInfoPage
                  pageKey="about"
                  title="About"
                  description="Company story, mission, and platform overview content will be listed here."
                />
              }
            />
            <Route
              path="contact"
              element={
                <SimpleInfoPage
                  pageKey="contact"
                  title="Contact"
                  description="Support, business, and general contact channels will be gathered here."
                />
              }
            />
            <Route
              path="ads"
              element={
                <SimpleInfoPage
                  pageKey="ads"
                  title="Advertising"
                  description="Advertising packages, audience reach, and campaign entry points will be shown here."
                />
              }
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
    </>
  )
}

export default App
