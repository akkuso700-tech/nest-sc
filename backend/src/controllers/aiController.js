const {
  callNvidiaStreaming,
  buildNestSocialSystemPrompt,
  magicComposeText,
  translatePostText,
} = require('../services/aiService')

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
    const activeSystemPrompt = systemPrompt || buildNestSocialSystemPrompt(req.user)

    const upstreamResponse = await callNvidiaStreaming({
      messages,
      systemPrompt: activeSystemPrompt,
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

/**
 * Handle AI summary generation for a specific post.
 */
async function summarizePost(req, res) {
  const { postId } = req.params
  const forceRefresh = req.query.refresh === 'true'

  if (!postId) {
    return res.status(400).json({ success: false, message: 'postId parametresi gereklidir.' })
  }

  try {
    const { Post } = require('../models/Post')
    const { Comment } = require('../models/Comment')
    const { summarizePostContent } = require('../services/aiService')

    const post = await Post.findById(postId).populate('author', 'username firstName lastName bio verification role')

    if (!post) {
      return res.status(404).json({ success: false, message: 'Gönderi bulunamadı.' })
    }

    // Return cached summary if available and not forced to refresh
    if (!forceRefresh && post.aiSummary && post.aiSummary.text) {
      return res.json({
        success: true,
        summary: post.aiSummary.text,
        cached: true,
        generatedAt: post.aiSummary.generatedAt,
      })
    }

    // Fetch up to 3 top comments for richer context
    let commentTexts = []
    try {
      const topComments = await Comment.find({
        post: postId,
        'moderation.visibility': 'visible',
      })
        .sort({ likeCount: -1, createdAt: -1 })
        .limit(3)
        .select('text')

      commentTexts = topComments.map((c) => c.text).filter(Boolean)
    } catch {
      // Ignore comment fetch errors
    }

    const authorDetails = {
      username: post.author?.username || 'kullanici',
      fullName: [post.author?.firstName, post.author?.lastName].filter(Boolean).join(' ') || '',
      bio: post.author?.bio || '',
      isVerified: post.author?.verification?.status === 'approved',
      verificationCategory: post.author?.verification?.category || '',
      role: post.author?.role || 'user',
    }

    const mediaList = (post.media || []).map((m) => ({
      type: m.type,
      durationSeconds: m.durationSeconds || 0,
    }))

    const summary = await summarizePostContent({
      postText: post.text,
      authorName: post.author?.username,
      authorDetails,
      mediaList,
      topComments: commentTexts,
    })

    // Cache to post document
    post.aiSummary = {
      text: summary,
      generatedAt: new Date(),
      language: 'tr',
    }
    await post.save()

    return res.json({
      success: true,
      summary,
      cached: false,
      generatedAt: post.aiSummary.generatedAt,
    })
  } catch (err) {
    console.error('[AI summarizePost Error]:', err.message || err)
    return res.status(500).json({
      success: false,
      message: 'Gönderi özeti oluşturulurken bir hata oluştu.',
      details: err.message,
    })
  }
}

/**
 * Handle AI Magic Compose / rewrite / hashtags / poll for post drafting.
 */
async function magicCompose(req, res) {
  const { text, action, language } = req.body || {}

  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({
      success: false,
      message: 'İçerik (text) alanı boş bırakılamaz.',
    })
  }

  try {
    const outcome = await magicComposeText({
      text,
      action: action || 'enhance',
      language: language || 'tr',
    })

    return res.json({
      success: true,
      result: outcome.result,
      action: outcome.action,
    })
  } catch (err) {
    console.error('[AI magicCompose Error]:', err.message || err)
    return res.status(500).json({
      success: false,
      message: 'Yapay zeka ile içerik üretilirken bir hata oluştu.',
      details: err.message,
    })
  }
}

/**
 * Handle on-the-fly post translation with AI.
 */
async function translateContent(req, res) {
  const { text, targetLanguage } = req.body || {}

  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Çevrilecek metin (text) boş bırakılamaz.',
    })
  }

  try {
    const outcome = await translatePostText({
      text,
      targetLanguage: targetLanguage || 'tr',
    })

    return res.json({
      success: true,
      translatedText: outcome.translatedText,
      targetLanguage: outcome.targetLanguage,
    })
  } catch (err) {
    console.error('[AI translateContent Error]:', err.message || err)
    return res.status(500).json({
      success: false,
      message: 'Metin çevrilirken bir hata oluştu.',
      details: err.message,
    })
  }
}

module.exports = {
  streamChat,
  summarizePost,
  magicCompose,
  translateContent,
}
