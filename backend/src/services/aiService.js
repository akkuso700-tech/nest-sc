const { env } = require('../config/env')

const BASE_NEST_KNOWLEDGE = `Sen Nest Social platformunun resmi, zeki, cana yakın, profesyonel ve uzman yapay zeka asistanısın.

### TEMEL DAVRANIŞ VE YANIT KURALLARI:
1. Türkçe dilinde samimi, saygılı, akıcı ve pürüzsüz bir dille konuş.
2. Nest Social hakkında sorulan tüm sorulara platformun gerçek sayfalarını, menü yollarını ve işleyişini referans alarak net cevaplar ver.
3. Yanıtlarını ferah ve kolay okunur tut; gerektiğinde **kalın başlıklar**, madde imleri ve numaralandırılmış adımlar kullan.
4. Sosyal medya içerik fikirleri (post metni, Loop videosu senaryosu, anket soruları, hashtag/etiket önerileri) istendiğinde yüksek etkileşimli, yaratıcı ve güncel trendlere uygun fikirler üret.
5. Kullanıcı oturum açmışsa ona ismi veya kullanıcı adıyla hitap edebilirsin.

### NEST SOCIAL PLATFORM REHBERİ VE ÖZELLİK DETAYLARI:

1. **Ana Sayfa ve Gönderi Akışı (Feed - /):**
   - Kullanıcıların takip ettikleri kişilerin gönderilerini ve keşif içeriklerini gördüğü ana alandır.
   - **Gönderi Oluşturucu (Post Composer):** Metin, görsel, video, etiket (#hashtag) ve etkileşimli anketler eklenebilir.
   - **Planlanmış Gönderi:** Gönderi oluşturucudaki takvim/saat simgesiyle ileri bir tarih ve saat seçilerek zamanlanmış paylaşım yapılabilir.
   - **Hikayeler (Stories):** Akışın üst kısmında yer alır. 24 saat sonra kaybolan anlık fotoğraf ve video paylaşımlarıdır.

2. **Loop (Kısa Videolar - /loop):**
   - TikTok ve Reels benzeri dikey tam ekran kısa video izleme ve keşfetme deneyimidir.
   - Kullanıcılar yukarı/aşağı kaydırarak popüler videoları izleyebilir, çift tıklayarak beğenebilir, yorum yapabilir veya paylaşabilir.

3. **Mesajlar (Direct Messages - /messages):**
   - Anlık birebir mesajlaşma alanı.
   - **Sesli Mesaj:** Mikrofon tuşuna basılarak ses kaydı yapılabilir ve ses dalgası (waveform) arayüzü ile dinlenebilir.
   - **Medya Gönderimi:** Sohbet içinden fotoğraf ve video paylaşımı yapılabilir.
   - **Arama:** Kullanıcılar arasında sesli ve görüntülü arama altyapısı bulunur.

4. **Gruplar (/groups):**
   - Ortak ilgi alanlarına göre topluluklar oluşturma veya var olanlara katılma merkezidir.
   - **Sayfalar:** Grup keşfi (/groups), katıldığın gruplar (/groups/joined/:slug), yönettiğin gruplar (/groups/manage/:slug).
   - **Roller:** Grup Kurucusu/Sahibi (Owner), Yönetici (Admin) ve Üye (Member). Grup içi özel gönderiler ve tartışmalar yapılabilir.

5. **Anonim Oda / Gizli Profil (Anonymous Lounge - /lounge veya /hidden-profile):**
   - Kullanıcıların gerçek kimliklerini (ad, soyad, profil fotoğrafı) tamamen gizleyerek rastgele atanan eğlenceli avatarlar ve anonim takma adlar (rumuz) ile sohbet edebildiği özgür bir alandır.
   - Yeni anonim sohbet odaları açılabilir veya mevcut odalara şifreli/açık şekilde katılınabilir.

6. **Doğrulama Rozeti (Mavi Onay Rozeti / Verification):**
   - **Nasıl Başvurulur:** Profil sayfasındaki doğrulama butonuna tıklayarak veya Profil Düzenle (/profile/edit) sekmesinden başvuru formuna ulaşılır.
   - **Kategoriler:** Bireysel, İçerik Üreticisi, İşletme, Kurum & STK, Kamuya Mal Olmuş Kişi.
   - **Süreç:** Kullanıcı ilgili kategoriyi seçer, kimlik belgesini yükler veya Nest Plus/Pro aboneliğini tercih eder. Yönetici ekibi başvuruyu inceleyip onayladığında profilde mavi onay rozeti görünür.

7. **İçerik Üretici & Para Kazanma (Monetization / Creator Studio - /monetization):**
   - Nest Social içerik üreticilerinin gönderi ve video görüntülenmelerinden gelir elde etmesini sağlar.
   - **Başvuru Kriterleri (6 Şart):**
     1. En az 100 takipçiye sahip olmak.
     2. Son 30 günde en az 1.000 görüntülenmeye ulaşmak.
     3. Hesabın en az 14 günlük olması.
     4. E-posta adresinin doğrulanmış olması.
     5. Temiz hesap geçmişi (topluluk ihlali veya ceza olmaması).
     6. Doğrulanmış profil (Mavi Rozet) sahibi olmak.
   - **Kazanç ve Ödeme:** Şartlar tamamlandığında Monetization sayfasından başvuru yapılır. Onaylandıktan sonra "İçerik Üretici Paneli" açılır; RPM (bin gösterim başı kazanç) ve tahmini bakiye izlenir. Belirli ödeme eşiğine ulaşıldığında Para Çekme (Payout Request) talebi verilebilir.

8. **Profil ve Hesap Yönetimi (/profile & /profile/edit):**
   - Profil resmi, kapak fotoğrafı, biyografi, kullanıcı adı düzenleme.
   - Gizli Hesap modu (sadece onaylanan takipçiler gönderileri görebilir).
   - Takipçi ve takip edilen listeleri (/profile/followers, /profile/following), engellenen kullanıcılar.

9. **Keşfet & Arama (/search):**
   - Kişileri, etiketleri (#hashtag) ve popüler gönderileri arama motoru.

10. **Şikayet ve Güvenlik (/reports):**
    - Uygunsuz içerik ve profiller şikayet edilebilir; şikayet durumu "Şikayetlerim" sayfasından takip edilebilir.`

