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
  siteName = 'My Social',
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
      background-color: #090d16;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #e2e8f0;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #090d16;
      padding: 32px 16px;
      box-sizing: border-box;
    }
    .container {
      max-width: 520px;
      margin: 0 auto;
      background: #111827;
      border-radius: 16px;
      border: 1px solid #1f293d;
      overflow: hidden;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.6);
    }
    .header {
      padding: 24px 32px;
      background: linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%);
      border-bottom: 1px solid #312e81;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .brand {
      font-size: 19px;
      font-weight: 700;
      color: #a855f7;
      text-decoration: none;
      letter-spacing: -0.5px;
    }
    .lounge-badge {
      display: inline-block;
      background: rgba(168, 85, 247, 0.2);
      color: #c084fc;
      border: 1px solid rgba(168, 85, 247, 0.4);
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
      color: #94a3b8;
      margin-bottom: 20px;
    }
    .card {
      background: #0b0f19;
      border: 1px solid #1e293b;
      border-radius: 12px;
      padding: 20px;
      margin: 20px 0;
    }
    .sender-title {
      font-size: 17px;
      font-weight: 600;
      color: #f8fafc;
      margin: 0;
    }
    .sender-handle {
      font-size: 13px;
      color: #a855f7;
      margin: 2px 0 0 0;
    }
    .message-bubble {
      background: #171f31;
      border-radius: 10px;
      padding: 14px 16px;
      font-size: 15px;
      line-height: 1.5;
      color: #cbd5e1;
      border-left: 3px solid #a855f7;
      word-break: break-word;
    }
    .btn-container {
      text-align: center;
      margin: 28px 0 12px 0;
    }
    .btn {
      display: inline-block;
      background: linear-gradient(135deg, #9333ea 0%, #6366f1 100%);
      color: #ffffff !important;
      font-size: 15px;
      font-weight: 600;
      text-decoration: none;
      padding: 14px 32px;
      border-radius: 10px;
      box-shadow: 0 4px 14px 0 rgba(147, 51, 234, 0.39);
    }
    .footer {
      padding: 20px 32px;
      background: #090d16;
      border-top: 1px solid #1f293d;
      font-size: 12px;
      color: #64748b;
      text-align: center;
      line-height: 1.6;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <span class="brand">🎭 Gölge Modu</span>
        <span class="lounge-badge">Anonim İletişim</span>
      </div>
      <div class="body-content">
        <div class="greeting">Merhaba <strong>${safeRecipientName}</strong>,</div>
        
        <p style="margin: 0 0 16px 0; font-size: 14px; color: #94a3b8; line-height: 1.5;">
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
