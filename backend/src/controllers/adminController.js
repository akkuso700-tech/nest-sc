const mongoose = require('mongoose')
const { User } = require('../models/User')
const { Post } = require('../models/Post')
const { Comment } = require('../models/Comment')
const { Message } = require('../models/Message')
const { Notification } = require('../models/Notification')
const { Conversation } = require('../models/Conversation')
const { Report } = require('../models/Report')
const { AuditLog } = require('../models/AuditLog')
const { LocationConsentLog } = require('../models/LocationConsentLog')
const { CallLog } = require('../models/CallLog')
const { EmailVerificationToken } = require('../models/EmailVerificationToken')
const { VerificationRequest } = require('../models/VerificationRequest')
const { PostView } = require('../models/PostView')
const { RecommendationEvent } = require('../models/RecommendationEvent')
const {
  getSignupNotificationEmails,
  updateSignupNotificationEmails,
  getSignupContractsSettings,
  updateSignupContractsSettings,
} = require('../services/adminSettingsService')
const { asyncHandler } = require('../utils/asyncHandler')
const { AppError } = require('../utils/AppError')
const { createAuditLog } = require('../utils/auditLog')

function escapeRegex(value = '') {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function buildPagination(page, limit, totalItems) {
  const totalPages = Math.max(Math.ceil(totalItems / limit), 1)

  return {
    page,
    limit,
    totalItems,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  }
}

function buildUsersSummaryRange(period, dateFrom, dateTo) {
  const now = new Date()
  const normalizedPeriod = period || '7d'
  let rangeStart = new Date(now)
  let rangeEnd = new Date(now)

  if (normalizedPeriod === 'today') {
    rangeStart.setHours(0, 0, 0, 0)
    rangeEnd.setHours(23, 59, 59, 999)
    return { period: normalizedPeriod, rangeStart, rangeEnd }
  }

  if (normalizedPeriod === '7d') {
    rangeStart.setDate(rangeStart.getDate() - 6)
    rangeStart.setHours(0, 0, 0, 0)
    rangeEnd.setHours(23, 59, 59, 999)
    return { period: normalizedPeriod, rangeStart, rangeEnd }
  }

  if (normalizedPeriod === '30d') {
    rangeStart.setDate(rangeStart.getDate() - 29)
    rangeStart.setHours(0, 0, 0, 0)
    rangeEnd.setHours(23, 59, 59, 999)
    return { period: normalizedPeriod, rangeStart, rangeEnd }
  }

  const parsedDateFrom = new Date(dateFrom)
  const parsedDateTo = new Date(dateTo)

  if (
    Number.isNaN(parsedDateFrom.getTime()) ||
    Number.isNaN(parsedDateTo.getTime())
  ) {
    throw new AppError('Ozel tarih araligi gecersiz.', 400)
  }

  parsedDateFrom.setHours(0, 0, 0, 0)
  parsedDateTo.setHours(23, 59, 59, 999)

  if (parsedDateFrom > parsedDateTo) {
    throw new AppError('Baslangic tarihi bitis tarihinden buyuk olamaz.', 400)
  }

  return {
    period: 'custom',
    rangeStart: parsedDateFrom,
    rangeEnd: parsedDateTo,
  }
}

function buildPreviousRange(rangeStart, rangeEnd) {
  const durationMs = Math.max(rangeEnd.getTime() - rangeStart.getTime() + 1, 1)
  const previousRangeEnd = new Date(rangeStart.getTime() - 1)
  const previousRangeStart = new Date(previousRangeEnd.getTime() - durationMs + 1)

  return {
    previousRangeStart,
    previousRangeEnd,
  }
}

function percentChange(current, previous) {
  const safeCurrent = Number(current || 0)
  const safePrevious = Number(previous || 0)

  if (safePrevious <= 0) {
    return safeCurrent > 0 ? 100 : 0
  }

  return Number((((safeCurrent - safePrevious) / safePrevious) * 100).toFixed(2))
}

function buildOverviewDateRange(period = '28d', dateFrom, dateTo) {
  const now = new Date()
  let rangeStart = new Date(now)
  let rangeEnd = new Date(now)
  let previousStart = new Date(now)
  let previousEnd = new Date(now)
  let resolution = 'daily'
  let label = 'Son 28 Gün'
  let dateFormat = '%Y-%m-%d'

  if (period === 'today') {
    rangeStart.setHours(0, 0, 0, 0)
    rangeEnd.setHours(23, 59, 59, 999)
    previousStart = new Date(rangeStart)
    previousStart.setDate(previousStart.getDate() - 1)
    previousEnd = new Date(rangeEnd)
    previousEnd.setDate(previousEnd.getDate() - 1)
    resolution = 'hourly'
    dateFormat = '%Y-%m-%d %H:00'
    label = 'Bugün'
  } else if (period === 'yesterday') {
    rangeStart.setDate(rangeStart.getDate() - 1)
    rangeStart.setHours(0, 0, 0, 0)
    rangeEnd = new Date(rangeStart)
    rangeEnd.setHours(23, 59, 59, 999)
    previousStart = new Date(rangeStart)
    previousStart.setDate(previousStart.getDate() - 1)
    previousEnd = new Date(rangeEnd)
    previousEnd.setDate(previousEnd.getDate() - 1)
    resolution = 'hourly'
    dateFormat = '%Y-%m-%d %H:00'
    label = 'Dün'
  } else if (period === '7d') {
    rangeStart.setDate(rangeStart.getDate() - 6)
    rangeStart.setHours(0, 0, 0, 0)
    rangeEnd.setHours(23, 59, 59, 999)
    previousEnd = new Date(rangeStart.getTime() - 1)
    previousStart = new Date(previousEnd)
    previousStart.setDate(previousStart.getDate() - 6)
    previousStart.setHours(0, 0, 0, 0)
    resolution = 'daily'
    dateFormat = '%Y-%m-%d'
    label = 'Son 7 Gün'
  } else if (period === '28d') {
    rangeStart.setDate(rangeStart.getDate() - 27)
    rangeStart.setHours(0, 0, 0, 0)
    rangeEnd.setHours(23, 59, 59, 999)
    previousEnd = new Date(rangeStart.getTime() - 1)
    previousStart = new Date(previousEnd)
    previousStart.setDate(previousStart.getDate() - 27)
    previousStart.setHours(0, 0, 0, 0)
    resolution = 'daily'
    dateFormat = '%Y-%m-%d'
    label = 'Son 28 Gün'
  } else if (period === 'this_month') {
    rangeStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
    rangeEnd.setHours(23, 59, 59, 999)
    const prevMonthDays = Math.min(now.getDate(), new Date(now.getFullYear(), now.getMonth(), 0).getDate())
    previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0)
    previousEnd = new Date(now.getFullYear(), now.getMonth() - 1, prevMonthDays, 23, 59, 59, 999)
    resolution = 'daily'
    dateFormat = '%Y-%m-%d'
    label = 'Bu Ay'
  } else if (period === 'last_month') {
    rangeStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0)
    const lastDay = new Date(now.getFullYear(), now.getMonth(), 0).getDate()
    rangeEnd = new Date(now.getFullYear(), now.getMonth() - 1, lastDay, 23, 59, 59, 999)
    const prevLastDay = new Date(now.getFullYear(), now.getMonth() - 1, 0).getDate()
    previousStart = new Date(now.getFullYear(), now.getMonth() - 2, 1, 0, 0, 0, 0)
    previousEnd = new Date(now.getFullYear(), now.getMonth() - 2, prevLastDay, 23, 59, 59, 999)
    resolution = 'daily'
    dateFormat = '%Y-%m-%d'
    label = 'Geçen Ay'
  } else if (period === 'this_year') {
    rangeStart = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0)
    rangeEnd.setHours(23, 59, 59, 999)
    previousStart = new Date(now.getFullYear() - 1, 0, 1, 0, 0, 0, 0)
    previousEnd = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate(), 23, 59, 59, 999)
    resolution = 'monthly'
    dateFormat = '%Y-%m'
    label = 'Bu Yıl'
  } else if (period === 'custom') {
    const parsedStart = new Date(dateFrom)
    const parsedEnd = new Date(dateTo)
    if (!Number.isNaN(parsedStart.getTime()) && !Number.isNaN(parsedEnd.getTime())) {
      parsedStart.setHours(0, 0, 0, 0)
      parsedEnd.setHours(23, 59, 59, 999)
      rangeStart = parsedStart
      rangeEnd = parsedEnd
      const prev = buildPreviousRange(rangeStart, rangeEnd)
      previousStart = prev.previousRangeStart
      previousEnd = prev.previousRangeEnd
      const diffDays = Math.max(Math.round((rangeEnd - rangeStart) / (1000 * 60 * 60 * 24)), 1)
      if (diffDays <= 2) {
        resolution = 'hourly'
        dateFormat = '%Y-%m-%d %H:00'
      } else if (diffDays > 90) {
        resolution = 'monthly'
        dateFormat = '%Y-%m'
      } else {
        resolution = 'daily'
        dateFormat = '%Y-%m-%d'
      }
      label = 'Özel Aralık'
    } else {
      return buildOverviewDateRange('28d')
    }
  }

  return {
    period,
    rangeStart,
    rangeEnd,
    previousStart,
    previousEnd,
    resolution,
    dateFormat,
    label,
  }
}