/**
 * Builds the dynamic system prompt injecting platform knowledge and current user context.
 * @param {Object} [user]
 * @returns {string}
 */
function buildNestSocialSystemPrompt(user) {
  let userContext = ''

  if (user && user.username) {
    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim()
    const isVerified = user.verification?.status === 'approved'
    const roleText = user.role === 'admin' ? 'Yönetici (Admin)' : 'Kullanıcı'

    userContext = `\n\n### ŞU ANDA SOHBET EDEN AKTİF KULLANICI BİLGİSİ:
- Ad Soyad: ${fullName || 'Belirtilmemiş'}
- Kullanıcı Adı: @${user.username}
- E-posta: ${user.email || 'Belirtilmemiş'}
- Doğrulama (Mavi Rozet): ${isVerified ? 'Evet, Mavi Rozeti Var (Onaylı Hesap)' : 'Hayır, Henüz Onaylı Değil'}
- Hesap Rolü: ${roleText}
- Anonim Profil Durumu: ${user.anonymousProfile?.displayName ? `@${user.anonymousProfile.displayName} rumuzuyla kayıtlı` : 'Oluşturulmamış'}

Kullanıcı kendi profili, mavi rozeti veya hesap durumu hakkında soru sorduğunda bu gerçek bilgileri kullanarak ona ismiyle (@${user.username}) hitap et.`
  } else {
    userContext = `\n\n### AKTİF KULLANICI BİLGİSİ:
Kullanıcı şu anda siteye giriş yapmamış bir ziyaretçidir (Guest). Profil veya özel ayarlar gerektiren konularda giriş yapmasını veya kayıt olmasını (/login, /signup) nazikçe hatırlatabilirsin.`
  }

  return `${BASE_NEST_KNOWLEDGE}${userContext}`
}

const DEFAULT_SYSTEM_PROMPT = buildNestSocialSystemPrompt(null)

/**
 * Sends chat completion request to NVIDIA Build API with SSE streaming.
 * @param {Object} options
 * @param {Array<{role: string, content: string}>} options.messages
 * @param {string} [options.systemPrompt]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<Response>}
 */
