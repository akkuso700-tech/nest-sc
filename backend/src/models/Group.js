const mongoose = require('mongoose')

const groupMemberSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['owner', 'admin', 'moderator', 'member'],
      default: 'member',
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'pending', 'removed'],
      default: 'active',
      index: true,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
)

const groupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 80,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      index: true,
      minlength: 3,
      maxlength: 120,
    },
    about: {
      type: String,
      trim: true,
      default: '',
      maxlength: 1200,
    },
    privacy: {
      type: String,
      enum: ['public', 'private'],
      default: 'public',
      index: true,
    },
    coverImageUrl: {
      type: String,
      trim: true,
      default: '',
    },
    postApprovalRequired: {
      type: Boolean,
      default: false,
    },
    joinApprovalRequired: {
      type: Boolean,
      default: false,
    },
    members: [groupMemberSchema],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    stats: {
      memberCount: {
        type: Number,
        default: 1,
      },
    },
  },
  {
    timestamps: true,
  },
)

groupSchema.index({ createdBy: 1, createdAt: -1 })
groupSchema.index({ name: 'text', about: 'text' })
groupSchema.index({ 'members.user': 1, 'members.status': 1, 'members.role': 1, updatedAt: -1 })

const Group = mongoose.model('Group', groupSchema)

module.exports = { Group }
