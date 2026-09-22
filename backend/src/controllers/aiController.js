const { callNvidiaStreaming } = require('../services/aiService')

/**
 * Handle streaming AI chat completions via Server-Sent Events (SSE).
 */
async function streamChat(req, res) {
  const { messages, systemPrompt } = req.body || {}

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({
      message: 'Geçerli bir mesaj listesi (messages) gönderilmelidir.',
    })
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders?.()

  const abortController = new AbortController()
  req.on('close', () => {
    abortController.abort()
  })

  try {
    const upstreamResponse = await callNvidiaStreaming({
      messages,
      systemPrompt,
      signal: abortController.signal,
    })

    if (!upstreamResponse) {
      // API key is not configured yet, provide a friendly simulated stream
      const friendlyNotice =
        'Merhaba! Ben Nest Social Yapay Zeka Asistanıyım. ✨\n\n' +
        'Şu an demo modundayım çünkü sistem yapılandırması henüz tamamlanmamış.\n\n' +
        'Web siteniz ve içeriklerinizle ilgili sorularınızı yanıtlamak için sabırsızlanıyorum.'

      // Stream the notice smoothly
      const words = friendlyNotice.split(' ')
      for (const word of words) {
        if (req.destroyed) break
        res.write(`data: ${JSON.stringify({ delta: word + ' ' })}\n\n`)
        await new Promise((resolve) => setTimeout(resolve, 35))
      }

      res.write('data: [DONE]\n\n')
      return res.end()
    }

    // Upstream has SSE stream
    const reader = upstreamResponse.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''

    while (!abortController.signal.aborted) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data:')) continue

        const dataContent = trimmed.replace(/^data:\s*/, '')
        if (dataContent === '[DONE]') {
          res.write('data: [DONE]\n\n')
          continue
        }

        try {
          const parsed = JSON.parse(dataContent)
          const delta = parsed.choices?.[0]?.delta?.content || ''
          if (delta) {
            res.write(`data: ${JSON.stringify({ delta })}\n\n`)
          }
        } catch {
          // Ignore JSON parse errors for non-JSON lines
        }
      }
    }

    res.write('data: [DONE]\n\n')
    res.end()
  } catch (err) {
    if (abortController.signal.aborted || req.destroyed) {
      return
    }

    console.error('[AI streamChat Error]:', err.message || err)
    res.write(
      `data: ${JSON.stringify({
        error: 'Yapay zeka yanıtı alınırken bir sorun oluştu. Lütfen birazdan tekrar deneyiniz.',
        details: err.message,
      })}\n\n`,
    )
    res.write('data: [DONE]\n\n')
    res.end()
  }
}

module.exports = {
  streamChat,
}
