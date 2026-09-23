const crypto = require('crypto')
const { User } = require('../models/User')
const { Comment } = require('../models/Comment')
const { Post } = require('../models/Post')
const { env } = require('../config/env')

// In-memory rate limiting map: `${userId}_${postId}` -> timestamp
const mentionCooldowns = new Map()
const COOLDOWN_MS = 30 * 1000 // 30 seconds between bot summons per user on a post

/**
 * Gets or creates the official @nestai bot user in MongoDB.
 * @returns {Promise<import('../models/User').UserDocument>}
 */
async function getOrCreateNestAiUser() {
  let botUser = await User.findOne({ username: 'nestai' })

  if (!botUser) {
    try {
      botUser = await User.create({
        firstName: 'Nest',
        lastName: 'AI',
        username: 'nestai',
        email: 'nestai@nest.social',
        passwordHash: crypto.randomBytes(32).toString('hex'),
        birthDate: new Date('2000-01-01'),
        accountStatus: 'active',
        emailVerifiedAt: new Date(),
        verification: {
          status: 'approved',
          category: 'creator',
          reviewedAt: new Date(),
        },
        bio: 'Nest Social Resmi Yapay Zeka Asistanı. Gönderilerde veya yorumlarda beni @nestai olarak etiketleyebilirsin! ✨',
        avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=nestai&backgroundColor=2563eb',
      })
    } catch (err) {
      // In case of race condition
      botUser = await User.findOne({ username: 'nestai' })
      if (!botUser) throw err
    }
  }

  return botUser
}

/**
 * Generates an intelligent, social-media style reply from @nestai.
 * @param {Object} options
 * @param {string} options.postText
 * @param {string} [options.commentText]
 * @param {string} options.authorUsername
 * @returns {Promise<string>}
 */
async function generateBotReply({ postText, commentText, authorUsername }) {
  const apiKey = env.nvidia.apiKey || process.env.NVIDIA_API_KEY || ''
  if (!apiKey) {
    return `@${authorUsername} Hey! Ben Nest AI. ✨ Sistem konfigürasyonum tamamlandığında sorularına harika yanıtlar vereceğim!`
  }

  const prompt = `Aşağıdaki sosyal medya içeriğinde bir kullanıcı seni (@nestai) etiketledi.

Gönderi İçeriği:
"""${postText || '(Görsel/Medya paylaşımı)'}"""

${commentText ? `Kullanıcının Yorumu/Sorusu:\n"""${commentText}"""` : 'Kullanıcı seni doğrudan gönderisinde etiketledi.'}

Etiketleyen Kullanıcı: @${authorUsername}

Kurallar:
1. Sen Nest Social platformunun resmi, zeki, esprili ve sevimli yapay zeka botusun (@nestai).
2. Samimi, doğal, eğlenceli ve sosyal medya ortamına tam oturan akıcı bir Türkçe kullan.
3. Yanıtın kısa olsun: En fazla 2 veya 3 cümle!
4. Kullanıcıya @${authorUsername} olarak hitap et.
5. "Ben bir yapay zekayım", "Merhaba, nasıl yardımcı olabilirim" gibi robotik kalıplar KULLANMA; doğrudan konuya zekice veya esprili bir yorum yap.`

  const baseUrl = (env.nvidia.baseUrl || 'https://integrate.api.nvidia.com/v1').replace(/\/+$/, '')
  const endpoint = `${baseUrl}/chat/completions`

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: env.nvidia.model || 'meta/llama-3.3-70b-instruct',
        messages: [
          {
            role: 'system',
            content:
              'Sen Nest Social platformunun resmi akıllı sosyal medya botusun (@nestai). Yorumlara 2-3 cümlelik canlı, zeki ve esprili Türkçe yanıtlar verirsin.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 250,
        stream: false,
      }),
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      console.error('[NestAI Reply API Error]:', response.status, errText)
      return `@${authorUsername} Bildirimini aldım! ✨ Gönderin harika görünüyor, takipteyim.`
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ''
    return content.trim()
  } catch (err) {
    console.error('[NestAI Generation Exception]:', err)
    return `@${authorUsername} Harika bir paylaşım! ✨ Seninle burada olmak çok güzel.`
  }
}

/**
 * Handles @nestai mention asynchronously without blocking the user's HTTP request.
 * @param {Object} options
 * @param {Object} options.post
 * @param {Object} [options.comment]
 * @param {Object} options.user
 * @param {Object} [options.io]
 * @param {Function} [options.createNotification]
 */
async function handleNestAiMention({ post, comment, user, io, createNotification }) {
  if (!user || user.username === 'nestai') {
    return
  }

  const postIdStr = (post._id || post.id || '').toString()
  const userIdStr = (user._id || user.id || '').toString()
  const cooldownKey = `${userIdStr}_${postIdStr}`

  // Rate limit check
  const lastTime = mentionCooldowns.get(cooldownKey) || 0
  const now = Date.now()
  if (now - lastTime < COOLDOWN_MS) {
    return
  }
  mentionCooldowns.set(cooldownKey, now)

  // Clean old cooldown entries periodically
  if (mentionCooldowns.size > 2000) {
    for (const [key, timestamp] of mentionCooldowns.entries()) {
      if (now - timestamp > COOLDOWN_MS) {
        mentionCooldowns.delete(key)
      }
    }
  }

  try {
    const nestAiUser = await getOrCreateNestAiUser()

    const replyText = await generateBotReply({
      postText: post.text || post.content || '',
      commentText: comment ? (comment.text || '') : '',
      authorUsername: user.username,
    })

    if (!replyText) {
      return
    }

    // Create the bot comment in database
    const botComment = await Comment.create({
      post: post._id,
      author: nestAiUser._id,
      parentComment: comment ? (comment._id || comment.id) : null,
      text: replyText,
    })

    // Update stats
    await Post.updateOne({ _id: post._id }, { $inc: { 'stats.comments': 1 } })

    if (comment && (comment._id || comment.id)) {
      await Comment.updateOne(
        { _id: comment._id || comment.id },
        { $inc: { 'stats.replies': 1 } },
      )
    }

    // Populate bot author for serialization
    const populatedBotComment = await Comment.findById(botComment._id).populate(
      'author',
      'firstName lastName username avatarUrl verification',
    )

    // Notify the user who summoned @nestai
    if (typeof createNotification === 'function') {
      try {
        await createNotification({
          io,
          recipientId: user._id,
          actor: nestAiUser,
          type: 'comment',
          entityKind: comment ? 'comment' : 'post',
          entityId: botComment._id,
          title: 'Nest AI yanıtladı ✨',
          body: replyText.slice(0, 100),
        })
      } catch (notifErr) {
        console.error('[NestAI Notification Error]:', notifErr.message)
      }
    }

    // Emit realtime socket event if io is available
    if (io) {
      io.emit('post:comment:new', {
        postId: postIdStr,
        comment: populatedBotComment,
      })
    }
  } catch (err) {
    console.error('[handleNestAiMention Error]:', err.message || err)
  }
}

module.exports = {
  getOrCreateNestAiUser,
  generateBotReply,
  handleNestAiMention,
}
