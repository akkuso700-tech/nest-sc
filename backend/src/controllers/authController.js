const bcrypt = require('bcryptjs')
const crypto = require('crypto')
const { User } = require('../models/User')
const { RefreshToken } = require('../models/RefreshToken')
const { AppError } = require('../utils/AppError')
const { asyncHandler } = require('../utils/asyncHandler')
const {
  clearAuthCookies,
  refreshTokenCookieName,
  setAuthCookies,
} = require('../utils/cookies')
const {
  createTokenPair,
  createPasswordResetToken,
  hashToken,
  serializeUser,
  verifyPasswordResetToken,
  verifyRefreshToken,
} = require('../utils/tokens')
const { env } = require('../config/env')
const { EmailVerificationToken } = require('../models/EmailVerificationToken')
const { sendEmail } = require('../services/emailService')
const { createAuditLog } = require('../utils/auditLog')
const {
  getSignupNotificationEmails,
  getSignupContractsForLanguage,
  getConsentTextByLanguage,
} = require('../services/adminSettingsService')

function createVerificationCode() {
  const number = Math.floor(Math.random() * 1000000)
  return String(number).padStart(6, '0')
}

function hashVerificationCode(code) {
  return hashToken(`${String(code).trim()}::${env.emailVerificationPepper}`)
}

const signupConsentVersion = '2026-04-16'
const googleStateCookieName = 'googleOAuthState'

function shouldBypassEmailVerification() {
  return env.isDevelopment
}

function getGoogleCookieOptions() {
  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: env.isProduction ? 'none' : 'lax',
    path: '/',
    maxAge: 10 * 60 * 1000,
  }
}

function resolveRequestOrigin(req) {
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim()
  const protocol = forwardedProto || req.protocol || (env.isProduction ? 'https' : 'http')
  const host = String(req.headers['x-forwarded-host'] || req.get('host') || '').split(',')[0].trim()

  if (!host) {
    return ''
  }

  return `${protocol}://${host}`
}

function normalizeLanguage(value) {
  const normalizedValue = String(value || '').trim().toLowerCase()

  if (!normalizedValue) {
    return 'tr'
  }

  return normalizedValue.slice(0, 5)
}

function resolveConsentText(language, providedText = '') {
  const customText = String(providedText || '').trim()

  if (customText) {
    return customText.slice(0, 1000)
  }

  return getConsentTextByLanguage(normalizeLanguage(language))
}

const passwordResetEmailContent = {
  tr: {
    subject: 'Nest Social sifre sifirlama baglantin',
    title: 'Sifreni sifirla',
    intro: 'Nest Social hesabinin sifresini yenilemek icin asagidaki baglantiyi kullan.',
    action: 'Yeni sifre belirle',
    expiry: 'Bu baglanti guvenlik nedeniyle sinirli bir sure boyunca gecerlidir.',
    ignore: 'Bu istegi sen yapmadiysan bu e-postayi yok sayabilirsin.',
  },
  en: {
    subject: 'Your Nest Social password reset link',
    title: 'Reset your password',
    intro: 'Use the link below to set a new password for your Nest Social account.',
    action: 'Set a new password',
    expiry: 'For security, this link is only valid for a limited time.',
    ignore: 'If you did not request this, you can ignore this email.',
  },
  de: {
    subject: 'Dein Link zum Zurucksetzen des Nest Social Passworts',
    title: 'Passwort zurucksetzen',
    intro: 'Verwende den folgenden Link, um ein neues Passwort fur dein Nest Social Konto festzulegen.',
    action: 'Neues Passwort festlegen',
    expiry: 'Aus Sicherheitsgrunden ist dieser Link nur fur begrenzte Zeit gultig.',
    ignore: 'Wenn du diese Anfrage nicht gestellt hast, kannst du diese E-Mail ignorieren.',
  },
  es: {
    subject: 'Tu enlace para restablecer la contrasena de Nest Social',
    title: 'Restablece tu contrasena',
    intro: 'Usa el siguiente enlace para crear una nueva contrasena para tu cuenta de Nest Social.',
    action: 'Crear una nueva contrasena',
    expiry: 'Por seguridad, este enlace solo es valido durante un tiempo limitado.',
    ignore: 'Si no solicitaste este cambio, puedes ignorar este correo.',
  },
}
const passwordResetRequestMessage =
  'Eger bu e-posta adresiyle kayitli bir hesap varsa sifre sifirlama baglantisi gonderildi.'

