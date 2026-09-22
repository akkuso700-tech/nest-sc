const { env } = require('../config/env')

const DEFAULT_SYSTEM_PROMPT = `Sen Nest Social platformunun resmi, zeki, cana yakın ve yardımsever yapay zeka asistanısın.
Görevlerin:
1. Nest Social kullanıcılarına platform özelliklerini (gönderi paylaşma, Loop videoları, gruplar, mesajlaşma, gizli profil, hikayeler) tanıtmak ve yardımcı olmak.
2. Kullanıcılara sosyal medya içerik fikirleri, başlıklar, etiketler (hashtags) ve yaratıcı metinler üretmekte destek olmak.
3. Genel sohbet, bilgi edinme, kodlama, günlük yaşam ve merak edilen tüm konularda kibar, akıcı ve doğal bir Türkçe ile yanıt vermek.
4. Yanıtlarını düzenli tutmak için gerektiğinde madde imleri, kalın başlıklar ve temiz formatlar kullan. Samimi ama saygılı bir üslup benimse.`

/**
 * Sends chat completion request to NVIDIA Build API with SSE streaming.
 * @param {Object} options
 * @param {Array<{role: string, content: string}>} options.messages
 * @param {string} [options.systemPrompt]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<Response>}
 */
async function callNvidiaStreaming({ messages, systemPrompt, signal }) {
  const apiKey = env.nvidia.apiKey || process.env.NVIDIA_API_KEY || ''

  if (!apiKey) {
    return null
  }

  const formattedMessages = [
    { role: 'system', content: systemPrompt || DEFAULT_SYSTEM_PROMPT },
    ...messages.map((msg) => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: String(msg.content || '').trim(),
    })).filter((msg) => msg.content.length > 0),
  ]

  const baseUrl = (env.nvidia.baseUrl || 'https://integrate.api.nvidia.com/v1').replace(/\/+$/, '')
  const endpoint = `${baseUrl}/chat/completions`

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'text/event-stream',
    },
    body: JSON.stringify({
      model: env.nvidia.model || 'meta/llama-3.3-70b-instruct',
      messages: formattedMessages,
      temperature: 0.7,
      max_tokens: 1024,
      stream: true,
    }),
    signal,
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    const error = new Error(`NVIDIA API Error (${response.status}): ${errorText || response.statusText}`)
    error.status = response.status
    error.details = errorText
    throw error
  }

  return response
}

module.exports = {
  DEFAULT_SYSTEM_PROMPT,
  callNvidiaStreaming,
}
