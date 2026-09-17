const assert = require('node:assert/strict')
const test = require('node:test')
const { env } = require('../src/config/env')
const { sendEmail } = require('../src/services/emailService')
const { buildMessageNotificationEmail } = require('../src/templates/messageNotificationEmail')
const { buildShadowMessageNotificationEmail } = require('../src/templates/shadowMessageNotificationEmail')

test('emailService: throws error when email provider is disabled', async () => {
  const originalProvider = env.emailProvider
  try {
    env.emailProvider = 'disabled'
    await assert.rejects(
      async () => {
        await sendEmail({
          to: 'test@example.com',
          subject: 'Test',
          html: '<p>Test</p>',
        })
      },
      { message: 'Email provider disabled.' }
    )
  } finally {
    env.emailProvider = originalProvider
  }
})

test('emailService: throws error for unsupported email provider', async () => {
  const originalProvider = env.emailProvider
  try {
    env.emailProvider = 'unsupported_provider'
    await assert.rejects(
      async () => {
        await sendEmail({
          to: 'test@example.com',
          subject: 'Test',
          html: '<p>Test</p>',
        })
      },
      { message: 'Unsupported email provider: unsupported_provider' }
    )
  } finally {
    env.emailProvider = originalProvider
  }
})

test('emailService: throws error when RESEND_API_KEY is missing for resend provider', async () => {
  const originalProvider = env.emailProvider
  const originalApiKey = env.resendApiKey
  try {
    env.emailProvider = 'resend'
    env.resendApiKey = ''
    await assert.rejects(
      async () => {
        await sendEmail({
          to: 'test@example.com',
          subject: 'Test',
          html: '<p>Test</p>',
        })
      },
      { message: 'RESEND_API_KEY missing.' }
    )
  } finally {
    env.emailProvider = originalProvider
    env.resendApiKey = originalApiKey
  }
})

test('emailService: successfully posts payload to Resend API with correct headers and body', async () => {
  const originalProvider = env.emailProvider
  const originalApiKey = env.resendApiKey
  const originalFrom = env.emailFrom
  const originalFetch = global.fetch

  let capturedUrl = null
  let capturedOptions = null

  try {
    env.emailProvider = 'resend'
    env.resendApiKey = 're_test_dummy_key_123456789'
    env.emailFrom = 'nest-sc.com <noreply@nest-sc.com>'

    global.fetch = async (url, options) => {
      capturedUrl = url
      capturedOptions = options
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: 'resend_email_id_999' }),
      }
    }

    const { subject, html, text } = buildMessageNotificationEmail({
      recipientName: 'Mert',
      senderName: 'Can',
      senderUsername: 'can_dev',
      previewText: 'Merhaba, proje nasıl gidiyor?',
      actionUrl: 'https://nest-sc.com/messages',
    })

    const result = await sendEmail({
      to: 'mert@example.com',
      subject,
      html,
      text,
    })

    assert.equal(capturedUrl, 'https://api.resend.com/emails')
    assert.equal(capturedOptions.method, 'POST')
    assert.equal(capturedOptions.headers['Authorization'], 'Bearer re_test_dummy_key_123456789')
    assert.equal(capturedOptions.headers['Content-Type'], 'application/json')

    const parsedBody = JSON.parse(capturedOptions.body)
    assert.equal(parsedBody.from, 'nest-sc.com <noreply@nest-sc.com>')
    assert.equal(parsedBody.to, 'mert@example.com')
    assert.match(parsedBody.subject, /Can sana yeni bir mesaj gönderdi - nest-sc\.com/)
    assert.match(parsedBody.html, /Merhaba, proje nasıl gidiyor\?/)
    assert.match(parsedBody.html, /background-color: #f8fafc/) // Modern light theme check
    assert.match(parsedBody.html, /nest-sc\.com/)
    assert.equal(result.id, 'resend_email_id_999')
  } finally {
    env.emailProvider = originalProvider
    env.resendApiKey = originalApiKey
    env.emailFrom = originalFrom
    global.fetch = originalFetch
  }
})

test('emailService: fallback sender header is nest-sc.com <onboarding@resend.dev> when emailFrom not set', async () => {
  const originalProvider = env.emailProvider
  const originalApiKey = env.resendApiKey
  const originalFrom = env.emailFrom
  const originalFetch = global.fetch

  let capturedOptions = null

  try {
    env.emailProvider = 'resend'
    env.resendApiKey = 're_test_dummy_key_123456789'
    delete env.emailFrom

    global.fetch = async (url, options) => {
      capturedOptions = options
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: 'resend_email_id_100' }),
      }
    }

    await sendEmail({
      to: 'user@example.com',
      subject: 'Test Subject',
      html: '<p>Test</p>',
      text: 'Test',
    })

    const parsedBody = JSON.parse(capturedOptions.body)
    assert.equal(parsedBody.from, 'nest-sc.com <onboarding@resend.dev>')
  } finally {
    env.emailProvider = originalProvider
    env.resendApiKey = originalApiKey
    env.emailFrom = originalFrom
    global.fetch = originalFetch
  }
})

test('emailService: handles Resend API failure status with body details', async () => {
  const originalProvider = env.emailProvider
  const originalApiKey = env.resendApiKey
  const originalFetch = global.fetch

  try {
    env.emailProvider = 'resend'
    env.resendApiKey = 're_invalid_api_key'

    global.fetch = async () => {
      return {
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ message: 'Invalid API key' }),
      }
    }

    await assert.rejects(
      async () => {
        await sendEmail({
          to: 'invalid@example.com',
          subject: 'Fail Test',
          html: '<p>Test</p>',
        })
      },
      (err) => {
        assert.equal(err.message, 'Resend API failed with status 401')
        assert.ok(err.details.includes('Invalid API key'))
        return true
      }
    )
  } finally {
    env.emailProvider = originalProvider
    env.resendApiKey = originalApiKey
    global.fetch = originalFetch
  }
})

test('emailService: shadow message email template light theme and nest-sc.com integration', async () => {
  const emailData = buildShadowMessageNotificationEmail({
    recipientName: 'Gizem',
    senderAlias: 'GölgeGezgini#44',
    messageCount: 2,
    previewText: 'Gizli mesaj bildirimi.',
    actionUrl: 'https://nest-sc.com/tr/lounge?chat=shadow_123',
  })

  assert.match(emailData.subject, /Gölge Modu: GölgeGezgini#44 sana 2 yeni mesaj gönderdi - nest-sc\.com/)
  assert.match(emailData.html, /background-color: #faf5ff/) // Soft purple light theme
  assert.match(emailData.html, /🎭 Gölge Modu - nest-sc\.com/)
  assert.match(emailData.html, /Gölge Sohbetini Aç/)
  assert.match(emailData.text, /nest-sc\.com/)
})