const getOverview = asyncHandler(async (req, res) => {
  const { period = '28d', dateFrom = '', dateTo = '' } = req.validated?.query || {}
  const dateRange = buildOverviewDateRange(period, dateFrom, dateTo)
  const { rangeStart, rangeEnd, previousStart, previousEnd, dateFormat, resolution, label } = dateRange

  const activeSince = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30)
  const lastSevenDays = new Date(Date.now() - 1000 * 60 * 60 * 24 * 7)

  const [
    totalUsers,
    activeUsers,
    weeklyActiveUsers,
    totalPosts,
    totalMessages,
    totalNotifications,
    suspendedUsers,
    hiddenPosts,
    removedPosts,
    hiddenComments,
    removedComments,
    openReports,
    inReviewReports,
    totalAuditLogs,
    usersWithLocationConsent,
    usersWithApproxLocation,
    nearbyDiscoveryUsage,
    roleBreakdown,
    countryBreakdown,
    latestRegistrations,
    cityBreakdown,
    contentEngagement,
    loopQualityAggregate,
    hiddenLoopPosts,
    removedLoopPosts,
    recommendationViewBreakdown,
    recommendationEventBreakdown,
    periodNewUsers,
    prevNewUsers,
    periodActiveUsers,
    prevActiveUsers,
    periodPosts,
    prevPosts,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ lastLoginAt: { $gte: activeSince } }),
    User.countDocuments({ lastLoginAt: { $gte: lastSevenDays } }),
    Post.countDocuments(),
    Message.countDocuments(),
    Notification.countDocuments(),
    User.countDocuments({ accountStatus: 'suspended' }),
    Post.countDocuments({ 'moderation.visibility': 'hidden' }),
    Post.countDocuments({ 'moderation.visibility': 'removed' }),
    Comment.countDocuments({ 'moderation.visibility': 'hidden' }),
    Comment.countDocuments({ 'moderation.visibility': 'removed' }),
    Report.countDocuments({ status: 'open' }),
    Report.countDocuments({ status: 'in_review' }),
    AuditLog.countDocuments(),
    User.countDocuments({ 'discovery.locationConsent.status': 'granted' }),
    User.countDocuments({
      'discovery.lastApproxLocation.latRounded': { $ne: null },
      'discovery.lastApproxLocation.lngRounded': { $ne: null },
    }),
    User.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: '$discovery.nearbyDiscoveryUsageCount' },
        },
      },
    ]),
    User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    User.aggregate([
      { $group: { _id: '$location.country', count: { $sum: 1 } } },
      { $match: { _id: { $ne: '' } } },
      { $sort: { count: -1 } },
    ]),
    User.aggregate([
      {
        $match: {
          createdAt: { $gte: rangeStart, $lte: rangeEnd },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: dateFormat, date: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    User.aggregate([
      { $group: { _id: '$location.city', count: { $sum: 1 } } },
      { $match: { _id: { $ne: '' } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
    Post.aggregate([
      {
        $group: {
          _id: null,
          likes: { $sum: '$stats.likes' },
          comments: { $sum: '$stats.comments' },
          shares: { $sum: '$stats.shares' },
          saves: { $sum: '$stats.saves' },
        },
      },
    ]),
    Post.aggregate([
      {
        $match: {
          contentType: 'loop',
        },
      },
      {
        $group: {
          _id: null,
          totalLoops: { $sum: 1 },
          views: { $sum: '$stats.views' },
          completions: { $sum: '$stats.loopCompletions' },
          replays: { $sum: '$stats.loopReplays' },
          signals: { $sum: '$stats.loopSignalsCount' },
          watchRatioSum: { $sum: '$stats.loopWatchRatioSum' },
          swipeVelocitySum: { $sum: '$stats.loopSwipeVelocitySum' },
          visibleMsSum: { $sum: '$stats.loopVisibleMsSum' },
        },
      },
    ]),
    Post.countDocuments({
      contentType: 'loop',
      'moderation.visibility': 'hidden',
    }),
    Post.countDocuments({
      contentType: 'loop',
      'moderation.visibility': 'removed',
    }),
    PostView.aggregate([
      { $match: { createdAt: { $gte: rangeStart, $lte: rangeEnd } } },
      {
        $group: {
          _id: {
            algorithm: '$algorithm',
            experimentId: '$experimentId',
            variant: '$experimentVariant',
          },
          impressions: { $sum: 1 },
          quickSkips: { $sum: { $cond: ['$quickSkipRecorded', 1, 0] } },
          longViews: { $sum: { $cond: ['$longViewRecorded', 1, 0] } },
        },
      },
    ]),
    RecommendationEvent.aggregate([
      { $match: { createdAt: { $gte: rangeStart, $lte: rangeEnd } } },
      {
        $group: {
          _id: {
            algorithm: '$algorithm',
            experimentId: '$experimentId',
            variant: '$experimentVariant',
          },
          saves: { $sum: { $cond: [{ $eq: ['$eventType', 'save'] }, 1, 0] } },
          shares: { $sum: { $cond: [{ $eq: ['$eventType', 'share'] }, 1, 0] } },
          hides: {
            $sum: { $cond: [{ $eq: ['$eventType', 'not-interested'] }, 1, 0] },
          },
        },
      },
    ]),
    User.countDocuments({ createdAt: { $gte: rangeStart, $lte: rangeEnd } }),
    User.countDocuments({ createdAt: { $gte: previousStart, $lte: previousEnd } }),
    User.countDocuments({ lastLoginAt: { $gte: rangeStart, $lte: rangeEnd } }),
    User.countDocuments({ lastLoginAt: { $gte: previousStart, $lte: previousEnd } }),
    Post.countDocuments({ createdAt: { $gte: rangeStart, $lte: rangeEnd } }),
    Post.countDocuments({ createdAt: { $gte: previousStart, $lte: previousEnd } }),
  ])

  const recommendationBreakdownMap = new Map()
  const getRecommendationBreakdownKey = (entry = {}) =>
    [entry.algorithm || 'unattributed', entry.experimentId || 'none', entry.variant || 'none'].join('|')
  const ensureRecommendationBreakdown = (entry = {}) => {
    const key = getRecommendationBreakdownKey(entry)
    if (!recommendationBreakdownMap.has(key)) {
      recommendationBreakdownMap.set(key, {
        algorithm: entry.algorithm || 'unattributed',
        experimentId: entry.experimentId || null,
        variant: entry.variant || null,
        impressions: 0,
        quickSkips: 0,
        longViews: 0,
        saves: 0,
        shares: 0,
        hides: 0,
      })
    }
    return recommendationBreakdownMap.get(key)
  }

  for (const entry of recommendationViewBreakdown) {
    const target = ensureRecommendationBreakdown(entry._id)
    target.impressions += Number(entry.impressions || 0)
    target.quickSkips += Number(entry.quickSkips || 0)
    target.longViews += Number(entry.longViews || 0)
  }
  for (const entry of recommendationEventBreakdown) {
    const target = ensureRecommendationBreakdown(entry._id)
    target.saves += Number(entry.saves || 0)
    target.shares += Number(entry.shares || 0)
    target.hides += Number(entry.hides || 0)
  }

  const recommendationBreakdown = [...recommendationBreakdownMap.values()]
    .map((entry) => ({
      ...entry,
      quickSkipRate:
        entry.impressions > 0 ? Number(((entry.quickSkips / entry.impressions) * 100).toFixed(2)) : 0,
      longViewRate:
        entry.impressions > 0 ? Number(((entry.longViews / entry.impressions) * 100).toFixed(2)) : 0,
      saveRate:
        entry.impressions > 0 ? Number(((entry.saves / entry.impressions) * 100).toFixed(2)) : 0,
      shareRate:
        entry.impressions > 0 ? Number(((entry.shares / entry.impressions) * 100).toFixed(2)) : 0,
      hideRate:
        entry.impressions > 0 ? Number(((entry.hides / entry.impressions) * 100).toFixed(2)) : 0,
    }))
    .sort((left, right) => right.impressions - left.impressions)
  const recommendationTotals = recommendationBreakdown.reduce(
    (totals, entry) => {
      for (const field of ['impressions', 'quickSkips', 'longViews', 'saves', 'shares', 'hides']) {
        totals[field] += Number(entry[field] || 0)
      }
      return totals
    },
    { impressions: 0, quickSkips: 0, longViews: 0, saves: 0, shares: 0, hides: 0 },
  )
  const recommendationRate = (count) =>
    recommendationTotals.impressions > 0
      ? Number(((Number(count || 0) / recommendationTotals.impressions) * 100).toFixed(2))
      : 0

  const loopQualityBase = loopQualityAggregate[0] || {
    totalLoops: 0,
    views: 0,
    completions: 0,
    replays: 0,
    signals: 0,
    watchRatioSum: 0,
    swipeVelocitySum: 0,
    visibleMsSum: 0,
  }
  const safeLoopViews = Math.max(Number(loopQualityBase.views || 0), 1)
  const safeLoopSignals = Math.max(Number(loopQualityBase.signals || 0), 1)
  const completionRate =
    Number(loopQualityBase.views || 0) > 0
      ? Number(((Number(loopQualityBase.completions || 0) / safeLoopViews) * 100).toFixed(2))
      : 0
  const replayPerView =
    Number(loopQualityBase.views || 0) > 0
      ? Number((Number(loopQualityBase.replays || 0) / safeLoopViews).toFixed(3))
      : 0
  const avgWatchRatio =
    Number(loopQualityBase.signals || 0) > 0
      ? Number((Number(loopQualityBase.watchRatioSum || 0) / safeLoopSignals).toFixed(3))
      : 0
  const avgSwipeVelocity =
    Number(loopQualityBase.signals || 0) > 0
      ? Number((Number(loopQualityBase.swipeVelocitySum || 0) / safeLoopSignals).toFixed(2))
      : 0
  const avgVisibleMs =
    Number(loopQualityBase.views || 0) > 0
      ? Number((Number(loopQualityBase.visibleMsSum || 0) / safeLoopViews).toFixed(0))
      : 0
  const signalCoverage =
    Number(loopQualityBase.views || 0) > 0
      ? Number(((Number(loopQualityBase.signals || 0) / safeLoopViews) * 100).toFixed(2))
      : 0
  const rankingConfidenceScore = Number(
    (
      clamp(Math.log10(Number(loopQualityBase.views || 0) + 1) / 2, 0, 1) * 60 +
      clamp(Number(loopQualityBase.signals || 0) / 25, 0, 1) * 40
    ).toFixed(2),
  )

  const newUsersChangePct = percentChange(periodNewUsers, prevNewUsers)
  const activeUsersChangePct = percentChange(periodActiveUsers, prevActiveUsers)
  const postsChangePct = percentChange(periodPosts, prevPosts)

  res.json({
    dateFilter: {
      period,
      label,
      resolution,
      rangeStart: rangeStart.toISOString(),
      rangeEnd: rangeEnd.toISOString(),
      previousStart: previousStart.toISOString(),
      previousEnd: previousEnd.toISOString(),
      newUsers: {
        current: periodNewUsers,
        previous: prevNewUsers,
        changePct: newUsersChangePct,
      },
      activeUsers: {
        current: periodActiveUsers,
        previous: prevActiveUsers,
        changePct: activeUsersChangePct,
      },
      posts: {
        current: periodPosts,
        previous: prevPosts,
        changePct: postsChangePct,
      },
    },
    metrics: {
      totalUsers,
      activeUsers,
      weeklyActiveUsers,
      totalPosts,
      totalMessages,
      totalNotifications,
    },
    moderationSummary: {
      suspendedUsers,
      hiddenPosts,
      removedPosts,
      hiddenComments,
      removedComments,
      openReports,
      inReviewReports,
      totalAuditLogs,
      usersWithLocationConsent,
      usersWithApproxLocation,
      nearbyDiscoveryUsageTotal: nearbyDiscoveryUsage[0]?.total || 0,
    },
    roleBreakdown,
    countryBreakdown,
    cityBreakdown,
    latestRegistrations,
    contentEngagement:
      contentEngagement[0] || { likes: 0, comments: 0, shares: 0, saves: 0 },
    loopQuality: {
      totalLoops: Number(loopQualityBase.totalLoops || 0),
      views: Number(loopQualityBase.views || 0),
      completions: Number(loopQualityBase.completions || 0),
      replays: Number(loopQualityBase.replays || 0),
      signals: Number(loopQualityBase.signals || 0),
      completionRate,
      replayPerView,
      avgWatchRatio,
      avgSwipeVelocity,
      avgVisibleMs,
      signalCoverage,
      rankingConfidenceScore,
      hiddenLoops: hiddenLoopPosts,
      removedLoops: removedLoopPosts,
    },
    recommendationQuality: {
      windowDays: 7,
      ...recommendationTotals,
      quickSkipRate: recommendationRate(recommendationTotals.quickSkips),
      longViewRate: recommendationRate(recommendationTotals.longViews),
      saveRate: recommendationRate(recommendationTotals.saves),
      shareRate: recommendationRate(recommendationTotals.shares),
      hideRate: recommendationRate(recommendationTotals.hides),
      breakdown: recommendationBreakdown,
    },
  })
})

const listUsers = asyncHandler(async (req, res) => {
  const { q, role, accountStatus, country, sortBy, sortDirection, page, limit } =
    req.validated.query
  const filter = {}

  if (role !== 'all') {
    filter.role = role
  }

  if (accountStatus !== 'all') {
    filter.accountStatus = accountStatus
  }

  if (country) {
    filter['location.country'] = new RegExp(escapeRegex(country), 'i')
  }

  if (q) {
    const searchRegex = new RegExp(escapeRegex(q), 'i')
    filter.$or = [
      { firstName: searchRegex },
      { lastName: searchRegex },
      { username: searchRegex },
      { email: searchRegex },
    ]
  }

  const sortField = sortBy === 'lastLoginAt' ? 'lastLoginAt' : 'createdAt'
  const sortValue = sortDirection === 'asc' ? 1 : -1

  const totalItems = await User.countDocuments(filter)
  const users = await User.find(filter)
    .select(
      'firstName lastName username email birthDate location role accountStatus moderation avatarUrl lastLoginAt createdAt friendIds activity signupConsent.ipAddress signupConsent.city signupConsent.country signupConsent.language signupConsent.browserLanguage',
    )
    .sort({ [sortField]: sortValue, _id: -1 })
    .skip((page - 1) * limit)
    .limit(limit)

  res.json({
    users,
    pagination: buildPagination(page, limit, totalItems),
  })
})

const getUsersSummary = asyncHandler(async (req, res) => {
  const { period, dateFrom, dateTo } = req.validated.query
  const { rangeStart, rangeEnd, period: resolvedPeriod } = buildUsersSummaryRange(
    period,
    dateFrom,
    dateTo,
  )
  const rangeFilter = {
    $gte: rangeStart,
    $lte: rangeEnd,
  }

  const [totalUsers, newUsers, activeUsers, totalVisitors] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ createdAt: rangeFilter }),
    User.countDocuments({ lastLoginAt: rangeFilter }),
    User.countDocuments({
      $or: [{ createdAt: rangeFilter }, { lastLoginAt: rangeFilter }],
    }),
  ])

  const conversionRate =
    totalVisitors > 0 ? Number(((activeUsers / totalVisitors) * 100).toFixed(2)) : 0

  res.json({
    metrics: {
      totalUsers,
      userGrowth: {
        newUsers,
      },
      activeUsers: {
        count: activeUsers,
      },
      conversion: {
        rate: conversionRate,
        totalVisitors,
        loggedInUsers: activeUsers,
      },
    },
    meta: {
      period: resolvedPeriod,
      rangeStart: rangeStart.toISOString(),
      rangeEnd: rangeEnd.toISOString(),
    },
  })
})

