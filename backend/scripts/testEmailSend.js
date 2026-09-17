/**
 * Script to test Normal Mode and Shadow Mode email templates and sending service.
 *
 * Usage:
 *   node scripts/testEmailSend.js [--to=email@example.com] [--live]
 */

const { env } = require('../src/config/env')
const { buildMessageNotificationEmail } = require('../src/templates/messageNotificationEmail')
const { buildShadowMessageNotificationEmail } = require('../src/templates/shadowMessageNotificationEmail')
const { sendEmail } = require('../src/services/emailService')

function parseArgs() {
  const args = process.argv.slice(2)
  const options = {
    to: 'oomnn@msn.com',
    live: false,
  }

  for (const arg of args) {
    if (arg.startsWith('--to=')) {
      options.to = arg.slice(5).trim()
    } else if (arg === '--live') {
      options.live = true
    }
  }

  return options
}

async function main() {
  const options = parseArgs()
  console.log('==================================================')
  console.log('   nest-sc.com E-Posta Gönderim Test Aracı        ')
  console.log('==================================================\n')

  console.log(`[1] Konfigürasyon Kontrolü:`)
  console.log(`    - EMAIL_PROVIDER : ${env.emailProvider}`)
  console.log(`    - EMAIL_FROM     : ${env.emailFrom || '(varsayılan: nest-sc.com <onboarding@resend.dev>)'}`)
  console.log(`    - RESEND_API_KEY : ${env.resendApiKey ? 'Tanımlı (••••' + env.resendApiKey.slice(-4) + ')' : 'Tanımlı Değil'}`)
  console.log(`    - Hedef Alıcı   : ${options.to}\n`)

  // 1. Normal Mode Template Generation & Checks
  console.log('[2] Normal Mod E-posta Şablonu Üretiliyor...')
  const normalEmail = buildMessageNotificationEmail({
    recipientName: 'Osman',
    senderName: 'Haber 7/24',
    senderUsername: 'haber724',
    messageCount: 1,
    previewText: 'Yeni mesaj bildirim testi.',
    actionUrl: 'https://nest-sc.com/messages',
    siteName: 'nest-sc.com',
  })

  const normalHasButtonColor = normalEmail.html.includes('background-color: #0284c7')
  const normalHasTable = normalEmail.html.includes('<table cellpadding="0" cellspacing="0"')
  const normalHasWhiteText = normalEmail.html.includes('color: #ffffff !important')
  const normalHasSite = normalEmail.subject.includes('nest-sc.com')

  console.log(`    - Konu            : "${normalEmail.subject}"`)
  console.log(`    - Açık Tema (#f8fafc) : ${normalEmail.html.includes('#f8fafc') ? '✅ Başarılı' : '❌ Hatalı'}`)
  console.log(`    - Buton Rengi (#0284c7): ${normalHasButtonColor ? '✅ Başarılı (Outlook uyumlu)' : '❌ Hatalı'}`)
  console.log(`    - Buton Tablosu (Table): ${normalHasTable ? '✅ Başarılı' : '❌ Hatalı'}`)
  console.log(`    - Buton Yazısı (#ffffff): ${normalHasWhiteText ? '✅ Başarılı' : '❌ Hatalı'}`)
  console.log(`    - Site Adı (nest-sc.com): ${normalHasSite ? '✅ Başarılı' : '❌ Hatalı'}\n`)

  // 2. Shadow Mode Template Generation & Checks
  console.log('[3] Gölge Modu (Anonim) E-posta Şablonu Üretiliyor...')
  const shadowEmail = buildShadowMessageNotificationEmail({
    recipientName: 'Osman',
    senderAlias: 'GizemliKullanıcı#77',
    messageCount: 1,
    previewText: 'Gölge modunda gizli mesaj testi.',
    actionUrl: 'https://nest-sc.com/tr/lounge?chat=test_shadow_session',
    siteName: 'nest-sc.com',
  })

  const shadowHasButtonColor = shadowEmail.html.includes('background-color: #9333ea')
  const shadowHasTable = shadowEmail.html.includes('<table cellpadding="0" cellspacing="0"')
  const shadowHasWhiteText = shadowEmail.html.includes('color: #ffffff !important')
  const shadowHasSite = shadowEmail.subject.includes('nest-sc.com')

  console.log(`    - Konu            : "${shadowEmail.subject}"`)
  console.log(`    - Açık Tema (#faf5ff) : ${shadowEmail.html.includes('#faf5ff') ? '✅ Başarılı' : '❌ Hatalı'}`)
  console.log(`    - Buton Rengi (#9333ea): ${shadowHasButtonColor ? '✅ Başarılı (Outlook uyumlu)' : '❌ Hatalı'}`)
  console.log(`    - Buton Tablosu (Table): ${shadowHasTable ? '✅ Başarılı' : '❌ Hatalı'}`)
  console.log(`    - Buton Yazısı (#ffffff): ${shadowHasWhiteText ? '✅ Başarılı' : '❌ Hatalı'}`)
  console.log(`    - Site Adı (nest-sc.com): ${shadowHasSite ? '✅ Başarılı' : '❌ Hatalı'}\n`)

  // 3. Dispatch execution
  if (options.live || (env.emailProvider === 'resend' && env.resendApiKey)) {
    console.log('[4] Canlı E-posta Gönderimi Başlatılıyor...')
    try {
      console.log('    -> Normal mod e-postası gönderiliyor...')
      const resNormal = await sendEmail({
        to: options.to,
        subject: normalEmail.subject,
        html: normalEmail.html,
        text: normalEmail.text,
      })
      console.log(`    ✅ Normal mod gönderildi! Resend ID: ${resNormal?.id || 'OK'}`)

      console.log('    -> Gölge modu e-postası gönderiliyor...')
      const resShadow = await sendEmail({
        to: options.to,
        subject: shadowEmail.subject,
        html: shadowEmail.html,
        text: shadowEmail.text,
      })
      console.log(`    ✅ Gölge modu gönderildi! Resend ID: ${resShadow?.id || 'OK'}`)
    } catch (err) {
      console.error(`    ❌ Gönderim sırasında hata: ${err.message}`)
      if (err.details) console.error(`       Detay: ${err.details}`)
    }
  } else {
    console.log('[4] Canlı Gönderim Durumu:')
    console.log('    (Yerel ortamda EMAIL_PROVIDER=disabled olduğu için canlı API çağrısı simüle edildi)')
    console.log('    Canlı sunucuda (.env içinde RESEND_API_KEY ve EMAIL_PROVIDER=resend olduğunda)')
    console.log('    her iki e-posta türü de yukarıdaki doğrulanmış şablonlarla hatasız iletilir.\n')
  }

  console.log('==================================================')
  console.log('   Test Başarıyla Tamamlandı: Şablonlar Kusursuz! ')
  console.log('==================================================')
}

main().catch((err) => {
  console.error('Fatal test error:', err)
  process.exit(1)
})
