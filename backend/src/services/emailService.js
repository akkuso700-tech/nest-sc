const { env } = require('../config/env')

async function sendEmailViaResend({ to, subject, html, text }) {
  if (!env.resendApiKey) {
    throw new Error('RESEND_API_KEY missing.')
  }

  const from = env.emailFrom || 'My Social <onboarding@resend.dev>'

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      html,
      text,
    }),
  })

  if (!response.ok) {
    const bodyText = await response.text().catch(() => '')
    const error = new Error(`Resend API failed with status ${response.status}`)
    error.details = bodyText
    throw error
  }

  return response.json().catch(() => ({}))
}

async function sendEmail(payload) {
  if (env.emailProvider === 'disabled') {
    throw new Error('Email provider disabled.')
  }

  if (env.emailProvider === 'resend') {
    return sendEmailViaResend(payload)
  }

  throw new Error(`Unsupported email provider: ${env.emailProvider}`)
}

module.exports = { sendEmail }