const getContentSummary = asyncHandler(async (req, res) => {
  const { period, dateFrom, dateTo } = req.validated.query
  const { rangeStart, rangeEnd, period: resolvedPeriod } = buildUsersSummaryRange(
    period,
    dateFrom,
    dateTo,
  )
  const { previousRangeStart, previousRangeEnd } = buildPreviousRange(rangeStart, rangeEnd)

  const currentRangeFilter = {
    $gte: rangeStart,
    $lte: rangeEnd,
  }
  const previousRangeFilter = {
    $gte: previousRangeStart,
    $lte: previousRangeEnd,
  }

  const weightedPostScore = {
    $add: [
      { $multiply: [{ $ifNull: ['$stats.likes', 0] }, 3] },
      { $multiply: [{ $ifNull: ['$stats.comments', 0] }, 4] },
      { $multiply: [{ $ifNull: ['$stats.shares', 0] }, 4] },
      { $multiply: [{ $ifNull: ['$stats.saves', 0] }, 5] },
    ],
  }
  const weightedLoopScore = {
    $add: [
      { $ifNull: ['$stats.views', 0] },
      { $multiply: [{ $ifNull: ['$stats.loopCompletions', 0] }, 2] },
      { $ifNull: ['$stats.loopReplays', 0] },
      { $multiply: [{ $ifNull: ['$stats.likes', 0] }, 2] },
      { $multiply: [{ $ifNull: ['$stats.comments', 0] }, 3] },
      { $multiply: [{ $ifNull: ['$stats.shares', 0] }, 3] },
      { $multiply: [{ $ifNull: ['$stats.saves', 0] }, 4] },
    ],
  }

  const countByEngagement = async (contentType, rangeFilter, scoreExpression, threshold) => {
    const result = await Post.aggregate([
      {
        $match: {
          contentType,
          createdAt: rangeFilter,
        },
      },
      {
        $project: {
          score: scoreExpression,
        },
      },
      {
        $match: {
          score: { $gte: threshold },
        },
      },
      {
        $count: 'total',
      },
    ])

    return Number(result?.[0]?.total || 0)
  }

  const [totalContent, totalLoops, totalPosts] = await Promise.all([
    Post.countDocuments(),
    Post.countDocuments({ contentType: 'loop' }),
    Post.countDocuments({ contentType: 'post' }),
  ])

  const [
    currentLoopPosts,
    previousLoopPosts,
    currentRegularPosts,
    previousRegularPosts,
    currentTrendingPostCount,
    previousTrendingPostCount,
    currentPopularPostCount,
    previousPopularPostCount,
    currentTrendingLoopCount,
    previousTrendingLoopCount,
    currentPopularLoopCount,
    previousPopularLoopCount,
    currentStoriesCount,
    previousStoriesCount,
    currentRemovedContentCount,
    previousRemovedContentCount,
    currentPendingReviewCount,
    previousPendingReviewCount,
  ] = await Promise.all([
    Post.countDocuments({ contentType: 'loop', createdAt: currentRangeFilter }),
    Post.countDocuments({ contentType: 'loop', createdAt: previousRangeFilter }),
    Post.countDocuments({ contentType: 'post', createdAt: currentRangeFilter }),
    Post.countDocuments({ contentType: 'post', createdAt: previousRangeFilter }),
    countByEngagement('post', currentRangeFilter, weightedPostScore, 15),
    countByEngagement('post', previousRangeFilter, weightedPostScore, 15),
    countByEngagement('post', currentRangeFilter, weightedPostScore, 35),
    countByEngagement('post', previousRangeFilter, weightedPostScore, 35),
    countByEngagement('loop', currentRangeFilter, weightedLoopScore, 20),
    countByEngagement('loop', previousRangeFilter, weightedLoopScore, 20),
    countByEngagement('loop', currentRangeFilter, weightedLoopScore, 50),
    countByEngagement('loop', previousRangeFilter, weightedLoopScore, 50),
    Post.countDocuments({ contentType: 'story', createdAt: currentRangeFilter }),
    Post.countDocuments({ contentType: 'story', createdAt: previousRangeFilter }),
    Post.countDocuments({
      'moderation.visibility': { $in: ['hidden', 'removed'] },
      $or: [
        { 'moderation.actionedAt': currentRangeFilter },
        {
          'moderation.actionedAt': null,
          createdAt: currentRangeFilter,
        },
      ],
    }),
    Post.countDocuments({
      'moderation.visibility': { $in: ['hidden', 'removed'] },
      $or: [
        { 'moderation.actionedAt': previousRangeFilter },
        {
          'moderation.actionedAt': null,
          createdAt: previousRangeFilter,
        },
      ],
    }),
    Report.countDocuments({
      targetKind: { $in: ['post', 'comment'] },
      status: { $in: ['open', 'in_review'] },
      createdAt: currentRangeFilter,
    }),
    Report.countDocuments({
      targetKind: { $in: ['post', 'comment'] },
      status: { $in: ['open', 'in_review'] },
      createdAt: previousRangeFilter,
    }),
  ])

  const currentPublishTotal = Number(currentLoopPosts || 0) + Number(currentRegularPosts || 0)
  const previousPublishTotal = Number(previousLoopPosts || 0) + Number(previousRegularPosts || 0)

  res.json({
    metrics: {
      totalContent: {
        total: Number(totalContent || 0),
        loops: Number(totalLoops || 0),
        posts: Number(totalPosts || 0),
      },
      activity: {
        total: currentPublishTotal,
        changePct: percentChange(currentPublishTotal, previousPublishTotal),
        loops: {
          count: Number(currentLoopPosts || 0),
          changePct: percentChange(currentLoopPosts, previousLoopPosts),
        },
        posts: {
          count: Number(currentRegularPosts || 0),
          changePct: percentChange(currentRegularPosts, previousRegularPosts),
        },
      },
      postEngagement: {
        trendCount: Number(currentTrendingPostCount || 0),
        trendChangePct: percentChange(currentTrendingPostCount, previousTrendingPostCount),
        popularCount: Number(currentPopularPostCount || 0),
        popularChangePct: percentChange(currentPopularPostCount, previousPopularPostCount),
      },
      loopEngagement: {
        trendCount: Number(currentTrendingLoopCount || 0),
        trendChangePct: percentChange(currentTrendingLoopCount, previousTrendingLoopCount),
        popularCount: Number(currentPopularLoopCount || 0),
        popularChangePct: percentChange(currentPopularLoopCount, previousPopularLoopCount),
      },
      stories: {
        count: Number(currentStoriesCount || 0),
        changePct: percentChange(currentStoriesCount, previousStoriesCount),
      },
      featured: {
        isActive: false,
      },
      removedContent: {
        count: Number(currentRemovedContentCount || 0),
        changePct: percentChange(currentRemovedContentCount, previousRemovedContentCount),
      },
      pendingReview: {
        count: Number(currentPendingReviewCount || 0),
        changePct: percentChange(currentPendingReviewCount, previousPendingReviewCount),
      },
    },
    meta: {
      period: resolvedPeriod,
      rangeStart: rangeStart.toISOString(),
      rangeEnd: rangeEnd.toISOString(),
      previousRangeStart: previousRangeStart.toISOString(),
      previousRangeEnd: previousRangeEnd.toISOString(),
    },
  })
})

