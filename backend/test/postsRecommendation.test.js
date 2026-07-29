const test = require('node:test')
const assert = require('node:assert/strict')
const mongoose = require('mongoose')
const { _test } = require('../src/controllers/postsController')
const {
  feedSchema,
  loopTelemetrySchema,
  registerPostViewSchema,
} = require('../src/validators/postValidators')
const { PostView } = require('../src/models/PostView')
const { RecommendationEvent } = require('../src/models/RecommendationEvent')
const { FeedSession } = require('../src/models/FeedSession')
const { TelemetryReceipt } = require('../src/models/TelemetryReceipt')

test('loop feed mode is part of the validated query and session scope', () => {
  const parsed = feedSchema.parse({
    body: {},
    params: {},
    query: { view: 'loop', loopMode: 'for-you' },
  })

  assert.equal(parsed.query.loopMode, 'for-you')
  assert.deepEqual(
    _test.normalizeFeedSessionScope({
      reqUserId: 'viewer-1',
      view: 'loop',
      topic: null,
      loopMode: parsed.query.loopMode,
    }),
    {
      reqUserId: 'viewer-1',
      view: 'loop',
      topic: null,
      loopMode: 'for-you',
      experimentVariant: 'control',
    },
  )
})

test('followers-only posts are accessible to followers but not unrelated viewers', () => {
  const authorId = new mongoose.Types.ObjectId()
  const followerId = new mongoose.Types.ObjectId()
  const post = {
    author: { _id: authorId },
    privacy: 'followers',
    moderation: { visibility: 'visible' },
    publication: { status: 'published' },
    archivedAt: null,
    group: null,
  }

  assert.equal(
    _test.canAccessPost(post, {
      _id: followerId,
      role: 'user',
      friendIds: [authorId],
      blockedUserIds: [],
    }),
    true,
  )
  assert.equal(
    _test.canAccessPost(post, {
      _id: followerId,
      role: 'user',
      friendIds: [],
      blockedUserIds: [],
    }),
    false,
  )
})

test('post view updates retain daily maxima instead of assigning lower metrics', () => {
  const pipeline = _test.buildPostViewUpdatePipeline({
    postId: new mongoose.Types.ObjectId(),
    viewerKey: 'user:viewer-1',
    dayBucket: new Date('2026-07-29T00:00:00.000Z'),
    expiresAt: new Date('2026-09-12T00:00:00.000Z'),
    now: new Date('2026-07-29T12:00:00.000Z'),
    watchRatio: 0.3,
    replayCount: 1,
    swipeVelocity: 850,
    visibleMs: 2400,
    quickSkip: false,
    longView: true,
    recommendation: {
      sessionId: 'session-12345678',
      rank: 4,
      algorithm: 'loop-personalized-diversity-v3',
      view: 'loop',
      loopMode: 'for-you',
      experiment: {
        id: 'feed-quality-2026-07',
        variant: 'challenger',
      },
    },
  })
  const update = pipeline[0].$set

  assert.deepEqual(update.maxWatchRatio, {
    $max: [{ $ifNull: ['$maxWatchRatio', 0] }, 0.3],
  })
  assert.deepEqual(update.replayCount, {
    $max: [{ $ifNull: ['$replayCount', 0] }, 1],
  })
  assert.deepEqual(update.maxVisibleMs, {
    $max: [{ $ifNull: ['$maxVisibleMs', 0] }, 2400],
  })
  assert.deepEqual(update.swipeVelocity, {
    $ifNull: ['$swipeVelocity', 850],
  })
  assert.equal(update.longViewRecorded, true)
  assert.equal(update.feedRank, 4)
  assert.equal(update.algorithm, 'loop-personalized-diversity-v3')
  assert.equal(update.experimentId, 'feed-quality-2026-07')
  assert.equal(update.experimentVariant, 'challenger')
})

test('personalized reranking applies diversity to the selected order', () => {
  const entries = [
    { post: { _id: 'a' }, baseScore: 1, meta: { authorId: 'same', topics: [] } },
    { post: { _id: 'b' }, baseScore: 0.96, meta: { authorId: 'same', topics: [] } },
    { post: { _id: 'c' }, baseScore: 0.92, meta: { authorId: 'same', topics: [] } },
    { post: { _id: 'd' }, baseScore: 0.84, meta: { authorId: 'different', topics: [] } },
  ]

  const rankedIds = _test.rankPersonalizedCandidates({
    entries,
    seedContext: 'viewer-1|loop|for-you|2026-07-29',
  }).map((post) => post._id)

  assert.equal(rankedIds.indexOf('d') < rankedIds.indexOf('c'), true)
})

test('recently seen posts are moved behind unseen candidates without being removed', () => {
  const posts = [{ _id: 'seen-1' }, { _id: 'new-1' }, { _id: 'seen-2' }, { _id: 'new-2' }]
  const ranked = _test.deprioritizeRecentlySeen(posts, new Set(['seen-1', 'seen-2']))

  assert.deepEqual(ranked.map((post) => post._id), ['new-1', 'new-2', 'seen-1', 'seen-2'])
})

