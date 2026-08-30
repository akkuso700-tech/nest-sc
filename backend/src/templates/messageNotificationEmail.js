function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function buildMessageNotificationEmail({
  recipientName,
  senderName,
  senderUsername,
  senderAvatarUrl,
  messageCount = 1,
  previewText = '',
  actionUrl,
  siteName = 'My Social',
}) {
  const safeRecipientName = escapeHtml(recipientName || 'Kullanıcı')
  const safeSenderName = escapeHtml(senderName || senderUsername || 'Bir kullanıcı')
  const safeSenderUsername = escapeHtml(senderUsername || '')
  const safePreviewText = escapeHtml(previewText || 'Yeni bir mesaj aldınız.')
  const safeActionUrl = escapeHtml(actionUrl)
  const safeSiteName = escapeHtml(siteName)

  const messageCountText =
    messageCount > 1
      ? `${messageCount} yeni mesaj gönderdi`
      : 'sana yeni bir mesaj gönderdi'

  const subject =
    messageCount > 1
      ? `${safeSenderName} sana ${messageCount} yeni mesaj gönderdi - ${safeSiteName}`
      : `${safeSenderName} sana yeni bir mesaj gönderdi - ${safeSiteName}`

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
      background-color: #0f172a;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #e2e8f0;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #0f172a;
      padding: 32px 16px;
      box-sizing: border-box;
    }
    .container {
      max-width: 520px;
      margin: 0 auto;
      background: #1e293b;
      border-radius: 16px;
      border: 1px solid #334155;
      overflow: hidden;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
    }
    .header {
      padding: 24px 32px;
      background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
      border-bottom: 1px solid #334155;
      display: flex;
      align-items: center;
    }
    .brand {
      font-size: 20px;
      font-weight: 700;
      color: #38bdf8;
      text-decoration: none;
      letter-spacing: -0.5px;
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
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 20px;
      margin: 20px 0;
    }
    .sender-avatar {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      object-fit: cover;
      border: 2px solid #38bdf8;
      background: #334155;
    }
    .sender-avatar-placeholder {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: #38bdf8;
      color: #0f172a;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      font-weight: bold;
      text-transform: uppercase;
      line-height: 48px;
      text-align: center;
    }
    .sender-title {
      font-size: 17px;
      font-weight: 600;
      color: #f8fafc;
      margin: 0;
    }
    .sender-handle {
      font-size: 14px;
      color: #64748b;
      margin: 2px 0 0 0;
    }
    .message-bubble {
      background: #1e293b;
      border-radius: 10px;
      padding: 14px 16px;
      font-size: 15px;
      line-height: 1.5;
      color: #cbd5e1;
      border-left: 3px solid #38bdf8;
      word-break: break-word;
    }
    .badge {
      display: inline-block;
      background: #0284c7;
      color: #ffffff;
      font-size: 12px;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: 9999px;
      margin-bottom: 12px;
    }
    .btn-container {
      text-align: center;
      margin: 28px 0 12px 0;
    }
    .btn {
      display: inline-block;
      background: linear-gradient(135deg, #0284c7 0%, #2563eb 100%);
      color: #ffffff !important;
      font-size: 15px;
      font-weight: 600;
      text-decoration: none;
      padding: 14px 32px;
      border-radius: 10px;
      box-shadow: 0 4px 14px 0 rgba(2, 132, 199, 0.39);
    }
    .footer {
      padding: 20px 32px;
      background: #0f172a;
      border-top: 1px solid #1e293b;
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
        <span class="brand">${safeSiteName}</span>
      </div>
      <div class="body-content">
        <div class="greeting">Merhaba <strong>${safeRecipientName}</strong>,</div>
        
        <div>
          <span class="badge">${messageCount > 1 ? `${messageCount} Yeni Mesaj` : 'Yeni Mesaj'}</span>
        </div>

        <div class="card">
          <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 12px; width: 100%;">
            <tr>
              <td style="width: 52px; vertical-align: middle;">
                ${
                  senderAvatarUrl
                    ? `<img src="${escapeHtml(senderAvatarUrl)}" alt="${safeSenderName}" class="sender-avatar" />`
                    : `<div class="sender-avatar-placeholder">${safeSenderName.charAt(0)}</div>`
                }
              </td>
              <td style="vertical-align: middle; padding-left: 12px;">
                <h3 class="sender-title">${safeSenderName}</h3>
                ${safeSenderUsername ? `<p class="sender-handle">@${safeSenderUsername}</p>` : ''}
              </td>
            </tr>
          </table>

          <div class="message-bubble">
            ${safePreviewText}
          </div>
        </div>

        <p style="font-size: 14px; color: #94a3b8; text-align: center; margin: 0 0 16px 0;">
          ${safeSenderName} ${messageCountText}. Yanıtlamak için siteye giriş yapabilirsin.
        </p>

        <div class="btn-container">
          <a href="${safeActionUrl}" class="btn" target="_blank" rel="noopener noreferrer">Mesajı Oku ve Yanıtla</a>
        </div>
      </div>

      <div class="footer">
        Bu e-posta, çevrimdışıyken gelen mesaj bildirimleriniz açık olduğu için gönderildi.<br>
        Bildirim tercihlerinizi dilediğiniz zaman profil ayarlarınızdan değiştirebilirsiniz.
      </div>
    </div>
  </div>
</body>
</html>`

  const text = `Merhaba ${recipientName || ''},\n\n${senderName || 'Bir kullanıcı'} sana yeni mesaj gönderdi:\n\n"${previewText}"\n\nMesajı görüntülemek ve yanıtlamak için aşağıdaki bağlantıya tıklayabilirsin:\n${actionUrl}\n\n${siteName}`

  return { subject, html, text }
}

module.exports = {
  buildMessageNotificationEmail,
}
