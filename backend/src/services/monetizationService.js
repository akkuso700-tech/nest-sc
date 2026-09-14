const { User } = require('../models/User')
const { Post } = require('../models/Post')
const { PostView } = require('../models/PostView')
const { Wallet } = require('../models/Wallet')
const { Transaction } = require('../models/Transaction')
const { PayoutRequest } = require('../models/PayoutRequest')
const { CreatorApplication } = require('../models/CreatorApplication')
const { AppError } = require('../utils/AppError')

const ELIGIBILITY_REQUIREMENTS = {
  minFollowers: 100, // Topluluk için uygun başlangıç eşiği
  minViews30d: 1000,
  minAccountAgeDays: 14,
  requireEmailVerified: true,
  requireVerifiedProfile: true, // Doğrulanmış profil olma şartı
  minPayoutAmount: 250, // Minimum çekim tutarı (TRY)
}

async function getOrCreateWallet(userId) {
  let wallet = await Wallet.findOne({ user: userId })
  if (!wallet) {
    wallet = await Wallet.create({
      user: userId,
      balance: 0,
      pendingBalance: 0,
      lifetimeEarnings: 0,
      currency: 'TRY',
      status: 'active',
    })
  }
  return wallet
}

async function calculateUserMetrics(userId, application = null) {
  const user = await User.findById(userId).select(
    '_id email emailVerifiedAt createdAt accountStatus role verification',
  )
  if (!user) {
    throw new AppError('Kullanıcı bulunamadı.', 404)
  }

  // 1. Takipçi sayısı (Bu kullanıcıyı arkadaş/takipçi listesine ekleyenler)
  const followersCount = await User.countDocuments({ friendIds: user._id })

  // 2. İzlenme Sayacı & 3. Hesap Güvenliği / Değerlendirme Süresi:
  // Admin onayından sonra sayaçların başlaması kuralı
  const isAppApproved = application?.status === 'approved' && application.reviewedAt
  const approvalDate = isAppApproved ? new Date(application.reviewedAt) : null

  let viewsCount30d = 0
  let accountAgeDays = 0

  if (isAppApproved && approvalDate) {
    // Admin onayından sonraki post/loop izlenmeleri
    const userPosts = await Post.find({
      author: user._id,
      createdAt: { $gte: approvalDate },
    }).select('_id')

    const postIds = userPosts.map((p) => p._id)
    if (postIds.length > 0) {
      viewsCount30d = await PostView.countDocuments({
        post: { $in: postIds },
        createdAt: { $gte: approvalDate },
      })
    }

    // Admin onayından itibaren geçen gün sayısı (hedef en az 14 gün)
    accountAgeDays = Math.max(
      0,
      Math.floor((Date.now() - approvalDate.getTime()) / (1000 * 60 * 60 * 24)),
    )
  } else {
    // Admin henüz onaylamamışsa veya ilk başvuru anlık görüntüsü için genel hesap geçmişi
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const userPosts = await Post.find({
      author: user._id,
      createdAt: { $gte: thirtyDaysAgo },
    }).select('_id')
    const postIds = userPosts.map((p) => p._id)
    if (postIds.length > 0) {
      viewsCount30d = await PostView.countDocuments({
        post: { $in: postIds },
        createdAt: { $gte: thirtyDaysAgo },
      })
    }
    accountAgeDays = Math.floor(
      (Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24),
    )
  }

  // 4. E-posta doğrulanma durumu
  const isEmailVerified = Boolean(user.emailVerifiedAt)

  // 5. Ceza durumu
  const hasNoActiveViolations = user.accountStatus === 'active'

  // 6. Profil doğrulama durumu (Profil Aboneliği & Üretici Fonu için onaylı profil şartı)
  const isProfileVerified = Boolean(
    user.verification?.status === 'approved' || user.role === 'admin',
  )

  const criteria = {
    followers: {
      current: followersCount,
      target: ELIGIBILITY_REQUIREMENTS.minFollowers,
      met: followersCount >= ELIGIBILITY_REQUIREMENTS.minFollowers,
    },
    views30d: {
      current: viewsCount30d,
      target: ELIGIBILITY_REQUIREMENTS.minViews30d,
      met: viewsCount30d >= ELIGIBILITY_REQUIREMENTS.minViews30d,
      startedAt: approvalDate ? approvalDate.toISOString() : null,
    },
    accountAge: {
      current: accountAgeDays,
      target: ELIGIBILITY_REQUIREMENTS.minAccountAgeDays,
      met: accountAgeDays >= ELIGIBILITY_REQUIREMENTS.minAccountAgeDays,
      startedAt: approvalDate ? approvalDate.toISOString() : null,
    },
    emailVerified: {
      met: isEmailVerified,
    },
    goodStanding: {
      met: hasNoActiveViolations,
    },
    verifiedProfile: {
      met: isProfileVerified,
      status: user.verification?.status || 'none',
    },
  }

  // Adminler doğrudan uygun kabul edilir
  const isPrivileged = user.role === 'admin'

  const isEligible =
    isPrivileged ||
    (criteria.followers.met &&
      criteria.views30d.met &&
      criteria.accountAge.met &&
      criteria.emailVerified.met &&
      criteria.goodStanding.met &&
      criteria.verifiedProfile.met)

  return {
    user,
    followersCount,
    viewsCount30d,
    accountAgeDays,
    isEmailVerified,
    hasNoActiveViolations,
    isProfileVerified,
    criteria,
    isEligible,
    isPrivileged,
    isAppApproved,
    approvalDate,
  }
}

