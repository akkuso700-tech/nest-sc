import { Link } from 'react-router-dom'
import UserAvatar from '../common/UserAvatar.jsx'
import { formatLocation, formatRelativeTime, getFullName } from '../../utils/social.js'
import {
  SectionCard,
  DetailRow,
  CopyButton,
  formatBrowserLanguage,
} from './AdminUserDetailCommon.jsx'

export function AdminUserDetailOverviewTab({
  user,
  posts = [],
  consent = {},
  activity = {},
  discovery = {},
  userAge,
  uaInfo,
  totalEngagements = 0,
  lang = 'tr',
  setActiveTab,
}) {
  return (
    <div className="space-y-6">
      {/* Account Lifecycle & Milestone Pipeline */}
      <section className="rounded-3xl border border-zinc-200/80 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 pb-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-400">Yaşam Döngüsü</p>
            <h3 className="text-base font-bold text-zinc-950">Hesap Gelişim & Denetim Çizelgesi</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
              Durum: {user.accountStatus === 'active' ? 'Aktif Üye' : 'Askıda'}
            </span>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {/* Step 1: Kayıt */}
          <div className="relative flex flex-col justify-between rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 transition-all hover:bg-emerald-50/70">
            <div className="flex items-center justify-between">
              <span className="text-lg">📝</span>
              <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">✓ Tamam</span>
            </div>
            <div className="mt-3">
              <p className="text-xs font-bold text-zinc-900">Hesap Oluşturuldu</p>
              <p className="mt-0.5 text-[11px] text-zinc-500">
                {new Date(user.createdAt).toLocaleDateString('tr-TR')}
              </p>
              <p className="mt-1 text-[10px] font-medium text-emerald-700">
                {consent.acceptedAt ? 'KVKK Onaylı Kayıt' : 'Standart Kayıt'}
              </p>
            </div>
          </div>

          {/* Step 2: E-posta */}
          <div
            className={`relative flex flex-col justify-between rounded-2xl border p-4 transition-all ${
              user.emailVerifiedAt
                ? 'border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50/70'
                : 'border-amber-200 bg-amber-50/40 hover:bg-amber-50/70'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-lg">✉️</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  user.emailVerifiedAt ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'
                }`}
              >
                {user.emailVerifiedAt ? '✓ Onaylı' : 'Bekliyor'}
              </span>
            </div>
            <div className="mt-3">
              <p className="text-xs font-bold text-zinc-900">E-posta Doğrulama</p>
              <p className="mt-0.5 truncate text-[11px] text-zinc-500" title={user.email}>
                {user.email}
              </p>
              <p
                className={`mt-1 text-[10px] font-medium ${
                  user.emailVerifiedAt ? 'text-emerald-700' : 'text-amber-700'
                }`}
              >
                {user.emailVerifiedAt
                  ? `Onay: ${new Date(user.emailVerifiedAt).toLocaleDateString('tr-TR')}`
                  : 'Aktivasyon Linki Bekliyor'}
              </p>
            </div>
          </div>

          {/* Step 3: Gönderi Paylaşımı */}
          <div
            className={`relative flex flex-col justify-between rounded-2xl border p-4 transition-all ${
              posts.length > 0
                ? 'border-indigo-200 bg-indigo-50/40 hover:bg-indigo-50/70'
                : 'border-zinc-200 bg-zinc-50/60 hover:bg-zinc-50'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-lg">📸</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  posts.length > 0 ? 'bg-indigo-600 text-white' : 'bg-zinc-200 text-zinc-600'
                }`}
              >
                {posts.length > 0 ? `${posts.length} Gönderi` : '0 İçerik'}
              </span>
            </div>
            <div className="mt-3">
              <p className="text-xs font-bold text-zinc-900">İçerik Üretimi</p>
              <p className="mt-0.5 text-[11px] text-zinc-500">
                {posts.length > 0 ? `Son: ${formatRelativeTime(posts[0].createdAt)}` : 'Henüz Paylaşım Yok'}
              </p>
              <p className="mt-1 text-[10px] font-medium text-zinc-600">
                {activity.likedPostIds?.length || 0} Beğeni / {activity.commentedPostIds?.length || 0} Yorum
              </p>
            </div>
          </div>

          {/* Step 4: Kimlik Doğrulama / Rozet */}
          <div
            className={`relative flex flex-col justify-between rounded-2xl border p-4 transition-all ${
              user.verification?.status === 'approved'
                ? 'border-sky-200 bg-sky-50/40 hover:bg-sky-50/70'
                : user.verification?.status === 'pending'
                ? 'border-amber-200 bg-amber-50/40 hover:bg-amber-50/70'
                : 'border-zinc-200 bg-zinc-50/60 hover:bg-zinc-50'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-lg">🔷</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  user.verification?.status === 'approved'
                    ? 'bg-sky-600 text-white'
                    : user.verification?.status === 'pending'
                    ? 'bg-amber-500 text-white'
                    : 'bg-zinc-200 text-zinc-600'
                }`}
              >
                {user.verification?.status === 'approved'
                  ? 'Doğrulanmış'
                  : user.verification?.status === 'pending'
                  ? 'İncelemede'
                  : 'Standart'}
              </span>
            </div>
            <div className="mt-3">
              <p className="text-xs font-bold text-zinc-900">Doğrulama & Rozet</p>
              <p className="mt-0.5 text-[11px] text-zinc-500">
                {user.verification?.status === 'approved'
                  ? 'Doğrulanmış Profil'
                  : user.verification?.status === 'pending'
                  ? 'Başvuru Değerlendiriliyor'
                  : 'Başvuru Yok'}
              </p>
              <p className="mt-1 text-[10px] font-medium text-zinc-600">
                Rol: {user.role === 'admin' ? 'Admin' : user.role === 'moderator' ? 'Moderatör' : 'Kullanıcı'}
              </p>
            </div>
          </div>

          {/* Step 5: Son Platform Aktivitesi */}
          <div
            className={`relative flex flex-col justify-between rounded-2xl border p-4 transition-all ${
              user.accountStatus === 'suspended'
                ? 'border-rose-200 bg-rose-50/40 hover:bg-rose-50/70'
                : 'border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50/70'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-lg">⚡</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  user.accountStatus === 'suspended' ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'
                }`}
              >
                {user.accountStatus === 'suspended' ? 'Askıda' : 'Aktif'}
              </span>
            </div>
            <div className="mt-3">
              <p className="text-xs font-bold text-zinc-900">Son Aktivite</p>
              <p className="mt-0.5 text-[11px] text-zinc-500">
                {user.lastLoginAt ? formatRelativeTime(user.lastLoginAt) : 'Giriş Kaydı Yok'}
              </p>
              <p
                className={`mt-1 text-[10px] font-medium ${
                  user.accountStatus === 'suspended' ? 'text-rose-700' : 'text-emerald-700'
                }`}
              >
                {user.accountStatus === 'suspended' ? 'Erişim Engellendi' : 'Oturum Açabilir'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Main 2-Column Grid: Profile Details & System Insights */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Card 1: Enhanced Profile Details */}
        <SectionCard
          title="Profil & Temel Kimlik Bilgileri"
          eyebrow="Hesap Özeti"
          subtitle="Kullanıcının beyan ettiği ve sisteme kayıtlı veriler"
          action={
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600">
              ID: {user._id?.slice(-8)}
            </span>
          }
        >
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <DetailRow label="E-posta Adresi" value={user.email} copyValue={user.email} fullWidth />
              <DetailRow
                label="Doğum Tarihi & Yaş"
                value={
                  user.birthDate
                    ? `${new Date(user.birthDate).toLocaleDateString('tr-TR')}${userAge ? ` (${userAge} Yaş)` : ''}`
                    : 'Belirtilmemiş'
                }
              />
              <DetailRow label="Konum / Şehir" value={formatLocation(user.location)} />
              <DetailRow label="Kayıt Tarihi" value={user.createdAt} isDate />
              <DetailRow label="Son Giriş Zamanı" value={user.lastLoginAt} isRelative />
              <DetailRow label="Profil Gizliliği" value={user.isPrivate ? 'Gizli Profil 🔒' : 'Herkese Açık 🌐'} />
              <DetailRow
                label="Giriş Sağlayıcı"
                value={user.authProvider === 'google' ? 'Google OAuth 2.0' : 'Standart E-posta & Şifre'}
              />
            </div>

            {/* Bio Callout Block */}
            <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/70 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Biyografi</span>
                {user.bio ? <CopyButton text={user.bio} label="Metni Kopyala" /> : null}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-zinc-800">
                {user.bio || <span className="italic text-zinc-400">Kullanıcı henüz bir biyografi metni girmedi.</span>}
              </p>
            </div>
          </div>
        </SectionCard>

        {/* Card 2: Smart System, Device & Legal KVKK Audit */}
        <SectionCard
          title="Sistem, Cihaz & KVKK Denetimi"
          eyebrow="Hukuki & Teknik"
          subtitle="Kayıt esnasındaki teknik cihaz ayak izi ve yasal onaylar"
        >
          {consent.acceptedAt ? (
            <div className="space-y-4">
              {/* Device & OS Highlight Tile */}
              <div className="flex items-center gap-3.5 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-2xl shadow-sm">
                  {uaInfo.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-indigo-950">{uaInfo.os}</span>
                    <span>•</span>
                    <span className="text-xs font-semibold text-indigo-800">{uaInfo.browser}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-indigo-600/80">{uaInfo.device} üzerinden kayıt yapıldı</p>
                </div>
                <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-indigo-700 shadow-xs">
                  {consent.version || 'v1.0'}
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <DetailRow label="Kayıt IP Adresi" value={consent.ipAddress} copyValue={consent.ipAddress} />
                <DetailRow
                  label="Kayıt Şehri / Ülkesi"
                  value={
                    consent.city || consent.country
                      ? `${consent.city || 'Şehir Yok'} / ${consent.country || 'Ülke Yok'}`
                      : user.location?.city || user.location?.country
                      ? `${user.location?.city || 'Şehir Yok'} / ${user.location?.country || 'Ülke Yok'} (Profil Konumu)`
                      : 'Tespit Edilemedi'
                  }
                />
                <DetailRow label="KVKK Onay Zamanı" value={consent.acceptedAt} isDate />
                <DetailRow
                  label="Tarayıcı Dili"
                  value={formatBrowserLanguage(consent.browserLanguage || consent.language || 'tr')}
                />
              </div>

              {/* Raw User Agent Box */}
              <div className="rounded-2xl bg-zinc-50 p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Ham User-Agent</span>
                  {consent.userAgent ? <CopyButton text={consent.userAgent} label="UA Kopyala" /> : null}
                </div>
                <p className="mt-1.5 break-all font-mono text-[11px] leading-relaxed text-zinc-600">
                  {consent.userAgent || 'Belirtilmemiş'}
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-zinc-200 p-8 text-center text-sm text-zinc-500">
              Bu kullanıcı için detaylı kayıt onay ve cihaz logu bulunmuyor.
            </div>
          )}
        </SectionCard>
      </div>

      {/* Bottom 2-Column Grid: Analytics & Social Graph */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Card 3: Engagement & Behavioral Analytics */}
        <SectionCard
          title="Kullanıcı Etkileşim Dağılımı"
          eyebrow="Aktivite Analitiği"
          subtitle="Kullanıcının platformdaki toplam içerik ve etkileşim profili"
        >
          <div className="space-y-5">
            {/* 5 Metric Badges */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <div className="rounded-2xl border border-zinc-200/70 bg-zinc-50/70 p-3 text-center">
                <p className="text-[11px] font-semibold text-zinc-500">İncelenen Profil</p>
                <p className="mt-1 text-xl font-bold text-zinc-950">{activity.viewedProfileIds?.length || 0}</p>
              </div>
              <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-3 text-center">
                <p className="text-[11px] font-semibold text-rose-600">Beğenilen</p>
                <p className="mt-1 text-xl font-bold text-rose-700">{activity.likedPostIds?.length || 0}</p>
              </div>
              <div className="rounded-2xl border border-sky-100 bg-sky-50/50 p-3 text-center">
                <p className="text-[11px] font-semibold text-sky-600">Yorum</p>
                <p className="mt-1 text-xl font-bold text-sky-700">{activity.commentedPostIds?.length || 0}</p>
              </div>
              <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-3 text-center">
                <p className="text-[11px] font-semibold text-amber-600">Kaydedilen</p>
                <p className="mt-1 text-xl font-bold text-amber-700">{activity.savedPostIds?.length || 0}</p>
              </div>
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-3 text-center col-span-2 sm:col-span-1">
                <p className="text-[11px] font-semibold text-emerald-600">Paylaşılan</p>
                <p className="mt-1 text-xl font-bold text-emerald-700">{activity.sharedPostIds?.length || 0}</p>
              </div>
            </div>

            {/* Visual Distribution Bar */}
            {totalEngagements > 0 ? (
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-zinc-500 mb-2">
                  <span>Etkileşim Yoğunluk Oranı</span>
                  <span className="text-zinc-900">{totalEngagements} Toplam Aksiyon</span>
                </div>
                <div className="flex h-3 w-full overflow-hidden rounded-full bg-zinc-100">
                  <div
                    style={{ width: `${((activity.likedPostIds?.length || 0) / totalEngagements) * 100}%` }}
                    className="bg-rose-500 transition-all"
                    title={`Beğeniler: ${activity.likedPostIds?.length || 0}`}
                  />
                  <div
                    style={{ width: `${((activity.commentedPostIds?.length || 0) / totalEngagements) * 100}%` }}
                    className="bg-sky-500 transition-all"
                    title={`Yorumlar: ${activity.commentedPostIds?.length || 0}`}
                  />
                  <div
                    style={{ width: `${((activity.savedPostIds?.length || 0) / totalEngagements) * 100}%` }}
                    className="bg-amber-500 transition-all"
                    title={`Kayıtlar: ${activity.savedPostIds?.length || 0}`}
                  />
                  <div
                    style={{ width: `${((activity.viewedProfileIds?.length || 0) / totalEngagements) * 100}%` }}
                    className="bg-indigo-500 transition-all"
                    title={`Profil Gezinme: ${activity.viewedProfileIds?.length || 0}`}
                  />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px] text-zinc-500">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-rose-500" /> Beğeni
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-sky-500" /> Yorum
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-amber-500" /> Kaydetme
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-indigo-500" /> Profil İnceleme
                  </span>
                </div>
              </div>
            ) : null}

            {/* Topic Interests & Recent Searches */}
            {discovery.interestProfile?.topicScores && Object.keys(discovery.interestProfile.topicScores).length > 0 ? (
              <div className="border-t border-zinc-100 pt-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2.5">
                  Öne Çıkan İlgi Alanları
                </p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(discovery.interestProfile.topicScores)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 8)
                    .map(([topic, score]) => (
                      <span
                        key={topic}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-100 bg-indigo-50/70 px-3 py-1 text-xs font-semibold text-indigo-900"
                      >
                        <span>#{topic}</span>
                        <span className="rounded-md bg-indigo-200/80 px-1.5 py-0.2 text-[10px] text-indigo-950 font-bold">
                          {score}
                        </span>
                      </span>
                    ))}
                </div>
              </div>
            ) : null}

            {activity.recentSearches?.length ? (
              <div className="border-t border-zinc-100 pt-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2.5">Son Arama Geçmişi</p>
                <div className="flex flex-wrap gap-2">
                  {activity.recentSearches.map((search, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-700"
                    >
                      <span>🔍</span>
                      <span>{search.query}</span>
                      <span className="text-[10px] text-zinc-400">
                        {formatRelativeTime(search.searchedAt)}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </SectionCard>

        {/* Card 4: Social Network & Graph Preview */}
        <SectionCard
          title="Sosyal Çevre & Bağlantı Ekosistemi"
          eyebrow="Ağ Grafiği"
          subtitle="Kullanıcının arkadaşları ve etkileşime geçtiği profiller"
        >
          <div className="space-y-5">
            {/* Friends List Preview */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Karşılıklı Arkadaşlar ({user.friendIds?.length || 0})
                </span>
              </div>

              {user.friendIds && user.friendIds.length > 0 ? (
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {user.friendIds.slice(0, 6).map((friend) => {
                    const fId = typeof friend === 'object' ? friend._id : friend
                    const fName = typeof friend === 'object' ? getFullName(friend) : 'Kullanıcı'
                    const fUsername = typeof friend === 'object' ? friend.username : ''

                    return (
                      <Link
                        key={fId}
                        to={`/${lang}/admin/users/${fId}`}
                        className="group flex items-center gap-3 rounded-2xl border border-zinc-200/80 bg-zinc-50/50 p-2.5 transition-all hover:border-zinc-300 hover:bg-white hover:shadow-xs"
                      >
                        <UserAvatar
                          user={typeof friend === 'object' ? friend : {}}
                          className="h-9 w-9 text-xs font-bold shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-bold text-zinc-900 group-hover:text-indigo-600">
                            {fName}
                          </p>
                          <p className="truncate text-[11px] text-zinc-400">@{fUsername}</p>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-zinc-200 py-6 text-center text-xs text-zinc-500">
                  Kullanıcının kayıtlı arkadaş bağlantısı bulunmuyor.
                </div>
              )}
            </div>

            {/* Recently Viewed Profiles */}
            {activity.viewedProfileIds && activity.viewedProfileIds.length > 0 ? (
              <div className="border-t border-zinc-100 pt-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">
                  Son Ziyaret Edilen Profiller ({activity.viewedProfileIds.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {activity.viewedProfileIds.slice(0, 8).map((viewed, idx) => {
                    const vId = typeof viewed === 'object' ? viewed._id : viewed
                    const vUsername = typeof viewed === 'object' ? viewed.username : 'kullanıcı'

                    return (
                      <Link
                        key={idx}
                        to={`/${lang}/admin/users/${vId}`}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-semibold text-zinc-700 hover:border-zinc-300 hover:bg-white"
                      >
                        <span>👤</span>
                        <span>@{vUsername}</span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            ) : null}

            {/* Security & Moderation Quick Strip */}
            <div className="border-t border-zinc-100 pt-4 flex flex-wrap items-center justify-between gap-3 text-xs">
              <span className="text-zinc-500">
                Engellenen Kullanıcı Sayısı: <strong className="text-zinc-800">{user.blockedUserIds?.length || 0}</strong>
              </span>
              <button
                type="button"
                onClick={() => setActiveTab('security')}
                className="font-semibold text-indigo-600 hover:underline cursor-pointer"
              >
                Güvenlik & Moderasyon Detayı →
              </button>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  )
}
