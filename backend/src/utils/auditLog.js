const mongoose = require('mongoose')
const { AuditLog } = require('../models/AuditLog')

async function createAuditLog({
  actorId,
  action,
  targetKind,
  targetId = null,
  summary = '',
  metadata = {},
}) {
  if (!actorId || !action || !targetKind) {
    return null
  }

  const isValidObjectId = targetId && mongoose.isValidObjectId(targetId)
  const safeTargetId = isValidObjectId ? targetId : null
  const safeMetadata =
    targetId && !isValidObjectId
      ? { ...metadata, targetKey: String(targetId) }
      : metadata

  try {
    return await AuditLog.create({
      actor: actorId,
      action,
      targetKind,
      targetId: safeTargetId,
      summary,
      metadata: safeMetadata,
    })
  } catch (error) {
    console.error('AuditLog kaydı oluşturulamadı:', error)
    return null
  }
}

module.exports = { createAuditLog }
