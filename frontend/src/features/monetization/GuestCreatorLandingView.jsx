import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  FilmIcon,
  GiftIcon,
  UsersIcon,
  UserCheckIcon,
  BadgeCheckIcon,
  SparklesIcon,
  ArrowUpRightIcon,
  CheckCircleIcon,
  ShieldCheckIcon,
  TrendingUpIcon,
  WalletIcon,
  BankIcon,
} from './MonetizationIcons.jsx'

export function GuestCreatorLandingView({ onSwitchToDemo }) {
  const { t } = useTranslation()
  const { lang = 'tr' } = useParams()
  const [openFaq, setOpenFaq] = useState(null)

  const faqs = [
    {
      q: t('creatorStudio.guest.faq1Q', 'Üretici Stüdyosu programına katılmak ücretli mi?'),
      a: t(
        'creatorStudio.guest.faq1A',
        'Hayır, Nest Social İçerik Üretici Programı tamamen ücretsizdir. Hiçbir başlangıç veya aidat ücreti ödemeden içerik üreterek kazanmaya başlayabilirsiniz.',
      ),
    },
    {
      q: t('creatorStudio.guest.faq2Q', 'Kazançlarımı nasıl ve ne zaman çekebilirim?'),
      a: t(
        'creatorStudio.guest.faq2A',
        'Kullanılabilir bakiyeniz minimum ₺250 limitine ulaştığında, IBAN bilginizi girerek dilediğiniz an tek tıkla FAST/EFT çekim talebi oluşturabilirsiniz. Ödemeler kayıtlı banka hesabınıza güvenle aktarılır.',
      ),
    },
    {
      q: t('creatorStudio.guest.faq3Q', 'Mavi Tik (Doğrulanmış Profil) zorunlu mu?'),
      a: t(
        'creatorStudio.guest.faq3A',
        'Loop Video Fonu kazançları için Mavi Tik zorunlu değildir; temel izlenme ve takipçi kriterleri yeterlidir. Takipçi bahşişleri, VIP grup abonelikleri ve profil abonelikleri gibi doğrudan ödeme kanalları için hesap güvenliği amacıyla onaylı profil avantajı sunulur.',
      ),
    },
    {
      q: t('creatorStudio.guest.faq4Q', 'Başvurular ne kadar sürede değerlendirilir?'),
      a: t(
        'creatorStudio.guest.faq4A',
        'Kriterleri sağladıktan sonra gönderdiğiniz başvurular, moderasyon ekibimiz ve otomatik sistemlerimiz tarafından genellikle 24 ile 48 saat içerisinde incelenerek sonuçlandırılır.',
      ),
    },
  ]

  const toggleFaq = (idx) => {
    setOpenFaq(openFaq === idx ? null : idx)
  }

  return (
    <div className="space-y-3 pb-8">
      {/* 1. Hero Section */}
      <section className="relative overflow-hidden rounded-none border-x-0 sm:border-x sm:rounded-md border border-border bg-gradient-to-b from-card via-card to-secondary/30 p-6 sm:p-8 shadow-sm">
        {/* Glow decoration */}
        <div className="absolute -right-16 -top-16 size-80 rounded-full bg-primary/15 blur-3xl pointer-events-none" />
        <div className="absolute -left-16 -bottom-16 size-80 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl space-y-3">
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-text leading-tight">
            {t(
              'creatorStudio.guest.heroTitle',
              'İçeriklerinizi Kazanca Dönüştürün',
            )}
          </h1>

          {/* Action Buttons */}
          <div className="pt-1 flex flex-wrap items-center gap-2.5">
            <Link
              to={`/${lang}/signup?source=creators`}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-6 py-2.5 text-sm font-semibold !text-white shadow-sm transition hover:bg-primary-hover active:scale-[0.98]"
            >
              <span>{t('creatorStudio.guest.ctaJoin', 'Hemen Katıl & Üretici Ol')}</span>
              <ArrowUpRightIcon className="size-4" />
            </Link>

            {onSwitchToDemo ? (
              <button
                type="button"
                onClick={onSwitchToDemo}
                className="inline-flex items-center justify-center rounded-md border border-primary/40 bg-primary/10 px-4 py-2.5 text-sm font-medium text-primary transition hover:bg-primary/20 cursor-pointer"
              >
                <span>{t('creatorStudio.guest.tryDemo', 'Canlı Kokpiti İncele (Demo)')}</span>
              </button>
            ) : null}
          </div>

          <p className="text-xs text-muted pt-0.5">
            ✓ {t('creatorStudio.guest.freeNotice', 'Ücretsiz katılım')} · ✓ {t('creatorStudio.guest.transparentNotice', 'Şeffaf gelir paylaşımı')}
          </p>
        </div>
      </section>

      {/* 2. Key Highlights / Trust Metric Bar */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-none sm:rounded-md border border-border bg-card p-4 sm:p-5 flex flex-col justify-between shadow-xs">
          <div className="size-9 rounded-md bg-primary/10 text-primary flex items-center justify-center mb-3">
            <TrendingUpIcon className="size-5" />
          </div>
          <div>
            <span className="text-lg sm:text-xl font-bold text-text">%85'e Varan</span>
            <p className="text-xs text-muted mt-0.5">Üretici dostu yüksek gelir payı</p>
          </div>
        </div>

        <div className="rounded-none sm:rounded-md border border-border bg-card p-4 sm:p-5 flex flex-col justify-between shadow-xs">
          <div className="size-9 rounded-md bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-3">
            <BankIcon className="size-5" />
          </div>
          <div>
            <span className="text-lg sm:text-xl font-bold text-text">FAST / EFT</span>
            <p className="text-xs text-muted mt-0.5">Doğrudan banka hesabına nakit çekim</p>
          </div>
        </div>

        <div className="rounded-none sm:rounded-md border border-border bg-card p-4 sm:p-5 flex flex-col justify-between shadow-xs">
          <div className="size-9 rounded-md bg-indigo-500/10 text-indigo-500 flex items-center justify-center mb-3">
            <WalletIcon className="size-5" />
          </div>
          <div>
            <span className="text-lg sm:text-xl font-bold text-text">Anlık Finans</span>
            <p className="text-xs text-muted mt-0.5">Saniye saniye güncellenen cüzdan</p>
          </div>
        </div>

        <div className="rounded-none sm:rounded-md border border-border bg-card p-4 sm:p-5 flex flex-col justify-between shadow-xs">
          <div className="size-9 rounded-md bg-sky-500/10 text-sky-500 flex items-center justify-center mb-3">
            <ShieldCheckIcon className="size-5" />
          </div>
          <div>
            <span className="text-lg sm:text-xl font-bold text-text">Telif & Güvenlik</span>
            <p className="text-xs text-muted mt-0.5">Özgün içerikleriniz tam koruma altında</p>
          </div>
        </div>
      </section>

      {/* 3. 4 Gelir Modeli (Monetization Pillars) */}
      <section className="space-y-3">
        <div className="px-3 sm:px-0">
          <h2 className="text-lg sm:text-xl font-bold text-text">
            {t('creatorStudio.guest.streamsTitle', '4 Farklı Gelir Kanalı ile Büyüyün')}
          </h2>
          <p className="text-xs sm:text-sm text-muted">
            {t('creatorStudio.guest.streamsSubtitle', 'Tek bir kaynağa bağlı kalmayın; farklı formatlarla gelirlerinizi çeşitlendirin.')}
          </p>
        </div>

        <div className="flex overflow-x-auto snap-x snap-mandatory gap-3 px-3 py-1 no-scrollbar sm:grid sm:grid-cols-2 sm:gap-3 sm:px-0 sm:py-0 sm:overflow-visible sm:snap-none">
          {/* Loop Fonu */}
          <div className="w-[280px] shrink-0 snap-start rounded-md border border-border bg-card p-5 sm:p-6 shadow-xs transition hover:border-primary/40 hover:shadow-md sm:w-auto sm:shrink flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between mb-3">
                <div className="flex size-11 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <FilmIcon className="size-5" />
                </div>
                <span className="rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                  {t('creatorStudio.guest.popularBadge', 'Tüm Üreticilere Açık')}
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-text group-hover:text-primary transition-colors">
                {t('creatorStudio.streams.loopTitle', 'Loop Video Fonu')}
              </h3>
              <p className="mt-1.5 text-xs sm:text-sm leading-relaxed text-muted">
                {t(
                  'creatorStudio.guest.loopLongDesc',
                  'Paylaştığınız dikey kısa videolar (Loop) izlendikçe, platform reklam havuzundan izlenme oranınıza göre otomatik pay kazanın.',
                )}
              </p>
            </div>
            <div className="mt-3.5 flex items-center gap-2 text-xs font-semibold text-text">
              <CheckCircleIcon className="size-4 text-emerald-500 shrink-0" />
              <span>{t('creatorStudio.guest.loopPerk', 'Minimum 1.000 izlenme ile aktifleşir')}</span>
            </div>
          </div>

          {/* Topluluk Bahşişleri & Hediyeler */}
          <div className="w-[280px] shrink-0 snap-start rounded-md border border-border bg-card p-5 sm:p-6 shadow-xs transition hover:border-emerald-500/40 hover:shadow-md sm:w-auto sm:shrink flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between mb-3">
                <div className="flex size-11 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-500">
                  <GiftIcon className="size-5" />
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 border border-sky-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-sky-600 dark:text-sky-400">
                  <BadgeCheckIcon className="size-3.5 text-sky-500 shrink-0" />
                  <span>{t('creatorStudio.streams.verifiedOnlyBadge', 'Onaylı Profillere Özel')}</span>
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-text group-hover:text-emerald-500 transition-colors">
                {t('creatorStudio.streams.tipsTitle', 'Topluluk Bahşişleri & Hediyeler')}
              </h3>
              <p className="mt-1.5 text-xs sm:text-sm leading-relaxed text-muted">
                {t(
                  'creatorStudio.guest.tipsLongDesc',
                  'Takipçileriniz profilinizden veya gönderileriniz altından tek tıkla doğrudan bakiye hediyesi ve teşekkür bahşişi gönderebilir.',
                )}
              </p>
            </div>
            <div className="mt-3.5 flex items-center gap-2 text-xs font-semibold text-text">
              <CheckCircleIcon className="size-4 text-emerald-500 shrink-0" />
              <span>{t('creatorStudio.guest.tipsPerk', 'Doğrudan cüzdanınıza anlık aktarılır')}</span>
            </div>
          </div>

          {/* VIP Gruplar & Özel İçerik */}
          <div className="w-[280px] shrink-0 snap-start rounded-md border border-border bg-card p-5 sm:p-6 shadow-xs transition hover:border-indigo-500/40 hover:shadow-md sm:w-auto sm:shrink flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between mb-3">
                <div className="flex size-11 items-center justify-center rounded-md bg-indigo-500/10 text-indigo-500">
                  <UsersIcon className="size-5" />
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 border border-sky-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-sky-600 dark:text-sky-400">
                  <BadgeCheckIcon className="size-3.5 text-sky-500 shrink-0" />
                  <span>{t('creatorStudio.streams.verifiedOnlyBadge', 'Onaylı Profillere Özel')}</span>
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-text group-hover:text-indigo-500 transition-colors">
                {t('creatorStudio.streams.subscriptionsTitle', 'Özel Gruplar & VIP İçerik')}
              </h3>
              <p className="mt-1.5 text-xs sm:text-sm leading-relaxed text-muted">
                {t(
                  'creatorStudio.guest.groupsLongDesc',
                  'Özel eğitimler, niş sohbetler veya VIP topluluklar için aylık abonelik ücretli gruplar kurarak düzenli tekrarlayan gelir yaratın.',
                )}
              </p>
            </div>
            <div className="mt-3.5 flex items-center gap-2 text-xs font-semibold text-text">
              <CheckCircleIcon className="size-4 text-emerald-500 shrink-0" />
              <span>{t('creatorStudio.guest.groupsPerk', 'Aylık otomatik yinelenen gelir')}</span>
            </div>
          </div>

          {/* Profil Aboneliği */}
          <div className="w-[280px] shrink-0 snap-start rounded-md border border-border bg-card p-5 sm:p-6 shadow-xs transition hover:border-purple-500/40 hover:shadow-md sm:w-auto sm:shrink flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between mb-3">
                <div className="flex size-11 items-center justify-center rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  <UserCheckIcon className="size-5" />
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 border border-sky-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-sky-600 dark:text-sky-400">
                  <BadgeCheckIcon className="size-3.5 text-sky-500 shrink-0" />
                  <span>{t('creatorStudio.streams.verifiedOnlyBadge', 'Onaylı Profillere Özel')}</span>
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-text group-hover:text-purple-500 transition-colors">
                {t('creatorStudio.streams.profileSubscriptionsTitle', 'Profil Aboneliği')}
              </h3>
              <p className="mt-1.5 text-xs sm:text-sm leading-relaxed text-muted">
                {t(
                  'creatorStudio.guest.profileLongDesc',
                  'Profilinizi aboneliğe açarak sadece abonelerinizin görebileceği özel paylaşımlar, hikayeler ve özel rozetler sunun.',
                )}
              </p>
            </div>
            <div className="mt-3.5 flex items-center gap-2 text-xs font-semibold text-text">
              <CheckCircleIcon className="size-4 text-emerald-500 shrink-0" />
              <span>{t('creatorStudio.guest.profilePerk', 'Özel üretici rozeti & sadık kitle')}</span>
            </div>
          </div>
        </div>
      </section>

      {/* 4. FAQ (Sıkça Sorulan Sorular) */}
      <section className="rounded-none sm:rounded-md border border-border bg-card p-5 sm:p-7 shadow-sm space-y-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-text">
            {t('creatorStudio.guest.faqTitle', 'Sıkça Sorulan Sorular')}
          </h2>
          <p className="text-xs sm:text-sm text-muted mt-0.5">
            {t('creatorStudio.guest.faqSubtitle', 'İçerik Üretici Programı hakkında aklınıza takılan soruların yanıtları.')}
          </p>
        </div>

        <div className="space-y-2 pt-1">
          {faqs.map((faq, idx) => {
            const isOpen = openFaq === idx
            return (
              <div
                key={idx}
                className="overflow-hidden rounded-md border border-border bg-secondary/20 transition hover:border-border-strong"
              >
                <button
                  type="button"
                  onClick={() => toggleFaq(idx)}
                  className="flex w-full items-center justify-between p-3.5 text-left font-semibold text-text text-sm cursor-pointer"
                >
                  <span>{faq.q}</span>
                  <span className="text-xs text-muted ml-3 shrink-0">
                    {isOpen ? '▲' : '▼'}
                  </span>
                </button>
                {isOpen ? (
                  <div className="border-t border-border/60 p-3.5 text-xs sm:text-sm leading-relaxed text-muted bg-secondary/10">
                    {faq.a}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      </section>

      {/* 5. Bottom Call To Action Banner */}
      <section className="relative overflow-hidden rounded-none border-x-0 sm:border-x sm:rounded-md border border-border bg-card p-6 sm:p-8 shadow-xs text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="space-y-1.5 max-w-xl">
          <h2 className="text-xl sm:text-2xl font-bold text-text">
            {t('creatorStudio.guest.bottomCtaTitle', 'Bugün Üretmeye ve Kazanmaya Başlayın')}
          </h2>
          <p className="text-xs sm:text-sm text-muted">
            {t(
              'creatorStudio.guest.bottomCtaDesc',
              'Nest Social topluluğunun bir parçası olun, özgün içerikleriniz hak ettiği değeri ve geliri bulsun.',
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2.5 shrink-0">
          <Link
            to={`/${lang}/signup?source=creators`}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold !text-white shadow-sm transition hover:bg-primary-hover"
          >
            <span>{t('creatorStudio.guest.freeRegister', 'Ücretsiz Kayıt Ol')}</span>
            <ArrowUpRightIcon className="size-4" />
          </Link>

          <Link
            to={`/${lang}/login?redirect=/${lang}/monetization`}
            className="inline-flex items-center rounded-md border border-border bg-secondary px-4 py-2.5 text-sm font-semibold text-text transition hover:bg-secondary-hover"
          >
            <span>{t('common.login', 'Giriş Yap')}</span>
          </Link>
        </div>
      </section>
    </div>
  )
}

export default GuestCreatorLandingView