async function getMonetizationStatus(userId) {
  const application = await CreatorApplication.findOne({ user: userId }).sort({
    createdAt: -1,
  })

  const metrics = await calculateUserMetrics(userId, application)

  let wallet = null
  const isPrivileged = metrics.isPrivileged

  // Tüm şartlar sağlandı mı ve kokpit açılabilir mi?
  const isFullyApproved = isPrivileged || (application?.status === 'approved' && metrics.isEligible)

  if (isFullyApproved) {
    wallet = await getOrCreateWallet(userId)
  }

  let status = 'not_enrolled'
  if (isFullyApproved) {
    status = 'approved'
  } else if (application?.status === 'approved') {
    status = 'approved_pending_criteria'
  } else if (application?.status === 'pending') {
    status = 'pending'
  } else if (application?.status === 'rejected') {
    status = 'rejected'
  }

  return {
    status,
    isApproved: isFullyApproved,
    isApplicationApproved: application?.status === 'approved',
    isEligible: metrics.isEligible,
    isPrivileged,
    requirements: ELIGIBILITY_REQUIREMENTS,
    criteria: metrics.criteria,
    application: application
      ? {
          id: application._id,
          status: application.status,
          createdAt: application.createdAt,
          reviewedAt: application.reviewedAt,
          statement: application.statement,
          reviewNote: application.reviewNote,
        }
      : null,
    wallet: wallet
      ? {
          balance: wallet.balance,
          pendingBalance: wallet.pendingBalance,
          lifetimeEarnings: wallet.lifetimeEarnings,
          currency: wallet.currency,
          defaultPayoutAccount: wallet.defaultPayoutAccount,
        }
      : null,
  }
}

async function applyForMonetization(userId, { statement = '' }) {
  const metrics = await calculateUserMetrics(userId)

  const existingApp = await CreatorApplication.findOne({
    user: userId,
    status: { $in: ['pending', 'approved'] },
  })

  if (existingApp) {
    if (existingApp.status === 'approved') {
      throw new AppError('Zaten onaylı bir içerik üreticisisiniz.', 400)
    }
    throw new AppError('Zaten incelenmekte olan bir başvurunuz bulunmaktadır.', 400)
  }

  // Her başvuru doğrudan pending olarak admin onayına iletilir
  const application = await CreatorApplication.create({
    user: userId,
    status: 'pending',
    metricsSnapshot: {
      followersCount: metrics.followersCount,
      viewsCount30d: metrics.viewsCount30d,
      isEmailVerified: metrics.isEmailVerified,
      accountAgeDays: metrics.accountAgeDays,
      hasNoActiveViolations: metrics.hasNoActiveViolations,
      isProfileVerified: metrics.isProfileVerified,
    },
    statement,
    termsAcceptedAt: new Date(),
    reviewedAt: null,
    reviewNote: '',
  })

  return {
    application,
    autoApproved: false,
  }
}

