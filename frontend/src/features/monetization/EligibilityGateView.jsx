import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  FilmIcon,
  GiftIcon,
  UsersIcon,
  CheckCircleIcon,
  ClockIcon,
  ShieldCheckIcon,
  UserCheckIcon,
  BadgeCheckIcon,
  SparklesIcon,
} from './MonetizationIcons.jsx'
import VerificationModal from '../../components/profile/VerificationModal.jsx'

export function EligibilityGateView({
  statusData,
  onSwitchToDemo,
  onBackToApplication,
  user,
}) {
  const { t } = useTranslation()
  const [showVerificationModal, setShowVerificationModal] = useState(false)

  const criteria = statusData?.criteria || {}
  const application = statusData?.application
  const applicationStatus = statusData?.status || application?.status || 'pending'

  const followersCurrent = criteria?.followers?.current ?? 0
  const followersTarget = criteria?.followers?.target ?? 100
  const followersPercent = Math.min(
    100,
    Math.round((followersCurrent / followersTarget) * 100),
  )

  const viewsCurrent = criteria?.views30d?.current ?? 0
  const viewsTarget = criteria?.views30d?.target ?? 1000
  const viewsPercent = Math.min(
    100,
    Math.round((viewsCurrent / viewsTarget) * 100),
  )

  const accountAgeCurrent = criteria?.accountAge?.current ?? 0
  const accountAgeTarget = criteria?.accountAge?.target ?? 14
  const accountAgePercent = Math.min(
    100,
    Math.round((accountAgeCurrent / accountAgeTarget) * 100),
  )

  const emailVerified = Boolean(criteria?.emailVerified?.met)
  const goodStanding = Boolean(criteria?.goodStanding?.met)
  const isProfileVerified = Boolean(
    criteria?.verifiedProfile?.met ||
      user?.verification?.status === 'approved' ||
      user?.role === 'admin',
  )
  const verificationStatus =
    user?.verification?.status || criteria?.verifiedProfile?.status || 'none'

  const isEligible = Boolean(statusData?.isEligible && isProfileVerified)

  return (
    <div className="space-y-3">
      {/* 2. Başvuru Onay Durumu & Hero Bannerı */}
      <section className="relative overflow-hidden rounded-none border-x-0 sm:border-x sm:rounded-md border border-border bg-card p-6 md:p-8 shadow-sm">
        <div className="absolute -right-12 -top-12 size-64 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <CheckCircleIcon className="size-3.5" />
              <span>
                {applicationStatus === 'rejected'
                  ? t('creatorStudio.eligibility.rejectedBadge', 'Yeniden İncelemede')
                  : t('creatorStudio.eligibility.adminApprovedBadge', 'Başvurunuz Onaylandı')}
              </span>
            </span>

            {application?.reviewedAt ? (
              <span className="text-xs text-muted">
                Onay Tarihi: {new Date(application.reviewedAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            ) : application?.createdAt ? (
              <span className="text-xs text-muted">
                Başvuru: {new Date(application.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            ) : null}
          </div>

          <h1 className="text-xl font-bold tracking-tight text-text">
            {t('creatorStudio.eligibility.trackingTitle', 'Uygunluk & Değerlendirme Takibi')}
          </h1>

          {/* Hızlı Demo & Başvuruya Dönüş Düğmeleri */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            {onSwitchToDemo ? (
              <button
                type="button"
                onClick={onSwitchToDemo}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-text transition hover:bg-secondary-hover cursor-pointer"
              >
                <span>✨</span>
                <span>{t('creatorStudio.demo.badge', 'Üretici Kokpiti Canlı Önizleme')}</span>
              </button>
            ) : null}

            {onBackToApplication ? (
              <button
                type="button"
                onClick={onBackToApplication}
                className="text-xs font-medium text-muted hover:text-text underline cursor-pointer"
              >
                {t('creatorStudio.eligibility.viewAppDetails', '← Başvuru Bilgilerini Gör')}
              </button>
            ) : null}
          </div>
        </div>
      </section>

      {/* 3. 4 Gelir Kaynağı Kartları - Mobilde Yatay Kaydırmalı */}
      <section className="flex overflow-x-auto snap-x snap-mandatory gap-3 px-4 py-1 no-scrollbar sm:grid sm:grid-cols-2 sm:px-0 sm:py-0 lg:grid-cols-4 sm:snap-none sm:overflow-visible">
        {/* Loop Fonu */}
        <div className="w-[270px] shrink-0 snap-start rounded-none sm:rounded-md border border-border bg-card p-5 shadow-xs transition hover:border-border-strong sm:w-auto sm:shrink">
          <div className="mb-3 inline-flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
            <FilmIcon className="size-5" />
          </div>
          <h2 className="text-base font-semibold text-text">
            {t('creatorStudio.streams.loopTitle', 'Loop Fonu')}
          </h2>
          <p className="mt-1.5 text-xs leading-relaxed text-muted">
            {t(
              'creatorStudio.streams.loopDesc',
              'Dikey video izlenmelerinize göre gelir havuzundan pay kazanın.',
            )}
          </p>
        </div>

        {/* Topluluk Bahşişleri & Hediyeler */}
        <div className="w-[270px] shrink-0 snap-start rounded-none sm:rounded-md border border-border bg-card p-5 shadow-xs transition hover:border-border-strong sm:w-auto sm:shrink">
          <div className="mb-3 flex items-center justify-between">
            <div className="inline-flex size-10 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-500">
              <GiftIcon className="size-5" />
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 text-[10px] font-semibold text-sky-600 dark:text-sky-400">
              <BadgeCheckIcon className="size-3.5 text-sky-500 shrink-0" />
              <span>{t('creatorStudio.streams.verifiedOnlyBadge', 'Onaylı Profillere Özel')}</span>
            </span>
          </div>
          <h2 className="text-base font-semibold text-text">
            {t('creatorStudio.streams.tipsTitle', 'Topluluk Bahşişleri & Hediyeler')}
          </h2>
          <p className="mt-1.5 text-xs leading-relaxed text-muted">
            {t(
              'creatorStudio.streams.tipsDesc',
              'Takipçilerinizden doğrudan destek ve bakiye hediyesi alın.',
            )}
          </p>
        </div>

        {/* Özel Gruplar & VIP İçerik */}
        <div className="w-[270px] shrink-0 snap-start rounded-none sm:rounded-md border border-border bg-card p-5 shadow-xs transition hover:border-border-strong sm:w-auto sm:shrink">
          <div className="mb-3 flex items-center justify-between">
            <div className="inline-flex size-10 items-center justify-center rounded-md bg-indigo-500/10 text-indigo-500">
              <UsersIcon className="size-5" />
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 text-[10px] font-semibold text-sky-600 dark:text-sky-400">
              <BadgeCheckIcon className="size-3.5 text-sky-500 shrink-0" />
              <span>{t('creatorStudio.streams.verifiedOnlyBadge', 'Onaylı Profillere Özel')}</span>
            </span>
          </div>
          <h2 className="text-base font-semibold text-text">
            {t('creatorStudio.streams.subscriptionsTitle', 'Özel Gruplar & VIP İçerik')}
          </h2>
          <p className="mt-1.5 text-xs leading-relaxed text-muted">
            {t(
              'creatorStudio.streams.subscriptionsDesc',
              'Özel gruplarınızı aboneliğe açarak düzenli aylık gelir elde edin.',
            )}
          </p>
        </div>

        {/* Profil Aboneliği */}
        <div className="w-[270px] shrink-0 snap-start rounded-none sm:rounded-md border border-border bg-card p-5 shadow-xs transition hover:border-border-strong sm:w-auto sm:shrink">
          <div className="mb-3 flex items-center justify-between">
            <div className="inline-flex size-10 items-center justify-center rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <UserCheckIcon className="size-5" />
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 text-[10px] font-semibold text-sky-600 dark:text-sky-400">
              <BadgeCheckIcon className="size-3.5 text-sky-500 shrink-0" />
              <span>{t('creatorStudio.streams.verifiedOnlyBadge', 'Onaylı Profillere Özel')}</span>
            </span>
          </div>
          <h2 className="text-base font-semibold text-text">
            {t('creatorStudio.streams.profileSubscriptionsTitle', 'Profil Aboneliği')}
          </h2>
          <p className="mt-1.5 text-xs leading-relaxed text-muted">
            {t(
              'creatorStudio.streams.profileSubscriptionsDesc',
              'Profilinizi aboneliğe açarak özel paylaşımlar ve rozetler sunun.',
            )}
          </p>
        </div>
      </section>

      {/* 4. Uygunluk Kriterleri & İlerleme Çubukları */}
      <section className="rounded-none border-x-0 sm:border-x sm:rounded-md border border-border bg-card p-6 shadow-sm space-y-6">
        <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-bold text-text">
              {t('creatorStudio.eligibility.badge', 'Uygunluk')}
            </h2>
            <p className="text-xs text-muted">
              {t(
                'creatorStudio.eligibility.reqSubtitle',
                'Topluluk güvenliği ve içerik kalitesi için belirlenen asgari kriterler',
              )}
            </p>
          </div>
          {isEligible ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <CheckCircleIcon className="size-4" />
              {t('creatorStudio.eligibility.met', 'Tüm Şartlar Karşılandı')}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
              <ClockIcon className="size-4" />
              {t('creatorStudio.eligibility.pending', 'İlerleme Devam Ediyor')}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {/* Takipçi Sayısı */}
          <div className="rounded-none sm:rounded-md border border-border bg-secondary/50 p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-text">
                {t('creatorStudio.eligibility.followersRequirement', 'Takipçi Sayısı')}
              </span>
              <span className="text-xs font-semibold text-muted">
                {followersCurrent} / {followersTarget}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-border">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  followersCurrent >= followersTarget ? 'bg-emerald-500' : 'bg-primary'
                }`}
                style={{ width: `${followersPercent}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-muted">
              <span>Hedef: {followersTarget}</span>
              <span>%{followersPercent}</span>
            </div>
          </div>

          {/* Onay Sonrası İzlenme */}
          <div className="rounded-none sm:rounded-md border border-border bg-secondary/50 p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-text">
                {t('creatorStudio.eligibility.viewsRequirement', 'Onay Sonrası Gösterim / İzlenme')}
              </span>
              <span className="text-xs font-semibold text-muted">
                {viewsCurrent} / {viewsTarget}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-border">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  viewsCurrent >= viewsTarget ? 'bg-emerald-500' : 'bg-primary'
                }`}
                style={{ width: `${viewsPercent}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-muted">
              <span>{t('creatorStudio.eligibility.viewsTargetDesc', 'Onay sonrası içeriklerin izlenmesi')}</span>
              <span>%{viewsPercent}</span>
            </div>
          </div>

          {/* Hesap Güvenliği / Onay Sonrası Süreç */}
          <div className="rounded-none sm:rounded-md border border-border bg-secondary/50 p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-text">
                {t('creatorStudio.eligibility.accountAge', 'Hesap Güvenliği (Onaydan İtibaren 14 Gün)')}
              </span>
              <span className="text-xs font-semibold text-muted">
                {accountAgeCurrent} / {accountAgeTarget} Gün
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-border">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  accountAgeCurrent >= accountAgeTarget ? 'bg-emerald-500' : 'bg-primary'
                }`}
                style={{ width: `${accountAgePercent}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-muted">
              <span>{t('creatorStudio.eligibility.accountAgeTargetDesc', 'Admin onayından sonra asgari 14 gün aktiflik')}</span>
              <span>%{accountAgePercent}</span>
            </div>
          </div>

          {/* Güvenlik & Doğrulama Kontrolleri */}
          <div className="flex flex-col justify-center rounded-none sm:rounded-md border border-border bg-secondary/50 p-4 space-y-2.5">
            {/* Doğrulanmış Profil Şartı */}
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 font-medium text-text">
                <BadgeCheckIcon
                  className={`size-4 ${isProfileVerified ? 'text-sky-500' : 'text-muted'}`}
                />
                {t('creatorStudio.eligibility.verifiedProfileRequirement', 'Doğrulanmış Profil')}
              </span>
              {isProfileVerified ? (
                <span className="flex items-center gap-1 font-semibold text-sky-500">
                  <CheckCircleIcon className="size-3.5" />
                  {t('creatorStudio.eligibility.verifiedProfileMet', 'Onaylandı')}
                </span>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-amber-500">
                    {verificationStatus === 'pending'
                      ? t('creatorStudio.eligibility.verifiedPending', 'İnceleniyor')
                      : t('creatorStudio.eligibility.verifiedProfileMissing', 'Eksik')}
                  </span>
                  {verificationStatus !== 'pending' ? (
                    <button
                      type="button"
                      onClick={() => setShowVerificationModal(true)}
                      className="rounded-md bg-sky-500/10 px-2 py-0.5 text-[11px] font-semibold text-sky-600 hover:bg-sky-500/20 dark:text-sky-400 cursor-pointer"
                    >
                      {t('creatorStudio.eligibility.applyForVerification', 'Başvur')}
                    </button>
                  ) : null}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 text-text">
                <ShieldCheckIcon
                  className={`size-4 ${emailVerified ? 'text-emerald-500' : 'text-muted'}`}
                />
                {t('creatorStudio.eligibility.emailVerified', 'E-posta Doğrulaması')}
              </span>
              <span
                className={`font-semibold ${emailVerified ? 'text-emerald-500' : 'text-amber-500'}`}
              >
                {emailVerified ? 'Doğrulandı' : 'Eksik'}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 text-text">
                <CheckCircleIcon
                  className={`size-4 ${goodStanding ? 'text-emerald-500' : 'text-rose-500'}`}
                />
                {t('creatorStudio.eligibility.goodStanding', 'Topluluk Kuralları Sicili')}
              </span>
              <span
                className={`font-semibold ${goodStanding ? 'text-emerald-500' : 'text-rose-500'}`}
              >
                {goodStanding ? 'Temiz Sicil' : 'İhlal Mevcut'}
              </span>
            </div>
          </div>
        </div>

        {/* Profil Doğrulama Bilgilendirme / Başvuru Kartı */}
        {!isProfileVerified ? (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-none sm:rounded-md border border-sky-500/30 bg-sky-500/5 p-4 text-xs">
            <div className="flex items-start gap-3">
              <BadgeCheckIcon className="size-5 text-sky-500 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-semibold text-text">
                  {t('creatorStudio.eligibility.verifiedBadgeNoticeTitle', 'Doğrulanmış Profil Zorunludur')}
                </p>
                <p className="text-muted leading-relaxed">
                  {t(
                    'creatorStudio.eligibility.verifiedBadgeNoticeDesc',
                    'Topluluk Bahşişleri & Hediyeler, VIP Gruplar ve Profil Abonelikleri gibi gelir kaynaklarını açabilmek için profilinizin doğrulanmış olması şarttır.',
                  )}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowVerificationModal(true)}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-md bg-sky-500 px-3.5 py-1.5 font-semibold !text-white shadow-xs hover:bg-sky-600 cursor-pointer"
            >
              <BadgeCheckIcon className="size-3.5" />
              <span>
                {verificationStatus === 'pending'
                  ? t('creatorStudio.eligibility.viewVerificationStatus', 'Durumu Gör')
                  : t('creatorStudio.eligibility.applyForVerification', 'Doğrulama Başvurusu Yap')}
              </span>
            </button>
          </div>
        ) : null}

        {/* 5. Durum & Sonraki Adımlar Kartı */}
        <div className="rounded-none sm:rounded-md border border-border bg-card p-5">
          {isEligible ? (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <CheckCircleIcon className="size-5 text-emerald-500" />
                  <p className="text-sm font-bold text-text">
                    {t('creatorStudio.eligibility.allMetTitle', 'Kriterlerin Tamamını Sağladınız!')}
                  </p>
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  {t(
                    'creatorStudio.eligibility.allMetDesc',
                    'Başvurunuz ve kriterleriniz doğrulandı. Onay süreciniz tamamlandığında Üretici Stüdyosu kokpitiniz otomatik olarak kullanıma açılacaktır.',
                  )}
                </p>
              </div>
              <span className="shrink-0 rounded-md bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                {t('creatorStudio.eligibility.inApprovalQueue', 'Onay Sırasında')}
              </span>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <ClockIcon className="size-4 text-amber-500" />
                <p className="text-xs font-bold text-text">
                  {t('creatorStudio.eligibility.inProgressTitle', 'Kriterler & Sayaçlar Takip Ediliyor')}
                </p>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                {t(
                  'creatorStudio.eligibility.inProgressDesc',
                  'Admin başvurunuzu onayladı. Onay tarihinizden itibaren 14 günlük güvenlik süresi, izlenme sayaçları ve profil doğrulamanız tamamlandığında Üretici Stüdyosu tam erişime açılacaktır.',
                )}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Profil Doğrulama Başvuru / Durum Modalı */}
      {showVerificationModal ? (
        <VerificationModal
          open={showVerificationModal}
          user={user}
          onClose={() => setShowVerificationModal(false)}
        />
      ) : null}
    </div>
  )
}

export default EligibilityGateView