test('Bayesian quality smoothing prevents one-view posts from dominating mature posts', () => {
  const oneViewPost = {
    stats: { views: 1, likes: 1, comments: 0, saves: 0, shares: 0 },
  }
  const maturePost = {
    stats: { views: 100, likes: 30, comments: 0, saves: 0, shares: 0 },
  }

  assert.equal(
    _test.computePostQualityScore(maturePost) > _test.computePostQualityScore(oneViewPost),
    true,
  )
})

test('recommendation topics include hashtags and meaningful caption keywords', () => {
  const topics = _test.topicsFromPost({
    title: 'Sokak Fotoğrafçılığı',
    text: '#Istanbul gece fotoğraf çekimi ve portre teknikleri',
  })

  assert.equal(topics.includes('istanbul'), true)
  assert.equal(topics.some((topic) => topic.startsWith('kwfoto')), true)
})

test('serialized feed posts carry session, rank and algorithm attribution', () => {
  const post = {
    _id: new mongoose.Types.ObjectId(),
    author: { _id: new mongoose.Types.ObjectId(), username: 'creator' },
    stats: {},
    media: [],
  }
  const [serialized] = _test.serializeFeedPosts([post], null, {
    sessionId: 'session-12345678',
    startRank: 7,
    view: 'loop',
    loopMode: 'for-you',
    algorithm: 'loop-personalized-diversity-v3',
    experiment: {
      id: 'feed-quality-2026-07',
      variant: 'control',
    },
  })

  assert.deepEqual(serialized._recommendation, {
    sessionId: 'session-12345678',
    rank: 7,
    view: 'loop',
    loopMode: 'for-you',
    algorithm: 'loop-personalized-diversity-v3',
    experiment: {
      id: 'feed-quality-2026-07',
      variant: 'control',
    },
  })
})

test('feed experiment assignment and telemetry sampling are deterministic', () => {
  const req = { user: { _id: 'viewer-1' }, headers: {} }
  const firstAssignment = _test.buildFeedExperiment({ req, view: 'loop', loopMode: 'for-you' })
  const secondAssignment = _test.buildFeedExperiment({ req, view: 'loop', loopMode: 'for-you' })

  assert.deepEqual(firstAssignment, secondAssignment)
  assert.equal(['control', 'challenger'].includes(firstAssignment.variant), true)

  const payload = {
    eventId: '27be2aa8-80af-4bd7-a801-72f864db9ae6',
    eventType: 'waiting',
    currentTimeSec: 12,
  }
  const firstSample = _test.shouldPersistLoopTelemetry({
    payload,
    postId: 'post-1',
    viewerKey: 'user:viewer-1',
  })
  const secondSample = _test.shouldPersistLoopTelemetry({
    payload,
    postId: 'post-1',
    viewerKey: 'user:viewer-1',
  })

  assert.deepEqual(firstSample, secondSample)
  assert.equal(firstSample.sampleRate, 0.25)
  assert.deepEqual(
    _test.shouldPersistLoopTelemetry({
      payload: { ...payload, eventType: 'error' },
      postId: 'post-1',
      viewerKey: 'user:viewer-1',
    }),
    { sampled: true, sampleRate: 1 },
  )
})

test('recommendation attribution and telemetry event ids are validated', () => {
  const recommendation = {
    sessionId: 'session-12345678',
    rank: 2,
    algorithm: 'loop-personalized-diversity-v3-control',
    view: 'loop',
    loopMode: 'for-you',
    experiment: { id: 'feed-quality-2026-07', variant: 'control' },
  }
  const parsedView = registerPostViewSchema.parse({
    body: { recommendation },
    params: { postId: new mongoose.Types.ObjectId().toString() },
    query: {},
  })
  const parsedTelemetry = loopTelemetrySchema.parse({
    body: {
      eventId: '27be2aa8-80af-4bd7-a801-72f864db9ae6',
      eventType: 'waiting',
    },
    params: { postId: new mongoose.Types.ObjectId().toString() },
    query: {},
  })

  assert.deepEqual(parsedView.body.recommendation.experiment, recommendation.experiment)
  assert.equal(parsedTelemetry.body.eventId, '27be2aa8-80af-4bd7-a801-72f864db9ae6')
})

test('recommendation event retention and recent-view lookup indexes are declared', () => {
  const recommendationIndexes = RecommendationEvent.schema.indexes()
  const postViewIndexes = PostView.schema.indexes()
  const feedSessionIndexes = FeedSession.schema.indexes()
  const telemetryReceiptIndexes = TelemetryReceipt.schema.indexes()

  assert.equal(
    recommendationIndexes.some(([fields, options]) => fields.expiresAt === 1 && options.expireAfterSeconds === 0),
    true,
  )
  assert.equal(
    postViewIndexes.some(([fields]) => fields.viewerKey === 1 && fields.updatedAt === -1 && fields.post === 1),
    true,
  )
  assert.equal(
    postViewIndexes.some(([fields]) => fields.createdAt === -1 && fields.experimentVariant === 1),
    true,
  )
  assert.equal(
    recommendationIndexes.some(([fields]) => fields.createdAt === -1 && fields.experimentVariant === 1),
    true,
  )
  assert.equal(
    feedSessionIndexes.some(([fields, options]) => fields.expiresAt === 1 && options.expireAfterSeconds === 0),
    true,
  )
  assert.equal(
    telemetryReceiptIndexes.some(([fields, options]) => fields.expiresAt === 1 && options.expireAfterSeconds === 0),
    true,
  )
})
