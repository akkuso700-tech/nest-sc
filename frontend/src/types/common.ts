export type Id = string

export type ISODateString = string

export interface ApiResponse<T = any> {
  success?: boolean
  message?: string
  data?: T
  [key: string]: any
}

export interface PaginatedResponse<T = any> {
  data: T[]
  total?: number
  page?: number
  limit?: number
  hasMore?: boolean
  totalPages?: number
  [key: string]: any
}

export interface ApiErrorResponse {
  message: string
  status?: number
  code?: string
  issues?: Array<{ field?: string; message: string }> | null
  details?: Record<string, any> | null
}

export type MediaType = 'image' | 'video' | 'audio'

export interface MediaItem {
  url: string
  type: MediaType
  posterUrl?: string
  duration?: number
  durationSec?: number
  width?: number
  height?: number
  fileSizeBytes?: number
  publicId?: string
  mimeType?: string
  [key: string]: any
}

export interface FileUploadResult {
  url: string
  type: MediaType
  fileSizeBytes?: number
  posterUrl?: string
  durationSec?: number
  [key: string]: any
}
