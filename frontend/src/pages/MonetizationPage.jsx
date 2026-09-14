import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import SocialLayout from '../layouts/SocialLayout.jsx'
import Seo from '../components/seo/Seo.jsx'
import ActionToast from '../components/feedback/ActionToast.jsx'
import { useAuth } from '../store/AuthContext.jsx'
import {
  getMonetizationStatus,
  applyForMonetization,
  getCreatorDashboard,
  requestPayout,
  simulateEarning,
} from '../services/monetizationService.js'
import { EligibilityGateView } from '../features/monetization/EligibilityGateView.jsx'
import { CreatorDashboardView } from '../features/monetization/CreatorDashboardView.jsx'
import { CreatorApplicationView } from '../features/monetization/CreatorApplicationView.jsx'
import { ApplicationPendingView } from '../features/monetization/ApplicationPendingView.jsx'

export function MonetizationPage() {
  const { t } = useTranslation()
  const { user, isAuthenticated } = useAuth()

  const [isLoading, setIsLoading] = useState(true)
  const [statusData, setStatusData] = useState(null)
  const [dashboardData, setDashboardData] = useState(null)
  const [isApplying, setIsApplying] = useState(false)
  const [isSubmittingPayout, setIsSubmittingPayout] = useState(false)
  const [toast, setToast] = useState({ message: '', tone: 'success' })
  const [forceDashboardPreview, setForceDashboardPreview] = useState(false)

  const showToast = (message, tone = 'success') => {
    setToast({ message, tone })
  }

  const loadData = useCallback(async () => {
    if (!isAuthenticated) {
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      const res = await getMonetizationStatus()
      const data = res?.data || {}
      setStatusData(data)

      if (data.isApproved || data.status === 'approved') {
        const dashRes = await getCreatorDashboard()
        setDashboardData(dashRes?.data || null)
      }
    } catch (err) {
      // Offline / fallback demo data if backend is starting or offline
      setStatusData({
        status: 'not_enrolled',
        isApproved: false,
        isEligible: false,
        criteria: {
          followers: { current: 0, target: 100, met: false },
          views30d: { current: 0, target: 1000, met: false },
          accountAge: { current: 0, target: 14, met: false },
          emailVerified: { met: true },
          goodStanding: { met: true },
          verifiedProfile: {
            met: Boolean(user?.verification?.status === 'approved' || user?.role === 'admin'),
            status: user?.verification?.status || 'none',
          },
        },
      })
    } finally {
      setIsLoading(false)
    }
  }, [isAuthenticated, user])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleApply = async (statement) => {
    try {
      setIsApplying(true)
      const res = await applyForMonetization({ statement })
      showToast(
        res?.message ||
          t(
            'creatorStudio.application.pendingNotice',
            'Başvurunuz başarıyla alındı! Yönetici incelemesine iletildi.',
          ),
      )
      await loadData()
    } catch (err) {
      showToast(err?.message || 'Başvuru gönderilirken bir sorun oluştu.', 'danger')
    } finally {
      setIsApplying(false)
    }
  }

  const handleRequestPayout = async (payload) => {
    try {
      setIsSubmittingPayout(true)
      const res = await requestPayout(payload)
      showToast(
        res?.message ||
          t('creatorStudio.payoutModal.successMsg', 'Para çekim talebiniz işleme alındı.'),
      )
      const dashRes = await getCreatorDashboard()
      setDashboardData(dashRes?.data || null)
    } catch (err) {
      showToast(err?.message || 'Para çekim talebi oluşturulamadı.', 'danger')
      throw err
    } finally {
      setIsSubmittingPayout(false)
    }
  }

  const handleSimulateEarning = async () => {
    try {
      await simulateEarning({ type: 'loop_reward', amount: 150 })
      showToast('₺150 Loop video izlenme ödülü cüzdanınıza eklendi!')
      const dashRes = await getCreatorDashboard()
      setDashboardData(dashRes?.data || null)
    } catch (err) {
      // Fallback local update for preview
      setDashboardData((prev) => {
        const oldWallet = prev?.wallet || { balance: 0, lifetimeEarnings: 0 }
        return {
          ...prev,
          wallet: {
            ...oldWallet,
            balance: (oldWallet.balance || 0) + 150,
            lifetimeEarnings: (oldWallet.lifetimeEarnings || 0) + 150,
          },
        }
      })
      showToast('Örnek ₺150 kazanç simülasyon olarak eklendi.')
    }
  }

  const isApproved =
    Boolean(statusData?.isApproved) || statusData?.status === 'approved' || forceDashboardPreview

  // Başvuru yapılmış ama admin henüz onaylamamışsa (inceleme aşaması)
  const isPendingReview =
    !isApproved &&
    (statusData?.status === 'pending' ||
      (statusData?.application?.status === 'pending' && !statusData?.isApproved))

  // Admin başvuruyu onaylamış ve kriter sayaçları aktif olan aşama
  const isApprovedPendingCriteria =
    !isApproved &&
    (statusData?.status === 'approved_pending_criteria' ||
      (statusData?.application?.status === 'approved' && !statusData?.isApproved))

  // Demo dashboard veri şablonu (gerçek veri henüz yoksa preview için)
  const effectiveDashboardData = dashboardData || {
    wallet: {
      balance: 1450,
      pendingBalance: 250,
      lifetimeEarnings: 5800,
      currency: 'TRY',
      defaultPayoutAccount: {
        fullName: `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'İçerik Üreticisi',
        iban: 'TR33 0006 1005 1234 5678 9012 34',
        bankName: 'Ziraat Bankası',
      },
    },
    streams: {
      loopRewards: 3200,
      tips: 1650,
      groupSubscriptions: 950,
      profileSubscriptions: 1200,
    },
    chartData: [
      { date: '2026-09-06', amount: 120 },
      { date: '2026-09-07', amount: 240 },
      { date: '2026-09-08', amount: 180 },
      { date: '2026-09-09', amount: 450 },
      { date: '2026-09-10', amount: 310 },
      { date: '2026-09-11', amount: 520 },
      { date: '2026-09-12', amount: 380 },
    ],
    minPayoutAmount: 250,
    transactions: [
      {
        id: 'tx-1',
        type: 'loop_reward',
        title: 'Loop Video Hasılatı',
        netAmount: 180,
        status: 'completed',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'tx-2',
        type: 'tip_received',
        title: 'Takipçi Bahşişi',
        netAmount: 50,
        status: 'completed',
        createdAt: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: 'tx-3',
        type: 'profile_subscription',
        title: 'Aylık Profil Aboneliği',
        netAmount: 85,
        status: 'completed',
        createdAt: new Date(Date.now() - 7200000).toISOString(),
      },
    ],
    payoutRequests: [],
  }

  return (
    <>
      <Seo
        title={`Nest Social · ${t('creatorStudio.title', 'Üretici Stüdyosu')}`}
        description={t(
          'creatorStudio.tagline',
          'İçeriklerinle değer üret, Nest Social ekosisteminde gelir elde et.',
        )}
      />

      <SocialLayout
        pageTitle={t('creatorStudio.title', 'Üretici Stüdyosu')}
        activeKey="monetization"
        showDesktopPageHeader={false}
        desktopSidebarMode="drawer"
      >
        <div className="mx-auto max-w-5xl py-2 px-1 sm:px-0">
          {isLoading ? (
            <div className="space-y-4 animate-pulse">
              <div className="h-44 rounded-2xl bg-card border border-border" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="h-28 rounded-xl bg-card border border-border" />
                <div className="h-28 rounded-xl bg-card border border-border" />
                <div className="h-28 rounded-xl bg-card border border-border" />
              </div>
            </div>
          ) : isApproved ? (
            <div className="space-y-4">
              {forceDashboardPreview ? (
                <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/10 p-3 text-xs text-primary">
                  <span>
                    ✨ <strong>Canlı Önizleme Modundasınız:</strong> Bu ekran, içerik üreticileri onaylandığında görünen tam finansal kokpiti simüle etmektedir.
                  </span>
                  <button
                    type="button"
                    onClick={() => setForceDashboardPreview(false)}
                    className="font-semibold underline cursor-pointer hover:opacity-80"
                  >
                    Geri Dön
                  </button>
                </div>
              ) : null}

              <CreatorDashboardView
                dashboardData={effectiveDashboardData}
                onSimulateEarning={handleSimulateEarning}
                onRequestPayout={handleRequestPayout}
                isSubmittingPayout={isSubmittingPayout}
              />
            </div>
          ) : isPendingReview ? (
            <ApplicationPendingView
              user={user}
              application={statusData?.application}
              onSwitchToDemo={() => setForceDashboardPreview(true)}
            />
          ) : isApprovedPendingCriteria ? (
            <EligibilityGateView
              statusData={statusData}
              onSwitchToDemo={() => setForceDashboardPreview(true)}
              user={user}
            />
          ) : (
            <CreatorApplicationView
              user={user}
              onApply={handleApply}
              isApplying={isApplying}
              onSwitchToDemo={() => setForceDashboardPreview(true)}
            />
          )}
        </div>
      </SocialLayout>

      <ActionToast
        toast={toast}
        onClose={() => setToast({ message: '', tone: 'success' })}
      />
    </>
  )
}

export default MonetizationPage
