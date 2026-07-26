const mongoose = require('mongoose')
const { Report } = require('../models/Report')
const { AppError } = require('../utils/AppError')
const { asyncHandler } = require('../utils/asyncHandler')
const { createAuditLog } = require('../utils/auditLog')

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

const createReport = asyncHandler(async (req, res) => {
  const { targetKind, targetId, reason, details } = req.validated.body

  if (!mongoose.isValidObjectId(targetId)) {
    throw new AppError('Gecersiz rapor hedef kimligi.', 400)
  }

  const report = await Report.create({
    reporter: req.user._id,
    targetKind,
    targetId,
    reason,
    details,
  })

  res.status(201).json({
    message: 'Rapor basariyla gonderildi.',
    report,
  })

  await createAuditLog({
    actorId: req.user._id,
    action: 'report.created',
    targetKind: 'report',
    targetId: report._id,
    summary: `${targetKind} hedefi icin yeni bir rapor olusturuldu.`,
    metadata: {
      targetKind,
      targetId,
      reason,
    },
  })
})

const listMyReports = asyncHandler(async (req, res) => {
  const { status, targetKind, page, limit } = req.validated.query
  const filter = {
    reporter: req.user._id,
  }

  if (status !== 'all') {
    filter.status = status
  }

  if (targetKind !== 'all') {
    filter.targetKind = targetKind
  }

  const totalItems = await Report.countDocuments(filter)
  const reports = await Report.find(filter)
    .populate('reviewedBy', 'firstName lastName username')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)

  res.json({
    reports,
    pagination: buildPagination(page, limit, totalItems),
  })
})

module.exports = { createReport, listMyReports }