function buildPasswordResetUrl(resetToken, language = 'tr') {
  const supportedLanguage = passwordResetEmailContent[language] ? language : 'tr'
  const frontendOrigin = String(env.clientUrl).replace(/\/+$/, '')
  const resetUrl = new URL(`/${supportedLanguage}/reset-password`, `${frontendOrigin}/`)
  resetUrl.searchParams.set('token', resetToken)
  return resetUrl.toString()
}

async function sendPasswordResetEmail({ to, resetToken, language = 'tr' }) {
  const supportedLanguage = passwordResetEmailContent[language] ? language : 'tr'
  const content = passwordResetEmailContent[supportedLanguage]
  const resetUrl = buildPasswordResetUrl(resetToken, supportedLanguage)

  await sendEmail({
    to,
    subject: content.subject,
    text: [
      content.title,
      '',
      content.intro,
      resetUrl,
      '',
      content.expiry,
      content.ignore,
    ].join('\n'),
    html: `<div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial;line-height:1.55;color:#18181b;">
      <h2 style="margin:0 0 12px 0;">${content.title}</h2>
      <p style="margin:0 0 20px 0;">${content.intro}</p>
      <p style="margin:0 0 20px 0;">
        <a href="${resetUrl}" style="display:inline-block;padding:12px 18px;border-radius:999px;background:#18181b;color:#ffffff;text-decoration:none;font-weight:700;">
          ${content.action}
        </a>
      </p>
      <p style="margin:0 0 8px 0;color:#52525b;font-size:13px;">${content.expiry}</p>
      <p style="margin:0;color:#52525b;font-size:13px;">${content.ignore}</p>
    </div>`,
  })
}

function resolveRequestGeoSummary(req) {
  const ipAddress = String(req.ip || req.headers['x-forwarded-for'] || '').split(',')[0].trim()
  const country =
    String(req.headers['cf-ipcountry'] || req.headers['x-vercel-ip-country'] || req.headers['x-country-code'] || '')
      .trim()
      .toUpperCase()
  const region = String(req.headers['x-vercel-ip-country-region'] || req.headers['x-country-region'] || '')
    .trim()
  const city = String(req.headers['x-vercel-ip-city'] || req.headers['x-city'] || '').trim()
  const locationLabel = [city, region, country].filter(Boolean).join(', ') || 'Unknown'

  return {
    ipAddress: ipAddress || 'Unknown',
    country: country || 'Unknown',
    region: region || '',
    city: city || '',
    locationLabel,
  }
}

async function sendSignupNotificationEmail({
  user,
  req,
  method = 'normal',
  language = 'tr',
  consentVersion,
  consentText,
}) {
  try {
    const recipients = await getSignupNotificationEmails()

    if (!recipients.length) {
      return
    }

    const geo = resolveRequestGeoSummary(req)
    const userAgent = String(req.headers['user-agent'] || '').trim() || 'Unknown'
    const createdAtLabel = new Date().toISOString()

    await sendEmail({
      to: recipients,
      subject: `[Nest Social] Yeni Uyelik: ${user.username}`,
      text: [
        `Kullanici adi: ${user.username}`,
        `E-posta: ${user.email}`,
        `Kayit zamani: ${createdAtLabel}`,
        `IP: ${geo.ipAddress}`,
        `Yaklasik bolge: ${geo.locationLabel}`,
        `User-Agent: ${userAgent}`,
        `Kayit yontemi: ${method}`,
        `Aktif dil: ${language}`,
        `Uyelik kabul surumu: ${consentVersion}`,
        `Uyelik kabul metni: ${consentText}`,
      ].join('\n'),
      html: `<div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial;line-height:1.55;">
        <h2 style="margin:0 0 12px 0;">Yeni Uyelik Bildirimi</h2>
        <p><strong>Kullanici adi:</strong> ${user.username}</p>
        <p><strong>E-posta:</strong> ${user.email}</p>
        <p><strong>Kayit zamani:</strong> ${createdAtLabel}</p>
        <p><strong>IP:</strong> ${geo.ipAddress}</p>
        <p><strong>Yaklasik bolge:</strong> ${geo.locationLabel}</p>
        <p><strong>User-Agent:</strong> ${userAgent}</p>
        <p><strong>Kayit yontemi:</strong> ${method}</p>
        <p><strong>Aktif dil:</strong> ${language}</p>
        <p><strong>Uyelik kabul surumu:</strong> ${consentVersion}</p>
        <p><strong>Uyelik kabul metni:</strong> ${consentText}</p>
      </div>`,
    })
  } catch (error) {
    console.error('Failed to send signup notification email:', error?.message || error)
  }
}

