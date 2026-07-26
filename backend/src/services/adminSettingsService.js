const { AdminSetting } = require('../models/AdminSetting')
const { env } = require('../config/env')

const signupNotificationEmailsKey = 'signup_notification_emails'
const signupContractsKey = 'signup_contracts'

const defaultSignupContracts = {
  tr: {
    terms: {
      title: 'Nest Social Kosullari',
      body: 'Hesap olusturarak platformu yasal sinirlar icinde kullanmayi, hesabinin guvenligini korumayi ve kotuye kullanimdan kacinmayi kabul edersin.',
    },
    cookies: {
      title: 'Cerez Politikasi',
      body: 'Oturum surekliligi, urun performansi ve deneyim iyilestirmeleri icin zorunlu ve analiz amacli cerezler kullanilir.',
    },
    privacy: {
      title: 'Gizlilik Ilkesi',
      body: 'Profil ve etkinlik verilerin hesap guvenligi, akis kisilestirme ve temel mesajlasma ozellikleri icin gizlilik taahhutlerimiz kapsaminda islenir.',
    },
  },
  en: {
    terms: {
      title: 'Nest Social Terms',
      body: 'By creating an account you agree to use the platform lawfully, keep your account secure, and avoid abusive, misleading, or unauthorized activity.',
    },
    cookies: {
      title: 'Cookie Policy',
      body: 'We use essential and analytics cookies to keep sessions active, improve product performance, and personalize your social experience.',
    },
    privacy: {
      title: 'Privacy Policy',
      body: 'Your profile and activity data are processed for account security, feed personalization, and core messaging features under our privacy commitments.',
    },
  },
  de: {
    terms: {
      title: 'Nest Social Nutzungsbedingungen',
      body: 'Mit der Kontoerstellung stimmst du einer rechtmassigen Nutzung der Plattform, dem Schutz deiner Zugangsdaten und einem respektvollen Verhalten zu.',
    },
    cookies: {
      title: 'Cookie-Richtlinie',
      body: 'Wir verwenden notwendige und Analyse-Cookies, um Sitzungen stabil zu halten, die Leistung zu verbessern und das Nutzungserlebnis zu optimieren.',
    },
    privacy: {
      title: 'Datenschutzerklarung',
      body: 'Deine Profil- und Aktivitatsdaten werden fur Kontosicherheit, Feed-Personalisierung und Kernfunktionen der Kommunikation verarbeitet.',
    },
  },
  es: {
    terms: {
      title: 'Terminos de Nest Social',
      body: 'Al crear una cuenta aceptas usar la plataforma de forma legal, mantener seguras tus credenciales y evitar actividades abusivas o enganosas.',
    },
    cookies: {
      title: 'Politica de Cookies',
      body: 'Usamos cookies esenciales y de analitica para mantener sesiones activas, mejorar el rendimiento y personalizar la experiencia.',
    },
    privacy: {
      title: 'Politica de Privacidad',
      body: 'Tus datos de perfil y actividad se procesan para seguridad de cuenta, personalizacion del feed y funciones principales de mensajeria.',
    },
  },
}

const defaultSignupConsentByLanguage = {
  tr: "Uye Ol'a tiklayarak, bir hesap olusturmayi ve Nest Social'in Kosullarini, Cerez Politikasini ve Gizlilik Ilkesini kabul etmis olursun.",
  en: "By selecting Sign Up, you agree to create an account and accept Nest Social's Terms, Cookie Policy, and Privacy Policy.",
  de: 'Mit Klick auf Registrieren erstellst du ein Konto und akzeptierst die Nest Social Nutzungsbedingungen, Cookie-Richtlinie und Datenschutzerklarung.',
  es: 'Al pulsar Registrarse, aceptas crear una cuenta y aceptar los Terminos, Politica de Cookies y Politica de Privacidad de Nest Social.',
}

function sanitizeEmailList(values = []) {
  const uniqueEmails = new Set()

  for (const value of values) {
    const normalizedValue = String(value || '').trim().toLowerCase()

    if (!normalizedValue || !normalizedValue.includes('@')) {
      continue
    }

    uniqueEmails.add(normalizedValue)
  }

  return [...uniqueEmails]
}

function normalizeLanguageCode(value) {
  const normalizedValue = String(value || '').trim().toLowerCase()

  if (!normalizedValue) {
    return 'tr'
  }

  return normalizedValue.slice(0, 5)
}

function sanitizeContractText(value, fallbackValue, maxLength) {
  const normalizedValue = String(value || '').trim()
  if (!normalizedValue) {
    return String(fallbackValue || '').trim()
  }

  return normalizedValue.slice(0, maxLength)
}

