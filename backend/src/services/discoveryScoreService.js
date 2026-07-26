function uniqueIds(values = []) {
  return [...new Set(values.map((value) => value?.toString()).filter(Boolean))]
}

function buildIdSet(values = []) {
  return new Set(uniqueIds(values))
}

function countIntersection(leftValues = [], rightValues = []) {
  const rightSet = buildIdSet(rightValues)

  return uniqueIds(leftValues).reduce(
    (count, value) => (rightSet.has(value) ? count + 1 : count),
    0,
  )
}

function normalizeTopicSet(topics = []) {
  return new Set(
    topics
      .map((item) => item?.key || item)
      .map((item) => `${item || ''}`.trim().toLowerCase())
      .filter(Boolean),
  )
}

function countTopicOverlap(leftTopics = [], rightTopics = []) {
  const rightSet = normalizeTopicSet(rightTopics)

  return [...normalizeTopicSet(leftTopics)].reduce(
    (count, topic) => (rightSet.has(topic) ? count + 1 : count),
    0,
  )
}

function scoreMutualConnections(mutualCount) {
  return Math.min(mutualCount * 22, 100)
}

function scoreLocationSimilarity({
  sameCity = false,
  sameCountry = false,
  nearbyDistanceKm = null,
}) {
  if (sameCity) {
    return 100
  }

  if (typeof nearbyDistanceKm === 'number') {
    if (nearbyDistanceKm <= 5) {
      return 98
    }

    if (nearbyDistanceKm <= 15) {
      return 84
    }

    if (nearbyDistanceKm <= 50) {
      return 64
    }
  }

  if (sameCountry) {
    return 52
  }

  return 0
}

function scoreInteractionOverlap(sharedInteractionCount) {
  return Math.min(sharedInteractionCount * 20, 100)
}

function scoreProfileViews(hasViewedProfile) {
  return hasViewedProfile ? 100 : 0
}

function scoreInterestSimilarity(topicOverlapCount) {
  return Math.min(topicOverlapCount * 26, 100)
}

function scoreMessagingAffinity(hasRecentConversation) {
  return hasRecentConversation ? 70 : 0
}

function scoreRecentRotation(hoursSinceShown = null) {
  if (hoursSinceShown === null || typeof hoursSinceShown === 'undefined') {
    return 0
  }

  if (hoursSinceShown < 6) {
    return -36
  }

  if (hoursSinceShown < 24) {
    return -22
  }

  if (hoursSinceShown < 48) {
    return -10
  }

  return 0
}

function buildSuggestionReason({
  nearbyLabel = '',
  mutualConnectionCount = 0,
  sharedInteractionCount = 0,
  topicOverlapCount = 0,
  hasRecentConversation = false,
  sameCity = false,
  sameCountry = false,
}) {
  if (nearbyLabel) {
    return nearbyLabel
  }

  if (mutualConnectionCount > 0) {
    return `${mutualConnectionCount} ortak baglanti`
  }

  if (sharedInteractionCount > 0) {
    return 'Benzer iceriklerle ilgileniyor'
  }

  if (topicOverlapCount > 0) {
    return 'Benzer konulari takip ediyor'
  }

  if (hasRecentConversation) {
    return 'Ayni sohbet cevresinde'
  }

  if (sameCity) {
    return 'Ayni sehirde'
  }

  if (sameCountry) {
    return 'Ayni ulkede'
  }

  return 'Senin icin onerildi'
}

function computeDiscoveryScore({
  mutualConnectionCount = 0,
  sameCity = false,
  sameCountry = false,
  nearbyDistanceKm = null,
  sharedInteractionCount = 0,
  hasViewedProfile = false,
  topicOverlapCount = 0,
  hasRecentConversation = false,
  hoursSinceShown = null,
}) {
  const mutualScore = scoreMutualConnections(mutualConnectionCount)
  const locationScore = scoreLocationSimilarity({
    sameCity,
    sameCountry,
    nearbyDistanceKm,
  })
  const interactionScore = scoreInteractionOverlap(sharedInteractionCount)
  const profileViewScore = scoreProfileViews(hasViewedProfile)
  const interestScore = scoreInterestSimilarity(topicOverlapCount)
  const messagingScore = scoreMessagingAffinity(hasRecentConversation)
  const rotationPenalty = scoreRecentRotation(hoursSinceShown)

  const weightedScore =
    mutualScore * 0.3 +
    locationScore * 0.2 +
    interactionScore * 0.2 +
    profileViewScore * 0.15 +
    interestScore * 0.15 +
    messagingScore * 0.08 +
    rotationPenalty

  return Number(Math.max(weightedScore, 0).toFixed(2))
}

module.exports = {
  uniqueIds,
  buildIdSet,
  countIntersection,
  countTopicOverlap,
  computeDiscoveryScore,
  buildSuggestionReason,
}
