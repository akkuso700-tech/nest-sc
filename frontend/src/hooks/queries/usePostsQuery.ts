import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '../../lib/queryKeys'
import { getFeed, getTrendingTopics, getPostDetail, type GetFeedParams } from '../../services/postsService'
import type { Post } from '../../types'

export function useFeedQuery(params: GetFeedParams = {}, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.posts.feed(params),
    queryFn: () => getFeed(params),
    staleTime: 30 * 1000,
    enabled: options.enabled ?? true,
  })
}

export function useTrendingTopicsQuery(params: { limit?: number } = {}) {
  return useQuery({
    queryKey: queryKeys.posts.trends(params.limit),
    queryFn: () => getTrendingTopics(params),
    staleTime: 5 * 60 * 1000,
  })
}

export function usePostDetailQuery(postId: string, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.posts.detail(postId),
    queryFn: () => getPostDetail(postId),
    enabled: Boolean(postId) && (options.enabled ?? true),
    staleTime: 60 * 1000,
  })
}