async function getCreatorDashboard(userId) {
  const wallet = await getOrCreateWallet(userId)

  // Son işlemler
  const transactions = await Transaction.find({ user: userId })
    .sort({ createdAt: -1 })
    .limit(15)
    .populate('sourceUser', 'username firstName lastName avatarUrl')

  // Son çekim talepleri
  const payoutRequests = await PayoutRequest.find({ user: userId })
    .sort({ createdAt: -1 })
    .limit(10)

  // Gelir akışları hesaplaması (Transactions üzerinden)
  const streamAggregations = await Transaction.aggregate([
    {
      $match: {
        user: wallet.user,
        status: 'completed',
        type: {
          $in: [
            'loop_reward',
            'tip_received',
            'group_subscription',
            'profile_subscription',
          ],
        },
      },
    },
    {
      $group: {
        _id: '$type',
        total: { $sum: '$netAmount' },
        count: { $sum: 1 },
      },
    },
  ])

  const streams = {
    loopRewards: 0,
    tips: 0,
    groupSubscriptions: 0,
    profileSubscriptions: 0,
  }

  streamAggregations.forEach((item) => {
    if (item._id === 'loop_reward') streams.loopRewards = item.total
    if (item._id === 'tip_received') streams.tips = item.total
    if (item._id === 'group_subscription') streams.groupSubscriptions = item.total
    if (item._id === 'profile_subscription') streams.profileSubscriptions = item.total
  })

  // Son 7 günlük grafik verisi (Chart data)
  const now = new Date()
  const chartDays = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().split('T')[0]
    chartDays.push({ date: dateStr, amount: 0 })
  }

  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const dailyTransactions = await Transaction.find({
    user: userId,
    status: 'completed',
    type: {
      $in: [
        'loop_reward',
        'tip_received',
        'group_subscription',
        'profile_subscription',
      ],
    },
    createdAt: { $gte: sevenDaysAgo },
  })

  dailyTransactions.forEach((tx) => {
    const txDate = new Date(tx.createdAt).toISOString().split('T')[0]
    const dayEntry = chartDays.find((d) => d.date === txDate)
    if (dayEntry) {
      dayEntry.amount += tx.netAmount
    }
  })

  // Sonraki ödeme tarihi: Her ayın 15'i
  const nextPayoutDate = new Date(now.getFullYear(), now.getMonth() + (now.getDate() > 15 ? 1 : 0), 15)

  return {
    wallet: {
      balance: wallet.balance,
      pendingBalance: wallet.pendingBalance,
      lifetimeEarnings: wallet.lifetimeEarnings,
      currency: wallet.currency,
      status: wallet.status,
      defaultPayoutAccount: wallet.defaultPayoutAccount,
    },
    streams,
    chartData: chartDays,
    nextPayoutDate,
    minPayoutAmount: ELIGIBILITY_REQUIREMENTS.minPayoutAmount,
    transactions: transactions.map((t) => ({
      id: t._id,
      type: t.type,
      amount: t.amount,
      netAmount: t.netAmount,
      platformFee: t.platformFee,
      currency: t.currency,
      status: t.status,
      title: t.title,
      description: t.description,
      createdAt: t.createdAt,
      sourceUser: t.sourceUser,
    })),
    payoutRequests: payoutRequests.map((p) => ({
      id: p._id,
      amount: p.amount,
      currency: p.currency,
      iban: p.iban,
      fullName: p.fullName,
      bankName: p.bankName,
      status: p.status,
      requestedAt: p.requestedAt,
      processedAt: p.processedAt,
      rejectionReason: p.rejectionReason,
    })),
  }
}