function buildGoogleRedirectTarget(req, language, type = 'success', message = '') {
  const frontendOrigin = String(env.clientUrl || '').replace(/\/+$/, '')
  const resolvedLanguage = normalizeLanguage(language)
  const basePath = type === 'success' ? `/${resolvedLanguage}/` : `/${resolvedLanguage}/login`

  if (!frontendOrigin) {
    return `${basePath}`
  }

  const redirectUrl = new URL(basePath, `${frontendOrigin}/`)

  if (type === 'error' && message) {
    redirectUrl.searchParams.set('authError', message)
  }

  if (type === 'success') {
    redirectUrl.searchParams.set('google', 'success')
  }

  return redirectUrl.toString()
}

const requestSignUpCode = asyncHandler(async (req, res) => {
  const normalizedEmail = req.validated.body.email.toLowerCase()

  const emailExists = await User.exists({ email: normalizedEmail })
  if (emailExists) {
    throw new AppError('Bu e-posta adresi zaten kullanimda.', 409)
  }

  if (shouldBypassEmailVerification()) {
    res.json({
      sent: true,
      mode: 'development-bypass',
      skipVerification: true,
      message: 'Local gelistirme ortaminda e-posta dogrulamasi atlandi.',
    })
    return
  }

  if (env.emailProvider === 'disabled') {
    throw new AppError('Dogrulama servisi henuz aktif degil.', 501)
  }

  const recentToken = await EmailVerificationToken.findOne({
    email: normalizedEmail,
    consumedAt: null,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 })

  // Basic cooldown (60s) to prevent spam.
  if (recentToken && Date.now() - recentToken.createdAt.getTime() < 60_000) {
    res.json({
      sent: true,
      message: 'Dogrulama kodu zaten gonderildi. Lutfen biraz bekle.',
    })
    return
  }

  await EmailVerificationToken.deleteMany({
    email: normalizedEmail,
    consumedAt: null,
  })

  const code = createVerificationCode()
  const expiresAt = new Date(Date.now() + env.emailVerificationTtlMs)

  await EmailVerificationToken.create({
    email: normalizedEmail,
    codeHash: hashVerificationCode(code),
    expiresAt,
    ipAddress: req.ip || '',
    userAgent: req.headers['user-agent'] || '',
  })

  await sendEmail({
    to: normalizedEmail,
    subject: 'Dogrulama kodun',
    text: `Dogrulama kodun: ${code}\nBu kod ${Math.round(env.emailVerificationTtlMs / 60000)} dakika icinde gecerliligini yitirir.`,
    html: `<div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; line-height: 1.5;">
      <h2 style="margin:0 0 12px 0;">Dogrulama Kodun</h2>
      <p style="margin:0 0 12px 0;">Kodu kayit ekranina gir:</p>
      <div style="display:inline-block;padding:12px 16px;border-radius:12px;background:#0f172a;color:#fff;font-size:20px;letter-spacing:4px;font-weight:700;">
        ${code}
      </div>
      <p style="margin:12px 0 0 0;color:#334155;font-size:13px;">
        Bu kod ${Math.round(env.emailVerificationTtlMs / 60000)} dakika icinde gecerliligini yitirir.
      </p>
    </div>`,
  })

  res.json({
    sent: true,
    mode: 'email',
    message: 'Dogrulama kodu e-posta adresine gonderildi.',
  })
})

