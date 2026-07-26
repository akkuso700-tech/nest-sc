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

  return AuditLog.create({
    actor: actorId,
    action,
    targetKind,
    targetId,
    summary,
    metadata,
  })
}

module.exports = { createAuditLog }
