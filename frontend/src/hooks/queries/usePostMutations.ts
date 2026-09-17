import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../../lib/queryKeys'
import {
  createPost,
  deletePost,
  togglePostLike,
  togglePostSave,
  togglePostShare,
  createComment,
  deleteComment,
} from '../../services/postsService'
import type { Post } from '../../types'

export function useCreatePostMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: FormData | Record<string, any>) => createPost(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.posts.all })
    },
  })
}

export function useLikePostMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ postId, recommendation }: { postId: string; recommendation?: any }) =>
      togglePostLike(postId, recommendation),
    onSuccess: (_data, { postId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.posts.detail(postId) })
    },
  })
}

export function useSavePostMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ postId, recommendation }: { postId: string; recommendation?: any }) =>
      togglePostSave(postId, recommendation),
    onSuccess: (_data, { postId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.posts.detail(postId) })
    },
  })
}

export function useSharePostMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ postId, recommendation }: { postId: string; recommendation?: any }) =>
      togglePostShare(postId, recommendation),
    onSuccess: (_data, { postId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.posts.detail(postId) })
    },
  })
}

export function useDeletePostMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (postId: string) => deletePost(postId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.posts.all })
    },
  })
}

export function useCommentMutation(postId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: FormData | Record<string, any>) => createComment(postId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.posts.detail(postId) })
    },
  })
}

export function useDeleteCommentMutation(postId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (commentId: string) => deleteComment(commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.posts.detail(postId) })
    },
  })
}