const verifySignUpCode = asyncHandler(async (req, res) => {
  const { email, code } = req.validated.body

  if (shouldBypassEmailVerification()) {
    res.json({
      verified: true,
      email: String(email || '').trim().toLowerCase(),
      mode: 'development-bypass',
      message: 'Local gelistirme ortaminda e-posta dogrulamasi atlandi.',
    })
    return
  }

  if (env.emailProvider === 'disabled') {
    throw new AppError('Dogrulama servisi henuz aktif degil.', 501)
  }

  const normalizedEmail = String(email || '').trim().toLowerCase()
  const normalizedCode = String(code || '').trim()

  if (!normalizedEmail) {
    throw new AppError('E-posta gerekli.', 400)
  }

  const token = await EmailVerificationToken.findOne({
    email: normalizedEmail,
    consumedAt: null,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 })

  if (!token) {
    throw new AppError('Dogrulama kodu gecersiz veya suresi dolmus.', 400)
  }

  token.attemptCount = Number(token.attemptCount || 0) + 1
  token.lastAttemptAt = new Date()
  await token.save()

  if (token.attemptCount > 10) {
    throw new AppError('Cok fazla deneme yapildi. Lutfen yeniden kod iste.', 429)
  }

  if (token.codeHash !== hashVerificationCode(normalizedCode)) {
    throw new AppError('Gecersiz dogrulama kodu.', 400)
  }

  token.consumedAt = new Date()
  await token.save()

  res.json({
    verified: true,
    email: normalizedEmail,
    message: 'Dogrulama basarili.',
  })
})

async function buildUniqueUsername(baseValue) {
  const base = baseValue
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 20)

  let candidate = base || `user${Date.now().toString().slice(-6)}`
  let counter = 1

  while (await User.exists({ username: candidate })) {
    candidate = `${base || 'user'}${counter}`
    counter += 1
  }

  return candidate
}

