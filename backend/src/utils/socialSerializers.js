const { normalizeMediaList, normalizeUserMedia } = require('./mediaUrls')

function toPlainObject(document) {
  if (!document) {
    return null
  }

  return typeof document.toObject === 'function' ? document.toObject() : document
}

function hasViewerLiked(ids = [], user) {
  if (!user) {
    return false
  }

  return ids.some((item) => item.toString() === user._id.toString())
}

function serializePostForViewer(postDocument, user) {
  const post = toPlainObject(postDocument)

  if (!post) {
    return null
  }

  const normalizedStats = {
    likes: Number(post.stats?.likes || 0),
    comments: Number(post.stats?.comments || 0),
    shares: Number(post.stats?.shares || 0),
    saves: Number(post.stats?.saves || 0),
    views: Number(post.stats?.views || 0),
  }

  const {
    likedByUserIds = [],
    savedByUserIds = [],
    sharedByUserIds = [],
    ...safePostPayload
  } = post

  return {
    ...safePostPayload,
    media: normalizeMediaList(post.media || []),
    author: normalizeUserMedia(post.author),
    group: post.group
      ? {
          id: post.group._id || post.group.id || post.group,
          name: post.group.name || '',
          slug: post.group.slug || '',
          privacy: post.group.privacy || 'public',
          coverImageUrl: post.group.coverImageUrl || '',
        }
      : null,
    stats: normalizedStats,
    likedByViewer: hasViewerLiked(likedByUserIds, user),
    savedByViewer: hasViewerLiked(savedByUserIds, user),
    sharedByViewer: hasViewerLiked(sharedByUserIds, user),
  }
}

function serializeCommentForViewer(commentDocument, user) {
  const comment = toPlainObject(commentDocument)

  if (!comment) {
    return null
  }

  const postAuthorId = comment.post?.author?._id?.toString?.() || comment.post?.author?.toString?.()

  return {
    id: comment._id,
    post: comment.post,
    parentCommentId: comment.parentComment,
    text: comment.text,
    media: normalizeMediaList(comment.media || []),
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    stats: comment.stats,
    author: normalizeUserMedia(comment.author),
    likedByViewer: hasViewerLiked(comment.likedByUserIds || [], user),
    savedByViewer: hasViewerLiked(comment.savedByUserIds || [], user),
    sharedByViewer: hasViewerLiked(comment.sharedByUserIds || [], user),
    canEdit:
      Boolean(user) &&
      (comment.author?._id?.toString?.() === user._id.toString() ||
        comment.author?.toString?.() === user._id.toString() ||
        user.role === 'admin'),
    canDelete:
      Boolean(user) &&
      (comment.author?._id?.toString?.() === user._id.toString() ||
        comment.author?.toString?.() === user._id.toString() ||
        (postAuthorId && postAuthorId === user._id.toString()) ||
        user.role === 'admin'),
    replies: [],
  }
}

module.exports = {
  serializePostForViewer,
  serializeCommentForViewer,
}
