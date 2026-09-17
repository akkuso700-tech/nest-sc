export function findCommentById(comments, commentId) {
  for (const comment of comments) {
    if ((comment.id || comment._id) === commentId) {
      return comment
    }

    const nestedComment = findCommentById(comment.replies || [], commentId)

    if (nestedComment) {
      return nestedComment
    }
  }

  return null
}

export function appendReplyToTree(comments, parentId, nextComment) {
  return comments.map((comment) => {
    const commentId = comment.id || comment._id

    if (commentId === parentId) {
      return {
        ...comment,
        replies: [nextComment, ...(comment.replies || [])],
      }
    }

    return comment.replies?.length
      ? {
          ...comment,
          replies: appendReplyToTree(comment.replies, parentId, nextComment),
        }
      : comment
  })
}

export function updateCommentInTree(comments, nextComment) {
  return comments.map((comment) => {
    if ((comment.id || comment._id) === (nextComment.id || nextComment._id)) {
      const currentReplies = comment.replies || []
      const incomingReplies = Array.isArray(nextComment?.replies) ? nextComment.replies : null
      const resolvedReplies =
        incomingReplies === null
          ? currentReplies
          : incomingReplies.length === 0 && currentReplies.length > 0
            ? currentReplies
            : incomingReplies

      return {
        ...comment,
        ...nextComment,
        replies: resolvedReplies,
      }
    }

    return comment.replies?.length
      ? {
          ...comment,
          replies: updateCommentInTree(comment.replies, nextComment),
        }
      : comment
  })
}

export function removeCommentFromTree(comments, commentId) {
  return comments
    .filter((comment) => (comment.id || comment._id) !== commentId)
    .map((comment) => ({
      ...comment,
      replies: removeCommentFromTree(comment.replies || [], commentId),
    }))
}

export function getCommentLikeCount(comment) {
  return Number(comment?.stats?.likes ?? comment?.likes ?? 0)
}

export function getCommentCreatedAt(comment) {
  const timestamp = comment?.createdAt ? Date.parse(comment.createdAt) : NaN
  return Number.isFinite(timestamp) ? timestamp : 0
}

export function sortCommentsByMode(comments, mode) {
  const sorted = [...comments]

  if (mode === 'popular') {
    sorted.sort((a, b) => {
      const likeDiff = getCommentLikeCount(b) - getCommentLikeCount(a)
      if (likeDiff !== 0) {
        return likeDiff
      }
      return getCommentCreatedAt(b) - getCommentCreatedAt(a)
    })
    return sorted
  }

  sorted.sort((a, b) => getCommentCreatedAt(b) - getCommentCreatedAt(a))
  return sorted
}
