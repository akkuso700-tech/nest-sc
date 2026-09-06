import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import SocialLayout from '../layouts/SocialLayout.jsx'
import Seo from '../components/seo/Seo.jsx'
import { useAuth } from '../store/AuthContext.jsx'

function ShieldCheckIcon({ className = 'size-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}

function SparklesIcon({ className = 'size-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="m12 3-1.9 5.1L5 10l5.1 1.9L12 17l1.9-5.1L19 10l-5.1-1.9L12 3z" />
      <path d="M19 17l-1 2.5L15.5 20.5 18 21.5 19 24l1-2.5 2.5-1-2.5-1L19 17z" />
    </svg>
  )
}

function ZapIcon({ className = 'size-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  )
}

function UsersGroupIcon({ className = 'size-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function VideoIcon({ className = 'size-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect width="14" height="12" x="2" y="6" rx="2" />
      <path d="m16 10 6-3v10l-6-3" />
    </svg>
  )
}

function PhoneIcon({ className = 'size-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  )
}

function FeedIcon({ className = 'size-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M3 9h18" />
      <path d="M9 21V9" />
    </svg>
  )
}

function ChevronDownIcon({ className = 'size-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

function ArrowRightIcon({ className = 'size-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  )
}

function CheckIcon({ className = 'size-3.5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function MailIcon({ className = 'size-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  )
}

function LockIcon({ className = 'size-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

export default function AboutPage() {
  const { lang = 'tr' } = useParams()
  const { t } = useTranslation()
  const { isAuthenticated } = useAuth()
  const [activeFeatureTab, setActiveFeatureTab] = useState('feed')
  const [openFaqIndex, setOpenFaqIndex] = useState(0)

  const isTr = lang === 'tr'

  const heroBadge = t('aboutPage.badge', {
    defaultValue: isTr ? 'Nest Social • Yeni Nesil Sosyal Deneyim' : 'Nest Social • Next-Gen Experience',
  })
  const heroTitle = t('aboutPage.heroTitle', {
    defaultValue: isTr
      ? 'Daha Özgür, Güvenli ve Samimi Bir Sosyal Alan'
      : 'A Freer, Safer, and Simpler Social Space',
  })
  const heroSubtitle = t('aboutPage.heroSubtitle', {
    defaultValue: isTr
      ? 'Gereksiz veri baskısı olmadan bağlantı kurun, paylaşın ve keşfedin. Telefon numarası veya T.C. kimlik zorunluluğu yok; sadece gerçek topluluk ve özgür içerik.'
      : 'Connect, share, and discover without invasive tracking. No phone number or government ID required — just real community and authentic expression.',
  })

  const stats = [
    {
      id: 'privacy',
      badge: '100%',
      title: t('aboutPage.stats.privacy', { defaultValue: isTr ? 'Gizlilik Öncelikli' : 'Privacy First' }),
      desc: t('aboutPage.stats.privacyDesc', { defaultValue: isTr ? 'Hassas kişisel veri zorunluluğu yok' : 'Zero intrusive personal data required' }),
      icon: <LockIcon className="size-4 text-primary shrink-0" />,
    },
    {
      id: 'realtime',
      badge: '< 50ms',
      title: t('aboutPage.stats.realtime', { defaultValue: isTr ? 'Gerçek Zamanlı' : 'Real-Time' }),
      desc: t('aboutPage.stats.realtimeDesc', { defaultValue: isTr ? 'Anlık sohbet ve WebRTC sesli/görüntülü arama' : 'Instant chat & WebRTC voice/video calls' }),
      icon: <ZapIcon className="size-4 text-primary shrink-0" />,
    },
    {
      id: 'discovery',
      badge: 'Loop & Hubs',
      title: t('aboutPage.stats.discovery', { defaultValue: isTr ? 'Kesintisiz Keşif' : 'Endless Discovery' }),
      desc: t('aboutPage.stats.discoveryDesc', { defaultValue: isTr ? 'Dinamik akış, dikey videolar ve gruplar' : 'Dynamic feed, loops & curated groups' }),
      icon: <VideoIcon className="size-4 text-primary shrink-0" />,
    },
    {
      id: 'multilingual',
      badge: isTr ? '4 Dil' : lang === 'de' ? '4 Sprachen' : lang === 'es' ? '4 Idiomas' : '4 Langs',
      title: t('aboutPage.stats.multilingual', { defaultValue: isTr ? 'Global & Erişilebilir' : 'Global & Accessible' }),
      desc: t('aboutPage.stats.multilingualDesc', { defaultValue: isTr ? 'Çoklu dil ve akıcı karanlık/aydınlık mod' : '4 languages with dark/light themes' }),
      icon: <SparklesIcon className="size-4 text-primary shrink-0" />,
    },
  ]

  const values = [
    {
      id: 'privacy',
      title: t('aboutPage.values.privacyTitle', { defaultValue: isTr ? 'Gizlilik ve Veri Saygısı' : 'Privacy & Data Respect' }),
      desc: t('aboutPage.values.privacyDesc', {
        defaultValue: isTr
          ? 'Kullanıcı mahremiyetini temel değerimiz olarak görüyoruz. Telefon numarası, kimlik kartı veya agresif izleyiciler talep etmiyoruz.'
          : 'We treat user privacy as a fundamental right. No phone number, ID card, or intrusive background trackers.',
      }),
      icon: <ShieldCheckIcon className="size-5 text-primary" />,
    },
    {
      id: 'minimal',
      title: t('aboutPage.values.minimalTitle', { defaultValue: isTr ? 'İçerik Odaklı Sade Deneyim' : 'Content-First & Minimal' }),
      desc: t('aboutPage.values.minimalDesc', {
        defaultValue: isTr
          ? 'Karmaşık reklam labirentleri veya dikkat tuzağı algoritmalar yerine, takip ettiğiniz kişileri ve toplulukları merkeze alıyoruz.'
          : 'No algorithmic traps or intrusive ad walls. Enjoy clean, fast, and authentic interactions with friends.',
      }),
      icon: <SparklesIcon className="size-5 text-primary" />,
    },
    {
      id: 'realtime',
      title: t('aboutPage.values.realtimeTitle', { defaultValue: isTr ? 'Gerçek Zamanlı İletişim' : 'Modern Real-Time Tech' }),
      desc: t('aboutPage.values.realtimeDesc', {
        defaultValue: isTr
          ? 'Tarayıcınız üzerinden doğrudan anlık mesajlaşma, medya paylaşımı ve sesli/görüntülü aramalarla kesintisiz iletişim kurun.'
          : 'Stay connected with instant socket messaging, rich media previews, and peer-to-peer WebRTC calls.',
      }),
      icon: <ZapIcon className="size-5 text-primary" />,
    },
    {
      id: 'community',
      title: t('aboutPage.values.communityTitle', { defaultValue: isTr ? 'Güvenli ve Canlı Topluluklar' : 'Safe & Vibrant Communities' }),
      desc: t('aboutPage.values.communityDesc', {
        defaultValue: isTr
          ? 'Ortak ilgi alanlarınıza özel açık veya kapalı gruplar oluşturun; kendi dijital alanınızı şeffaflıkla yönetin.'
          : 'Public and private groups, clear community guidelines, and robust personal privacy controls.',
      }),
      icon: <UsersGroupIcon className="size-5 text-primary" />,
    },
  ]

  const rawHighlights = t('aboutPage.highlights', { returnObjects: true })
  const highlights = Array.isArray(rawHighlights) && rawHighlights.length > 0
    ? rawHighlights
    : [
        isTr ? 'Kayıt için telefon numarası veya T.C. kimlik zorunluluğu yok' : 'No phone number or government ID needed to register',
        isTr ? 'Uçtan uca WebRTC sesli ve görüntülü canlı arama' : 'Crystal-clear WebRTC audio & video calling in browser',
        isTr ? 'Akıcı dikey Loop video akışı ve gelişmiş oynatıcı' : 'Fluid vertical Loop video player with smooth controls',
        isTr ? 'Ortak ilgi alanlarına özel açık ve kapalı gruplar' : 'Curated public & private interest groups and discussions',
        isTr ? 'Gizli profil modu ve onaylı takipçi filtreleme' : 'Hidden profile mode & selective follower discovery',
        isTr ? 'Modern karanlık/aydınlık tema ve çok dilli mimari' : 'High-contrast dark/light modes with 4 language options',
      ]

  const featureTabs = [
    {
      id: 'feed',
      label: t('aboutPage.tabs.feed', { defaultValue: isTr ? 'Akış & Gönderiler' : 'Feed & Posts' }),
      icon: <FeedIcon className="size-4" />,
      title: t('aboutPage.featureFeedTitle', { defaultValue: isTr ? 'Zengin İçerik Üretimi ve Akış' : 'Rich Content Creation & Feed' }),
      desc: t('aboutPage.featureFeedDesc', {
        defaultValue: isTr
          ? 'Metinler, yüksek çözünürlüklü fotoğraflar, videolar, etiketler ve kullanıcı etiketlemeleri ile düşüncelerinizi anında paylaşın. İlgi alanlarınıza göre filtrelenen akışta yeni içerik üreticileri keşfedin.'
          : 'Share text updates, media galleries, hashtags, and mentions. Discover creators in a fast, clean chronological or trending stream.',
      }),
      bulletPoints: isTr
        ? ['Gelişmiş gönderi düzenleyici', 'Medya galerisi ve video oynatıcı', 'Popüler konu etiketleri (#trendler)', 'Yorum dizileri ve mikro etkileşimler']
        : ['Advanced post composer', 'Media galleries & video player', 'Trending hashtag discovery', 'Threaded comments & micro-reactions'],
    },
    {
      id: 'loop',
      label: t('aboutPage.tabs.loop', { defaultValue: isTr ? 'Loop Videoları' : 'Loop Videos' }),
      icon: <VideoIcon className="size-4" />,
      title: t('aboutPage.featureLoopTitle', { defaultValue: isTr ? 'Dikey ve Akıcı Loop Videoları' : 'Fluid Vertical Loop Videos' }),
      desc: t('aboutPage.featureLoopDesc', {
        defaultValue: isTr
          ? 'Kısa formatlı dikey videolar arasında yumuşak kaydırma ile gezinin. Ses kontrolleri, yorum paneli ve anlık paylaşım araçlarıyla en sevdiğiniz anları toplulukla paylaşın.'
          : 'Swipe through short-form vertical videos with fluid controls, responsive audio toggle, and fast community engagement.',
      }),
      bulletPoints: isTr
        ? ['Dikey video keşif ekranı', 'HLS destekli optimize video akışı', 'Yorum ve beğeni etkileşimleri', 'Hızlı ses kapatma/açma kontrolleri']
        : ['Dedicated vertical video stage', 'Optimized HLS streaming', 'Instant likes and side-panel comments', 'Keyboard and touch-friendly controls'],
    },
    {
      id: 'groups',
      label: t('aboutPage.tabs.groups', { defaultValue: isTr ? 'Gruplar & Odalar' : 'Groups & Hubs' }),
      icon: <UsersGroupIcon className="size-4" />,
      title: t('aboutPage.featureGroupsTitle', { defaultValue: isTr ? 'İlgi Alanlarına Özel Gruplar' : 'Curated Interest Communities' }),
      desc: t('aboutPage.featureGroupsDesc', {
        defaultValue: isTr
          ? 'Ortak tutkularınızı paylaşan insanlarla açık veya kapalı gruplarda bir araya gelin. Kendi topluluğunuzu oluşturun, kuralları belirleyin ve üyelerinizle doğrudan etkileşime geçin.'
          : 'Create or join public and private groups tailored to your passions. Set rules, invite members, and cultivate your own digital circle.',
      }),
      bulletPoints: isTr
        ? ['Açık veya özel üyelikli topluluklar', 'Grup içi gönderi akışı ve duyurular', 'Yönetici ve moderatör araçları', 'Grup içi arama ve öneriler']
        : ['Public or invite-only privacy settings', 'Dedicated group feed & announcements', 'Admin & moderator management tools', 'Group discovery and member roles'],
    },
    {
      id: 'chat',
      label: t('aboutPage.tabs.chat', { defaultValue: isTr ? 'Sohbet & Çağrı' : 'Chat & Calling' }),
      icon: <PhoneIcon className="size-4" />,
      title: t('aboutPage.featureChatTitle', { defaultValue: isTr ? 'Anlık Sohbet ve Canlı Arama' : 'Instant Messaging & Calling' }),
      desc: t('aboutPage.featureChatDesc', {
        defaultValue: isTr
          ? 'Soket altyapısıyla anında birebir mesajlaşın, görsel paylaşın ve doğrudan tarayıcınızdan WebRTC protokolüyle sesli/görüntülü aramalar gerçekleştirin.'
          : 'Send instant direct messages, share images and voice notes, and initiate crystal-clear WebRTC voice or video calls right from your browser.',
      }),
      bulletPoints: isTr
        ? ['Gerçek zamanlı soket mesajlaşma', 'Tarayıcı içi WebRTC sesli/görüntülü arama', 'Görsel ve sesli mesaj gönderme', 'Çevrim içi / son görülme durumu']
        : ['Low-latency socket messaging', 'Peer-to-peer WebRTC voice & video calls', 'Media & voice message attachments', 'Online presence indicators'],
    },
    {
      id: 'privacy',
      label: t('aboutPage.tabs.privacy', { defaultValue: isTr ? 'Gizlilik & Güvenlik' : 'Privacy & Safety' }),
      icon: <ShieldCheckIcon className="size-4" />,
      title: t('aboutPage.featurePrivacyTitle', { defaultValue: isTr ? 'Kapsamlı Gizlilik Denetimleri' : 'Granular Privacy & Safety' }),
      desc: t('aboutPage.featurePrivacyDesc', {
        defaultValue: isTr
          ? 'Hesabınızı tek tıkla gizli moda alın, takipçi onaylarını yönetin, istenmeyen kullanıcıları engelleyin veya şüpheli içerikleri hızlıca moderasyon ekibimize iletin.'
          : 'Toggle hidden profiles, approve followers, block bad actors, and report inappropriate behavior to keep your space comfortable.',
      }),
      bulletPoints: isTr
        ? ['Gizli profil modu (yalnızca onaylı takipçiler)', 'Telefon ve TC kimlik bilgisi talep edilmez', 'Kullanıcı engelleme ve raporlama sistemi', 'Mavi tik doğrulama başvuru süreci']
        : ['Hidden profile option', 'Zero phone or identity card requirements', 'Block & report protection mechanisms', 'Verification request review workflow'],
    },
  ]

  const activeTabContent = featureTabs.find((tab) => tab.id === activeFeatureTab) || featureTabs[0]

  const rawFaqs = t('aboutPage.faqs', { returnObjects: true })
  const faqs = Array.isArray(rawFaqs) && rawFaqs.length > 0
    ? rawFaqs
    : [
        {
          q: isTr ? 'Kayıt olmak için telefon numarası veya kimlik gerekiyor mu?' : 'Do I need a phone number or ID to sign up?',
          a: isTr
            ? 'Hayır. Nest Social kullanıcı mahremiyetine saygı duyar. Kayıt olmak için yalnızca geçerli bir kullanıcı adı, e-posta adresi ve şifre yeterlidir. Telefon numaranızı veya kimlik kartı bilgilerinizi asla zorunlu tutmuyoruz.'
            : 'No. Nest Social respects your privacy. To create an account, all you need is a username, email address, and password. We never require your phone number or government identity documents.',
        },
        {
          q: isTr ? 'Profilimi nasıl gizli yapabilirim?' : 'Can I make my profile private or hidden?',
          a: isTr
            ? 'Profil ayarlarınızdan veya Gizli Profil menüsünden hesabınızı dilediğiniz an gizli moda alabilirsiniz. Gizli modda paylaşımlarınız yalnızca onayladığınız takipçiler tarafından görülebilir.'
            : 'Yes. You can switch your account to Hidden Profile mode at any time from your settings. Only approved followers will see your posts and activity.',
        },
        {
          q: isTr ? 'Nest Social kullanıcı verilerini satıyor mu veya reklam baskısı var mı?' : 'Does Nest Social sell user data or push invasive ads?',
          a: isTr
            ? 'Kesinlikle hayır. Verileriniz hiçbir üçüncü tarafa veya veri simsarına satılmaz. Akışımızda aldatıcı izleyiciler veya saldırgan reklam duvarları bulunmaz; deneyimimiz tamamen içerik ve topluluk odaklıdır.'
            : 'Never. Your data is not sold to data brokers or third-party advertisers. Your experience remains clean, respectful, and content-first.',
        },
        {
          q: isTr ? 'Gönderiler ile Loop videoları arasındaki fark nedir?' : 'What is the difference between standard Posts and Loops?',
          a: isTr
            ? 'Gönderiler metin, fotoğraf galerileri ve etiketler içeren klasik paylaşımlardır. Loop ise mobil ve masaüstünde dikey, akıcı ve kesintisiz video keşfi sunan özel bir video alanıdır.'
            : 'Posts are standard social updates with text, photos, and links. Loops are dedicated vertical short-form videos with an immersive player.',
        },
        {
          q: isTr ? 'Sesli ve görüntülü aramalar nasıl çalışıyor?' : 'How do voice and video calls work?',
          a: isTr
            ? 'Aramalar doğrudan tarayıcınız üzerinden modern WebRTC teknolojisiyle güvenle gerçekleşir. Ek bir uygulama yüklemenize gerek kalmadan arkadaşlarınızla sesli veya görüntülü görüşebilirsiniz.'
            : 'Calls use secure WebRTC peer-to-peer technology directly in your browser without requiring external software.',
        },
        {
          q: isTr ? 'Bir soru veya öneri durumunda nasıl ulaşabilirim?' : 'How can I get help or submit suggestions?',
          a: isTr
            ? 'Görüşleriniz bizim için değerlidir. İletişim sayfamızdan veya doğrudan info@nest-sc.com adresinden ekibimize dilediğiniz an ulaşabilirsiniz.'
            : 'You can reach our team anytime via the Contact page or directly by sending an email to info@nest-sc.com.',
        },
      ]

  const rightRailContent = (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-soft">
          {t('aboutPage.sidebarToc', { defaultValue: isTr ? 'Sayfa İçeriği' : 'On This Page' })}
        </p>
        <nav className="mt-3 flex flex-col space-y-2 text-xs font-medium text-muted">
          <button
            type="button"
            onClick={() => document.getElementById('about-hero')?.scrollIntoView({ behavior: 'smooth' })}
            className="flex items-center gap-2 text-left transition hover:text-text cursor-pointer"
          >
            <span className="size-1.5 rounded-full bg-primary" />
            <span>{isTr ? 'Giriş & Vizyon' : 'Vision & Overview'}</span>
          </button>
          <button
            type="button"
            onClick={() => document.getElementById('about-values')?.scrollIntoView({ behavior: 'smooth' })}
            className="flex items-center gap-2 text-left transition hover:text-text cursor-pointer"
          >
            <span className="size-1.5 rounded-full bg-primary" />
            <span>{isTr ? 'Temel Değerlerimiz' : 'Our Core Values'}</span>
          </button>
          <button
            type="button"
            onClick={() => document.getElementById('about-story')?.scrollIntoView({ behavior: 'smooth' })}
            className="flex items-center gap-2 text-left transition hover:text-text cursor-pointer"
          >
            <span className="size-1.5 rounded-full bg-primary" />
            <span>{isTr ? 'Manifestomuz & Hikaye' : 'Our Manifesto'}</span>
          </button>
          <button
            type="button"
            onClick={() => document.getElementById('about-features')?.scrollIntoView({ behavior: 'smooth' })}
            className="flex items-center gap-2 text-left transition hover:text-text cursor-pointer"
          >
            <span className="size-1.5 rounded-full bg-primary" />
            <span>{isTr ? 'Platform Özellikleri' : 'Platform Features'}</span>
          </button>
          <button
            type="button"
            onClick={() => document.getElementById('about-faq')?.scrollIntoView({ behavior: 'smooth' })}
            className="flex items-center gap-2 text-left transition hover:text-text cursor-pointer"
          >
            <span className="size-1.5 rounded-full bg-primary" />
            <span>{isTr ? 'Sıkça Sorulan Sorular' : 'FAQ'}</span>
          </button>
        </nav>

        <div className="mt-4 border-t border-border pt-3">
          <p className="text-[11px] text-muted">
            {isTr ? 'Sorularınız veya talepleriniz için:' : 'For questions or inquiries:'}
          </p>
          <a
            href="mailto:info@nest-sc.com"
            className="mt-1 flex items-center gap-1.5 font-medium text-primary hover:underline"
          >
            <MailIcon className="size-3.5" />
            <span>info@nest-sc.com</span>
          </a>
        </div>
      </div>

      {!isAuthenticated && (
        <div className="rounded-lg border border-border bg-secondary p-4 text-xs">
          <p className="font-semibold text-text">{isTr ? 'Aramıza Katılın' : 'Join Our Community'}</p>
          <p className="mt-1 text-muted">
            {isTr ? 'Telefon numarası gerekmeden saniyeler içinde hesabınızı açın.' : 'Create an account in seconds without a phone number.'}
          </p>
          <Link
            to={`/${lang}/signup`}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold !text-white transition hover:bg-primary-hover"
          >
            <span>{isTr ? 'Hemen Kaydol' : 'Sign Up Free'}</span>
            <ArrowRightIcon className="size-3.5" />
          </Link>
        </div>
      )}
    </div>
  )

  return (
    <>
      <Seo
        title={`Nest Social · ${t('pages.about', { defaultValue: isTr ? 'Hakkımızda' : 'About' })}`}
        description={heroSubtitle}
      />

      <SocialLayout
        pageTitle={t('pages.about', { defaultValue: isTr ? 'Hakkımızda' : 'About' })}
        activeKey="about"
        showDesktopPageHeader={false}
        desktopSidebarMode="drawer"
        rightAside={rightRailContent}
      >
        <div className="mx-auto max-w-5xl space-y-5 sm:space-y-6 md:space-y-8 px-3.5 sm:px-5 md:px-0 pb-8">
          {/* Hero Section */}
          <section
            id="about-hero"
            className="rounded-lg border border-border bg-card p-4 sm:p-6 md:p-8 shadow-sm"
          >
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-text">
                <span className="size-2 rounded-full bg-primary" />
                <span>{heroBadge}</span>
              </div>

              <h1 className="mt-4 text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-text" style={{ textWrap: 'balance' }}>
                {heroTitle}
              </h1>

              <p className="mt-3 text-sm sm:text-base leading-6 sm:leading-7 text-muted" style={{ textWrap: 'pretty' }}>
                {heroSubtitle}
              </p>

              <div className="mt-5 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2.5">
                {isAuthenticated ? (
                  <Link
                    to={`/${lang}/`}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold !text-white transition hover:bg-primary-hover w-full sm:w-auto"
                  >
                    <span>{t('aboutPage.ctaExplore', { defaultValue: isTr ? 'Akışı Keşfet' : 'Explore Feed' })}</span>
                    <ArrowRightIcon />
                  </Link>
                ) : (
                  <>
                    <Link
                      to={`/${lang}/signup`}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold !text-white transition hover:bg-primary-hover w-full sm:w-auto"
                    >
                      <span>{t('aboutPage.ctaJoin', { defaultValue: isTr ? 'Topluluğa Katıl' : 'Join Now' })}</span>
                      <ArrowRightIcon />
                    </Link>
                    <Link
                      to={`/${lang}/login`}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-semibold text-text transition hover:bg-secondary w-full sm:w-auto"
                    >
                      <span>{t('common.login', { defaultValue: isTr ? 'Giriş Yap' : 'Sign In' })}</span>
                    </Link>
                  </>
                )}
                <Link
                  to={`/${lang}/contact`}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-text transition hover:bg-secondary w-full sm:w-auto"
                >
                  <MailIcon />
                  <span>{t('aboutPage.ctaContact', { defaultValue: isTr ? 'İletişim' : 'Contact' })}</span>
                </Link>
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="mt-5 sm:mt-7 grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 border-t border-border pt-4 sm:pt-6">
              {stats.map((stat) => (
                <div
                  key={stat.id}
                  className="flex flex-col justify-between rounded-lg border border-border bg-secondary p-2.5 sm:p-3.5 transition hover:bg-secondary-hover min-w-0"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="inline-flex shrink-0 items-center rounded-md border border-border bg-card px-1.5 py-0.5 sm:px-2 text-[10px] sm:text-[11px] font-bold text-text">
                      {stat.badge}
                    </span>
                    {stat.icon}
                  </div>
                  <div className="mt-2 sm:mt-3 min-w-0">
                    <p className="text-xs sm:text-sm font-bold text-text leading-snug line-clamp-2">{stat.title}</p>
                    <p className="mt-0.5 text-[10px] sm:text-xs text-muted leading-tight line-clamp-2">{stat.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Core Values Section */}
          <section id="about-values" className="space-y-3 sm:space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-soft">
                {t('aboutPage.valuesTitle', { defaultValue: isTr ? 'Temel Değerlerimiz' : 'Our Core Values' })}
              </p>
              <h2 className="mt-1 text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-text" style={{ textWrap: 'balance' }}>
                {t('aboutPage.valuesSubtitle', {
                  defaultValue: isTr
                    ? 'Daha Özgür ve Saygılı Bir Sosyal Ağ İçin İnşa Edildi'
                    : 'Built for a Freer and More Respectful Social Network',
                })}
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
              {values.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-border bg-card p-4 sm:p-5 shadow-sm transition hover:bg-secondary/40"
                >
                  <div className="inline-flex rounded-lg border border-border bg-secondary p-2.5 text-primary">
                    {item.icon}
                  </div>
                  <h3 className="mt-3 text-base sm:text-lg font-bold text-text">
                    {item.title}
                  </h3>
                  <p className="mt-1.5 text-xs sm:text-sm leading-6 text-muted" style={{ textWrap: 'pretty' }}>
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Our Story & Manifesto Section */}
          <section
            id="about-story"
            className="rounded-lg border border-border bg-card p-4 sm:p-6 md:p-8 shadow-sm"
          >
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
              <div className="space-y-3.5 lg:col-span-7">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-soft">
                  {t('aboutPage.storyEyebrow', { defaultValue: isTr ? 'Manifestomuz' : 'Our Manifesto' })}
                </p>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-text" style={{ textWrap: 'balance' }}>
                  {t('aboutPage.storyTitle', { defaultValue: isTr ? "Neden Nest Social'ı İnşa Ettik?" : 'Why We Built Nest Social' })}
                </h2>

                <div className="space-y-3 text-xs sm:text-sm leading-6 sm:leading-7 text-muted" style={{ textWrap: 'pretty' }}>
                  <p>
                    {t('aboutPage.storyParagraph1', {
                      defaultValue: isTr
                        ? 'Platformumuz, dijital dünyada daha güvenli, daha özgür ve daha konforlu bir sosyal deneyim sunma amacıyla geliştirildi. Kullanıcı gizliliğini temel değerlerimizden biri olarak görüyor; telefon numarası, kimlik kartı bilgisi ve benzeri hassas kişisel verileri zorunlu tutmadan herkesin kendini rahat hissedebileceği bir ortam oluşturmayı hedefliyoruz.'
                        : 'Our platform was built to provide a safer, freer, and more comfortable social experience in the digital world. We treat user privacy as a core value and avoid forcing sensitive data such as phone numbers or government identity records.',
                    })}
                  </p>
                  <p>
                    {t('aboutPage.storyParagraph2', {
                      defaultValue: isTr
                        ? 'Günümüzde sosyal medya, yalnızca paylaşım yapmak değil; aynı zamanda güven duygusu içinde bağlantı kurabilmek anlamına geliyor. Biz de bu anlayışla, kullanıcıların gereksiz veri paylaşımı baskısı yaşamadan içerik keşfedebildiği, etkileşim kurabildiği ve topluluğun bir parçası olabildiği modern bir platform inşa ediyoruz.'
                        : 'Today, social media is not just about posting content — it is also about building connections with genuine trust. With this mindset, we are building a platform where users can discover content and cultivate community without pressure to surrender sensitive personal data.',
                    })}
                  </p>
                  <p>
                    {t('aboutPage.storyParagraph3', {
                      defaultValue: isTr
                        ? 'Yaklaşımımızın merkezinde sadelik, erişilebilirlik ve güven yer alır. Amacımız, teknolojiyi yalnızca işlevsel değil; aynı zamanda kullanıcıya saygılı, şeffaf ve sürdürülebilir bir deneyime dönüştürmektir.'
                        : 'At the center of our approach are simplicity, accessibility, and trust. Our goal is to make technology not only functional, but also respectful, transparent, and sustainable for users.',
                    })}
                  </p>
                </div>

                <div className="mt-4 rounded-lg border border-border bg-secondary p-3.5 sm:p-4">
                  <p className="text-xs sm:text-sm font-medium italic text-text leading-relaxed">
                    {t('aboutPage.storyQuote', {
                      defaultValue: isTr
                        ? '“Çünkü inanıyoruz ki güçlü bir sosyal platform, yalnızca özellikleriyle değil; kullanıcılarına sunduğu güven, özgürlük ve değer duygusuyla öne çıkar.”'
                        : '“We believe a great social platform stands out not only with its features, but with the sense of trust, freedom, and empowerment it gives to every user.”',
                    })}
                  </p>
                  <p className="mt-2 text-xs font-semibold text-soft">
                    — {t('aboutPage.storyAuthor', { defaultValue: isTr ? 'Nest Social Ekibi' : 'Nest Social Team' })}
                  </p>
                </div>
              </div>

              {/* Highlights List Card */}
              <div className="flex flex-col justify-between rounded-lg border border-border bg-secondary p-4 sm:p-5 lg:col-span-5">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-text">
                    {t('aboutPage.highlightsTitle', { defaultValue: isTr ? 'Neden Nest Social?' : 'Why Nest Social?' })}
                  </h3>
                  <p className="mt-1 text-xs text-muted">
                    {isTr ? 'Geleneksel sosyal ağlardan ayıran temel ilkelerimiz:' : 'What sets us apart from traditional networks:'}
                  </p>

                  <ul className="mt-3.5 space-y-2.5 text-xs text-text">
                    {highlights.map((point, index) => (
                      <li key={index} className="flex items-start gap-2.5">
                        <span className="mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-primary !text-white">
                          <CheckIcon />
                        </span>
                        <span className="leading-snug">{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-5 border-t border-border pt-3.5">
                  <Link
                    to={`/${lang}/contact`}
                    className="flex items-center justify-between text-xs font-semibold text-primary hover:underline"
                  >
                    <span>{isTr ? 'Topluluk İlkeleri & İletişim' : 'Community Guidelines & Contact'}</span>
                    <ArrowRightIcon className="size-3" />
                  </Link>
                </div>
              </div>
            </div>
          </section>

          {/* Interactive Feature Explorer Tabs */}
          <section id="about-features" className="space-y-3 sm:space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-soft">
                {t('aboutPage.featuresTitle', { defaultValue: isTr ? 'Platform Vitrini' : 'Platform Features' })}
              </p>
              <h2 className="mt-1 text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-text" style={{ textWrap: 'balance' }}>
                {t('aboutPage.featuresSubtitle', {
                  defaultValue: isTr
                    ? 'Bağlantı Kurmak ve Paylaşmak İçin Eksiksiz Bir Ekosistem'
                    : 'A Complete Ecosystem to Connect, Create, and Belong',
                })}
              </h2>
            </div>

            {/* Horizontally scrollable feature tabs for smooth mobile interaction */}
            <div
              role="tablist"
              aria-label={t('aboutPage.featuresTitle', { defaultValue: isTr ? 'Platform Vitrini' : 'Platform Features' })}
              className="no-scrollbar flex items-center gap-2 overflow-x-auto overscroll-x-contain touch-pan-x pb-1 -mx-3.5 px-3.5 sm:mx-0 sm:px-0"
            >
              {featureTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeFeatureTab === tab.id}
                  onClick={() => setActiveFeatureTab(tab.id)}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition cursor-pointer min-h-[38px] ${
                    activeFeatureTab === tab.id
                      ? 'bg-primary !text-white'
                      : 'border border-border bg-card text-muted hover:bg-secondary hover:text-text'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Active Tab Panel */}
            <div role="tabpanel" className="rounded-lg border border-border bg-card p-4 sm:p-6 shadow-sm">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-12 md:items-center">
                <div className="space-y-3.5 md:col-span-7">
                  <div className="inline-flex items-center gap-2 rounded-md border border-border bg-secondary px-2.5 py-1 text-xs font-semibold text-text">
                    {activeTabContent.icon}
                    <span>{activeTabContent.label}</span>
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-text" style={{ textWrap: 'balance' }}>
                    {activeTabContent.title}
                  </h3>
                  <p className="text-xs sm:text-sm leading-6 text-muted" style={{ textWrap: 'pretty' }}>
                    {activeTabContent.desc}
                  </p>

                  <div className="pt-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-soft">
                      {isTr ? 'Öne Çıkan Özellikler:' : 'Key Capabilities:'}
                    </p>
                    <ul className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                      {activeTabContent.bulletPoints.map((item, idx) => (
                        <li key={idx} className="flex items-center gap-2 text-xs text-text">
                          <span className="size-1.5 shrink-0 rounded-full bg-primary" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="flex items-center justify-center rounded-lg border border-border bg-secondary p-4 sm:p-6 md:col-span-5">
                  <div className="text-center w-full max-w-xs">
                    <div className="mx-auto flex size-12 items-center justify-center rounded-lg border border-border bg-card text-primary shadow-xs">
                      {activeTabContent.icon}
                    </div>
                    <p className="mt-2.5 text-sm font-bold text-text">{activeTabContent.label}</p>
                    <p className="mt-1 text-xs text-muted">
                      {isTr ? 'Nest Social ile anında deneyimleyin.' : 'Experience directly inside Nest Social.'}
                    </p>
                    {activeTabContent.id === 'loop' && (
                      <Link
                        to={`/${lang}/loop`}
                        className="mt-3.5 inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 sm:py-1.5 text-xs font-semibold text-text hover:bg-secondary transition w-full sm:w-auto min-h-[38px] sm:min-h-0"
                      >
                        <span>{isTr ? 'Loop Videolarını Aç' : 'Watch Loops'}</span>
                        <ArrowRightIcon className="size-3" />
                      </Link>
                    )}
                    {activeTabContent.id === 'groups' && (
                      <Link
                        to={`/${lang}/groups`}
                        className="mt-3.5 inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 sm:py-1.5 text-xs font-semibold text-text hover:bg-secondary transition w-full sm:w-auto min-h-[38px] sm:min-h-0"
                      >
                        <span>{isTr ? 'Grupları Gör' : 'Browse Groups'}</span>
                        <ArrowRightIcon className="size-3" />
                      </Link>
                    )}
                    {activeTabContent.id === 'feed' && (
                      <Link
                        to={`/${lang}/`}
                        className="mt-3.5 inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 sm:py-1.5 text-xs font-semibold text-text hover:bg-secondary transition w-full sm:w-auto min-h-[38px] sm:min-h-0"
                      >
                        <span>{isTr ? 'Akışı Aç' : 'Go to Feed'}</span>
                        <ArrowRightIcon className="size-3" />
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Frequently Asked Questions (FAQ Accordion) */}
          <section id="about-faq" className="space-y-3 sm:space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-soft">
                {t('aboutPage.faqTitle', { defaultValue: isTr ? 'Merak Edilenler' : 'Frequently Asked Questions' })}
              </p>
              <h2 className="mt-1 text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-text" style={{ textWrap: 'balance' }}>
                {t('aboutPage.faqSubtitle', {
                  defaultValue: isTr
                    ? 'Sıkça Sorulan Sorular ve Cevaplar'
                    : 'Common Questions & Answers',
                })}
              </h2>
            </div>

            <div className="space-y-2.5 sm:space-y-3">
              {faqs.map((faq, index) => {
                const isOpen = openFaqIndex === index
                return (
                  <div
                    key={index}
                    className={`rounded-lg border transition-all duration-200 ${
                      isOpen
                        ? 'border-border bg-card shadow-xs'
                        : 'border-border-soft bg-card hover:border-border hover:bg-secondary/40'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                      className="flex min-h-[46px] sm:min-h-[50px] w-full items-center justify-between gap-3 p-3.5 sm:p-4 text-left transition cursor-pointer"
                      aria-expanded={isOpen}
                    >
                      <span className="text-xs sm:text-sm font-semibold text-text">{faq.q}</span>
                      <span
                        className={`shrink-0 text-muted transition-transform duration-200 ${
                          isOpen ? 'rotate-180 text-primary' : ''
                        }`}
                      >
                        <ChevronDownIcon />
                      </span>
                    </button>
                    {isOpen && (
                      <div className="border-t border-border-soft px-3.5 pb-3.5 pt-2.5 sm:px-4 sm:pb-4 text-xs sm:text-sm leading-relaxed text-muted">
                        <p style={{ textWrap: 'pretty' }}>{faq.a}</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          {/* Bottom Call to Action Card */}
          <section className="rounded-lg border border-border bg-card p-5 sm:p-7 md:p-8 text-center shadow-sm">
            <div className="max-w-xl mx-auto space-y-3">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-text" style={{ textWrap: 'balance' }}>
                {t('aboutPage.ctaTitle', {
                  defaultValue: isTr
                    ? 'Daha Özgür Bir Sosyal Ağ Deneyimine Hazır mısınız?'
                    : 'Ready to Experience a Better Social Web?',
                })}
              </h2>
              <p className="text-xs sm:text-sm leading-6 text-muted" style={{ textWrap: 'pretty' }}>
                {t('aboutPage.ctaSubtitle', {
                  defaultValue: isTr
                    ? 'Gizliliğinize saygı duyan, modern ve hızlı bir toplulukta yerinizi alın. Telefon numarası veya T.C. kimlik zorunluluğu yok.'
                    : 'Join thousands of creators and communities enjoying a freer, safer digital home with full privacy respect.',
                })}
              </p>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2 sm:gap-2.5 pt-2">
                {isAuthenticated ? (
                  <Link
                    to={`/${lang}/`}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold !text-white transition hover:bg-primary-hover w-full sm:w-auto"
                  >
                    <span>{isTr ? 'Akışa Devam Et' : 'Go to Feed'}</span>
                    <ArrowRightIcon />
                  </Link>
                ) : (
                  <>
                    <Link
                      to={`/${lang}/signup`}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold !text-white transition hover:bg-primary-hover w-full sm:w-auto"
                    >
                      <span>{t('aboutPage.ctaRegister', { defaultValue: isTr ? 'Ücretsiz Hesap Oluştur' : 'Create Free Account' })}</span>
                      <ArrowRightIcon />
                    </Link>
                    <Link
                      to={`/${lang}/login`}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-secondary px-5 py-2.5 text-sm font-semibold text-text transition hover:bg-secondary-hover w-full sm:w-auto"
                    >
                      <span>{t('aboutPage.ctaLogin', { defaultValue: isTr ? 'Giriş Yap' : 'Sign In' })}</span>
                    </Link>
                  </>
                )}
              </div>
            </div>
          </section>
        </div>
      </SocialLayout>
    </>
  )
}