async function callNvidiaStreaming({ messages, systemPrompt, signal }) {
  const apiKey = env.nvidia.apiKey || process.env.NVIDIA_API_KEY || ''

  if (!apiKey) {
    return null
  }

  const formattedMessages = [
    { role: 'system', content: systemPrompt || DEFAULT_SYSTEM_PROMPT },
    ...messages.map((msg) => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: String(msg.content || '').trim(),
    })).filter((msg) => msg.content.length > 0),
  ]

  const baseUrl = (env.nvidia.baseUrl || 'https://integrate.api.nvidia.com/v1').replace(/\/+$/, '')
  const endpoint = `${baseUrl}/chat/completions`

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'text/event-stream',
    },
    body: JSON.stringify({
      model: env.nvidia.model || 'meta/llama-3.3-70b-instruct',
      messages: formattedMessages,
      temperature: 0.7,
      max_tokens: 1024,
      stream: true,
    }),
    signal,
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    const error = new Error(`NVIDIA API Error (${response.status}): ${errorText || response.statusText}`)
    error.status = response.status
    error.details = errorText
    throw error
  }

  return response
}

/**
 * Summarizes a post and its context into 2-3 concise bullet points.
 * @param {Object} options
/**
 * Summarize post text, media, and author profile in 3 concise bullet points (X / Grok style).
 * @param {Object} options
 * @param {string} options.postText
 * @param {string} [options.authorName]
 * @param {Object} [options.authorDetails]
 * @param {Array<Object>} [options.mediaList]
 * @param {Array<string>} [options.topComments]
 * @returns {Promise<string>}
 */
