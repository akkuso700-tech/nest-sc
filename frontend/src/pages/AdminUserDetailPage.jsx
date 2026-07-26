import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import ActionToast from '../components/feedback/ActionToast.jsx'
import ConfirmActionDialog from '../components/feedback/ConfirmActionDialog.jsx'
import {
  getAdminUserDetail,
  updateAdminUserRole,
  updateAdminUserStatus,
} from '../services/adminService.js'
import { formatLocation, formatRelativeTime, getFullName } from '../utils/social.js'

function EntityList({ title, items, renderItem, emptyLabel }) {
  return (
    <section className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-zinc-950">{title}</h2>
      <div className="mt-4 space-y-3">
        {items.length ? (
          items.map(renderItem)
        ) : (
          <div className="rounded-2xl border border-dashed border-zinc-200 px-4 py-5 text-sm text-zinc-500">
            {emptyLabel}
          </div>
        )}
      </div>
    </section>
  )
}

function AdminUserDetailPage() {
  const { lang, userId } = useParams()
  const [state, setState] = useState({
    data: null,
    isLoading: true,
    error: '',
  })
  const [selectedRole, setSelectedRole] = useState('user')
  const [isSavingRole, setIsSavingRole] = useState(false)
  const [toast, setToast] = useState({ message: '', tone: 'success' })
  const [statusDialog, setStatusDialog] = useState(null)
  const [isSavingStatus, setIsSavingStatus] = useState(false)

  useEffect(() => {
    if (!toast.message) {
      return undefined
    }

    const timer = window.setTimeout(() => {
      setToast({ message: '', tone: 'success' })
    }, 2600)

    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    let cancelled = false

    async function loadUserDetail() {
      setState({
        data: null,
        isLoading: true,
        error: '',
      })

      try {
        const payload = await getAdminUserDetail(userId)

        if (cancelled) {
          return
        }

        setSelectedRole(payload.user.role)
        setState({
          data: payload,
          isLoading: false,
          error: '',
        })
      } catch (error) {
        if (cancelled) {
          return
        }

        setState({
          data: null,
          isLoading: false,
          error: error.message || 'Kullanici detayi yuklenemedi.',
        })
      }
    }

    loadUserDetail()

    return () => {
      cancelled = true
    }
  }, [userId])

  async function handleRoleUpdate() {
    if (!state.data?.user || selectedRole === state.data.user.role) {
      return
    }

    setIsSavingRole(true)

    try {
      const payload = await updateAdminUserRole(userId, selectedRole)

      setState((currentState) => ({
        ...currentState,
        data: {
          ...currentState.data,
          user: payload.user,
        },
      }))
      setToast({ message: 'Rol basariyla guncellendi.', tone: 'success' })
    } catch (error) {
      setToast({
        message: error.message || 'Rol guncellenemedi.',
        tone: 'error',
      })
    } finally {
      setIsSavingRole(false)
    }
  }

  function handleStatusUpdate(nextStatus) {
    if (!state.data?.user || nextStatus === state.data.user.accountStatus) {
      return
    }

    setStatusDialog({
      nextStatus,
      title:
        nextStatus === 'suspended'
          ? 'Bu kullaniciyi askiya al'
          : 'Bu kullaniciyi yeniden aktif et',
      description:
        nextStatus === 'suspended'
          ? 'Bu hesap auth, feed ve socket akislarinda erisimini kaybeder.'
          : 'Bu islem kullanicinin erisimini geri acar.',
    })
  }

  async function confirmStatusUpdate(reason) {
    if (!statusDialog) {
      return
    }

    setIsSavingStatus(true)

    try {
      const payload = await updateAdminUserStatus(userId, {
        accountStatus: statusDialog.nextStatus,
        reason,
      })

      setState((currentState) => ({
        ...currentState,
        data: {
          ...currentState.data,
          user: payload.user,
        },
      }))
      setToast({ message: payload.message, tone: 'success' })
      setStatusDialog(null)
    } catch (error) {
      setToast({
        message: error.message || 'Hesap durumu guncellenemedi.',
        tone: 'error',
      })
    } finally {
      setIsSavingStatus(false)
    }
  }

  if (state.isLoading) {
    return (
      <div className="rounded-[28px] border border-zinc-200 bg-white px-5 py-6 text-sm text-zinc-500 shadow-sm">
        Kullanici detayi yukleniyor...
      </div>
    )
  }

  if (state.error) {
    return (
      <div className="rounded-[28px] border border-rose-200 bg-rose-50 px-5 py-6 text-sm text-rose-600 shadow-sm">
        {state.error}
      </div>
    )
  }

  const { user, posts, conversations, messages, locationLogs } = state.data
  const activity = user.activity || {}

  return (
    <>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <Link
            to={`/${lang}/admin/users`}
            className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm"
          >
            Kullanicilara Don
          </Link>
        </div>

        <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
                  Kullanici Detayi
                </p>
                <h2 className="mt-2 text-2xl font-bold text-zinc-950">{getFullName(user)}</h2>
                <p className="mt-1 text-sm text-zinc-500">@{user.username}</p>
              </div>

              <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
                  Rol Yonetimi
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <select
                    value={selectedRole}
                    onChange={(event) => setSelectedRole(event.target.value)}
                    className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none"
                  >
                    <option value="user">kullanici</option>
                    <option value="moderator">moderator</option>
                    <option value="admin">admin</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleRoleUpdate}
                    disabled={isSavingRole}
                    className="rounded-full bg-zinc-950 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
                  >
                    {isSavingRole ? 'Kaydediliyor...' : 'Rolu Guncelle'}
                  </button>
                </div>
              </div>

              <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
                  Moderasyon
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      user.accountStatus === 'suspended'
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {user.accountStatus === 'suspended' ? 'askida' : 'aktif'}
                  </span>
                  {user.accountStatus === 'active' ? (
                    <button
                      type="button"
                      onClick={() => handleStatusUpdate('suspended')}
                      disabled={isSavingStatus}
                      className="rounded-full bg-rose-600 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-rose-300"
                    >
                      {isSavingStatus ? 'Kaydediliyor...' : 'Kullaniciyi Askiya Al'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleStatusUpdate('active')}
                      disabled={isSavingStatus}
                      className="rounded-full bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-emerald-300"
                    >
                      {isSavingStatus ? 'Kaydediliyor...' : 'Kullaniciyi Aktif Et'}
                    </button>
                  )}
                </div>
                {user.moderation?.reason ? (
                  <p className="mt-3 text-sm text-zinc-500">
                    Neden: {user.moderation.reason}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-[24px] bg-zinc-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">Iletisim</p>
                <p className="mt-2 text-sm text-zinc-700">{user.email}</p>
              </div>
              <div className="rounded-[24px] bg-zinc-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">Konum</p>
                <p className="mt-2 text-sm text-zinc-700">{formatLocation(user.location)}</p>
              </div>
              <div className="rounded-[24px] bg-zinc-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">Dogum Tarihi</p>
                <p className="mt-2 text-sm text-zinc-700">{new Date(user.birthDate).toLocaleDateString()}</p>
              </div>
              <div className="rounded-[24px] bg-zinc-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">Son Giris</p>
                <p className="mt-2 text-sm text-zinc-700">{user.lastLoginAt ? formatRelativeTime(user.lastLoginAt) : 'Hic'}</p>
              </div>
              <div className="rounded-[24px] bg-zinc-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">Kayit Tarihi</p>
                <p className="mt-2 text-sm text-zinc-700">{new Date(user.createdAt).toLocaleDateString()}</p>
              </div>
              <div className="rounded-[24px] bg-zinc-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">Arkadaslar</p>
                <p className="mt-2 text-sm text-zinc-700">{user.friendIds?.length || 0}</p>
              </div>
              <div className="rounded-[24px] bg-zinc-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">Konum Izni</p>
                <p className="mt-2 text-sm text-zinc-700">{user.discovery?.locationConsent?.status || 'unknown'}</p>
              </div>
              <div className="rounded-[24px] bg-zinc-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">Yakindaki Kisi Kullanimi</p>
                <p className="mt-2 text-sm text-zinc-700">{user.discovery?.nearbyDiscoveryUsageCount || 0}</p>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-zinc-950">Aktivite Ozeti</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[24px] bg-zinc-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">Incelenen Profiller</p>
                <p className="mt-2 text-2xl font-bold text-zinc-950">{activity.viewedProfileIds?.length || 0}</p>
              </div>
              <div className="rounded-[24px] bg-zinc-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">Begenilen Gonderiler</p>
                <p className="mt-2 text-2xl font-bold text-zinc-950">{activity.likedPostIds?.length || 0}</p>
              </div>
              <div className="rounded-[24px] bg-zinc-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">Yorum Yapilan Gonderiler</p>
                <p className="mt-2 text-2xl font-bold text-zinc-950">{activity.commentedPostIds?.length || 0}</p>
              </div>
              <div className="rounded-[24px] bg-zinc-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">Kaydedilen Gonderiler</p>
                <p className="mt-2 text-2xl font-bold text-zinc-950">{activity.savedPostIds?.length || 0}</p>
              </div>
              <div className="rounded-[24px] bg-zinc-50 p-4 sm:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">Paylasilan Gonderiler</p>
                <p className="mt-2 text-2xl font-bold text-zinc-950">{activity.sharedPostIds?.length || 0}</p>
              </div>
            </div>
          </section>
        </section>

        <section className="grid gap-5 xl:grid-cols-2">
          <EntityList
            title="Son Gonderiler"
            items={posts}
            emptyLabel="Bu kullanici henuz gonderi paylasmadi."
            renderItem={(item) => (
              <div key={item._id} className="rounded-2xl bg-zinc-50 px-4 py-3">
                <p className="text-sm font-medium text-zinc-800">{item.text || 'Sadece medya iceren gonderi'}</p>
                <p className="mt-2 text-xs text-zinc-500">
                  {new Date(item.createdAt).toLocaleString()} - Begeni {item.stats?.likes || 0} - Yorum {item.stats?.comments || 0}
                </p>
              </div>
            )}
          />

          <EntityList
            title="Son Konusmalar"
            items={conversations}
            emptyLabel="Bu kullanici icin konusma kaydi yok."
            renderItem={(item) => (
              <div key={item._id} className="rounded-2xl bg-zinc-50 px-4 py-3">
                <p className="text-sm font-medium text-zinc-800">{item.lastMessagePreview || 'Mesaj onizlemesi yok'}</p>
                <p className="mt-2 text-xs text-zinc-500">Guncellenme {new Date(item.updatedAt).toLocaleString()}</p>
              </div>
            )}
          />
        </section>

        <section className="grid gap-5 xl:grid-cols-2">
          <EntityList
            title="Son Yaklasik Konum"
            items={user.discovery?.lastApproxLocation?.latRounded !== null ? [user.discovery.lastApproxLocation] : []}
            emptyLabel="Bu kullanici icin kayitli yaklasik konum yok."
            renderItem={(item) => (
              <div key={`${item.latRounded}-${item.lngRounded}-${item.lastSeenAt || 'none'}`} className="rounded-2xl bg-zinc-50 px-4 py-3">
                <p className="text-sm font-medium text-zinc-800">
                  {item.city || 'Sehir yok'} / {item.country || 'Ulke yok'}
                </p>
                <p className="mt-2 text-xs text-zinc-500">
                  Lat {item.latRounded ?? '-'} · Lng {item.lngRounded ?? '-'} · Accuracy {item.accuracy ?? '-'}m
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Son gorulme {item.lastSeenAt ? new Date(item.lastSeenAt).toLocaleString() : 'yok'}
                </p>
              </div>
            )}
          />

          <EntityList
            title="Son Tam GPS Konumu"
            items={user.discovery?.lastExactLocation?.latitude !== null ? [user.discovery.lastExactLocation] : []}
            emptyLabel="Bu kullanici icin kayitli tam GPS konumu yok."
            renderItem={(item) => (
              <div key={`${item.latitude}-${item.longitude}-${item.lastSeenAt || 'none'}`} className="rounded-2xl bg-zinc-50 px-4 py-3">
                <p className="text-sm font-medium text-zinc-800">
                  {item.city || 'Sehir yok'} / {item.country || 'Ulke yok'}
                </p>
                <p className="mt-2 text-xs text-zinc-500">
                  Lat {item.latitude ?? '-'} · Lng {item.longitude ?? '-'} · Accuracy {item.accuracy ?? '-'}m
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Son gorulme {item.lastSeenAt ? new Date(item.lastSeenAt).toLocaleString() : 'yok'}
                </p>
              </div>
            )}
          />
        </section>

        <section className="grid gap-5 xl:grid-cols-2">

          <EntityList
            title="Konum Riza Gecmisi"
            items={locationLogs || []}
            emptyLabel="Konum izni gecmisi henuz yok."
            renderItem={(item) => (
              <div key={item._id} className="rounded-2xl bg-zinc-50 px-4 py-3">
                <p className="text-sm font-medium text-zinc-800">
                  {item.status} · {item.source}
                </p>
                <p className="mt-2 text-xs text-zinc-500">
                  {item.city || 'Sehir yok'} / {item.country || 'Ulke yok'} · GPS {item.latitude ?? '-'} / {item.longitude ?? '-'} · Approx {item.latRounded ?? '-'} / {item.lngRounded ?? '-'}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  {new Date(item.consentGivenAt || item.createdAt).toLocaleString()}
                </p>
              </div>
            )}
          />
        </section>

        <section className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-950">Mesaj Arsivi</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Kullanici kendi kutusunda bir mesaji silse bile admin kayitlari burada gorunmeye devam eder.
          </p>
          <div className="mt-4 space-y-3">
            {messages.length ? (
              messages.map((item) => (
                <div key={item._id} className="rounded-2xl bg-zinc-50 px-4 py-3">
                  <p className="text-sm font-medium text-zinc-800">{item.text || 'Sadece medya iceren mesaj'}</p>
                  <p className="mt-2 text-xs text-zinc-500">
                    {new Date(item.createdAt).toLocaleString()} - Medya {item.media?.length || 0}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-zinc-200 px-4 py-5 text-sm text-zinc-500">
                Bu kullanici icin henuz mesaj kaydi yok.
              </div>
            )}
          </div>
        </section>
      </div>

      <ConfirmActionDialog
        open={Boolean(statusDialog)}
        title={statusDialog?.title}
        description={statusDialog?.description}
        confirmLabel={
          statusDialog?.nextStatus === 'suspended'
            ? 'Kullaniciyi Askiya Al'
            : 'Kullaniciyi Aktif Et'
        }
        confirmTone={statusDialog?.nextStatus === 'suspended' ? 'danger' : 'default'}
        reasonLabel="Moderator notu"
        reasonPlaceholder="Islem kaydi icin istege bagli not"
        isProcessing={isSavingStatus}
        onCancel={() => {
          if (!isSavingStatus) {
            setStatusDialog(null)
          }
        }}
        onConfirm={confirmStatusUpdate}
      />

      <ActionToast
        toast={toast}
        onClose={() => setToast({ message: '', tone: 'success' })}
      />
    </>
  )
}

export default AdminUserDetailPage
