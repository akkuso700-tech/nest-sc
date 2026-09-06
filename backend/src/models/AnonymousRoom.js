const mongoose = require('mongoose')

const anonymousRoomSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 50,
    },
    topic: {
      type: String,
      trim: true,
      maxlength: 120,
      default: '',
    },
    icon: {
      type: String,
      trim: true,
      default: '💬',
    },
    color: {
      type: String,
      trim: true,
      default: 'purple',
    },
    isSystem: {
      type: Boolean,
      default: false,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    creatorAlias: {
      type: String,
      trim: true,
      default: 'Anonim',
    },
    activeCount: {
      type: Number,
      default: 0,
    },
    expiresAt: {
      type: Date,
      default: null,
      index: { expires: 0 },
    },
  },
  {
    timestamps: true,
  },
)

const AnonymousRoom = mongoose.model('AnonymousRoom', anonymousRoomSchema)

module.exports = { AnonymousRoom }