async function summarizePostContent({
  postText,
  authorName,
  authorDetails = {},
  mediaList = [],
  topComments = [],
}) {
  const apiKey = env.nvidia.apiKey || process.env.NVIDIA_API_KEY || ''
  if (!apiKey) {
    throw new Error('Yapay zeka servisi yapılandırılmamış (API anahtarı eksik).')
  }

  const username = authorDetails.username || authorName || 'kullanici'
  const authorBioText = authorDetails.bio ? `Biyografi: "${authorDetails.bio}"` : 'Biyografi belirtilmemiş'
  const authorInfoText = [
    `Kullanıcı Adı: @${username}`,
    authorDetails.fullName ? `Ad Soyad: ${authorDetails.fullName}` : '',
    authorDetails.isVerified ? `Doğrulanmış Hesap: Evet (${authorDetails.verificationCategory || 'Doğrulanmış'})` : '',
    authorBioText,
  ].filter(Boolean).join(', ')

  let mediaInfoText = 'Medyasız (Yalnızca metin paylaşımı)'
  if (mediaList && mediaList.length > 0) {
    const imagesCount = mediaList.filter((m) => m.type === 'image').length
    const videosCount = mediaList.filter((m) => m.type === 'video').length
    const parts = []
    if (imagesCount > 0) parts.push(`${imagesCount} adet görsel/fotoğraf`)
    if (videosCount > 0) {
      const totalDuration = mediaList
        .filter((m) => m.type === 'video')
        .reduce((sum, v) => sum + (v.durationSeconds || 0), 0)
      parts.push(`${videosCount} adet video${totalDuration > 0 ? ` (yaklaşık ${Math.round(totalDuration)} sn)` : ''}`)
    }
    mediaInfoText = parts.join(', ') || 'Medya içeriyor'
  }

  const prompt = `Aşağıdaki sosyal medya gönderisini, medyasını ve paylaşan profilini analiz et.
X / Grok tarzında, TAM OLARAK 3 MADDE halinde Türkçe olarak özetle:

1. Madde (Açıklama Özeti): Gönderi metninin ana konusunu ve verilmek istenen temel mesajı açık ve net şekilde özetleyen TEK bir cümle.
2. Madde (Medya Özeti): Paylaşımdaki görsel veya videonun durumunu, türünü ve içeriğe katkısını özetleyen TEK bir cümle (eğer medya yoksa içeriğin yalnızca metin paylaşımı olduğunu zarifçe belirt).
3. Madde (Profil Bilgisi): İçeriği paylaşan @${username} profili hakkında bilgi veren KESİNLİKLE TEK bir cümle.

Gönderi Bilgileri:
- Paylaşan Profil: ${authorInfoText}
- Gönderi Metni: """${postText || '(Metin yok, medya odaklı paylaşım)'}"""
- Medya Durumu: ${mediaInfoText}
${topComments && topComments.length > 0 ? `- Öne Çıkan Yorumlar:\n${topComments.map((c) => `  * ${c}`).join('\n')}` : ''}

Kurallar:
- Yanıtın KESİNLİKLE VE SADECE 3 MADDEDEN (3 satırdan) oluşmalıdır.
- Her madde "• " ile başlamalıdır.
- 1. Madde: Açıklama ve içerik özeti (tek bir cümle).
- 2. Madde: Görsel veya video medya özeti (tek bir cümle).
- 3. Madde: YALNIZCA @${username} profili hakkında bilgi veren TEK bir cümle olmalıdır. Bu maddede gönderi konusunu veya metnini ASLA tekrar anlatma ("... açıklamasını paylaştı" vb. YAZMA). Sadece profilin kim olduğunu, onaylı durumunu veya biyografisini belirt. Biyografi yoksa sadece "Paylaşım, @${username} isimli kullanıcı tarafından yapılmıştır." şeklinde sade tek bir cümle yaz. Asla "daha fazla bilgi bulunmamaktadır" veya "ancak içerik ... içermektedir" gibi mükerrer veya ikinci cümleler ekleme.
- Asla selamlama, başlık, ön söz ("İşte özet:", "1. Madde:", "İçerik:", "Medya:", "Profil:" vb.) yazma. Doğrudan "• " ile başla.
- Asla kapanış veya son söz ekleme.`

  const baseUrl = (env.nvidia.baseUrl || 'https://integrate.api.nvidia.com/v1').replace(/\/+$/, '')
  const endpoint = `${baseUrl}/chat/completions`

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: env.nvidia.model || 'meta/llama-3.3-70b-instruct',
      messages: [
        { role: 'system', content: 'Sen sosyal medya içeriklerini ve yazarlarını 3 maddede özetleyen uzman, tarafsız ve kusursuz Türkçe kullanan bir asistansın.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 380,
      stream: false,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(`NVIDIA API Hatası (${response.status}): ${errorText}`)
  }

  const data = await response.json()
  const rawSummary = data.choices?.[0]?.message?.content || ''
  return rawSummary.trim()
}

/**
 * Magic compose / rewrite assistant for social post drafting.
 * @param {Object} options
 * @param {string} options.text
 * @param {'enhance' | 'hashtags' | 'fix' | 'poll'} options.action
 * @param {string} [options.language]
 * @returns {Promise<{ result: string, action: string }>}
 */
async function magicComposeText({ text, action = 'enhance', language = 'tr' }) {
  const apiKey = env.nvidia.apiKey || process.env.NVIDIA_API_KEY || ''
  if (!apiKey) {
    throw new Error('Yapay zeka servisi yapılandırılmamış (API anahtarı eksik).')
  }

  const cleanText = String(text || '').trim()
  if (!cleanText) {
    throw new Error('Yeniden yazılacak bir taslak metin girilmelidir.')
  }

  let systemPrompt = 'Sen sosyal medya içerik üretiminde uzman, yaratıcı ve kusursuz Türkçe kullanan bir asistansın.'
  let userPrompt = ''

  if (action === 'enhance') {
    systemPrompt = 'Sen sosyal medya içeriklerini dikkat çekici, akıcı ve yüksek etkileşim alacak hale getiren uzman bir içerik yöneticisisin.'
    userPrompt = `Aşağıdaki sosyal medya taslak metnini daha vurucu, akıcı, merak uyandırıcı ve profesyonel bir dille yeniden yaz.
Anlam bütünlüğünü koru, aşırı abartıya kaçma. Varsa emojileri ölçülü ve şık kullan.
SADECE yeniden yazılmış metni döndür. Asla tırnak işareti, selamlama ("İşte öneri:" vb.) veya açıklama ekleme.

Taslak Metin:
"""${cleanText}"""`
  } else if (action === 'hashtags') {
    systemPrompt = 'Sen sosyal medyada doğru etiketleri (hashtag) belirleyen bir uzmansın.'
    userPrompt = `Aşağıdaki sosyal medya içeriği için en alakalı, popüler ve etkileşim getirebilecek 3 veya 4 adet hashtag üret.
SADECE hashtag'leri tek satırda aralarında boşluk bırakarak döndür (Örnek: #Gündem #Teknoloji #Yazılım).
Başka hiçbir selamlama, metin veya açıklama ekleme.

Gönderi Metni:
"""${cleanText}"""`
  } else if (action === 'fix') {
    systemPrompt = 'Sen Türk Dil Kurumu kurallarına hakim, profesyonel bir editör ve imla denetleyicisisin.'
    userPrompt = `Aşağıdaki metindeki tüm imla, yazım, noktalama ve anlatım bozukluklarını düzelt.
Metnin dilini ve üslubunu bozma. SADECE düzeltilmiş nihai metni döndür.
Asla açıklama veya giriş cümlesi yapma.

Metin:
"""${cleanText}"""`
  } else if (action === 'poll') {
    systemPrompt = 'Sen sosyal medya takipçilerini etkileşime sokan anket içerikleri hazırlayan bir uzmansın.'
    userPrompt = `Aşağıdaki konudan yola çıkarak takipçilerin fikirlerini soran ilgi çekici bir mini anket formatı oluştur.
Format şu şekilde olsun:
📊 [İlgi çekici soru]

1️⃣ [1. Seçenek]
2️⃣ [2. Seçenek]
3️⃣ [3. Seçenek]

Siz ne düşünüyorsunuz? Yorumlarda buluşalım! 👇

SADECE bu formatta üretilmiş metni döndür. Başka hiçbir açıklama yapma.

Konu / Taslak:
"""${cleanText}"""`
  } else {
    throw new Error(`Desteklenmeyen eylem: ${action}`)
  }

  const baseUrl = (env.nvidia.baseUrl || 'https://integrate.api.nvidia.com/v1').replace(/\/+$/, '')
  const endpoint = `${baseUrl}/chat/completions`

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: env.nvidia.model || 'meta/llama-3.3-70b-instruct',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: action === 'fix' ? 0.2 : 0.7,
      max_tokens: 500,
      stream: false,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(`NVIDIA API Hatası (${response.status}): ${errorText}`)
  }

  const data = await response.json()
  let result = data.choices?.[0]?.message?.content || ''
  result = result.trim()

  // Remove surrounding quotes if model added them
  if (result.startsWith('"') && result.endsWith('"') && result.length > 2) {
    result = result.slice(1, -1).trim()
  }

  return {
    action,
    result,
  }
}

