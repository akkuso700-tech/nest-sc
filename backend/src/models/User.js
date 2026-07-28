const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')

function isAdult(value) {
  const minimumBirthDate = new Date()
  minimumBirthDate.setFullYear(minimumBirthDate.getFullYear() - 18)
  return value <= minimumBirthDate
}

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    authProvider: {
      type: String,
      enum: ['password', 'google'],
      default: 'password',
      index: true,
    },
    googleSub: {
      type: String,
      index: true,
      unique: true,
      sparse: true,
      trim: true,
    },
    emailVerifiedAt: {
      type: Date,
      default: null,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    birthDate: {
      type: Date,
      required: true,
      validate: {
        validator: isAdult,
        message: 'Users must be at least 18 years old.',
      },
    },
    location: {
      country: { type: String, trim: true, default: '' },
      city: { type: String, trim: true, default: '' },
    },
    role: {
      type: String,
      enum: ['user', 'moderator', 'admin'],
      default: 'user',
      index: true,
    },
    accountStatus: {
      type: String,
      enum: ['active', 'suspended'],
      default: 'active',
      index: true,
    },
    verification: {
      status: {
        type: String,
        enum: ['none', 'pending', 'in_review', 'needs_info', 'approved', 'rejected', 'revoked'],
        default: 'none',
        index: true,
      },
      category: {
        type: String,
        enum: ['individual', 'creator', 'business', 'organization', 'public_figure'],
        default: 'individual',
      },
      verifiedAt: { type: Date, default: null },
      verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      updatedAt: { type: Date, default: null },
    },
    moderation: {
      reason: { type: String, trim: true, default: '' },
      actionedAt: { type: Date, default: null },
      actionedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
      },
    },
    bio: {
      type: String,
      trim: true,
      default: '',
      maxlength: 280,
    },
    avatarUrl: {
      type: String,
      default: '',
    },
    coverUrl: {
      type: String,
      default: '',
    },
    isPrivate: {
      type: Boolean,
      default: false,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    signupConsent: {
      acceptedAt: { type: Date, default: null },
      version: { type: String, trim: true, default: '' },
      text: { type: String, trim: true, default: '' },
      language: { type: String, trim: true, default: 'tr' },
      method: { type: String, enum: ['normal', 'google'], default: 'normal' },
      ipAddress: { type: String, trim: true, default: '' },
      city: { type: String, trim: true, default: '' },
      country: { type: String, trim: true, default: '' },
      browserLanguage: { type: String, trim: true, default: '' },
      userAgent: { type: String, trim: true, default: '' },
    },
    friendIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    blockedUserIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    activity: {
      viewedProfileIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      likedPostIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Post' }],
      commentedPostIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Post' }],
      savedPostIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Post' }],
      sharedPostIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Post' }],
      recentSearches: [
        {
          query: {
            type: String,
            trim: true,
            maxlength: 80,
            required: true,
          },
          searchedAt: {
            type: Date,
            default: Date.now,
          },
        },
      ],
    },
    discovery: {
      interestProfile: {
        topicScores: {
          type: Map,
          of: Number,
          default: {},
        },
        hiddenTopicKeys: {
          type: [String],
          default: [],
        },
        hiddenPostIds: [
          {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Post',
          },
        ],
        updatedAt: {
          type: Date,
          default: null,
        },
      },
      locationConsent: {
        status: {
          type: String,
          enum: ['unknown', 'granted', 'denied'],
          default: 'unknown',
        },
        consentGivenAt: {
          type: Date,
          default: null,
        },
        source: {
          type: String,
          trim: true,
          default: '',
        },
      },
      lastApproxLocation: {
        city: { type: String, trim: true, default: '' },
        country: { type: String, trim: true, default: '' },
        latRounded: { type: Number, default: null },
        lngRounded: { type: Number, default: null },
        accuracy: { type: Number, default: null },
        source: { type: String, trim: true, default: '' },
        capturedAt: { type: Date, default: null },
        lastSeenAt: { type: Date, default: null },
      },
      lastExactLocation: {
        city: { type: String, trim: true, default: '' },
        country: { type: String, trim: true, default: '' },
        latitude: { type: Number, default: null },
        longitude: { type: Number, default: null },
        accuracy: { type: Number, default: null },
        source: { type: String, trim: true, default: '' },
        capturedAt: { type: Date, default: null },
        lastSeenAt: { type: Date, default: null },
      },
      nearbyDiscoveryUsageCount: {
        type: Number,
        default: 0,
      },
      lastNearbyDiscoveryAt: {
        type: Date,
        default: null,
      },
      suggestionHistory: [
        {
          userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
          },
          mode: {
            type: String,
            enum: ['for-you', 'mutual', 'nearby'],
            default: 'for-you',
          },
          shownAt: {
            type: Date,
            default: Date.now,
          },
        },
      ],
    },
  },
  {
    timestamps: true,
  },
)

userSchema.index({ createdAt: -1 })

userSchema.methods.comparePassword = function comparePassword(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash)
}

const User = mongoose.model('User', userSchema)

module.exports = { User }
