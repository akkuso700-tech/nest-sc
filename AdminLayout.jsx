import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useParams } from 'react-router-dom'
import Seo from '../components/seo/Seo.jsx'
import { useAuth } from '../store/AuthContext.jsx'
import { getAvatarLabel, getFullName } from '../utils/social.js'

function AdminNavLink({ to, label, shortLabel }) {
  return (
    <NavLink
      to={to}
      end={to.endsWith('/admin')}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${
          isActive
            ? 'bg-amber-400 text-zinc-950'
            : 'text-zinc-300 hover:bg-white/10 hover:text-white'
        }`
      }
    >
      <span className="grid size-9 place-items-center rounded-xl bg-white/10 text-xs font-bold">
        {shortLabel}
      </span>
      <span>{label}</span>
    </NavLink>
  )
}

function AdminSubNavLink({ to, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${
          isActive
            ? 'bg-amber-400 text-zinc-950'
            : 'text-zinc-300 hover:bg-white/10 hover:text-white'
        }`
      }
    >
      <span className="size-1.5 rounded-full bg-current" />
      <span>{label}</span>
    </NavLink>
  )
}

function AdminLayout() {
  const { lang } = useParams()
  const location = useLocation()
  const { user } = useAuth()
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const isSettingsRoute = location.pathname.includes(`/${lang}/admin/settings/`)

  useEffect(() => {
    if (isSettingsRoute) {
      setIsSettingsOpen(true)
    }
  }, [isSettingsRoute])

  return (
    <>
      <Seo
        title="My Social 1 - Yonetim Paneli"
        description="Kullanici analizi, moderasyon ve platform operasyonlari icin yonetim paneli."
      />

      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#1f2937_0%,#111827_35%,#f8f7f2_35%,#f5f5f4_100%)] text-zinc-900">
        <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col gap-5 px-4 py-4 lg:flex-row lg:px-6">
          <aside className="w-full shrink-0 rounded-[32px] border border-white/10 bg-zinc-950/95 p-5 text-white shadow-2xl lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] lg:w-[290px]">
            <div className="flex items-center gap-3 border-b border-white/10 pb-5">
              <div className="grid size-12 place-items-center rounded-2xl bg-amber-400 text-sm font-bold text-zinc-950">
                AD
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Yonetim Konsolu</p>
                <p className="text-xs text-zinc-400">My Social 1 Operasyonlari</p>
              </div>
            </div>

            <div className="mt-5 rounded-[24px] border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                Oturum
              </p>
              <div className="mt-3 flex items-center gap-3">
                <div className="grid size-10 place-items-center rounded-full bg-white text-sm font-semibold text-zinc-950">
                  {getAvatarLabel(user)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{getFullName(user)}</p>
                  <p className="text-xs text-zinc-400">@{user?.username}</p>
                </div>
              </div>
            </div>

            <nav className="mt-6 space-y-2">
              <AdminNavLink to={`/${lang}/admin`} label="Genel Bakis" shortLabel="GB" />
              <AdminNavLink to={`/${lang}/admin/users`} label="Kullanicilar" shortLabel="KL" />
              <AdminNavLink to={`/${lang}/admin/content`} label="Icerikler" shortLabel="IC" />
              <AdminNavLink to={`/${lang}/admin/comments`} label="Yorumlar" shortLabel="YR" />
              <AdminNavLink to={`/${lang}/admin/reports`} label="Raporlar" shortLabel="RP" />
              <AdminNavLink to={`/${lang}/admin/audit-logs`} label="Islem Kayitlari" shortLabel="LK" />

              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen((current) => !current)}
                  className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${
                    isSettingsRoute
                      ? 'bg-amber-400 text-zinc-950'
                      : 'text-zinc-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span className="grid size-9 place-items-center rounded-xl bg-white/10 text-xs font-bold">
                    AY
                  </span>
                  <span className="flex-1 text-left">Ayarlar</span>
                  <span className={`text-xs transition ${isSettingsOpen ? 'rotate-180' : ''}`}>
                    v
                  </span>
                </button>

                {isSettingsOpen ? (
                  <div className="mt-2 space-y-1 pl-14">
                    <AdminSubNavLink
                      to={`/${lang}/admin/settings/contracts`}
                      label="Sozlesmeler"
                    />
                  </div>
                ) : null}
              </div>
            </nav>
          </aside>

          <div className="min-w-0 flex-1">
            <header className="rounded-[32px] border border-zinc-200 bg-white/90 px-6 py-5 shadow-sm backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
                Platform Kontrolu
              </p>
              <div className="mt-2 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <h1 className="text-3xl font-bold tracking-tight text-zinc-950">
                    Yonetim paneli
                  </h1>
                  <p className="mt-1 text-sm text-zinc-500">
                    Kullanici buyumesi, moderasyon, icerik durumu ve operasyon gorunurlugu.
                  </p>
                </div>
              </div>
            </header>

            <main className="mt-5">
              <Outlet />
            </main>
          </div>
        </div>
      </div>
    </>
  )
}

export default AdminLayout
