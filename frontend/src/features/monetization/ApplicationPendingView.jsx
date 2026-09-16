import { useTranslation } from 'react-i18next'
import {
  ClockIcon,
  ShieldCheckIcon,
  FilmIcon,
  GiftIcon,
  UsersIcon,
  UserCheckIcon,
  BadgeCheckIcon,
} from './MonetizationIcons.jsx'

export function ApplicationPendingView({
  user,
  application,
  onSwitchToDemo,
}) {
  const { t } = useTranslation()

  return (
    <div className="space-y-3">
      {/* 2. Başvuru Değerlendiriliyor Durum Ekranı */}
      <section className="relative overflow-hidden rounded-none border-x-0 sm:border-x sm:rounded-md border border-amber-500/30 bg-gradient-to-br from-card via-card to-amber-500/5 p-6 md:p-8 shadow-sm space-y-6">
        <div className="absolute -right-12 -top-12 size-64 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/15 px-3.5 py-1 text-xs font-bold text-amber-600 dark:text-amber-400">
            <ClockIcon className="size-3.5" />
            <span>Başvuru Değerlendiriliyor</span>
          </div>

          <h1 className="text-xl font-bold tracking-tight text-text md:text-2xl">
            İçerik Üretici Başvurunuz İnceleniyor
          </h1>

          <p className="text-sm leading-relaxed text-muted md:text-base">
            Başvurunuz başarıyla sisteme ulaştı ve yönetim ekibimizin değerlendirme kuyruğuna iletildi.
          </p>

          <div className="rounded-none sm:rounded-md border border-border bg-secondary/40 p-4 text-xs leading-relaxed text-muted space-y-2">
            <p className="flex items-center gap-2 font-semibold text-text">
              <ShieldCheckIcon className="size-4 text-primary" />
              <span>Sıradaki Aşama Hakkında Bilgilendirme:</span>
            </p>
            <p>
              Yönetici başvurunuzu onayladığı anda <strong>Uygunluk Bölümü</strong> açılacak; <strong>30 Günlük Gösterim / İzlenme</strong> ve <strong>Hesap Güvenliği (En az 14 Gün)</strong> sayaçlarınız admin onay tarihinden itibaren işlemeye başlayacaktır.
            </p>
          </div>

          {onSwitchToDemo ? (
            <div className="pt-2">
              <button
                type="button"
                onClick={onSwitchToDemo}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-text transition hover:bg-secondary-hover cursor-pointer"
              >
                <span>✨</span>
                <span>Üretici Kokpiti Canlı Önizleme</span>
              </button>
            </div>
          ) : null}
        </div>
      </section>


      {/* 4. Açılacak Gelir Kanalları Ön Bilgilendirmesi - Mobilde Yatay Kaydırmalı */}
      <section className="flex overflow-x-auto snap-x snap-mandatory gap-3 px-4 py-1 no-scrollbar sm:grid sm:grid-cols-2 sm:px-0 sm:py-0 lg:grid-cols-4 opacity-85 sm:snap-none sm:overflow-visible">
        <div className="w-[240px] shrink-0 snap-start rounded-none sm:rounded-md border border-border bg-card p-4 shadow-xs sm:w-auto sm:shrink">
          <div className="mb-2 inline-flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
            <FilmIcon className="size-4" />
          </div>
          <h3 className="text-xs font-bold text-text">Loop Fonu</h3>
          <p className="mt-1 text-[11px] text-muted">Onay sonrası izlenme hasılatı.</p>
        </div>

        {/* Bahşişler & Hediyeler */}
        <div className="w-[240px] shrink-0 snap-start rounded-none sm:rounded-md border border-border bg-card p-4 shadow-xs sm:w-auto sm:shrink">
          <div className="mb-2 flex items-center justify-between">
            <div className="inline-flex size-8 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-500">
              <GiftIcon className="size-4" />
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 border border-sky-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-sky-600 dark:text-sky-400">
              <BadgeCheckIcon className="size-3 text-sky-500 shrink-0" />
              <span>{t('creatorStudio.streams.verifiedOnlyBadge', 'Onaylı Profillere Özel')}</span>
            </span>
          </div>
          <h3 className="text-xs font-bold text-text">Bahşişler & Hediyeler</h3>
          <p className="mt-1 text-[11px] text-muted">Takipçilerden doğrudan destek.</p>
        </div>

        {/* Özel Gruplar */}
        <div className="w-[240px] shrink-0 snap-start rounded-none sm:rounded-md border border-border bg-card p-4 shadow-xs sm:w-auto sm:shrink">
          <div className="mb-2 flex items-center justify-between">
            <div className="inline-flex size-8 items-center justify-center rounded-md bg-indigo-500/10 text-indigo-500">
              <UsersIcon className="size-4" />
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 border border-sky-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-sky-600 dark:text-sky-400">
              <BadgeCheckIcon className="size-3 text-sky-500 shrink-0" />
              <span>{t('creatorStudio.streams.verifiedOnlyBadge', 'Onaylı Profillere Özel')}</span>
            </span>
          </div>
          <h3 className="text-xs font-bold text-text">Özel Gruplar</h3>
          <p className="mt-1 text-[11px] text-muted">VIP ücretli abonelik toplulukları.</p>
        </div>

        {/* Profil Aboneliği */}
        <div className="w-[240px] shrink-0 snap-start rounded-none sm:rounded-md border border-border bg-card p-4 shadow-xs sm:w-auto sm:shrink">
          <div className="mb-2 flex items-center justify-between">
            <div className="inline-flex size-8 items-center justify-center rounded-md bg-purple-500/10 text-purple-600">
              <UserCheckIcon className="size-4" />
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 border border-sky-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-sky-600 dark:text-sky-400">
              <BadgeCheckIcon className="size-3 text-sky-500 shrink-0" />
              <span>{t('creatorStudio.streams.verifiedOnlyBadge', 'Onaylı Profillere Özel')}</span>
            </span>
          </div>
          <h3 className="text-xs font-bold text-text">Profil Aboneliği</h3>
          <p className="mt-1 text-[11px] text-muted">Aylık profil aboneliği ve rozetler.</p>
        </div>
      </section>
    </div>
  )
}

export default ApplicationPendingView