async function deleteUsersAndRelatedData(userIds) {
  const objectIds = userIds.map((id) => new mongoose.Types.ObjectId(id))

  const usersToDelete = await User.find(
    { _id: { $in: objectIds } },
    { _id: 1, email: 1 },
  ).lean()
  const emailsToDelete = usersToDelete.map((item) => item.email).filter(Boolean)

  const postsByUsers = await Post.find(
    { author: { $in: objectIds } },
    { _id: 1 },
  ).lean()
  const postIds = postsByUsers.map((item) => item._id)

  const commentsByUsersOrOnPosts = await Comment.find(
    {
      $or: [
        { author: { $in: objectIds } },
        ...(postIds.length ? [{ post: { $in: postIds } }] : []),
      ],
    },
    { _id: 1 },
  ).lean()
  const commentIds = commentsByUsersOrOnPosts.map((item) => item._id)

  const messagesByUsers = await Message.find(
    {
      $or: [
        { sender: { $in: objectIds } },
        { recipient: { $in: objectIds } },
      ],
    },
    { _id: 1 },
  ).lean()
  const messageIds = messagesByUsers.map((item) => item._id)

  await Promise.all([
    Notification.deleteMany({
      $or: [
        { user: { $in: objectIds } },
        { actor: { $in: objectIds } },
        { entityKind: 'profile', entityId: { $in: objectIds } },
        ...(postIds.length ? [{ entityKind: 'post', entityId: { $in: postIds } }] : []),
        ...(commentIds.length ? [{ entityKind: 'comment', entityId: { $in: commentIds } }] : []),
        ...(messageIds.length ? [{ entityKind: 'message', entityId: { $in: messageIds } }] : []),
      ],
    }),
    Report.deleteMany({
      $or: [
        { reporter: { $in: objectIds } },
        { reviewedBy: { $in: objectIds } },
        { targetKind: 'user', targetId: { $in: objectIds } },
        ...(postIds.length ? [{ targetKind: 'post', targetId: { $in: postIds } }] : []),
        ...(commentIds.length ? [{ targetKind: 'comment', targetId: { $in: commentIds } }] : []),
        ...(messageIds.length ? [{ targetKind: 'message', targetId: { $in: messageIds } }] : []),
      ],
    }),
    AuditLog.deleteMany({
      $or: [
        { actor: { $in: objectIds } },
        { targetKind: 'user', targetId: { $in: objectIds } },
        ...(postIds.length ? [{ targetKind: 'post', targetId: { $in: postIds } }] : []),
        ...(commentIds.length ? [{ targetKind: 'comment', targetId: { $in: commentIds } }] : []),
      ],
    }),
    LocationConsentLog.deleteMany({ user: { $in: objectIds } }),
    Conversation.deleteMany({ participantIds: { $in: objectIds } }),
    Conversation.updateMany(
      { participantIds: { $nin: objectIds } },
      { $pull: { hiddenByUserIds: { $in: objectIds } } },
    ),
    Message.deleteMany({
      $or: [
        { sender: { $in: objectIds } },
        { recipient: { $in: objectIds } },
      ],
    }),
    Message.updateMany(
      {
        sender: { $nin: objectIds },
        recipient: { $nin: objectIds },
      },
      { $pull: { deletedByUserIds: { $in: objectIds } } },
    ),
    Comment.deleteMany({
      $or: [
        { author: { $in: objectIds } },
        ...(postIds.length ? [{ post: { $in: postIds } }] : []),
      ],
    }),
    Post.deleteMany({ author: { $in: objectIds } }),
    User.updateMany(
      { _id: { $nin: objectIds } },
      {
        $pull: {
          friendIds: { $in: objectIds },
          blockedUserIds: { $in: objectIds },
          'activity.viewedProfileIds': { $in: objectIds },
          'activity.likedPostIds': { $in: postIds },
          'activity.commentedPostIds': { $in: postIds },
          'activity.savedPostIds': { $in: postIds },
          'activity.sharedPostIds': { $in: postIds },
        },
      },
    ),
    Post.updateMany(
      {},
      {
        $pull: {
          likedByUserIds: { $in: objectIds },
          savedByUserIds: { $in: objectIds },
          sharedByUserIds: { $in: objectIds },
        },
      },
    ),
    Comment.updateMany(
      {},
      {
        $pull: {
          likedByUserIds: { $in: objectIds },
          savedByUserIds: { $in: objectIds },
          sharedByUserIds: { $in: objectIds },
        },
      },
    ),
    User.deleteMany({ _id: { $in: objectIds } }),
    ...(emailsToDelete.length
      ? [EmailVerificationToken.deleteMany({ email: { $in: emailsToDelete } })]
      : []),
  ])
}

