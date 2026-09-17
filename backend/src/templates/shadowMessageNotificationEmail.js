function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function buildShadowMessageNotificationEmail({
  recipientName,
  senderAlias,
  messageCount = 1,
  previewText = '',
  actionUrl,
  siteName = 'nest-sc.com',
}) {
  const safeRecipientName = escapeHtml(recipientName || 'Kullanıcı')
  const safeSenderAlias = escapeHtml(senderAlias || 'Anonim Kullanıcı')
  const safePreviewText = escapeHtml(previewText || 'Gölge modunda yeni bir mesajınız var.')
  const safeActionUrl = escapeHtml(actionUrl)
  const safeSiteName = escapeHtml(siteName)

  const subject =
    messageCount > 1
      ? `Gölge Modu: ${safeSenderAlias} sana ${messageCount} yeni mesaj gönderdi - ${safeSiteName}`
      : `Gölge Modu: ${safeSenderAlias} sana yeni bir mesaj gönderdi - ${safeSiteName}`

  const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #faf5ff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1e1b4b;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #faf5ff;
      padding: 36px 16px;
      box-sizing: border-box;
    }
    .container {
      max-width: 520px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 16px;
      border: 1px solid #e9d5ff;
      overflow: hidden;
      box-shadow: 0 4px 20px -2px rgba(147, 51, 234, 0.08);
    }
    .header {
      padding: 22px 32px;
      background: #ffffff;
      border-bottom: 1px solid #f3e8ff;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .brand {
      font-size: 19px;
      font-weight: 700;
      color: #7e22ce;
      text-decoration: none;
      letter-spacing: -0.5px;
    }
    .lounge-badge {
      display: inline-block;
      background: #f3e8ff;
      color: #7e22ce;
      border: 1px solid #d8b4fe;
      font-size: 11px;
      font-weight: 700;
      padding: 3px 10px;
      border-radius: 9999px;
    }
    .body-content {
      padding: 32px;
    }
    .greeting {
      font-size: 16px;
      color: #4b5563;
      margin-bottom: 16px;
    }
    .card {
      background: #faf5ff;
      border: 1px solid #e9d5ff;
      border-radius: 12px;
      padding: 20px;
      margin: 18px 0;
    }
    .sender-title {
      font-size: 16px;
      font-weight: 600;
      color: #1e1b4b;
      margin: 0;
    }
    .sender-handle {
      font-size: 13px;
      color: #7e22ce;
      margin: 2px 0 0 0;
    }
    .message-bubble {
      background: #ffffff;
      border: 1px solid #e9d5ff;
      border-radius: 10px;
      padding: 14px 16px;
      font-size: 14px;
      line-height: 1.5;
      color: #1e1b4b;
      border-left: 4px solid #9333ea;
      word-break: break-word;
    }
    .btn-container {
      text-align: center;
      margin: 28px 0 12px 0;
    }
    .btn {
      display: inline-block;
      background: linear-gradient(135deg, #9333ea 0%, #7c3aed 100%);
      color: #ffffff !important;
      font-size: 15px;
      font-weight: 600;
      text-decoration: none;
      padding: 14px 32px;
      border-radius: 10px;
      box-shadow: 0 4px 14px 0 rgba(147, 51, 234, 0.28);
    }
    .footer {
      padding: 20px 32px;
      background: #faf5ff;
      border-top: 1px solid #e9d5ff;
      font-size: 12px;
      color: #6b7280;
      text-align: center;
      line-height: 1.6;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <span class="brand">🎭 Gölge Modu - ${safeSiteName}</span>
        <span class="lounge-badge">Anonim İletişim</span>
      </div>
      <div class="body-content">
        <div class="greeting">Merhaba <strong>${safeRecipientName}</strong>,</div>
        
        <p style="margin: 0 0 16px 0; font-size: 14px; color: #4b5563; line-height: 1.5;">
          Gölge Modu'nda çevrimdışıyken yeni bir anonim mesaj aldınız:
        </p>

        <div class="card">
          <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 12px; width: 100%;">
            <tr>
              <td style="width: 44px; vertical-align: middle;">
                <div style="width: 42px; height: 42px; border-radius: 50%; background: #9333ea; color: #ffffff; text-align: center; line-height: 42px; font-size: 20px;">
                  🎭
                </div>
              </td>
              <td style="vertical-align: middle; padding-left: 12px;">
                <h3 class="sender-title">${safeSenderAlias}</h3>
                <p class="sender-handle">Gölge Modu Kullanıcısı</p>
              </td>
            </tr>
          </table>

          <div class="message-bubble">
            ${safePreviewText}
          </div>
        </div>

        <div class="btn-container">
          <a href="${safeActionUrl}" class="btn" target="_blank" rel="noopener noreferrer">
            Gölge Sohbetini Aç
          </a>
        </div>
      </div>
      <div class="footer">
        Bu e-posta, profilinizdeki <strong>Arama ve İletişim İzinleri</strong> tercihleriniz doğrultusunda gönderilmiştir.<br />
        Gölge bildirimlerini dilediğiniz zaman profil ayarlarınızdan kapatabilirsiniz.<br />
        &copy; ${new Date().getFullYear()} ${safeSiteName}. Tüm hakları saklıdır.
      </div>
    </div>
  </div>
</body>
</html>`

  const text = `Merhaba ${safeRecipientName},

Gölge Modu'nda ${safeSenderAlias} size yeni bir mesaj gönderdi:

"${safePreviewText}"

Sohbeti açmak için aşağıdaki bağlantıya tıklayın:
${actionUrl}

--
${siteName}`

  return {
    subject,
    html,
    text,
  }
}

module.exports = {
  buildShadowMessageNotificationEmail,
}
