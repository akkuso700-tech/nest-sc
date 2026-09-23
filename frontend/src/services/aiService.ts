import { apiBaseUrl } from '../lib/apiClient.js'

export interface AiChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export interface StreamAiChatOptions {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  onDelta: (delta: string) => void
  onError?: (err: Error) => void
  onDone?: () => void
  signal?: AbortSignal
}

export async function streamAiChat({
  messages,
  onDelta,
  onError,
  onDone,
  signal,
}: StreamAiChatOptions): Promise<void> {
  const url = `${apiBaseUrl}/ai/stream`

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      },
      credentials: 'include',
      body: JSON.stringify({ messages }),
      signal,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMsg =
        errorData.error ||
        errorData.message ||
        `İstek başarısız oldu (${response.status})`
      const err = new Error(errorMsg)
      onError?.(err)
      throw err
    }

    if (!response.body) {
      const err = new Error('Yanıt akışı başlatılamadı.')
      onError?.(err)
      throw err
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data:')) continue

        const payloadStr = trimmed.replace(/^data:\s*/, '')
        if (payloadStr === '[DONE]') {
          onDone?.()
          return
        }

        try {
          const payload = JSON.parse(payloadStr)
          if (payload.delta) {
            onDelta(payload.delta)
          }
          if (payload.error) {
            onError?.(new Error(payload.error))
          }
        } catch {
          // ignore JSON parse issue for fragmented SSE
        }
      }
    }
  } catch (err: any) {
    if (signal?.aborted) {
      return
    }
    onError?.(err)
    throw err
  } finally {
    onDone?.()
  }
}

export interface PostSummaryResult {
  success: boolean
  summary: string
  cached: boolean
  generatedAt?: string
}

export async function getPostSummary(
  postId: string,
  refresh: boolean = false,
  signal?: AbortSignal
): Promise<PostSummaryResult> {
  const url = `${apiBaseUrl}/ai/summarize-post/${postId}${refresh ? '?refresh=true' : ''}`

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    signal,
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    const errorMsg =
      errorData.message ||
      errorData.error ||
      `Özet alınamadı (${response.status})`
    throw new Error(errorMsg)
  }

  return response.json()
}

export interface MagicComposeOptions {
  text: string
  action: 'enhance' | 'hashtags' | 'fix' | 'poll'
  language?: string
  signal?: AbortSignal
}

export interface MagicComposeResult {
  success: boolean
  result: string
  action: string
}

export async function magicComposeText({
  text,
  action,
  language = 'tr',
  signal,
}: MagicComposeOptions): Promise<MagicComposeResult> {
  const url = `${apiBaseUrl}/ai/magic-compose`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ text, action, language }),
    signal,
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.message || errorData.error || 'İşlem gerçekleştirilemedi.')
  }

  return response.json()
}

export interface TranslateTextOptions {
  text: string
  targetLanguage?: string
  signal?: AbortSignal
}

export interface TranslateTextResult {
  success: boolean
  translatedText: string
  targetLanguage: string
}

export async function translatePostContent({
  text,
  targetLanguage = 'tr',
  signal,
}: TranslateTextOptions): Promise<TranslateTextResult> {
  const url = `${apiBaseUrl}/ai/translate`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ text, targetLanguage }),
    signal,
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.message || errorData.error || 'Çeviri yapılamadı.')
  }

  return response.json()
}

