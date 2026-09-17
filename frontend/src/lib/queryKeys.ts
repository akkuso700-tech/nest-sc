export const queryKeys = {
  // Posts & Feed
  posts: {
    all: ['posts'] as const,
    feed: (params: Record<string, any> = {}) => ['posts', 'feed', params] as const,
    detail: (postId: string) => ['posts', 'detail', postId] as const,
    trends: (limit?: number) => ['posts', 'trends', { limit }] as const,
    likes: (postId: string, page?: number) => ['posts', 'likes', postId, { page }] as const,
    insights: (postId: string, days?: number) => ['posts', 'insights', postId, { days }] as const,
  },

  // Users & Profiles
  users: {
    all: ['users'] as const,
    me: () => ['users', 'me'] as const,
    profile: (username: string) => ['users', 'profile', username] as const,
    connections: (username: string, type: string) => ['users', 'connections', username, type] as const,
    discovery: (params: Record<string, any> = {}) => ['users', 'discovery', params] as const,
    search: (query: string, limit?: number) => ['users', 'search', { query, limit }] as const,
  },

  // Notifications
  notifications: {
    all: ['notifications'] as const,
    list: (params: Record<string, any> = {}) => ['notifications', 'list', params] as const,
  },

  // Messages & Conversations
  messages: {
    all: ['messages'] as const,
    conversations: (limit?: number) => ['messages', 'conversations', { limit }] as const,
    chat: (conversationId: string, limit?: number) => ['messages', 'chat', conversationId, { limit }] as const,
  },

  // Groups
  groups: {
    all: ['groups'] as const,
    sidebar: (params: Record<string, any> = {}) => ['groups', 'sidebar', params] as const,
    detail: (slug: string) => ['groups', 'detail', slug] as const,
    members: (groupId: string, params: Record<string, any> = {}) => ['groups', 'members', groupId, params] as const,
    feed: (params: Record<string, any> = {}) => ['groups', 'feed', params] as const,
  },

  // Stories
  stories: {
    all: ['stories'] as const,
    rails: (params: Record<string, any> = {}) => ['stories', 'rails', params] as const,
    user: (username: string) => ['stories', 'user', username] as const,
  },

  // Anonymous Lounge
  anonymous: {
    all: ['anonymous'] as const,
    rooms: () => ['anonymous', 'rooms'] as const,
    roomMessages: (roomId: string) => ['anonymous', 'roomMessages', roomId] as const,
    directChats: () => ['anonymous', 'directChats'] as const,
  },

  // Admin
  admin: {
    all: ['admin'] as const,
    overview: (params: Record<string, any> = {}) => ['admin', 'overview', params] as const,
    users: (params: Record<string, any> = {}) => ['admin', 'users', params] as const,
    userDetail: (userId: string) => ['admin', 'userDetail', userId] as const,
    auditLogs: (params: Record<string, any> = {}) => ['admin', 'auditLogs', params] as const,
    reports: (params: Record<string, any> = {}) => ['admin', 'reports', params] as const,
  },
}