const startGoogleAuth = asyncHandler(async (req, res) => {
  if (!env.googleClientId || !env.googleClientSecret) {
    throw new AppError('Google giris servisi henuz aktif degil.', 501)
  }

  const origin = resolveRequestOrigin(req)
  if (!origin && !env.googleRedirectUri) {
    throw new AppError('Google OAuth redirect ayari eksik.', 500)
  }

  const language = normalizeLanguage(req.query.lang || 'tr')
  const nonce = crypto.randomUUID()
  const statePayload = Buffer.from(
    JSON.stringify({
      nonce,
      lang: language,
      ts: Date.now(),
    }),
  ).toString('base64url')
  const redirectUri = env.googleRedirectUri || `${origin}/api/v1/auth/google/callback`

  res.cookie(googleStateCookieName, nonce, getGoogleCookieOptions())

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authUrl.searchParams.set('client_id', env.googleClientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', 'openid email profile')
  authUrl.searchParams.set('prompt', 'select_account')
  authUrl.searchParams.set('state', statePayload)

  res.redirect(authUrl.toString())
})

const googleCallback = asyncHandler(async (req, res) => {
  const fallbackLang = normalizeLanguage(req.query.lang || 'tr')
  const clearGoogleStateCookie = () => {
    res.clearCookie(googleStateCookieName, {
      ...getGoogleCookieOptions(),
      maxAge: undefined,
    })
  }

  if (!env.googleClientId || !env.googleClientSecret) {
    clearGoogleStateCookie()
    return res.redirect(
      buildGoogleRedirectTarget(req, fallbackLang, 'error', 'Google giris servisi aktif degil.'),
    )
  }

  const stateValue = String(req.query.state || '').trim()
  const authorizationCode = String(req.query.code || '').trim()
  const oauthError = String(req.query.error || '').trim()

  if (oauthError) {
    clearGoogleStateCookie()
    return res.redirect(
      buildGoogleRedirectTarget(req, fallbackLang, 'error', 'Google girisi iptal edildi.'),
    )
  }

  if (!stateValue || !authorizationCode) {
    clearGoogleStateCookie()
    return res.redirect(
      buildGoogleRedirectTarget(req, fallbackLang, 'error', 'Google kimlik dogrulama gecersiz.'),
    )
  }

  let parsedState = null

  try {
    parsedState = JSON.parse(Buffer.from(stateValue, 'base64url').toString('utf8'))
  } catch (error) {
    clearGoogleStateCookie()
    return res.redirect(
      buildGoogleRedirectTarget(req, fallbackLang, 'error', 'Google state verisi gecersiz.'),
    )
  }

  const language = normalizeLanguage(parsedState?.lang || fallbackLang)
  const stateNonce = String(parsedState?.nonce || '')
  const cookieNonce = String(req.cookies?.[googleStateCookieName] || '')
  const stateAgeMs = Math.abs(Date.now() - Number(parsedState?.ts || 0))

  if (!stateNonce || !cookieNonce || stateNonce !== cookieNonce || stateAgeMs > 10 * 60 * 1000) {
    clearGoogleStateCookie()
    return res.redirect(
      buildGoogleRedirectTarget(req, language, 'error', 'Google state dogrulamasi basarisiz.'),
    )
  }

  const origin = resolveRequestOrigin(req)
  const redirectUri = env.googleRedirectUri || `${origin}/api/v1/auth/google/callback`

  let tokenPayload = null
  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: authorizationCode,
        client_id: env.googleClientId,
        client_secret: env.googleClientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    })

    if (!tokenResponse.ok) {
      const bodyText = await tokenResponse.text().catch(() => '')
      throw new Error(`Google token endpoint failed (${tokenResponse.status}) ${bodyText}`)
    }

    tokenPayload = await tokenResponse.json()
  } catch (error) {
    clearGoogleStateCookie()
    return res.redirect(
      buildGoogleRedirectTarget(req, language, 'error', 'Google token alinamadi.'),
    )
  }

  if (!tokenPayload?.id_token) {
    clearGoogleStateCookie()
    return res.redirect(
      buildGoogleRedirectTarget(req, language, 'error', 'Google kimlik verisi eksik.'),
    )
  }

  let googleProfile = null
  try {
    const infoResponse = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(tokenPayload.id_token)}`,
    )
    const infoPayload = await infoResponse.json()

    if (!infoResponse.ok) {
      throw new Error(`Google tokeninfo failed (${infoResponse.status})`)
    }

    googleProfile = infoPayload
  } catch (error) {
    clearGoogleStateCookie()
    return res.redirect(
      buildGoogleRedirectTarget(req, language, 'error', 'Google profil verisi dogrulanamadi.'),
    )
  }

  if (!googleProfile?.email || googleProfile?.email_verified !== 'true') {
    clearGoogleStateCookie()
    return res.redirect(
      buildGoogleRedirectTarget(req, language, 'error', 'Google e-posta dogrulanmamis.'),
    )
  }

  if (googleProfile.aud !== env.googleClientId) {
    clearGoogleStateCookie()
    return res.redirect(
      buildGoogleRedirectTarget(req, language, 'error', 'Google istemci dogrulamasi basarisiz.'),
    )
  }

  const normalizedEmail = String(googleProfile.email).trim().toLowerCase()
  const googleSub = String(googleProfile.sub || '').trim()
  const defaultFirstName = String(googleProfile.given_name || '').trim() || 'Google'
  const defaultLastName = String(googleProfile.family_name || '').trim() || 'User'

  let user = await User.findOne({
    $or: [{ googleSub }, { email: normalizedEmail }],
  }).select('+passwordHash')

  const now = new Date()
  let isNewUser = false
  const consentText = resolveConsentText(language)

  if (!user) {
    const resolvedUsername = await buildUniqueUsername(normalizedEmail.split('@')[0])
    const randomPasswordHash = await bcrypt.hash(crypto.randomUUID(), 12)
    const fallbackBirthDate = new Date()
    fallbackBirthDate.setFullYear(fallbackBirthDate.getFullYear() - 18)

    user = await User.create({
      firstName: defaultFirstName,
      lastName: defaultLastName,
      email: normalizedEmail,
      username: resolvedUsername,
      passwordHash: randomPasswordHash,
      birthDate: fallbackBirthDate,
      location: { country: 'Unknown', city: '' },
      authProvider: 'google',
      googleSub,
      emailVerifiedAt: now,
      signupConsent: {
        acceptedAt: now,
        version: signupConsentVersion,
        text: consentText,
        language,
        method: 'google',
        ipAddress: resolveRequestGeoSummary(req).ipAddress,
        city: resolveRequestGeoSummary(req).city,
        country: resolveRequestGeoSummary(req).country,
        browserLanguage: String(req.headers['accept-language'] || '').trim().slice(0, 80),
        userAgent: String(req.headers['user-agent'] || ''),
      },
    })
    isNewUser = true
  } else {
    if (!user.googleSub) {
      user.googleSub = googleSub
    }
    user.authProvider = 'google'
    if (!user.emailVerifiedAt) {
      user.emailVerifiedAt = now
    }
  }

  if (user.accountStatus === 'suspended') {
    clearGoogleStateCookie()
    return res.redirect(
      buildGoogleRedirectTarget(req, language, 'error', 'Bu hesap askiya alinmis.'),
    )
  }

  user.lastLoginAt = now
  await user.save()

  const tokens = createTokenPair(user)
  await persistRefreshToken(user, tokens.refreshTokenId, tokens.refreshToken, req)
  setAuthCookies(res, tokens, { rememberMe: true })
  clearGoogleStateCookie()

  if (isNewUser) {
    await createAuditLog({
      actorId: user._id,
      action: 'auth.signup_terms_accepted',
      targetKind: 'user',
      targetId: user._id,
      summary: 'Google ile yeni uyelikte sozlesme onayi kaydedildi.',
      metadata: {
        userEmail: user.email,
        signupMethod: 'google',
        ipAddress: resolveRequestGeoSummary(req).ipAddress,
        userAgent: String(req.headers['user-agent'] || ''),
        acceptedVersion: signupConsentVersion,
        acceptedText: consentText,
        acceptedAt: now.toISOString(),
        language,
      },
    })

    void sendSignupNotificationEmail({
      user,
      req,
      method: 'google',
      language,
      consentVersion: signupConsentVersion,
      consentText,
    })
  }

  return res.redirect(buildGoogleRedirectTarget(req, language, 'success'))
})

async function persistRefreshToken(user, refreshTokenId, refreshToken, req) {
  await RefreshToken.create({
    user: user._id,
    tokenId: refreshTokenId,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + env.jwt.refreshExpiresMs),
    userAgent: req.headers['user-agent'] || '',
    ipAddress: req.ip || '',
  })
}

function sendAuthResponse(res, user, tokens, statusCode = 200, options = {}) {
  setAuthCookies(res, tokens, options)

  res.status(statusCode).json({
    message: 'Authentication successful.',
    accessToken: tokens.accessToken,
    expiresInMs: env.jwt.accessExpiresMs,
    user: serializeUser(user),
  })
}

const register = asyncHandler(async (req, res) => {
  const {
    firstName,
    lastName,
    email,
    password,
    birthDate,
    username,
    location,
    locale,
    signupConsentVersion: incomingConsentVersion,
    signupConsentText: incomingConsentText,
  } =
    req.validated.body

  const normalizedEmail = email.toLowerCase()
  const emailExists = await User.exists({ email: normalizedEmail })

  if (emailExists) {
    throw new AppError('An account with this email already exists.', 409)
  }

  if (!shouldBypassEmailVerification()) {
    const verifiedToken = await EmailVerificationToken.findOne({
      email: normalizedEmail,
      consumedAt: { $ne: null },
    }).sort({ consumedAt: -1 })

    if (!verifiedToken || Date.now() - verifiedToken.consumedAt.getTime() > 30 * 60_000) {
      throw new AppError('E-posta dogrulamasi gerekli.', 403)
    }
  }

  const resolvedUsername = username
    ? await buildUniqueUsername(username)
    : await buildUniqueUsername(normalizedEmail.split('@')[0])

  const passwordHash = await bcrypt.hash(password, 12)
  const acceptedAt = new Date()
  const resolvedLanguage = normalizeLanguage(locale || req.headers['accept-language'] || 'tr')
  const acceptedVersion = String(incomingConsentVersion || signupConsentVersion).trim().slice(0, 60)
  const acceptedText = resolveConsentText(resolvedLanguage, incomingConsentText)
  const geoSummary = resolveRequestGeoSummary(req)
  const userAgent = String(req.headers['user-agent'] || '')

  const user = await User.create({
    firstName,
    lastName,
    email: normalizedEmail,
    username: resolvedUsername,
    passwordHash,
    birthDate,
    location,
    authProvider: 'password',
    emailVerifiedAt: new Date(),
    signupConsent: {
      acceptedAt,
      version: acceptedVersion,
      text: acceptedText,
      language: resolvedLanguage,
      method: 'normal',
      ipAddress: geoSummary.ipAddress,
      city: geoSummary.city,
      country: geoSummary.country,
      browserLanguage: String(req.headers['accept-language'] || '').trim().slice(0, 80),
      userAgent,
    },
  })

  const tokens = createTokenPair(user)
  await persistRefreshToken(user, tokens.refreshTokenId, tokens.refreshToken, req)

  await createAuditLog({
    actorId: user._id,
    action: 'auth.signup_terms_accepted',
    targetKind: 'user',
    targetId: user._id,
    summary: 'Yeni uyelikte sozlesme onayi kaydedildi.',
    metadata: {
      userEmail: user.email,
      signupMethod: 'normal',
      ipAddress: geoSummary.ipAddress,
      userAgent,
      acceptedVersion,
      acceptedText,
      acceptedAt: acceptedAt.toISOString(),
      language: resolvedLanguage,
    },
  })

  void sendSignupNotificationEmail({
    user,
    req,
    method: 'normal',
    language: resolvedLanguage,
    consentVersion: acceptedVersion,
    consentText: acceptedText,
  })

  sendAuthResponse(res, user, tokens, 201)
})

const login = asyncHandler(async (req, res) => {
  const { emailOrUsername, password, rememberMe } = req.validated.body
  const normalizedValue = emailOrUsername.toLowerCase()

  const user = await User.findOne({
    $or: [{ email: normalizedValue }, { username: normalizedValue }],
  }).select('+passwordHash')

  if (!user) {
    throw new AppError('Invalid credentials.', 401)
  }

  if (user.accountStatus === 'suspended') {
    throw new AppError('Your account is suspended.', 403)
  }

  const passwordMatches = await user.comparePassword(password)

  if (!passwordMatches) {
    throw new AppError('Invalid credentials.', 401)
  }

  user.lastLoginAt = new Date()
  await user.save()

  const tokens = createTokenPair(user)
  await persistRefreshToken(user, tokens.refreshTokenId, tokens.refreshToken, req)

  sendAuthResponse(res, user, tokens, 200, { rememberMe })
})

const checkLoginIdentifier = asyncHandler(async (req, res) => {
  const normalizedValue = req.validated.body.emailOrUsername.toLowerCase()
  const user = await User.findOne({
    $or: [{ email: normalizedValue }, { username: normalizedValue }],
  }).select('username email accountStatus')

  if (!user) {
    throw new AppError('Bu e-posta veya kullanici adi ile kayit bulunamadi.', 404)
  }

  if (user.accountStatus === 'suspended') {
    throw new AppError('Bu hesap su anda askiya alinmis durumda.', 403)
  }

  res.json({
    exists: true,
    username: user.username,
    message: 'Hesap bulundu. Sifre adimina gecebilirsin.',
  })
})

const requestPasswordReset = asyncHandler(async (req, res) => {
  const normalizedEmail = req.validated.body.email.toLowerCase()
  const language = req.validated.body.language || 'tr'

  if (env.emailProvider === 'disabled' && !env.isDevelopment) {
    throw new AppError('Sifre sifirlama e-posta servisi gecici olarak kullanilamiyor.', 503)
  }

  const user = await User.findOne({ email: normalizedEmail }).select(
    'email username accountStatus +passwordHash',
  )

  if (!user || user.accountStatus === 'suspended') {
    res.json({
      message: passwordResetRequestMessage,
    })
    return
  }

  const { resetToken } = createPasswordResetToken(user)

  if (env.emailProvider !== 'disabled') {
    try {
      await sendPasswordResetEmail({
        to: user.email,
        resetToken,
        language,
      })
    } catch (error) {
      console.error('Failed to send password reset email:', error?.message || error)
    }
  }

  res.json({
    message: passwordResetRequestMessage,
    ...(env.isDevelopment ? { resetToken } : {}),
  })
})

const confirmPasswordReset = asyncHandler(async (req, res) => {
  let payload

  try {
    payload = verifyPasswordResetToken(req.validated.body.token)
  } catch (error) {
    throw new AppError('Sifre sifirlama baglantisi gecersiz veya suresi dolmus.', 400)
  }

  const user = await User.findById(payload.sub).select('+passwordHash')

  if (!user) {
    throw new AppError('Kullanici bulunamadi.', 404)
  }

  if (user.accountStatus === 'suspended') {
    throw new AppError('Bu hesap su anda askiya alinmis durumda.', 403)
  }

  const currentPasswordVersion = hashToken(user.passwordHash).slice(0, 16)

  if (payload.passwordVersion !== currentPasswordVersion) {
    throw new AppError('Bu sifre sifirlama baglantisi artik kullanilamaz.', 400)
  }

  const nextPasswordMatchesCurrent = await bcrypt.compare(
    req.validated.body.newPassword,
    user.passwordHash,
  )

  if (nextPasswordMatchesCurrent) {
    throw new AppError('Yeni sifre mevcut sifreden farkli olmali.', 400)
  }

  user.passwordHash = await bcrypt.hash(req.validated.body.newPassword, 12)
  await user.save()
  await RefreshToken.updateMany(
    { user: user._id, revokedAt: null },
    { revokedAt: new Date(), lastUsedAt: new Date() },
  )

  res.json({
    message: 'Sifren basariyla sifirlandi. Simdi yeni sifrenle giris yapabilirsin.',
  })
})

const checkEmailAvailability = asyncHandler(async (req, res) => {
  const normalizedEmail = req.validated.body.email.toLowerCase()
  const exists = await User.exists({ email: normalizedEmail })

  res.json({
    email: normalizedEmail,
    available: !exists,
    message: exists
      ? 'Bu e-posta adresi zaten kullanimda.'
      : 'E-posta adresi kullanilabilir.',
  })
})

const getSignupContracts = asyncHandler(async (req, res) => {
  const language = normalizeLanguage(req.query.lang || req.headers['accept-language'] || 'tr')
  const payload = await getSignupContractsForLanguage(language)

  res.json(payload)
})

const refreshSession = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.[refreshTokenCookieName]

  if (!refreshToken) {
    throw new AppError('Refresh token is missing.', 401)
  }

  const payload = verifyRefreshToken(refreshToken)
  const session = await RefreshToken.findOne({
    tokenId: payload.tokenId,
    user: payload.sub,
    revokedAt: null,
  })

  if (!session || session.tokenHash !== hashToken(refreshToken)) {
    throw new AppError('Refresh session is invalid.', 401)
  }

  const user = await User.findById(payload.sub)

  if (!user) {
    throw new AppError('User not found.', 401)
  }

  if (user.accountStatus === 'suspended') {
    throw new AppError('Your account is suspended.', 403)
  }

  session.revokedAt = new Date()
  session.lastUsedAt = new Date()
  await session.save()

  const tokens = createTokenPair(user)
  await persistRefreshToken(user, tokens.refreshTokenId, tokens.refreshToken, req)

  sendAuthResponse(res, user, tokens)
})

const logout = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.[refreshTokenCookieName]

  if (refreshToken) {
    try {
      const payload = verifyRefreshToken(refreshToken)
      await RefreshToken.updateOne(
        { tokenId: payload.tokenId, revokedAt: null },
        { revokedAt: new Date(), lastUsedAt: new Date() },
      )
    } catch (error) {
      // Ignore token parsing errors on logout to keep the endpoint idempotent.
    }
  }

  clearAuthCookies(res)

  res.json({
    message: 'Logged out successfully.',
  })
})

const getCurrentUser = asyncHandler(async (req, res) => {
  res.json({
    user: serializeUser(req.user),
  })
})

module.exports = {
  register,
  requestSignUpCode,
  verifySignUpCode,
  startGoogleAuth,
  googleCallback,
  login,
  checkLoginIdentifier,
  checkEmailAvailability,
  getSignupContracts,
  requestPasswordReset,
  confirmPasswordReset,
  refreshSession,
  logout,
  getCurrentUser,
}