const listAuditLogs = asyncHandler(async (req, res) => {
  const { q, action, actor, targetKind, targetId, dateFrom, dateTo, page, limit } =
    req.validated.query
  const filter = {}

  if (action) {
    filter.action = new RegExp(escapeRegex(action), 'i')
  }

  if (actor) {
    const actorRegex = new RegExp(escapeRegex(actor), 'i')
    const matchingActors = await User.find(
      {
        $or: [
          { firstName: actorRegex },
          { lastName: actorRegex },
          { username: actorRegex },
          { email: actorRegex },
        ],
      },
      { _id: 1 },
    ).lean()

    filter.actor = { $in: matchingActors.map((item) => item._id) }
  }

  if (targetKind !== 'all') {
    filter.targetKind = targetKind
  }

  if (targetId && mongoose.isValidObjectId(targetId)) {
    filter.targetId = targetId
  }

  if (dateFrom || dateTo) {
    filter.createdAt = {}

    if (dateFrom) {
      const fromDate = new Date(dateFrom)
      if (!Number.isNaN(fromDate.getTime())) {
        filter.createdAt.$gte = fromDate
      }
    }

    if (dateTo) {
      const toDate = new Date(dateTo)
      if (!Number.isNaN(toDate.getTime())) {
        toDate.setHours(23, 59, 59, 999)
        filter.createdAt.$lte = toDate
      }
    }

    if (!Object.keys(filter.createdAt).length) {
      delete filter.createdAt
    }
  }

  if (q) {
    const searchRegex = new RegExp(escapeRegex(q), 'i')
    filter.$or = [{ action: searchRegex }, { summary: searchRegex }]
  }

  const totalItems = await AuditLog.countDocuments(filter)
  const logs = await AuditLog.find(filter)
    .populate('actor', 'firstName lastName username email')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)

  res.json({
    logs,
    pagination: buildPagination(page, limit, totalItems),
  })
})

const getUserDetail = asyncHandler(async (req, res) => {
  const { userId } = req.validated?.params || req.params

  if (!mongoose.isValidObjectId(userId)) {
    throw new AppError('Gecersiz kullanici kimligi.', 400)
  }

  const [user, posts, conversations, messages, locationLogs, callLogs] = await Promise.all([
    User.findById(userId)
      .select('-passwordHash')
      .populate('friendIds', 'firstName lastName username')
      .populate('activity.viewedProfileIds', 'firstName lastName username')
      .populate('activity.likedPostIds', '_id text createdAt')
      .populate('activity.commentedPostIds', '_id text createdAt')
      .populate('activity.savedPostIds', '_id text createdAt')
      .populate('activity.sharedPostIds', '_id text createdAt'),
    Post.find({ author: userId }).sort({ createdAt: -1 }).limit(20),
    Conversation.find({ participantIds: userId })
      .populate('participantIds', 'firstName lastName username avatarUrl verification accountStatus')
      .sort({ updatedAt: -1 }),
    Message.find({
      $or: [{ sender: userId }, { recipient: userId }],
    })
      .populate('sender', 'firstName lastName username avatarUrl verification')
      .populate('recipient', 'firstName lastName username avatarUrl verification')
      .sort({ createdAt: 1 }),
    LocationConsentLog.find({ user: userId }).sort({ createdAt: -1 }).limit(20),
    CallLog.find({
      $or: [{ caller: userId }, { recipient: userId }],
    })
      .populate('caller', 'firstName lastName username avatarUrl verification')
      .populate('recipient', 'firstName lastName username avatarUrl verification')
      .sort({ createdAt: -1 })
      .limit(100),
  ])

  if (!user) {
    throw new AppError('Kullanici bulunamadi.', 404)
  }

  res.json({
    user,
    posts,
    conversations,
    messages,
    locationLogs,
    callLogs,
  })
})