async function requestPayout(userId, { amount, iban, fullName, bankName = '', taxOrIdNumber = '' }) {
  const numericAmount = Number(amount)
  if (!numericAmount || numericAmount < ELIGIBILITY_REQUIREMENTS.minPayoutAmount) {
    throw new AppError(
      `Minimum çekilebilir tutar ₺${ELIGIBILITY_REQUIREMENTS.minPayoutAmount}'dir.`,
      400,
    )
  }

  const wallet = await getOrCreateWallet(userId)
  if (wallet.balance < numericAmount) {
    throw new AppError('Yetersiz bakiye.', 400)
  }

  const cleanIban = iban.replace(/\s+/g, '').toUpperCase()
  if (!cleanIban.startsWith('TR') || cleanIban.length !== 26) {
    throw new AppError('Lütfen geçerli bir TR IBAN adresi giriniz (26 karakter).', 400)
  }

  // Bakiyeden düş, bekleyen çekime aktar
  wallet.balance -= numericAmount
  wallet.pendingBalance += numericAmount
  wallet.defaultPayoutAccount = {
    fullName,
    iban: cleanIban,
    bankName,
    taxOrIdNumber,
    updatedAt: new Date(),
  }
  await wallet.save()

  // Çekim talebi oluştur
  const payoutRequest = await PayoutRequest.create({
    user: userId,
    wallet: wallet._id,
    amount: numericAmount,
    currency: wallet.currency,
    fullName,
    iban: cleanIban,
    bankName,
    taxOrIdNumber,
    status: 'pending',
  })

  // Transaction defter kaydı
  await Transaction.create({
    user: userId,
    wallet: wallet._id,
    type: 'payout_withdrawal',
    amount: numericAmount,
    platformFee: 0,
    netAmount: -numericAmount,
    currency: wallet.currency,
    status: 'pending',
    title: 'Banka Çekim Talebi',
    description: `${cleanIban} nolu hesaba transfer talebi`,
    referenceModel: 'PayoutRequest',
    referenceId: payoutRequest._id,
  })

  return payoutRequest
}

async function savePayoutAccount(userId, { fullName, iban, bankName = '', taxOrIdNumber = '' }) {
  const cleanIban = iban.replace(/\s+/g, '').toUpperCase()
  if (!cleanIban.startsWith('TR') || cleanIban.length !== 26) {
    throw new AppError('Lütfen geçerli bir TR IBAN adresi giriniz (26 karakter).', 400)
  }

  const wallet = await getOrCreateWallet(userId)
  wallet.defaultPayoutAccount = {
    fullName,
    iban: cleanIban,
    bankName,
    taxOrIdNumber,
    updatedAt: new Date(),
  }
  await wallet.save()

  return wallet.defaultPayoutAccount
}

// Geliştirme / Test amaçlı Demo Bakiye Yükleme (Geliştirici veya içerik üreticisi paneli denemesi için)
async function simulateEarning(userId, { type = 'loop_reward', amount = 150 }) {
  const wallet = await getOrCreateWallet(userId)
  const numericAmount = Number(amount)

  wallet.balance += numericAmount
  wallet.lifetimeEarnings += numericAmount
  await wallet.save()

  await Transaction.create({
    user: userId,
    wallet: wallet._id,
    type,
    amount: numericAmount,
    platformFee: 0,
    netAmount: numericAmount,
    currency: wallet.currency,
    status: 'completed',
    title:
      type === 'loop_reward'
        ? 'Loop Video İzlenme Ödülü'
        : type === 'tip_received'
          ? 'Takipçi Bahşişi'
          : type === 'profile_subscription'
            ? 'Profil Aboneliği (Aylık Destek)'
            : 'Özel Grup Aboneliği',
    description: 'İçerik etkileşiminden kazanılan tutar',
  })

  return wallet
}

module.exports = {
  ELIGIBILITY_REQUIREMENTS,
  getOrCreateWallet,
  calculateUserMetrics,
  getMonetizationStatus,
  applyForMonetization,
  getCreatorDashboard,
  requestPayout,
  savePayoutAccount,
  simulateEarning,
}
