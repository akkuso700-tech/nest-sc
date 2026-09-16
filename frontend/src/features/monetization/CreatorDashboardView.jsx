import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  WalletIcon,
  TrendingUpIcon,
  ClockIcon,
  BankIcon,
  FilmIcon,
  GiftIcon,
  UsersIcon,
  CheckCircleIcon,
  SparklesIcon,
  ArrowUpRightIcon,
  UserCheckIcon,
} from './MonetizationIcons.jsx'
import { RequestPayoutModal } from './RequestPayoutModal.jsx'

export function CreatorDashboardView({
  dashboardData,
  onSimulateEarning,
  onRequestPayout,
  isSubmittingPayout,
}) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('overview')
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false)
  const [hoveredChartIndex, setHoveredChartIndex] = useState(null)

  const wallet = dashboardData?.wallet || {}
  const streams = dashboardData?.streams || {
    loopRewards: 0,
    tips: 0,
    groupSubscriptions: 0,
    profileSubscriptions: 0,
  }
  const chartData = dashboardData?.chartData || []
  const transactions = dashboardData?.transactions || []
  const payoutRequests = dashboardData?.payoutRequests || []
  const minPayoutAmount = dashboardData?.minPayoutAmount || 250

  const availableBalance = wallet?.balance ?? 0
  const pendingBalance = wallet?.pendingBalance ?? 0
  const lifetimeEarnings = wallet?.lifetimeEarnings ?? 0

  const maxChartAmount = Math.max(...chartData.map((d) => d.amount), 100)

  const getTransactionBadge = (type) => {
    switch (type) {
      case 'loop_reward':
        return { label: 'Loop Fonu', bg: 'bg-primary/10 text-primary' }
      case 'tip_received':
        return { label: 'Bahşiş', bg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' }
      case 'group_subscription':
        return { label: 'Grup Aboneliği', bg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' }
      case 'profile_subscription':
        return { label: 'Profil Aboneliği', bg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400' }
      case 'payout_withdrawal':
        return { label: 'Banka Çekimi', bg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' }
      default:
        return { label: 'Diğer', bg: 'bg-muted/10 text-muted' }
    }
  }

  return (
    <div className="space-y-3">
      {/* 1. Üst Bakiye & KPI Kartları */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Kullanılabilir Bakiye & Çekim Butonu */}
        <div className="relative overflow-hidden rounded-none border-x-0 sm:border-x sm:rounded-md border border-border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs font-semibold uppercase tracking-wider">
              {t('creatorStudio.metrics.availableBalance', 'Kullanılabilir Bakiye')}
            </span>
            <div className="grid size-8 place-items-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <WalletIcon className="size-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold tracking-tight text-text">
              ₺{availableBalance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setIsPayoutModalOpen(true)}
              disabled={availableBalance < minPayoutAmount}
              className="w-full rounded-md bg-primary px-3.5 py-2 text-xs font-semibold !text-inverse shadow-xs transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            >
              {t('creatorStudio.metrics.requestPayout', 'Parayı Çek')}
            </button>
          </div>
        </div>

        {/* Toplam Kazanç */}
        <div className="rounded-none border-x-0 sm:border-x sm:rounded-md border border-border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs font-semibold uppercase tracking-wider">
              {t('creatorStudio.metrics.lifetimeEarnings', 'Toplam Kazanç')}
            </span>
            <div className="grid size-8 place-items-center rounded-md bg-primary/10 text-primary">
              <TrendingUpIcon className="size-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold tracking-tight text-text">
              ₺{lifetimeEarnings.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <p className="mt-4 text-[11px] text-muted">
            Tüm zamanlar içerik ve etkileşim hasılatı
          </p>
        </div>

        {/* Bekleyen Bakiye */}
        <div className="rounded-none border-x-0 sm:border-x sm:rounded-md border border-border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs font-semibold uppercase tracking-wider">
              {t('creatorStudio.metrics.pendingBalance', 'Bekleyen / Onayda')}
            </span>
            <div className="grid size-8 place-items-center rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <ClockIcon className="size-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold tracking-tight text-text">
              ₺{pendingBalance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <p className="mt-4 text-[11px] text-muted">
            Transfer süreci devam eden çekim talepleri
          </p>
        </div>

        {/* Sonraki Ödeme Tarihi */}
        <div className="rounded-none border-x-0 sm:border-x sm:rounded-md border border-border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs font-semibold uppercase tracking-wider">
              {t('creatorStudio.metrics.nextPayout', 'Sonraki Ödeme')}
            </span>
            <div className="grid size-8 place-items-center rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <BankIcon className="size-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold tracking-tight text-text">15'i Her Ay</p>
          </div>
          <p className="mt-4 text-[11px] text-muted">
            Min. ₺{minPayoutAmount} eşiği üzeri kayıtlı IBAN'a aktarılır
          </p>
        </div>
      </section>

      {/* 2. Sekme Butonları & Hızlı Test Aksiyonu */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-2">
        <nav className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {[
            { id: 'overview', label: t('creatorStudio.tabs.overview', 'Genel Bakış') },
            { id: 'streams', label: t('creatorStudio.tabs.streams', 'Gelir Kanalları') },
            { id: 'payouts', label: t('creatorStudio.tabs.payouts', 'Ödeme & Cüzdan') },
            { id: 'insights', label: t('creatorStudio.tabs.insights', 'Üretici Rehberi') },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-md px-4 py-2 text-xs font-semibold transition cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-nav-active text-primary shadow-xs'
                  : 'text-muted hover:bg-secondary hover:text-text'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Simülasyon / Test Butonu */}
        {onSimulateEarning ? (
          <button
            type="button"
            onClick={onSimulateEarning}
            className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-primary/40 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 cursor-pointer"
          >
            <SparklesIcon className="size-3.5" />
            <span>{t('creatorStudio.demo.addSampleEarning', 'Örnek ₺150 Kazanç Ekle')}</span>
          </button>
        ) : null}
      </div>

      {/* 3. SEKME İÇERİKLERİ */}

      {/* SEKME 1: GENEL BAKIŞ */}
      {activeTab === 'overview' ? (
        <div className="space-y-3">
          {/* Kazanç Grafiği */}
          <div className="rounded-none border-x-0 sm:border-x sm:rounded-md border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-text">Son 7 Günlük Gelir Grafiği</h3>
                <p className="text-xs text-muted">Günlük tahakkuk eden içerik ödülleri</p>
              </div>
              <span className="text-xs font-semibold text-emerald-500">
                Canlı Veri
              </span>
            </div>

            <div className="mt-6 flex h-44 items-end gap-3 sm:gap-6 pt-6 pb-2 border-b border-border">
              {chartData.map((item, idx) => {
                const heightPercent = Math.max(8, Math.round((item.amount / maxChartAmount) * 100))
                const isHovered = hoveredChartIndex === idx
                return (
                  <div
                    key={item.date}
                    onMouseEnter={() => setHoveredChartIndex(idx)}
                    onMouseLeave={() => setHoveredChartIndex(null)}
                    className="group relative flex flex-1 flex-col items-center h-full justify-end cursor-pointer"
                  >
                    {/* Tooltip */}
                    {isHovered ? (
                      <div className="pointer-events-none absolute -top-9.5 z-20 rounded-md bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-white shadow-lg border border-slate-800 dark:bg-slate-700 dark:text-white dark:border-slate-600 whitespace-nowrap">
                        ₺{item.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 size-2 rotate-45 bg-slate-900 border-r border-b border-slate-800 dark:bg-slate-700 dark:border-slate-600" />
                      </div>
                    ) : null}

                    {/* Çubuk */}
                    <div
                      className={`w-full max-w-[40px] rounded-t-md transition-all duration-300 ${
                        item.amount > 0
                          ? 'bg-primary group-hover:bg-primary-hover'
                          : 'bg-border'
                      }`}
                      style={{ height: `${heightPercent}%` }}
                    />
                    <span className="mt-2 text-[10px] text-muted">
                      {item.date.slice(5)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Son İşlemler Tablosu */}
          <div className="rounded-none border-x-0 sm:border-x sm:rounded-md border border-border bg-card p-6 shadow-sm">
            <h3 className="text-sm font-bold text-text mb-4">Son Finansal Hareketler</h3>
            {transactions.length ? (
              <div className="divide-y divide-border">
                {transactions.map((tx) => {
                  const badge = getTransactionBadge(tx.type)
                  const isPositive = tx.netAmount >= 0
                  return (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${badge.bg}`}
                          >
                            {badge.label}
                          </span>
                          <span className="text-xs font-semibold text-text">
                            {tx.title || 'Sistem İşlemi'}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted">
                          {new Date(tx.createdAt).toLocaleDateString('tr-TR', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>

                      <div className="text-right">
                        <span
                          className={`text-sm font-bold ${
                            isPositive ? 'text-emerald-500' : 'text-rose-500'
                          }`}
                        >
                          {isPositive ? '+' : ''}₺
                          {Math.abs(tx.netAmount).toLocaleString('tr-TR', {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                        <p className="text-[10px] uppercase tracking-wider text-muted">
                          {tx.status}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-muted">
                Henüz kayıtlı bir finansal işlem bulunmuyor.
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* SEKME 2: GELİR KANALLARI */}
      {activeTab === 'streams' ? (
        <div className="flex overflow-x-auto snap-x snap-mandatory gap-3 px-4 py-1 no-scrollbar sm:grid sm:grid-cols-2 sm:px-0 sm:py-0 lg:grid-cols-4 sm:snap-none sm:overflow-visible">
          {/* Loop Fonu */}
          <div className="w-[270px] shrink-0 snap-start rounded-none sm:rounded-md border border-border bg-card p-5 shadow-xs space-y-4 sm:w-auto sm:shrink">
            <div className="flex items-center justify-between">
              <div className="inline-flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                <FilmIcon className="size-5" />
              </div>
              <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600">
                {t('creatorStudio.streams.statusActive', 'Aktif')}
              </span>
            </div>
            <div>
              <h4 className="text-sm font-bold text-text">
                {t('creatorStudio.streams.loopTitle', 'Loop Video Fonu')}
              </h4>
              <p className="mt-1 text-xs text-muted leading-relaxed">
                {t(
                  'creatorStudio.streams.loopDesc',
                  'Kısa videolarınızın izlenme ve tamamlanma oranına göre hesaplanan gelir havuzu payı.',
                )}
              </p>
            </div>
            <div className="border-t border-border pt-3">
              <span className="text-xs text-muted">Toplam Kazanılan:</span>
              <p className="text-lg font-bold text-text">
                ₺{streams.loopRewards.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {/* Bahşişler */}
          <div className="w-[270px] shrink-0 snap-start rounded-none sm:rounded-md border border-border bg-card p-5 shadow-xs space-y-4 sm:w-auto sm:shrink">
            <div className="flex items-center justify-between">
              <div className="inline-flex size-10 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600">
                <GiftIcon className="size-5" />
              </div>
              <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600">
                {t('creatorStudio.streams.statusActive', 'Aktif')}
              </span>
            </div>
            <div>
              <h4 className="text-sm font-bold text-text">
                {t('creatorStudio.streams.tipsTitle', 'Topluluk Bahşişleri')}
              </h4>
              <p className="mt-1 text-xs text-muted leading-relaxed">
                {t(
                  'creatorStudio.streams.tipsDesc',
                  'Takipçilerinizden gönderi ve profilleriniz üzerinden toplanan doğrudan mikro destekler.',
                )}
              </p>
            </div>
            <div className="border-t border-border pt-3">
              <span className="text-xs text-muted">Toplam Kazanılan:</span>
              <p className="text-lg font-bold text-text">
                ₺{streams.tips.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {/* Özel Gruplar */}
          <div className="w-[270px] shrink-0 snap-start rounded-none sm:rounded-md border border-border bg-card p-5 shadow-xs space-y-4 sm:w-auto sm:shrink">
            <div className="flex items-center justify-between">
              <div className="inline-flex size-10 items-center justify-center rounded-md bg-indigo-500/10 text-indigo-600">
                <UsersIcon className="size-5" />
              </div>
              <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600">
                {t('creatorStudio.streams.statusActive', 'Aktif')}
              </span>
            </div>
            <div>
              <h4 className="text-sm font-bold text-text">
                {t('creatorStudio.streams.subscriptionsTitle', 'VIP Gruplar & Abonelikler')}
              </h4>
              <p className="mt-1 text-xs text-muted leading-relaxed">
                {t(
                  'creatorStudio.streams.subscriptionsDesc',
                  'Yönettiğiniz grupları ücretli aboneliğe açarak düzenli aylık gelir sağlayabilirsiniz.',
                )}
              </p>
            </div>
            <div className="border-t border-border pt-3">
              <span className="text-xs text-muted">Toplam Kazanılan:</span>
              <p className="text-lg font-bold text-text">
                ₺{streams.groupSubscriptions.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {/* Profil Aboneliği */}
          <div className="w-[270px] shrink-0 snap-start rounded-none sm:rounded-md border border-border bg-card p-5 shadow-xs space-y-4 sm:w-auto sm:shrink">
            <div className="flex items-center justify-between">
              <div className="inline-flex size-10 items-center justify-center rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <UserCheckIcon className="size-5" />
              </div>
              <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600">
                {t('creatorStudio.streams.statusActive', 'Aktif')}
              </span>
            </div>
            <div>
              <h4 className="text-sm font-bold text-text">
                {t('creatorStudio.streams.profileSubscriptionsTitle', 'Profil Aboneliği')}
              </h4>
              <p className="mt-1 text-xs text-muted leading-relaxed">
                {t(
                  'creatorStudio.streams.profileSubscriptionsDesc',
                  'Takipçileriniz profilinize aylık abone olarak özel paylaşımlarınıza, destekçi rozetine ve doğrudan iletişim ayrıcalıklarına sahip olur.',
                )}
              </p>
            </div>
            <div className="border-t border-border pt-3">
              <span className="text-xs text-muted">Toplam Kazanılan:</span>
              <p className="text-lg font-bold text-text">
                ₺{streams.profileSubscriptions.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {/* SEKME 3: ÖDEMELER & CÜZDAN */}
      {activeTab === 'payouts' ? (
        <div className="space-y-3">
          {/* Kayıtlı Banka Bilgisi */}
          <div className="rounded-none border-x-0 sm:border-x sm:rounded-md border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-text">Varsayılan Banka Hesabı</h3>
              <button
                type="button"
                onClick={() => setIsPayoutModalOpen(true)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline cursor-pointer"
              >
                <span>Güncelle / Yeni Talep</span>
                <ArrowUpRightIcon className="size-3.5" />
              </button>
            </div>

            {wallet?.defaultPayoutAccount?.iban ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-none sm:rounded-md border border-border bg-secondary/40 p-4">
                <div>
                  <span className="text-[11px] text-muted block">Hesap Sahibi</span>
                  <p className="text-xs font-semibold text-text mt-0.5">
                    {wallet.defaultPayoutAccount.fullName}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] text-muted block">Banka IBAN</span>
                  <p className="text-xs font-mono font-semibold text-text mt-0.5">
                    {wallet.defaultPayoutAccount.iban}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] text-muted block">Banka Adı</span>
                  <p className="text-xs font-semibold text-text mt-0.5">
                    {wallet.defaultPayoutAccount.bankName || 'Türkiye Bankası'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-none sm:rounded-md border border-dashed border-border p-4 text-center text-xs text-muted">
                Henüz kayıtlı bir IBAN bulunmuyor. İlk para çekim talebinizde otomatik olarak kaydedilecektir.
              </div>
            )}
          </div>

          {/* Çekim Talepleri Geçmişi */}
          <div className="rounded-none border-x-0 sm:border-x sm:rounded-md border border-border bg-card p-6 shadow-sm">
            <h3 className="text-sm font-bold text-text mb-4">Para Çekim Talepleri Geçmişi</h3>
            {payoutRequests.length ? (
              <div className="divide-y divide-border">
                {payoutRequests.map((req) => (
                  <div
                    key={req.id}
                    className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0"
                  >
                    <div>
                      <p className="text-xs font-semibold text-text">
                        ₺{req.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} - FAST Transferi
                      </p>
                      <p className="text-[11px] text-muted">
                        {req.iban} • {new Date(req.requestedAt).toLocaleDateString('tr-TR')}
                      </p>
                    </div>
                    <div>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                          req.status === 'completed'
                            ? 'bg-emerald-500/10 text-emerald-600'
                            : req.status === 'rejected'
                              ? 'bg-rose-500/10 text-rose-600'
                              : 'bg-amber-500/10 text-amber-600'
                        }`}
                      >
                        {req.status === 'completed'
                          ? 'Aktarıldı'
                          : req.status === 'rejected'
                            ? 'Reddedildi'
                            : 'İşleniyor'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-muted">
                Henüz verilmiş bir para çekim talebiniz bulunmuyor.
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* SEKME 4: ÜRETİCİ REHBERİ */}
      {activeTab === 'insights' ? (
        <div className="rounded-none border-x-0 sm:border-x sm:rounded-md border border-border bg-card p-6 shadow-sm space-y-6">
          <div>
            <h3 className="text-base font-bold text-text">
              Nest Social İçerik Üretici Rehberi & En İyi Uygulamalar
            </h3>
            <p className="text-xs text-muted mt-1">
              Gelirlerinizi ve kitlenizi organik olarak büyütmek için bilmeniz gerekenler
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-none sm:rounded-md border border-border bg-secondary/30 p-4 space-y-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-primary">
                <CheckCircleIcon className="size-4" />
                Loop Tamamlanma Oranını Artırın
              </span>
              <p className="text-xs text-muted leading-relaxed">
                Videolarınızın ilk 3 saniyesinde izleyicinin dikkatini çekecek bir kanca (hook) kullanın. Videoyu sonuna kadar izleyen kullanıcılar, havuz gelir puanınızı katlar.
              </p>
            </div>

            <div className="rounded-none sm:rounded-md border border-border bg-secondary/30 p-4 space-y-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <CheckCircleIcon className="size-4" />
                Yasal Vergi Uyum Kolaylığı
              </span>
              <p className="text-xs text-muted leading-relaxed">
                193 sayılı Gelir Vergisi Kanunu Madde 20/B kapsamında, bankanızdan açtıracağınız Sosyal İçerik Üreticiliği İstisna Hesabı ile şirket kurmadan stopaj avantajıyla ödeme alabilirsiniz.
              </p>
            </div>

            <div className="rounded-none sm:rounded-md border border-border bg-secondary/30 p-4 space-y-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                <CheckCircleIcon className="size-4" />
                Topluluğunuzla Düzenli İletişim
              </span>
              <p className="text-xs text-muted leading-relaxed">
                Yorumlara ve mesajlara yanıt vermek, takipçilerinizin bahşiş gönderme ve grubunuza katılma motivasyonunu belirgin şekilde artırır.
              </p>
            </div>

            <div className="rounded-none sm:rounded-md border border-border bg-secondary/30 p-4 space-y-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                <CheckCircleIcon className="size-4" />
                Özgün ve Kaliteli İçerik
              </span>
              <p className="text-xs text-muted leading-relaxed">
                Başka platformların filigranlarını (watermark) taşımayan, yüksek çözünürlüklü özgün paylaşımlar öneri algoritmasında önceliklendirilir.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {/* Para Çekim Modalı */}
      <RequestPayoutModal
        isOpen={isPayoutModalOpen}
        onClose={() => setIsPayoutModalOpen(false)}
        wallet={wallet}
        minPayoutAmount={minPayoutAmount}
        onSubmit={onRequestPayout}
        isSubmitting={isSubmittingPayout}
      />
    </div>
  )
}
