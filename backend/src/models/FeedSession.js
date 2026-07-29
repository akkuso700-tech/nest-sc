const mongoose = require('mongoose')

const feedSessionSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 64,
    },
    orderedPostIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Post',
        required: true,
      },
    ],
    scope: {
      reqUserId: { type: String, default: null },
      view: { type: String, required: true },
      topic: { type: String, default: null },
      loopMode: { type: String, default: null },
      experimentVariant: { type: String, default: 'control' },
    },
    limit: {
      type: Number,
      required: true,
      min: 1,
      max: 50,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
)

feedSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })
feedSessionSchema.index({ 'scope.reqUserId': 1, createdAt: -1 })

const FeedSession = mongoose.model('FeedSession', feedSessionSchema)

module.exports = { FeedSession }
