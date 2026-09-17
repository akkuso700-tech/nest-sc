import { useState } from 'react'
import {
  togglePostLike,
  togglePostSave,
  togglePostShare,
  deletePost,
  togglePostArchive,
  markPostNotInterested,
} from '../../../services/postsService.js'
import { copyTextToClipboard } from '../../../utils/postShare.js'

export function usePostInteractions({
  postId,
  post,
  localPost,
  setLocalPost,
  isAuthenticated,
  sharePayload,
  shareTargets,
  onPostHidden,
  t,
}) {
  const [pendingAction, setPendingAction] = useState('')
  const [isShareMenuOpen, setIsShareMenuOpen] = useState(false)
  const [toast, setToast] = useState({ message: '', tone: 'success' })

  const isShareProcessing = pendingAction === 'share'

  function getSafeRecommendationContext(recommendation) {
    if (
      !recommendation?.sessionId ||
      !Number.isInteger(recommendation.rank) ||
      !recommendation.algorithm ||
      !recommendation.view ||
      !recommendation.experiment?.id ||
      !recommendation.experiment?.variant
    ) {
      return null
    }

    return {
      sessionId: recommendation.sessionId,
      rank: recommendation.rank,
      algorithm: recommendation.algorithm,
      view: recommendation.view,
      loopMode: recommendation.loopMode || null,
      experiment: {
        id: recommendation.experiment.id,
        variant: recommendation.experiment.variant,
      },
    }
  }

  async function runPostAction(actionName, action) {
    if (!isAuthenticated || pendingAction) {
      return
    }

    setPendingAction(actionName)

    try {
      const payload = await action(postId, getSafeRecommendationContext(post?._recommendation))
      if (payload?.post) {
        setLocalPost(payload.post)
      }
    } finally {
      setPendingAction('')
    }
  }

  async function trackShareIfPossible() {
    if (!isAuthenticated || localPost?.sharedByViewer || pendingAction === 'share') {
      return
    }

    try {
      await runPostAction('share', togglePostShare)
    } catch {
      // Share analytics should not block user-facing share flow.
    }
  }

  async function handleShareCopyLink() {
    try {
      await copyTextToClipboard(sharePayload.url)
      setToast({ message: t('common.shareActions.linkCopied'), tone: 'success' })
      setIsShareMenuOpen(false)
      void trackShareIfPossible()
    } catch {
      setToast({ message: t('common.shareActions.copyFailed'), tone: 'error' })
    }
  }

  function handleShareToPlatform(platformKey) {
    const targetUrl = shareTargets[platformKey]

    if (!targetUrl) {
      return
    }

    if (typeof window !== 'undefined') {
      window.open(targetUrl, '_blank', 'noopener,noreferrer')
    }

    setToast({ message: t('common.shareActions.platformOpened'), tone: 'success' })
    setIsShareMenuOpen(false)
    void trackShareIfPossible()
  }

  function handleShareButtonClick() {
    if (!sharePayload.url || isShareProcessing) {
      return
    }

    setIsShareMenuOpen((currentState) => !currentState)
  }

  return {
    pendingAction,
    setPendingAction,
    isShareMenuOpen,
    setIsShareMenuOpen,
    isShareProcessing,
    toast,
    setToast,
    runPostAction,
    trackShareIfPossible,
    handleShareCopyLink,
    handleShareToPlatform,
    handleShareButtonClick,
    getSafeRecommendationContext,
  }
}