const listVerificationRequests = asyncHandler(async (req, res) => {
  const { q, status, category, page, limit } = req.validated.query
  const filter = {}

  if (status !== 'all') filter.status = status
  if (category !== 'all') filter.category = category

  if (q) {
    const searchRegex = new RegExp(escapeRegex(q), 'i')
    const matchingUsers = await User.find({
      $or: [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { username: searchRegex },
        { email: searchRegex },
      ],
    }).select('_id')
    filter.user = { $in: matchingUsers.map((user) => user._id) }
  }

  const [totalItems, requests] = await Promise.all([
    VerificationRequest.countDocuments(filter),
    VerificationRequest.find(filter)
      .populate('user', 'firstName lastName username email avatarUrl accountStatus verification')
      .populate('reviewedBy', 'firstName lastName username')
      .sort({ submittedAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
  ])

  res.json({
    requests,
    pagination: buildPagination(page, limit, totalItems),
  })
})

const getVerificationRequest = asyncHandler(async (req, res) => {
  const { requestId } = req.validated.params
  if (!mongoose.isValidObjectId(requestId)) {
    throw new AppError('Gecersiz basvuru kimligi.', 400)
  }

  const request = await VerificationRequest.findById(requestId)
    .populate('user', '-passwordHash')
    .populate('reviewedBy', 'firstName lastName username')

  if (!request) throw new AppError('Dogrulama basvurusu bulunamadi.', 404)
  res.json({ request })
})

const updateVerificationRequestStatus = asyncHandler(async (req, res) => {
  const { requestId } = req.validated.params
  const { status, note } = req.validated.body
  if (!mongoose.isValidObjectId(requestId)) {
    throw new AppError('Gecersiz basvuru kimligi.', 400)
  }

  const request = await VerificationRequest.findById(requestId).populate(
    'user',
    'firstName lastName username verification accountStatus',
  )
  if (!request) throw new AppError('Dogrulama basvurusu bulunamadi.', 404)
  if (request.user._id.toString() === req.user._id.toString()) {
    throw new AppError('Kendi dogrulama basvurunu inceleyemezsin.', 403)
  }
  if (!request.isActive || ['approved', 'rejected', 'revoked'].includes(request.status)) {
    throw new AppError('Bu basvuru artik karara acik degil.', 409)
  }

  const allowedTransitions = {
    pending: ['in_review', 'needs_info', 'approved', 'rejected'],
    in_review: ['needs_info', 'approved', 'rejected'],
    needs_info: ['in_review', 'approved', 'rejected'],
  }
  if (!allowedTransitions[request.status]?.includes(status)) {
    throw new AppError('Gecersiz basvuru durum gecisi.', 409)
  }
  if (status === 'approved' && request.user.accountStatus !== 'active') {
    throw new AppError('Askidaki bir hesap dogrulanamaz.', 409)
  }

  const now = new Date()
  request.status = status
  request.reviewedBy = req.user._id
  request.reviewedAt = now
  request.reviewNote = note || ''
  request.requestedInformation = status === 'needs_info' ? note : ''
  request.rejectionReason = status === 'rejected' ? note : ''
  request.isActive = !['approved', 'rejected'].includes(status)
  request.resubmissionAllowedAt =
    status === 'rejected' ? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) : null
  await request.save()

  const profileStatus = status
  await User.findByIdAndUpdate(request.user._id, {
    'verification.status': profileStatus,
    'verification.category': request.category,
    'verification.verifiedAt': status === 'approved' ? now : null,
    'verification.verifiedBy': status === 'approved' ? req.user._id : null,
    'verification.updatedAt': now,
  })

  const notificationCopy = {
    in_review: ['Basvurunuz inceleniyor', 'Mavi tik basvurunuz incelemeye alindi.'],
    needs_info: ['Ek bilgi gerekiyor', note],
    approved: ['Mavi tik basvurunuz onaylandi', 'Profiliniz artik onayli profil olarak gorunecek.'],
    rejected: ['Mavi tik basvurunuz sonuclandi', note],
  }[status]
  await Notification.create({
    user: request.user._id,
    actor: req.user._id,
    type: 'admin',
    entityKind: 'profile',
    entityId: request.user._id,
    title: notificationCopy[0],
    body: notificationCopy[1],
  })

  await createAuditLog({
    actorId: req.user._id,
    action: `profile.verification.${status}`,
    targetKind: 'user',
    targetId: request.user._id,
    summary: `@${request.user.username} dogrulama basvurusu ${status} durumuna getirildi.`,
    metadata: { requestId: request._id, status, note: note || '' },
  })

  res.json({ message: 'Dogrulama basvurusu guncellendi.', request })
})

const revokeUserVerification = asyncHandler(async (req, res) => {
  const { userId } = req.validated.params
  const { reason } = req.validated.body
  if (!mongoose.isValidObjectId(userId)) throw new AppError('Gecersiz kullanici kimligi.', 400)

  const user = await User.findById(userId)
  if (!user) throw new AppError('Kullanici bulunamadi.', 404)
  if (user.verification?.status !== 'approved') {
    throw new AppError('Kullanicinin aktif bir mavi tiki yok.', 409)
  }

  const now = new Date()
  user.verification.status = 'revoked'
  user.verification.verifiedAt = null
  user.verification.verifiedBy = null
  user.verification.updatedAt = now
  await user.save()

  await VerificationRequest.findOneAndUpdate(
    { user: user._id, status: 'approved' },
    {
      status: 'revoked',
      reviewNote: reason,
      reviewedAt: now,
      reviewedBy: req.user._id,
      isActive: false,
    },
    { sort: { createdAt: -1 } },
  )

  await Promise.all([
    Notification.create({
      user: user._id,
      actor: req.user._id,
      type: 'admin',
      entityKind: 'profile',
      entityId: user._id,
      title: 'Profil dogrulamasi kaldirildi',
      body: reason,
    }),
    createAuditLog({
      actorId: req.user._id,
      action: 'profile.verification.revoked',
      targetKind: 'user',
      targetId: user._id,
      summary: `@${user.username} kullanicisinin profil dogrulamasi kaldirildi.`,
      metadata: { reason },
    }),
  ])

  res.json({ message: 'Profil dogrulamasi kaldirildi.', user })
})

const listContent = asyncHandler(async (req, res) => {
  const { q, privacy, contentType, mediaKind, visibility, sortBy, sortDirection, page, limit } =
    req.validated.query
  const filter = {}

  if (privacy !== 'all') {
    filter.privacy = privacy
  }

  if (visibility !== 'all') {
    filter['moderation.visibility'] = visibility
  }

  if (contentType !== 'all') {
    filter.contentType = contentType
  }

  if (mediaKind === 'media') {
    filter['media.0'] = { $exists: true }
  }

  if (mediaKind === 'text') {
    filter['media.0'] = { $exists: false }
  }

  if (q) {
    const searchRegex = new RegExp(escapeRegex(q), 'i')
    const matchingUsers = await User.find(
      {
        $or: [
          { firstName: searchRegex },
          { lastName: searchRegex },
          { username: searchRegex },
          { email: searchRegex },
        ],
      },
      { _id: 1 },
    ).lean()

    filter.$or = [
      { text: searchRegex },
      { author: { $in: matchingUsers.map((user) => user._id) } },
    ]
  }

  const sortFieldMap = {
    createdAt: 'createdAt',
    contentType: 'contentType',
    privacy: 'privacy',
    views: 'stats.views',
  }
  const resolvedSortField = sortFieldMap[sortBy] || 'createdAt'
  const resolvedSortDirection = sortDirection === 'asc' ? 1 : -1
  const sort = { [resolvedSortField]: resolvedSortDirection }

  if (resolvedSortField !== 'createdAt') {
    sort.createdAt = -1
  }

  const totalItems = await Post.countDocuments(filter)
  const posts = await Post.find(filter)
    .populate('author', 'firstName lastName username email')
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(limit)

  res.json({
    posts,
    pagination: buildPagination(page, limit, totalItems),
  })
})

const listComments = asyncHandler(async (req, res) => {
  const { q, visibility, page, limit } = req.validated.query
  const filter = {}

  if (visibility !== 'all') {
    filter['moderation.visibility'] = visibility
  }

  if (q) {
    const searchRegex = new RegExp(escapeRegex(q), 'i')
    const matchingUsers = await User.find(
      {
        $or: [
          { firstName: searchRegex },
          { lastName: searchRegex },
          { username: searchRegex },
          { email: searchRegex },
        ],
      },
      { _id: 1 },
    ).lean()

    filter.$or = [
      { text: searchRegex },
      { author: { $in: matchingUsers.map((user) => user._id) } },
    ]
  }

  const totalItems = await Comment.countDocuments(filter)
  const comments = await Comment.find(filter)
    .populate('author', 'firstName lastName username email')
    .populate('post', 'text')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)

  res.json({
    comments,
    pagination: buildPagination(page, limit, totalItems),
  })
})