function sanitizeContractSection(section = {}, fallbackSection = {}) {
  return {
    title: sanitizeContractText(section.title, fallbackSection.title, 180),
    body: sanitizeContractText(section.body, fallbackSection.body, 12000),
  }
}

function sanitizeSignupContracts(contracts = {}) {
  const nextContracts = {}
  const entries = Object.entries(contracts || {})

  for (const [language, value] of entries) {
    const normalizedLanguage = normalizeLanguageCode(language)
    const fallbackLanguageBlock = defaultSignupContracts[normalizedLanguage] || defaultSignupContracts.tr
    const languageBlock = value && typeof value === 'object' ? value : {}

    nextContracts[normalizedLanguage] = {
      terms: sanitizeContractSection(languageBlock.terms, fallbackLanguageBlock.terms),
      cookies: sanitizeContractSection(languageBlock.cookies, fallbackLanguageBlock.cookies),
      privacy: sanitizeContractSection(languageBlock.privacy, fallbackLanguageBlock.privacy),
    }
  }

  if (!Object.keys(nextContracts).length) {
    return { ...defaultSignupContracts }
  }

  return nextContracts
}

function getConsentTextByLanguage(language) {
  const normalizedLanguage = normalizeLanguageCode(language)

  if (defaultSignupConsentByLanguage[normalizedLanguage]) {
    return defaultSignupConsentByLanguage[normalizedLanguage]
  }

  if (normalizedLanguage.startsWith('tr')) {
    return defaultSignupConsentByLanguage.tr
  }

  return defaultSignupConsentByLanguage.en
}

function resolveContractsLanguage(contracts = {}, language = 'tr') {
  const normalizedLanguage = normalizeLanguageCode(language)

  if (contracts[normalizedLanguage]) {
    return normalizedLanguage
  }

  if (normalizedLanguage.startsWith('tr') && contracts.tr) {
    return 'tr'
  }

  if (contracts.en) {
    return 'en'
  }

  if (contracts.tr) {
    return 'tr'
  }

  const languages = Object.keys(contracts)
  return languages[0] || 'tr'
}

async function getSignupNotificationEmails() {
  const setting = await AdminSetting.findOne({ key: signupNotificationEmailsKey }).lean()
  const configuredEmails = sanitizeEmailList(setting?.value?.emails || [])
  const fallbackEmails = sanitizeEmailList(env.adminSignupNotificationEmails || [])

  if (configuredEmails.length) {
    return configuredEmails
  }

  return fallbackEmails
}

async function updateSignupNotificationEmails(emails, updatedByUserId = null) {
  const sanitizedEmails = sanitizeEmailList(emails)

  const setting = await AdminSetting.findOneAndUpdate(
    { key: signupNotificationEmailsKey },
    {
      key: signupNotificationEmailsKey,
      value: { emails: sanitizedEmails },
      updatedBy: updatedByUserId || null,
    },
    { upsert: true, returnDocument: 'after', runValidators: true },
  ).lean()

  return sanitizeEmailList(setting?.value?.emails || [])
}

async function getSignupContractsSettings() {
  const setting = await AdminSetting.findOne({ key: signupContractsKey }).lean()
  const configuredContracts = sanitizeSignupContracts(setting?.value?.contracts || {})

  return {
    contracts: configuredContracts,
    languages: Object.keys(configuredContracts),
  }
}

async function updateSignupContractsSettings(contracts, updatedByUserId = null) {
  const sanitizedContracts = sanitizeSignupContracts(contracts)

  const setting = await AdminSetting.findOneAndUpdate(
    { key: signupContractsKey },
    {
      key: signupContractsKey,
      value: { contracts: sanitizedContracts },
      updatedBy: updatedByUserId || null,
    },
    { upsert: true, returnDocument: 'after', runValidators: true },
  ).lean()

  const normalizedContracts = sanitizeSignupContracts(setting?.value?.contracts || {})

  return {
    contracts: normalizedContracts,
    languages: Object.keys(normalizedContracts),
  }
}

async function getSignupContractsForLanguage(language = 'tr') {
  const settings = await getSignupContractsSettings()
  const resolvedLanguage = resolveContractsLanguage(settings.contracts, language)
  const dialogs = settings.contracts[resolvedLanguage] || settings.contracts.tr

  return {
    language: resolvedLanguage,
    dialogs,
    consentText: getConsentTextByLanguage(resolvedLanguage),
    languages: settings.languages,
  }
}

module.exports = {
  getSignupNotificationEmails,
  updateSignupNotificationEmails,
  getSignupContractsSettings,
  updateSignupContractsSettings,
  getSignupContractsForLanguage,
  getConsentTextByLanguage,
}
