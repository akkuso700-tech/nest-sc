import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import UserAvatar from '../../components/common/UserAvatar.jsx'
import {
  FilmIcon,
  GiftIcon,
  UsersIcon,
  UserCheckIcon,
  ArrowUpRightIcon,
  BadgeCheckIcon,
} from './MonetizationIcons.jsx'

const CONTENT_CATEGORIES = [
  'Eğlence & Mizah',
  'Yaşam & Vlog',
  'Teknoloji & Yazılım',
  'Eğitim & Bilim',
  'Sanat & Tasarım',
  'Oyun & Espor',
  'Müzik & Sahne',
  'Spor & Fitness',
  'Diğer',
]

export function CreatorApplicationView({
  user,
  onApply,
  isApplying,
  onViewEligibility,
  onSwitchToDemo,
}) {
  const { t } = useTranslation()
  const [selectedCategory, setSelectedCategory] = useState(CONTENT_CATEGORIES[0])
  const [statement, setStatement] = useState('')
  const [agreeTerms, setAgreeTerms] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!agreeTerms || isApplying) return
    const fullStatement = `[Kategori: ${selectedCategory}] ${statement}`.trim()
    await onApply(fullStatement)
  }

  return (
    <div className="space-y-8">
      {/* 1. Süreç Adımları (Step Indicator) */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {/* Adım 1 - Aktif */}
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-xs">
            <span className="grid size-7 place-items-center rounded-full bg-primary text-xs font-bold !text-white shrink-0">
              1
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-text">
                {t('creatorStudio.steps.step1Title', '1. Başvuru Formu')}
              </p>
              <p className="truncate text-[11px] text-muted">
                {t('creatorStudio.steps.step1Subtitle', 'Kanal ve içerik planı')}
              </p>
            </div>
          </div>

          {/* Adım 2 - Sıradaki */}
          <div className="flex items-center gap-3 rounded-xl border border-border bg-secondary/40 p-3 opacity-80">
            <span className="grid size-7 place-items-center rounded-full bg-border text-xs font-bold text-muted shrink-0">
              2
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-muted">
                {t('creatorStudio.steps.step2TitlePending', '2. Yönetici İncelemesi')}
              </p>
              <p className="truncate text-[11px] text-muted">
                {t('creatorStudio.steps.step2SubtitlePending', 'Admin değerlendirmesi')}
              </p>
            </div>
          </div>

          {/* Adım 3 - Sonuç */}
          <div className="flex items-center gap-3 rounded-xl border border-border bg-secondary/40 p-3 opacity-60">
            <span className="grid size-7 place-items-center rounded-full bg-border text-xs font-bold text-muted shrink-0">
              3
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-muted">
                {t('creatorStudio.steps.step3Title', '3. Uygunluk & Stüdyo')}
              </p>
              <p className="truncate text-[11px] text-muted">
                {t('creatorStudio.steps.step3Subtitle', 'Sayaçlar ve kokpit')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Hero Tanıtım Bannerı */}
      <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 md:p-8 shadow-sm">
        <div className="absolute -right-12 -top-12 size-64 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-2xl space-y-3">
          <h1 className="text-2xl font-bold tracking-tight text-text md:text-3xl">
            {t('creatorStudio.application.heroTitle', 'Nest Social İçerik Üretici Başvurusu')}
          </h1>
          <p className="text-sm leading-relaxed text-muted md:text-base">
            {t(
              'creatorStudio.application.heroDesc',
              'Loop kısa videolarınız ve özgün paylaşımlarınızla topluluğunuza ilham verin. Başvurunuzu yaparak Nest Social gelir paylaşım ekosistemine ilk adımı atın.',
            )}
          </p>

          {onSwitchToDemo ? (
            <div className="pt-2">
              <button
                type="button"
                onClick={onSwitchToDemo}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-text transition hover:bg-secondary-hover cursor-pointer"
              >
                <span>✨</span>
                <span>{t('creatorStudio.demo.badge', 'Üretici Kokpiti Canlı Önizleme')}</span>
              </button>
            </div>
          ) : null}
        </div>
      </section>

      {/* 3. 4 Gelir Kaynağı Kartları */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Loop Fonu */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-xs transition hover:border-border-strong">
          <div className="mb-3 inline-flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
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
        <div className="rounded-xl border border-border bg-card p-5 shadow-xs transition hover:border-border-strong">
          <div className="mb-3 flex items-center justify-between">
            <div className="inline-flex size-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
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
        <div className="rounded-xl border border-border bg-card p-5 shadow-xs transition hover:border-border-strong">
          <div className="mb-3 flex items-center justify-between">
            <div className="inline-flex size-10 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-500">
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
        <div className="rounded-xl border border-border bg-card p-5 shadow-xs transition hover:border-border-strong">
          <div className="mb-3 flex items-center justify-between">
            <div className="inline-flex size-10 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
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

      {/* 4. Başvuru Formu */}
      <section className="rounded-2xl border border-border bg-card p-6 md:p-8 shadow-sm space-y-6">
        <div>
          <h2 className="text-lg font-bold text-text">
            {t('creatorStudio.application.formTitle', 'Başvuru Formu')}
          </h2>
          <p className="text-xs text-muted mt-1">
            {t(
              'creatorStudio.application.formSubtitle',
              'İçerik planınızı ileterek üretici değerlendirme sürecini başlatın.',
            )}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Başvuran Üretici Profili */}
          <div className="flex items-center gap-3.5 rounded-xl border border-border bg-secondary/50 p-4">
            <UserAvatar user={user} className="size-12 ring-2 ring-border" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-text text-sm">
                  {`${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.username}
                </span>
                {user?.verification?.status === 'approved' ? (
                  <BadgeCheckIcon className="size-4 text-sky-500 shrink-0" />
                ) : null}
              </div>
              <p className="text-xs text-muted truncate">@{user?.username} · {user?.email}</p>
            </div>
          </div>

          {/* Kategori Seçimi */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-text">
              {t('creatorStudio.application.categoryLabel', 'İçerik Üretim Alanınız / Kategoriniz')}
            </label>
            <div className="flex flex-wrap gap-2">
              {CONTENT_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-primary text-white shadow-xs'
                      : 'border border-border bg-secondary text-muted hover:bg-secondary-hover hover:text-text'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Kanal / Üretici Açıklaması */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-text">
              {t('creatorStudio.application.statementLabel', 'Kanalınız ve İçerik Hedefleriniz (Opsiyonel)')}
            </label>
            <textarea
              rows={4}
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              placeholder="Nest Social üzerinde ürettiğiniz veya üretmeyi planladığınız video formatları, konular ve topluluğunuz hakkında kısa bilgi verin..."
              className="w-full rounded-xl border border-border bg-secondary p-3.5 text-sm text-text placeholder:text-muted focus:border-primary focus:outline-none leading-relaxed"
            />
            <p className="text-[11px] text-muted">
              İçerik türünüz editörlerimiz ve sistem değerlendirmesi tarafından referans alınır.
            </p>
          </div>

          {/* Sözleşme Onay Kutusu */}
          <label className="flex items-start gap-3 rounded-xl border border-border bg-secondary/30 p-3.5 cursor-pointer text-xs leading-relaxed text-muted hover:bg-secondary/50 transition">
            <input
              type="checkbox"
              checked={agreeTerms}
              onChange={(e) => setAgreeTerms(e.target.checked)}
              className="mt-0.5 size-4 rounded border-border text-primary focus:ring-0 cursor-pointer"
            />
            <span>
              {t(
                'creatorStudio.eligibility.termsNotice',
                'Başvurarak Nest Social İçerik Üretici Sözleşmesi, Gelir Paylaşım Kuralları ve Topluluk Standartlarını kabul etmiş olursunuz.',
              )}
            </span>
          </label>

          {/* Butonlar & Aksiyonlar */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={!agreeTerms || isApplying}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-7 py-3 text-sm font-semibold !text-inverse shadow-sm transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            >
              <span>{isApplying ? 'Başvuru İletiliyor...' : t('creatorStudio.application.submitButton', 'İçerik Üretici Başvurusunu Gönder')}</span>
              {!isApplying ? <ArrowUpRightIcon className="size-4" /> : null}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

export default CreatorApplicationView