const updateUserRole = asyncHandler(async (req, res) => {
  const { userId } = req.validated.params
  const { role } = req.validated.body

  if (!mongoose.isValidObjectId(userId)) {
    throw new AppError('Gecersiz kullanici kimligi.', 400)
  }

  if (userId === req.user._id.toString()) {
    throw new AppError('Yonetim panelinden kendi rolunu degistiremezsin.', 400)
  }

  const user = await User.findByIdAndUpdate(
    userId,
    { role },
    { returnDocument: 'after', runValidators: true },
  ).select('-passwordHash')

  if (!user) {
    throw new AppError('Kullanici bulunamadi.', 404)
  }

  res.json({
    message: 'Kullanici rolu basariyla guncellendi.',
    user,
  })

  await createAuditLog({
    actorId: req.user._id,
    action: 'user.role.updated',
    targetKind: 'user',
    targetId: user._id,
    summary: `@${user.username} kullanicisinin rolu ${role} olarak degistirildi.`,
    metadata: { role },
  })
})

const updateUserStatus = asyncHandler(async (req, res) => {
  const { userId } = req.validated.params
  const { accountStatus, reason } = req.validated.body

  if (!mongoose.isValidObjectId(userId)) {
    throw new AppError('Gecersiz kullanici kimligi.', 400)
  }

  if (userId === req.user._id.toString()) {
    throw new AppError('Yonetim panelinden kendi hesap durumunu degistiremezsin.', 400)
  }

  const user = await User.findByIdAndUpdate(
    userId,
    {
      accountStatus,
      moderation: {
        reason: reason || '',
        actionedAt: new Date(),
        actionedBy: req.user._id,
      },
    },
    { returnDocument: 'after', runValidators: true },
  ).select('-passwordHash')

  if (!user) {
    throw new AppError('Kullanici bulunamadi.', 404)
  }

  res.json({
    message:
      accountStatus === 'suspended'
        ? 'Kullanici basariyla askiya alindi.'
        : 'Kullanici basariyla yeniden aktif edildi.',
    user,
  })

  await createAuditLog({
    actorId: req.user._id,
    action: 'user.status.updated',
    targetKind: 'user',
    targetId: user._id,
    summary: `@${user.username} kullanicisinin hesap durumu ${accountStatus} olarak degistirildi.`,
    metadata: { accountStatus, reason },
  })
})

const updatePostModeration = asyncHandler(async (req, res) => {
  const { postId } = req.validated.params
  const { visibility, reason } = req.validated.body

  if (!mongoose.isValidObjectId(postId)) {
    throw new AppError('Gecersiz gonderi kimligi.', 400)
  }

  const post = await Post.findByIdAndUpdate(
    postId,
    {
      moderation: {
        visibility,
        reason: reason || '',
        actionedAt: new Date(),
        actionedBy: req.user._id,
      },
    },
    { returnDocument: 'after', runValidators: true },
  ).populate('author', 'firstName lastName username email')

  if (!post) {
    throw new AppError('Gonderi bulunamadi.', 404)
  }

  res.json({
    message: `Gonderi durumu ${visibility} olarak guncellendi.`,
    post,
  })

  await createAuditLog({
    actorId: req.user._id,
    action: 'post.moderation.updated',
    targetKind: 'post',
    targetId: post._id,
    summary: `Bir gonderinin moderasyon durumu ${visibility} olarak guncellendi.`,
    metadata: { visibility, reason },
  })
})

const updateCommentModeration = asyncHandler(async (req, res) => {
  const { commentId } = req.validated.params
  const { visibility, reason } = req.validated.body

  if (!mongoose.isValidObjectId(commentId)) {
    throw new AppError('Gecersiz yorum kimligi.', 400)
  }

  const comment = await Comment.findByIdAndUpdate(
    commentId,
    {
      moderation: {
        visibility,
        reason: reason || '',
        actionedAt: new Date(),
        actionedBy: req.user._id,
      },
    },
    { returnDocument: 'after', runValidators: true },
  )
    .populate('author', 'firstName lastName username email')
    .populate('post', 'text')

  if (!comment) {
    throw new AppError('Yorum bulunamadi.', 404)
  }

  res.json({
    message: `Yorum durumu ${visibility} olarak guncellendi.`,
    comment,
  })

  await createAuditLog({
    actorId: req.user._id,
    action: 'comment.moderation.updated',
    targetKind: 'comment',
    targetId: comment._id,
    summary: `Bir yorumun moderasyon durumu ${visibility} olarak guncellendi.`,
    metadata: { visibility, reason },
  })
})

const bulkUpdateUserStatus = asyncHandler(async (req, res) => {
  const { userIds, accountStatus, reason } = req.validated.body
  const normalizedIds = userIds.filter((id) => mongoose.isValidObjectId(id))
  const filteredIds = normalizedIds.filter((id) => id !== req.user._id.toString())

  if (!filteredIds.length) {
    throw new AppError('Toplu islem icin gecerli kullanici kimligi gonderilmedi.', 400)
  }

  const result = await User.updateMany(
    { _id: { $in: filteredIds } },
    {
      accountStatus,
      moderation: {
        reason: reason || '',
        actionedAt: new Date(),
        actionedBy: req.user._id,
      },
    },
  )

  res.json({
    message: `Toplu kullanici durumu ${accountStatus} olarak guncellendi.`,
    modifiedCount: result.modifiedCount,
  })

  await createAuditLog({
    actorId: req.user._id,
    action: 'user.status.bulk-updated',
    targetKind: 'user',
    summary: `Toplu kullanici durumu ${accountStatus} olarak guncellendi.`,
    metadata: {
      accountStatus,
      reason,
      modifiedCount: result.modifiedCount,
      userIds: filteredIds,
    },
  })
})

const bulkDeleteUsers = asyncHandler(async (req, res) => {
  const { userIds, reason } = req.validated.body
  const normalizedIds = userIds.filter((id) => mongoose.isValidObjectId(id))
  const filteredIds = normalizedIds.filter((id) => id !== req.user._id.toString())

  if (!filteredIds.length) {
    throw new AppError('Toplu silme icin gecerli kullanici kimligi gonderilmedi.', 400)
  }

  const users = await User.find(
    { _id: { $in: filteredIds } },
    { _id: 1, username: 1, email: 1 },
  ).lean()

  if (!users.length) {
    throw new AppError('Silinecek kullanici bulunamadi.', 404)
  }

  await deleteUsersAndRelatedData(filteredIds)

  res.json({
    message: `${users.length} kullanici ve bagli tum veriler kalici olarak silindi.`,
    deletedCount: users.length,
  })

  await createAuditLog({
    actorId: req.user._id,
    action: 'user.bulk-deleted',
    targetKind: 'user',
    summary: `${users.length} kullanici kalici olarak silindi.`,
    metadata: {
      reason: reason || '',
      userIds: users.map((item) => item._id.toString()),
      usernames: users.map((item) => item.username).filter(Boolean),
      emails: users.map((item) => item.email).filter(Boolean),
      deletedCount: users.length,
    },
  })
})

