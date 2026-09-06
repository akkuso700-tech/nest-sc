import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import SocialLayout from '../layouts/SocialLayout.jsx'
import Seo from '../components/seo/Seo.jsx'
import { useAuth } from '../store/AuthContext.jsx'

function MailIcon({ className = 'size-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  )
}

function ShieldCheckIcon({ className = 'size-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}

function ClockIcon({ className = 'size-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
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

function SparklesIcon({ className = 'size-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="m12 3-1.9 5.1L5 10l5.1 1.9L12 17l1.9-5.1L19 10l-5.1-1.9L12 3z" />
      <path d="M19 17l-1 2.5L15.5 20.5 18 21.5 19 24l1-2.5 2.5-1-2.5-1L19 17z" />
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

function ChevronDownIcon({ className = 'size-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
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


function SendIcon({ className = 'size-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  )
}

function MessageSquareIcon({ className = 'size-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}

export default function ContactPage() {
  const { lang = 'tr' } = useParams()
  const { t } = useTranslation()
  const { user } = useAuth()
  const [openFaqIndex, setOpenFaqIndex] = useState(0)

  // Form State
  const [formData, setFormData] = useState({
    name: user?.username ? `@${user.username}` : '',
    email: user?.email || '',
    subject: 'support',
    message: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [formError, setFormError] = useState('')

  const isTr = lang === 'tr'

  const heroBadge = t('contactPage.badge', {
    defaultValue: isTr ? 'Nest Social • İletişim & Destek Merkezi' : 'Nest Social • Support & Help Center',
  })
  const heroTitle = t('contactPage.heroTitle', {
    defaultValue: isTr
      ? 'Bizimle İletişime Geçin'
      : 'Get in Touch with Our Team',
  })
  const heroSubtitle = t('contactPage.heroSubtitle', {
    defaultValue: isTr
      ? 'Kullanıcı deneyiminize ve geri bildirimlerinize değer veriyoruz. İster teknik destek, ister iş birliği veya genel sorularınız olsun; ekibimiz en kısa sürede size geri dönüş sağlar.'
      : 'We value your experience and feedback. Whether you need technical assistance, want to propose a partnership, or have a question, our dedicated team is here to help.',
  })

  const stats = [
    {
      id: 'response',
      badge: '< 24 Saat',
      title: t('contactPage.stats.responseTime', { defaultValue: isTr ? 'Yanıt Süresi' : 'Response Time' }),
      desc: t('contactPage.stats.responseTimeDesc', { defaultValue: isTr ? 'Hafta içi 24 saatte geri dönüş' : 'Replies within 24 hours' }),
      icon: <ClockIcon className="size-4 text-primary shrink-0" />,
    },
    {
      id: 'human',
      badge: 'Doğrudan Ekip',
      title: t('contactPage.stats.humanSupport', { defaultValue: isTr ? 'Doğrudan Ekip' : 'Human Support' }),
      desc: t('contactPage.stats.humanSupportDesc', { defaultValue: isTr ? 'Bot değil, gerçek insan desteği' : 'Direct help from real humans' }),
      icon: <UsersGroupIcon className="size-4 text-primary shrink-0" />,
    },
    {
      id: 'privacy',
      badge: '100% Güvenli',
      title: t('contactPage.stats.privacyGuaranteed', { defaultValue: isTr ? 'Gizlilik Güvencesi' : 'Privacy First' }),
      desc: t('contactPage.stats.privacyGuaranteedDesc', { defaultValue: isTr ? 'Mesajlarınız asla paylaşılmaz' : 'Zero tracking or data sharing' }),
      icon: <ShieldCheckIcon className="size-4 text-primary shrink-0" />,
    },
    {
      id: 'multilingual',
      badge: isTr ? '4 Dil' : lang === 'de' ? '4 Sprachen' : lang === 'es' ? '4 Idiomas' : '4 Langs',
      title: t('contactPage.stats.multilingual', { defaultValue: isTr ? 'Global Destek' : 'Global Support' }),
      desc: t('contactPage.stats.multilingualDesc', { defaultValue: isTr ? '4 farklı dilde tam destek' : 'Support in 4 languages' }),
      icon: <SparklesIcon className="size-4 text-primary shrink-0" />,
    },
  ]

  const rawFaqs = t('contactPage.faqs', { returnObjects: true })
  const faqs = Array.isArray(rawFaqs) && rawFaqs.length > 0
    ? rawFaqs
    : [
        {
          q: isTr ? 'Gönderdiğim mesaja ne kadar sürede yanıt alırım?' : 'How long does it take to get a response?',
          a: isTr
            ? 'Destek ekibimiz hafta içi gelen tüm talepleri inceler ve ortalama 24 saat içerisinde e-posta adresinize geri dönüş sağlar.'
            : 'Our support team typically reviews and replies to all messages within 24 hours on business days.',
        },
        {
          q: isTr ? 'Şifremi unuttum, nasıl sıfırlayabilirim?' : 'How can I reset my password?',
          a: isTr
            ? 'Giriş sayfasında yer alan "Şifremi Unuttum" bağlantısını kullanarak kayıtlı e-posta adresinize anında güvenli bir sıfırlama bağlantısı gönderebilirsiniz.'
            : 'You can request a password reset link at any time from the Sign In page using your registered email address.',
        },
        {
          q: isTr ? 'Profilimi gizli moda nasıl alabilirim?' : 'How can I switch my profile to Hidden or Private mode?',
          a: isTr
            ? 'Profil ayarlarınızdan veya Gizli Profil bölümünden hesabınızı tek tıkla gizliye alabilirsiniz. Yalnızca onayladığınız takipçiler içeriklerinizi görebilir.'
            : 'Navigate to your Profile or Settings and toggle "Hidden Profile". Only users you manually approve will be able to follow you and view your posts.',
        },
        {
          q: isTr ? 'Bir hata veya öneri bildirmek için ne yapmalıyım?' : 'How can I report a bug or suggest a feature?',
          a: isTr
            ? 'Aşağıdaki formdan "Hata Bildirimi / Öneri" konusunu seçerek detayları ve mümkünse adımları bizimle paylaşabilirsiniz.'
            : 'Select "Bug Report / Feedback" in the form below or email info@nest-sc.com directly with relevant details.',
        },
        {
          q: isTr ? 'Destek talebi için telefon numarası zorunlu mu?' : 'Do you require a phone number for support verification?',
          a: isTr
            ? 'Asla. Gizlilik odaklı yaklaşımımız gereği sizden asla telefon numarası veya kimlik kartı talep etmiyoruz. İletişimimiz güvenle e-posta üzerinden yürütülür.'
            : 'Never. In line with our Privacy-First philosophy, we never require your phone number or government ID for account or support matters.',
        },
      ]

  const handleSubmitForm = (e) => {
    e.preventDefault()
    setFormError('')

    if (!formData.name.trim() || !formData.email.trim() || !formData.message.trim()) {
      setFormError(t('contactPage.form.errorRequired', { defaultValue: isTr ? 'Lütfen zorunlu alanları eksiksiz doldurun.' : 'Please fill in all required fields.' }))
      return
    }

    if (!formData.email.includes('@') || !formData.email.includes('.')) {
      setFormError(t('contactPage.form.errorEmail', { defaultValue: isTr ? 'Lütfen geçerli bir e-posta adresi girin.' : 'Please enter a valid email address.' }))
      return
    }

    setIsSubmitting(true)

    setTimeout(() => {
      setIsSubmitting(false)
      setSubmitSuccess(true)
    }, 800)
  }

  const handleResetForm = () => {
    setFormData({
      name: user?.username ? `@${user.username}` : '',
      email: user?.email || '',
      subject: 'support',
      message: '',
    })
    setSubmitSuccess(false)
    setFormError('')
  }

  const rightRailContent = (
    <div className="space-y-4">
      {/* Table of Contents */}
      <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-soft">
          {t('contactPage.sidebar.tocTitle', { defaultValue: isTr ? 'Sayfa İçeriği' : 'On This Page' })}
        </p>
        <nav className="mt-3 flex flex-col space-y-2 text-xs font-medium text-muted">
          <button
            type="button"
            onClick={() => document.getElementById('contact-hero')?.scrollIntoView({ behavior: 'smooth' })}
            className="flex items-center gap-2 text-left transition hover:text-text cursor-pointer"
          >
            <span className="size-1.5 rounded-full bg-primary" />
            <span>{isTr ? 'Giriş & Genel Bakış' : 'Overview'}</span>
          </button>
          <button
            type="button"
            onClick={() => document.getElementById('contact-form')?.scrollIntoView({ behavior: 'smooth' })}
            className="flex items-center gap-2 text-left transition hover:text-text cursor-pointer"
          >
            <span className="size-1.5 rounded-full bg-primary" />
            <span>{isTr ? 'Mesaj Gönderme Formu' : 'Send a Message'}</span>
          </button>
          <button
            type="button"
            onClick={() => document.getElementById('contact-faq')?.scrollIntoView({ behavior: 'smooth' })}
            className="flex items-center gap-2 text-left transition hover:text-text cursor-pointer"
          >
            <span className="size-1.5 rounded-full bg-primary" />
            <span>{isTr ? 'Sıkça Sorulan Sorular' : 'Support FAQ'}</span>
          </button>
        </nav>

        <div className="mt-4 border-t border-border-soft pt-3">
          <p className="text-[11px] text-muted">
            {isTr ? 'Merkezi e-posta adresi:' : 'Central email address:'}
          </p>
          <a
            href="mailto:info@nest-sc.com"
            className="mt-1 flex items-center gap-1.5 font-medium text-primary hover:underline text-xs"
          >
            <MailIcon className="size-3.5" />
            <span>info@nest-sc.com</span>
          </a>
        </div>
      </div>

      {/* Support Hours Card */}
      <div className="rounded-lg border border-border bg-card p-4 text-xs shadow-sm">
        <div className="flex items-center gap-2 text-text font-semibold">
          <div className="inline-flex rounded-md border border-border bg-secondary p-1 text-primary">
            <ClockIcon className="size-3.5" />
          </div>
          <span>{t('contactPage.sidebar.hoursTitle', { defaultValue: isTr ? 'Destek Saatleri' : 'Support Hours' })}</span>
        </div>
        <p className="mt-2 text-muted leading-relaxed">
          {t('contactPage.sidebar.hours', { defaultValue: isTr ? 'Pazartesi – Cuma, 09:00 – 18:00 (TSİ)' : 'Monday – Friday, 09:00 – 18:00 (UTC+3)' })}
        </p>
        <p className="mt-1 font-medium text-text">
          {t('contactPage.sidebar.avgResponse', { defaultValue: isTr ? 'Ortalama yanıt: < 24 saat' : 'Average response: < 24 hours' })}
        </p>
        <div className="mt-3 border-t border-border-soft pt-2 text-[11px] text-muted">
          {t('contactPage.sidebar.securityNote', { defaultValue: isTr ? 'Acil güvenlik durumlarında lütfen konu satırına [ACİL] ekleyiniz.' : 'For urgent safety issues, please prefix subject with [URGENT].' })}
        </div>
      </div>

      {/* About Us Cross-link */}
      <div className="rounded-lg border border-border bg-card p-4 text-xs shadow-sm">
        <p className="font-semibold text-text">{isTr ? 'Nest Social Manifestosu' : 'Our Manifesto'}</p>
        <p className="mt-1 text-muted">
          {isTr ? 'Gizlilik ilkelerimizi ve vizyonumuzu Hakkımızda sayfasında keşfedin.' : 'Learn more about our vision on the About page.'}
        </p>
        <Link
          to={`/${lang}/about`}
          className="mt-3 inline-flex items-center gap-1.5 font-semibold text-primary hover:underline"
        >
          <span>{isTr ? 'Hakkımızda Sayfasına Git' : 'Visit About Page'}</span>
          <ArrowRightIcon className="size-3" />
        </Link>
      </div>
    </div>
  )

  return (
    <>
      <Seo
        title={`Nest Social · ${t('pages.contact', { defaultValue: isTr ? 'İletişim' : 'Contact' })}`}
        description={heroSubtitle}
      />

      <SocialLayout
        pageTitle={t('pages.contact', { defaultValue: isTr ? 'İletişim' : 'Contact' })}
        activeKey="contact"
        showDesktopPageHeader={false}
        desktopSidebarMode="drawer"
        rightAside={rightRailContent}
      >
        <div className="mx-auto max-w-5xl space-y-5 sm:space-y-6 md:space-y-8 px-3.5 sm:px-5 md:px-0 pb-8">
          {/* Hero Section */}
          <section
            id="contact-hero"
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
                <button
                  type="button"
                  onClick={() => document.getElementById('contact-form')?.scrollIntoView({ behavior: 'smooth' })}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold !text-white transition hover:bg-primary-hover w-full sm:w-auto cursor-pointer"
                >
                  <SendIcon />
                  <span>{isTr ? 'Mesaj Formunu Aç' : 'Write a Message'}</span>
                </button>

                <a
                  href="mailto:info@nest-sc.com"
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-semibold text-text transition hover:bg-secondary w-full sm:w-auto"
                >
                  <MailIcon />
                  <span>info@nest-sc.com</span>
                </a>

                <Link
                  to={`/${lang}/about`}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-text transition hover:bg-secondary w-full sm:w-auto"
                >
                  <span>{t('contactPage.ctaAbout', { defaultValue: isTr ? 'Hakkımızda' : 'About Us' })}</span>
                  <ArrowRightIcon />
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

          {/* Interactive Contact Form */}
          <section
            id="contact-form"
            className="rounded-lg border border-border bg-card p-4 sm:p-6 md:p-8 shadow-sm"
          >
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-md border border-border bg-secondary px-2.5 py-1 text-xs font-semibold text-text">
                <MessageSquareIcon className="size-4 text-primary" />
                <span>{t('contactPage.form.title', { defaultValue: isTr ? 'Doğrudan Mesaj Gönderin' : 'Send Us a Direct Message' })}</span>
              </div>

              <h2 className="mt-3 text-xl sm:text-2xl font-bold tracking-tight text-text" style={{ textWrap: 'balance' }}>
                {t('contactPage.form.title', { defaultValue: isTr ? 'Doğrudan Mesaj Gönderin' : 'Send Us a Direct Message' })}
              </h2>
              <p className="mt-1.5 text-xs sm:text-sm leading-6 text-muted">
                {t('contactPage.form.subtitle', { defaultValue: isTr ? 'Aşağıdaki formu doldurarak ekibimize anında mesaj iletebilirsiniz.' : 'Fill out the form below and we will respond as soon as possible.' })}
              </p>

              {submitSuccess ? (
                <div className="mt-6 rounded-lg border border-border bg-secondary p-5 text-center sm:text-left space-y-3">
                  <div className="inline-flex size-10 items-center justify-center rounded-full bg-primary text-white">
                    <CheckIcon className="size-5" />
                  </div>
                  <h3 className="text-base font-bold text-text">
                    {t('contactPage.form.successTitle', { defaultValue: isTr ? 'Mesajınız Başarıyla İletildi!' : 'Message Sent Successfully!' })}
                  </h3>
                  <p className="text-xs sm:text-sm text-muted leading-relaxed">
                    {t('contactPage.form.successDesc', { defaultValue: isTr ? 'Bizimle iletişime geçtiğiniz için teşekkür ederiz. Mesajınız ekibimize ulaştı, en kısa sürede e-posta adresinize geri dönüş yapacağız.' : 'Thank you for reaching out. We have received your message and will respond to your email shortly.' })}
                  </p>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleResetForm}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-4 py-2 text-xs font-semibold text-text hover:bg-secondary transition cursor-pointer"
                    >
                      <span>{t('contactPage.form.sendAnother', { defaultValue: isTr ? 'Yeni Bir Mesaj Gönder' : 'Send Another Message' })}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmitForm} className="mt-6 space-y-4">
                  {formError && (
                    <div className="rounded-lg border border-border bg-secondary p-3 text-xs font-medium text-primary">
                      {formError}
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {/* Name */}
                    <div>
                      <label htmlFor="contact-name" className="block text-xs font-medium text-text mb-1.5">
                        {t('contactPage.form.nameLabel', { defaultValue: isTr ? 'Adınız veya Kullanıcı Adınız' : 'Your Name or Username' })}
                        <span className="text-primary ml-0.5">*</span>
                      </label>
                      <input
                        id="contact-name"
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                        placeholder={t('contactPage.form.namePlaceholder', { defaultValue: isTr ? 'Örn: Ahmet veya @ahmet' : 'e.g. Alex or @alex' })}
                        className="w-full rounded-lg border border-border bg-card px-3.5 py-2.5 text-xs sm:text-sm text-text placeholder:text-soft outline-none focus:border-primary transition"
                      />
                    </div>

                    {/* Email */}
                    <div>
                      <label htmlFor="contact-email" className="block text-xs font-medium text-text mb-1.5">
                        {t('contactPage.form.emailLabel', { defaultValue: isTr ? 'E-posta Adresiniz' : 'Email Address' })}
                        <span className="text-primary ml-0.5">*</span>
                      </label>
                      <input
                        id="contact-email"
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                        placeholder={t('contactPage.form.emailPlaceholder', { defaultValue: 'you@example.com' })}
                        className="w-full rounded-lg border border-border bg-card px-3.5 py-2.5 text-xs sm:text-sm text-text placeholder:text-soft outline-none focus:border-primary transition"
                      />
                    </div>
                  </div>

                  {/* Subject */}
                  <div>
                    <label htmlFor="contact-subject" className="block text-xs font-medium text-text mb-1.5">
                      {t('contactPage.form.subjectLabel', { defaultValue: isTr ? 'Konu Başlığı' : 'Topic / Subject' })}
                    </label>
                    <select
                      id="contact-subject"
                      value={formData.subject}
                      onChange={(e) => setFormData((prev) => ({ ...prev, subject: e.target.value }))}
                      className="w-full rounded-lg border border-border bg-card px-3.5 py-2.5 text-xs sm:text-sm text-text outline-none focus:border-primary transition cursor-pointer"
                    >
                      <option value="support">{t('contactPage.form.subjects.support', { defaultValue: isTr ? 'Teknik Destek & Yardım' : 'Technical Support & Help' })}</option>
                      <option value="account">{t('contactPage.form.subjects.account', { defaultValue: isTr ? 'Hesap & Gizlilik Talebi' : 'Account & Privacy Request' })}</option>
                      <option value="bug">{t('contactPage.form.subjects.bug', { defaultValue: isTr ? 'Hata Bildirimi / Öneri' : 'Bug Report / Feedback' })}</option>
                      <option value="partnership">{t('contactPage.form.subjects.partnership', { defaultValue: isTr ? 'İş Birliği & Sponsorluk' : 'Business & Partnerships' })}</option>
                      <option value="other">{t('contactPage.form.subjects.other', { defaultValue: isTr ? 'Diğer Konular' : 'Other Inquiry' })}</option>
                    </select>
                  </div>

                  {/* Message */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="contact-message" className="block text-xs font-medium text-text">
                        {t('contactPage.form.messageLabel', { defaultValue: isTr ? 'Mesajınız' : 'Your Message' })}
                        <span className="text-primary ml-0.5">*</span>
                      </label>
                      <span className="text-[11px] text-soft">
                        {formData.message.length} {t('contactPage.form.charCount', { defaultValue: isTr ? 'karakter' : 'chars' })}
                      </span>
                    </div>
                    <textarea
                      id="contact-message"
                      required
                      rows={5}
                      value={formData.message}
                      onChange={(e) => setFormData((prev) => ({ ...prev, message: e.target.value }))}
                      placeholder={t('contactPage.form.messagePlaceholder', { defaultValue: isTr ? 'Sorunuzu veya iletmek istediğiniz detayları buraya yazın...' : 'Describe your question or request in detail...' })}
                      className="w-full rounded-lg border border-border bg-card px-3.5 py-2.5 text-xs sm:text-sm text-text placeholder:text-soft outline-none focus:border-primary transition resize-y min-h-[110px]"
                    />
                  </div>

                  {/* Submit Button */}
                  <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold !text-white transition hover:bg-primary-hover disabled:opacity-60 cursor-pointer w-full sm:w-auto min-h-[42px]"
                    >
                      {isSubmitting ? (
                        <span>{t('contactPage.form.submittingBtn', { defaultValue: isTr ? 'Gönderiliyor...' : 'Sending...' })}</span>
                      ) : (
                        <>
                          <SendIcon />
                          <span>{t('contactPage.form.submitBtn', { defaultValue: isTr ? 'Mesajı Gönder' : 'Send Message' })}</span>
                        </>
                      )}
                    </button>

                    <p className="text-[11px] text-muted">
                      {isTr
                        ? 'Mesajınız doğrudan destek panelimize aktarılacaktır.'
                        : 'Your message will be sent directly to our support queue.'}
                    </p>
                  </div>
                </form>
              )}
            </div>
          </section>

          {/* FAQ Section - Soft Borders Accordion */}
          <section id="contact-faq" className="space-y-3 sm:space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-soft">
                {t('contactPage.faqTitle', { defaultValue: isTr ? 'İletişim Öncesi Merak Edilenler' : 'Frequently Asked Support Questions' })}
              </p>
              <h2 className="mt-1 text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-text" style={{ textWrap: 'balance' }}>
                {t('contactPage.faqSubtitle', {
                  defaultValue: isTr
                    ? 'Sıkça Sorulan Destek Soruları ve Hızlı Yanıtlar'
                    : 'Quick Answers Before Reaching Out',
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
                {t('contactPage.ctaTitle', {
                  defaultValue: isTr
                    ? 'Vizyonumuz ve İlkelerimiz Hakkında Bilgi Alın'
                    : 'Have Questions About Our Vision?',
                })}
              </h2>
              <p className="text-xs sm:text-sm leading-6 text-muted" style={{ textWrap: 'pretty' }}>
                {t('contactPage.ctaSubtitle', {
                  defaultValue: isTr
                    ? 'Nest Social mimarisi, topluluk manifestosu ve temel değerlerimizi keşfedin.'
                    : 'Learn more about our architecture, core values, and community manifesto.',
                })}
              </p>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2 sm:gap-2.5 pt-2">
                <Link
                  to={`/${lang}/about`}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold !text-white transition hover:bg-primary-hover w-full sm:w-auto"
                >
                  <span>{t('contactPage.ctaAbout', { defaultValue: isTr ? 'Hakkımızda Sayfası' : 'About Us' })}</span>
                  <ArrowRightIcon />
                </Link>
                <Link
                  to={`/${lang}/`}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-secondary px-5 py-2.5 text-sm font-semibold text-text transition hover:bg-secondary-hover w-full sm:w-auto"
                >
                  <span>{t('contactPage.ctaExplore', { defaultValue: isTr ? 'Akışa Göz At' : 'Explore Feed' })}</span>
                </Link>
              </div>
            </div>
          </section>
        </div>
      </SocialLayout>
    </>
  )
}
