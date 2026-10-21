export interface ApiRequestConfig {
  skipRefreshRetry?: boolean
  timeoutMs?: number
  retry?: boolean | number
}

export interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  body?: any
  cache?: RequestCache
  headers?: Record<string, string>
}

export declare function apiRequest<T = any>(
  path: string,
  options?: ApiRequestOptions,
  config?: ApiRequestConfig
): Promise<T>

export declare function refreshSession(): Promise<any>
export declare function onSessionExpired(callback: () => void): () => void
export declare function getAccessToken(): string | null
export declare function isAccessTokenExpired(skewMs?: number): boolean
export declare function setAccessToken(token: string | null | undefined, expiresInMs?: number): void
export declare function clearAccessToken(): void
export declare function getRefreshToken(): string | null
export declare function setRefreshToken(token: string | null | undefined): void
export declare function clearAuthTokens(): void

export declare const apiBaseUrl: string
export declare const apiOrigin: string

export declare const _test: {
  createTimedSignal: (timeoutMs?: number) => { signal?: AbortSignal; cleanup?: () => void }
  fetchWithApiFallback: (path: string, options?: RequestInit, config?: ApiRequestConfig) => Promise<Response>
  isIdempotentMethod: (method: string) => boolean
  isRetryableStatus: (status: number) => boolean
}
