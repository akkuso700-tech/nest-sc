const mongoose = require('mongoose')

const auditLogSchema = new mongoose.Schema(
  {
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    targetKind: {
      type: String,
      enum: ['user', 'post', 'comment', 'report', 'system'],
      required: true,
      index: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    summary: {
      type: String,
      trim: true,
      default: '',
      maxlength: 280,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  },
)

auditLogSchema.index({ createdAt: -1, action: 1 })

const AuditLog = mongoose.model('AuditLog', auditLogSchema)

module.exports = { AuditLog }