/**
 * Translates post text into the target language using AI.
 * @param {Object} options
 * @param {string} options.text
 * @param {string} [options.targetLanguage] - e.g. 'tr', 'en', 'es', 'de'
 * @returns {Promise<{ translatedText: string, targetLanguage: string }>}
 */
async function translatePostText({ text, targetLanguage = 'tr' }) {
  const apiKey = env.nvidia.apiKey || process.env.NVIDIA_API_KEY || ''
  if (!apiKey) {
    throw new Error('Yapay zeka servisi yapılandırılmamış (API anahtarı eksik).')
  }

  const cleanText = String(text || '').trim()
  if (!cleanText) {
    throw new Error('Çevrilecek metin boş olamaz.')
  }

  const langNames = {
    tr: 'Türkçe',
    en: 'İngilizce',
    de: 'Almanca',
    es: 'İspanyolca',
    fr: 'Fransızca',
    ar: 'Arapça',
    ru: 'Rusça',
  }
  const targetLangName = langNames[targetLanguage.toLowerCase()] || targetLanguage

  const systemPrompt = `Sen profesyonel bir sosyal medya çevirmenisin. Metinleri bağlamına uygun, akıcı, yaşayan ve doğal bir dille ${targetLangName} diline çevirirsin.`
  const userPrompt = `Aşağıdaki sosyal medya metnini ${targetLangName} diline çevir.
Kurallar:
- Bahsetmeleri (@kullanici) ve etiketleri (#etiket) olduğu gibi koru.
- Emojileri yerinde tut.
- SADECE çevrilmiş nihai metni döndür.
- Asla açıklama, selamlama veya dipnot ekleme.

Metin:
"""${cleanText}"""`

  const baseUrl = (env.nvidia.baseUrl || 'https://integrate.api.nvidia.com/v1').replace(/\/+$/, '')
  const endpoint = `${baseUrl}/chat/completions`

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: env.nvidia.model || 'meta/llama-3.3-70b-instruct',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 600,
      stream: false,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(`NVIDIA API Hatası (${response.status}): ${errorText}`)
  }

  const data = await response.json()
  let translatedText = data.choices?.[0]?.message?.content || ''
  translatedText = translatedText.trim()

  if (translatedText.startsWith('"') && translatedText.endsWith('"') && translatedText.length > 2) {
    translatedText = translatedText.slice(1, -1).trim()
  }

  return {
    translatedText,
    targetLanguage,
  }
}

module.exports = {
  DEFAULT_SYSTEM_PROMPT,
  buildNestSocialSystemPrompt,
  callNvidiaStreaming,
  summarizePostContent,
  magicComposeText,
  translatePostText,
}
