import { useEffect, useState } from 'react'
import { getAdminOverview, getAdminPerformanceSummary } from '../services/adminService.js'

function MetricCard({ label, value, helper }) {
  return (
    <article className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
        {label}
      </p>
      <p className="mt-3 text-3xl font-bold tracking-tight text-zinc-950">{value}</p>
      <p className="mt-2 text-sm text-zinc-500">{helper}</p>
    </article>
  )
}

function formatPercent(value) {
  const numericValue = Number(value || 0)
  return `${numericValue.toFixed(2)}%`
}

function formatDecimal(value, digits = 2) {
  const numericValue = Number(value || 0)
  return numericValue.toFixed(digits)
}

function formatWebVitalValue(metric) {
  if (!metric || metric.p75 === null || typeof metric.p75 === 'undefined') return '-'
  return metric.name === 'CLS' ? formatDecimal(metric.p75, 3) : `${metric.p75} ms`
}

function formatWebVitalRating(rating) {
  if (rating === 'good') return 'Iyi'
  if (rating === 'needs-improvement') return 'Iyilestirilmeli'
  if (rating === 'poor') return 'Zayif'
  return 'Veri bekleniyor'
}

function BreakdownList({ title, items, emptyLabel = 'Henuz veri yok.' }) {
  return (
    <section className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-zinc-950">{title}</h2>
      <div className="mt-4 space-y-3">
        {items.length ? (
          items.map((item) => (
            <div
              key={`${item._id || 'unknown'}-${item.count}`}
              className="flex items-center justify-between rounded-2xl bg-zinc-50 px-4 py-3"
            >
              <span className="text-sm font-medium text-zinc-700">
                {item._id || 'Unknown'}
              </span>
              <span className="rounded-full bg-zinc-950 px-3 py-1 text-xs font-semibold text-white">
                {item.count}
              </span>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-zinc-200 px-4 py-5 text-sm text-zinc-500">
            {emptyLabel}
          </div>
        )}
      </div>
    </section>
  )
}

function AdminOverviewPage() {
  const [state, setState] = useState({
    data: null,
    isLoading: true,
    error: '',
  })

  useEffect(() => {
    let cancelled = false

    async function loadOverview() {
      setState({
        data: null,
        isLoading: true,
        error: '',
      })

      try {
        const [payload, webVitals] = await Promise.all([
          getAdminOverview(),
          getAdminPerformanceSummary({ days: 7 }).catch(() => ({
            periodDays: 7,
            totalSamples: 0,
            metrics: [],
            routes: [],
          })),
        ])

        if (cancelled) {
          return
        }

        setState({
          data: { ...payload, webVitals },
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
          error: error.message || 'Genel bakis verileri yuklenemedi.',
        })
      }
    }

    loadOverview()

    return () => {
      cancelled = true
    }
  }, [])

  if (state.isLoading) {
    return (
      <div className="rounded-[28px] border border-zinc-200 bg-white px-5 py-6 text-sm text-zinc-500 shadow-sm">
        Yonetim analizleri yukleniyor...
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

  const {
    metrics,
    moderationSummary,
    roleBreakdown,
    countryBreakdown,
    cityBreakdown,
    latestRegistrations,
    contentEngagement,
    loopQuality,
    webVitals,
  } = state.data
  const webVitalMetrics = new Map(
    (webVitals?.metrics || []).map((metric) => [metric.name, metric]),
  )
  const maxRegistrationCount = Math.max(
    ...latestRegistrations.map((item) => item.count),
    1,
  )

  return (
    <div className="space-y-5">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <MetricCard label="Toplam Kullanici" value={metrics.totalUsers} helper="Platform genelindeki kayitli hesaplar." />
        <MetricCard label="30 Gun Aktif" value={metrics.activeUsers} helper="Son 30 gunde giris yapan kullanicilar." />
        <MetricCard label="7 Gun Aktif" value={metrics.weeklyActiveUsers} helper="Kisa vadeli saglik icin haftalik aktif hesaplar." />
        <MetricCard label="Gonderiler" value={metrics.totalPosts} helper="Sistemde tutulan yayinlanmis icerikler." />
        <MetricCard label="Mesajlar" value={metrics.totalMessages} helper="Yonetim kayitlarinda saklanan direkt mesajlar." />
        <MetricCard label="Bildirimler" value={metrics.totalNotifications} helper="Kullanici aksiyonlariyla olusan sistem bildirimleri." />
        <MetricCard label="Konum Izni Verenler" value={moderationSummary.usersWithLocationConsent} helper="Yakindaki kisiler icin yaklasik konum paylasan hesaplar." />
        <MetricCard label="Yaklasik Konum Kaydi" value={moderationSummary.usersWithApproxLocation} helper="Sistemde son yaklasik konumu tutulan hesaplar." />
        <MetricCard label="Yakindaki Kisi Kullanimi" value={moderationSummary.nearbyDiscoveryUsageTotal} helper="Yakindaki kisiler modunun toplam kullanim sayisi." />
      </section>

      <section className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-950">Gercek Kullanici Performansi</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Son 7 gunun p75 Web Vitals degerleri; toplam {webVitals?.totalSamples || 0} olcum.
            </p>
          </div>
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">
            Anonim RUM
          </span>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {['LCP', 'INP', 'CLS', 'FCP', 'TTFB'].map((metricName) => {
            const metric = webVitalMetrics.get(metricName)
            return (
              <MetricCard
                key={metricName}
                label={`${metricName} p75`}
                value={formatWebVitalValue(metric)}
                helper={`${formatWebVitalRating(metric?.rating)} · ${metric?.samples || 0} ornek`}
              />
            )
          })}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          label="Loop Videolari"
          value={loopQuality?.totalLoops || 0}
          helper="Sistemde loop tipinde yayinda olan toplam video sayisi."
        />
        <MetricCard
          label="Loop Completion Rate"
          value={formatPercent(loopQuality?.completionRate)}
          helper="Izlemelerin tamamlama oranini gosterir."
        />
        <MetricCard
          label="Replay / View"
          value={formatDecimal(loopQuality?.replayPerView, 3)}
          helper="Her izlenme basina ortalama tekrar izleme seviyesi."
        />
        <MetricCard
          label="Ortalama Izleme Orani"
          value={formatPercent((loopQuality?.avgWatchRatio || 0) * 100)}
          helper="Loop sinyallerindeki ortalama izleme ilerleme orani."
        />
        <MetricCard
          label="Ortalama Kaydirma Hizi"
          value={`${formatDecimal(loopQuality?.avgSwipeVelocity, 2)} px/s`}
          helper="Kullanici loop kartini ne kadar hizli kaydirdigini gosterir."
        />
        <MetricCard
          label="Loop Izleme Sinyali"
          value={loopQuality?.signals || 0}
          helper="Siralama algoritmasinda kullanilan toplam loop sinyal sayisi."
        />
        <MetricCard
          label="Ort. Gorunurluk Suresi"
          value={`${loopQuality?.avgVisibleMs || 0} ms`}
          helper="Loop videonun ekranda gorunur kaldigi ortalama sure."
        />
        <MetricCard
          label="Sinyal Kapsami"
          value={formatPercent(loopQuality?.signalCoverage)}
          helper="Toplam izlenmeye gore ranking sinyali toplanma orani."
        />
        <MetricCard
          label="Ranking Guven Skoru"
          value={formatPercent(loopQuality?.rankingConfidenceScore)}
          helper="Algoritmanin yeterli veriyle karar verme guven seviyesi."
        />
        <MetricCard
          label="Gizlenen Loop"
          value={loopQuality?.hiddenLoops || 0}
          helper="Moderasyonda gizli durumda kalan loop icerikleri."
        />
        <MetricCard
          label="Kaldirilan Loop"
          value={loopQuality?.removedLoops || 0}
          helper="Moderasyonla kaldirilan loop iceriklerinin adedi."
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <MetricCard label="Askidaki Kullanicilar" value={moderationSummary.suspendedUsers} helper="Giris yapmasi engellenmis hesaplar." />
        <MetricCard label="Gizlenen Gonderiler" value={moderationSummary.hiddenPosts} helper="Geri alinabilir ama normal kullanicidan gizlenmis gonderiler." />
        <MetricCard label="Kaldirilan Gonderiler" value={moderationSummary.removedPosts} helper="Moderatorden kaldirildi olarak isaretlenen gonderiler." />
        <MetricCard label="Gizlenen Yorumlar" value={moderationSummary.hiddenComments} helper="Akislarda su an gizli olan yorumlar." />
        <MetricCard label="Kaldirilan Yorumlar" value={moderationSummary.removedComments} helper="Kaldirildi olarak isaretlenen yorumlar." />
        <MetricCard label="Acik Raporlar" value={moderationSummary.openReports + moderationSummary.inReviewReports} helper="Acik ve incelemede durumundaki tum raporlar." />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-950">Kayit Trendi</h2>
          <div className="mt-5 space-y-3">
            {latestRegistrations.length ? (
              latestRegistrations.map((entry) => (
                <div key={entry._id} className="grid grid-cols-[110px_1fr_54px] items-center gap-3">
                  <span className="text-sm font-medium text-zinc-500">{entry._id}</span>
                  <div className="h-3 overflow-hidden rounded-full bg-zinc-100">
                    <div
                      className="h-full rounded-full bg-zinc-950"
                      style={{ width: `${Math.max((entry.count / maxRegistrationCount) * 100, 8)}%` }}
                    />
                  </div>
                  <span className="text-right text-sm font-semibold text-zinc-900">{entry.count}</span>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-zinc-200 px-4 py-5 text-sm text-zinc-500">
                Henuz yeterli kayit gecmisi yok.
              </div>
            )}
          </div>
        </section>

        <section className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-950">Icerik Etkilesimi</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <MetricCard label="Begeni" value={contentEngagement.likes} helper="Toplam gonderi begenisi." />
            <MetricCard label="Yorum" value={contentEngagement.comments} helper="Toplam gonderi yorumu." />
            <MetricCard label="Paylasim" value={contentEngagement.shares} helper="Toplam gonderi paylasimi." />
            <MetricCard label="Kaydetme" value={contentEngagement.saves} helper="Toplam gonderi kaydetme sayisi." />
          </div>
        </section>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        <BreakdownList title="Rol Dagilimi" items={roleBreakdown} />
        <BreakdownList title="Ulke Dagilimi" items={countryBreakdown.slice(0, 10)} />
        <BreakdownList title="Sehir Dagilimi" items={cityBreakdown.slice(0, 10)} />
      </section>
    </div>
  )
}

export default AdminOverviewPage