const bulkUpdatePostModeration = asyncHandler(async (req, res) => {
  const { postIds, visibility, reason } = req.validated.body
  const normalizedIds = postIds.filter((id) => mongoose.isValidObjectId(id))

  if (!normalizedIds.length) {
    throw new AppError('Toplu islem icin gecerli gonderi kimligi gonderilmedi.', 400)
  }

  const result = await Post.updateMany(
    { _id: { $in: normalizedIds } },
    {
      moderation: {
        visibility,
        reason: reason || '',
        actionedAt: new Date(),
        actionedBy: req.user._id,
      },
    },
  )

  res.json({
    message: `Toplu gonderi moderasyonu ${visibility} olarak guncellendi.`,
    modifiedCount: result.modifiedCount,
  })

  await createAuditLog({
    actorId: req.user._id,
    action: 'post.moderation.bulk-updated',
    targetKind: 'post',
    summary: `Toplu gonderi moderasyonu ${visibility} olarak guncellendi.`,
    metadata: { visibility, reason, modifiedCount: result.modifiedCount, postIds: normalizedIds },
  })
})

const listReports = asyncHandler(async (req, res) => {
  const { status, targetKind, page, limit } = req.validated.query
  const filter = {}

  if (status !== 'all') {
    filter.status = status
  }

  if (targetKind !== 'all') {
    filter.targetKind = targetKind
  }

  const totalItems = await Report.countDocuments(filter)
  const reports = await Report.find(filter)
    .populate('reporter', 'firstName lastName username email')
    .populate('reviewedBy', 'firstName lastName username')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)

  res.json({
    reports,
    pagination: buildPagination(page, limit, totalItems),
  })
})

const updateReportStatus = asyncHandler(async (req, res) => {
  const { reportId } = req.validated.params
  const { status, resolutionNote } = req.validated.body

  if (!mongoose.isValidObjectId(reportId)) {
    throw new AppError('Gecersiz rapor kimligi.', 400)
  }

  const report = await Report.findByIdAndUpdate(
    reportId,
    {
      status,
      resolutionNote: resolutionNote || '',
      reviewedAt: new Date(),
      reviewedBy: req.user._id,
    },
    { returnDocument: 'after', runValidators: true },
  )
    .populate('reporter', 'firstName lastName username email')
    .populate('reviewedBy', 'firstName lastName username')

  if (!report) {
    throw new AppError('Rapor bulunamadi.', 404)
  }

  res.json({
    message: `Rapor durumu ${status} olarak guncellendi.`,
    report,
  })

  await createAuditLog({
    actorId: req.user._id,
    action: 'report.status.updated',
    targetKind: 'report',
    targetId: report._id,
    summary: `Bir raporun durumu ${status} olarak guncellendi.`,
    metadata: { status, resolutionNote },
  })
})

const getSignupNotificationSettings = asyncHandler(async (_req, res) => {
  const emails = await getSignupNotificationEmails()
  res.json({ emails })
})

const updateSignupNotificationSettings = asyncHandler(async (req, res) => {
  const incomingEmails = req.validated?.body?.emails || []
  const updatedEmails = await updateSignupNotificationEmails(incomingEmails, req.user?._id)

  res.json({
    message: 'Uyelik bildirim e-posta listesi guncellendi.',
    emails: updatedEmails,
  })

  await createAuditLog({
    actorId: req.user._id,
    action: 'admin.signup_notification_settings.updated',
    targetKind: 'system',
    summary: 'Uyelik bildirim e-posta listesi guncellendi.',
    metadata: {
      emails: updatedEmails,
      total: updatedEmails.length,
    },
  })
})

const getSignupContractsSettingsController = asyncHandler(async (_req, res) => {
  const payload = await getSignupContractsSettings()
  res.json(payload)
})

const updateSignupContractsSettingsController = asyncHandler(async (req, res) => {
  const contracts = req.validated?.body?.contracts || {}
  const payload = await updateSignupContractsSettings(contracts, req.user?._id)

  res.json({
    message: 'Uyelik sozlesmeleri guncellendi.',
    ...payload,
  })

  await createAuditLog({
    actorId: req.user._id,
    action: 'admin.signup_contracts.updated',
    targetKind: 'system',
    summary: 'Uyelik sozlesmeleri admin tarafindan guncellendi.',
    metadata: {
      languages: payload.languages,
      totalLanguages: payload.languages.length,
    },
  })
})

const deleteAdminConversation = asyncHandler(async (req, res) => {
  const { conversationId } = req.validated?.params || req.params
  const { reason = '' } = req.validated?.body || req.body || {}

  if (!mongoose.isValidObjectId(conversationId)) {
    throw new AppError('Gecersiz sohbet kimligi.', 400)
  }

  const conversation = await Conversation.findById(conversationId)
  if (!conversation) {
    throw new AppError('Sohbet bulunamadi.', 404)
  }

  const messageCount = await Message.countDocuments({ conversation: conversationId })

  // 1. Delete all messages of this conversation
  await Message.deleteMany({ conversation: conversationId })

  // 2. Delete the conversation record
  await Conversation.findByIdAndDelete(conversationId)

  // 3. Create Audit Log
  await createAuditLog({
    actorId: req.user._id,
    action: 'admin.conversation.deleted',
    targetKind: 'system',
    targetId: conversationId,
    summary: `Sohbet ve ${messageCount} adet mesaj kalici olarak silindi. Gerekce: ${reason || 'Belirtilmedi'}`,
    metadata: {
      participantIds: conversation.participantIds,
      deletedMessagesCount: messageCount,
      reason,
    },
  })

  res.json({
    success: true,
    message: 'Sohbet ve ilgili tum mesajlar kalici olarak silindi.',
    deletedConversationId: conversationId,
    deletedMessagesCount: messageCount,
  })
})

const deleteAdminMessage = asyncHandler(async (req, res) => {
  const { messageId } = req.validated?.params || req.params
  const { reason = '' } = req.validated?.body || req.body || {}

  if (!mongoose.isValidObjectId(messageId)) {
    throw new AppError('Gecersiz mesaj kimligi.', 400)
  }

  const message = await Message.findById(messageId)
  if (!message) {
    throw new AppError('Mesaj bulunamadi.', 404)
  }

  const conversationId = message.conversation

  // 1. Delete message
  await Message.findByIdAndDelete(messageId)

  // 2. Update conversation preview if needed
  if (conversationId) {
    const latestMessage = await Message.findOne({ conversation: conversationId }).sort({ createdAt: -1 })
    if (latestMessage) {
      await Conversation.findByIdAndUpdate(conversationId, {
        lastMessageId: latestMessage._id,
        lastMessagePreview: latestMessage.text || (latestMessage.media?.length ? 'Medya eki' : ''),
        lastMessageAt: latestMessage.createdAt,
      })
    } else {
      await Conversation.findByIdAndUpdate(conversationId, {
        lastMessageId: null,
        lastMessagePreview: '',
        lastMessageAt: null,
      })
    }
  }

  // 3. Create Audit Log
  await createAuditLog({
    actorId: req.user._id,
    action: 'admin.message.deleted',
    targetKind: 'system',
    targetId: messageId,
    summary: `Mesaj admin tarafindan kalici olarak silindi. Gerekce: ${reason || 'Belirtilmedi'}`,
    metadata: {
      conversationId,
      sender: message.sender,
      recipient: message.recipient,
      reason,
    },
  })

  res.json({
    success: true,
    message: 'Mesaj kalici olarak silindi.',
    deletedMessageId: messageId,
    conversationId,
  })
})

module.exports = {
  getOverview,
  listUsers,
  getUsersSummary,
  getContentSummary,
  listAuditLogs,
  getUserDetail,
  listContent,
  listComments,
  listReports,
  updateUserRole,
  updateUserStatus,
  updatePostModeration,
  updateCommentModeration,
  bulkUpdateUserStatus,
  bulkDeleteUsers,
  bulkUpdatePostModeration,
  updateReportStatus,
  getSignupNotificationSettings,
  updateSignupNotificationSettings,
  getSignupContractsSettingsController,
  updateSignupContractsSettingsController,
  listVerificationRequests,
  getVerificationRequest,
  updateVerificationRequestStatus,
  revokeUserVerification,
  deleteAdminConversation,
  deleteAdminMessage,
}
