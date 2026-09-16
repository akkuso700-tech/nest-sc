import { useState, useId } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import SocialLayout from '../layouts/SocialLayout.jsx'
import Seo from '../components/seo/Seo.jsx'
import { useAuth } from '../store/AuthContext.jsx'

function CheckIcon({ className = 'size-3.5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
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

function DownloadIcon({ className = 'size-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
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

export default function AdsPage() {
  const { lang = 'tr' } = useParams()
  const { t } = useTranslation()
  const { user } = useAuth()
  const isTr = lang === 'tr'

  // Accessible unique IDs for form elements
  const nameId = useId()
  const emailId = useId()
  const companyId = useId()
  const phoneId = useId()
  const budgetId = useId()
  const messageId = useId()

  // State: FAQ Accordion
  const [openFaqIndex, setOpenFaqIndex] = useState(0)

  // State: Lead Form
  const [formData, setFormData] = useState({
    name: user?.username ? `@${user.username}` : '',
    email: user?.email || '',
    company: '',
    phone: '',
    budget: '10k-25k',
    formats: ['feed'],
    message: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [formError, setFormError] = useState('')
  const [leadRefCode, setLeadRefCode] = useState('')

  // Text constants
  const pageTitle = t('adsPage.pageTitle', { defaultValue: isTr ? 'Reklam Verin & Medya Kiti' : 'Advertise & Media Kit' })
  const seoDescription = isTr
    ? 'Nest Social reklam talebi, sponsorluk ve kurumsal marka iş birliği başvuru sayfası.'
    : 'Nest Social advertising inquiries and brand sponsorship proposals.'

  // Available format options for form selection
  const adFormatOptions = [
    { id: 'feed', title: isTr ? 'Feed İçi Gönderi' : 'In-Feed Post' },
    { id: 'loop', title: isTr ? 'Loop Dikey Video' : 'Loop Vertical Video' },
    { id: 'banner', title: isTr ? 'Display Banner' : 'Display Banner' },
    { id: 'trend', title: isTr ? 'Gündem / Trend' : 'Trend Takeover' },
  ]

  // FAQs
  const faqs = [
    {
      q: isTr
        ? 'Reklam başvurum ne kadar sürede onaylanır ve yayına alınır?'
        : 'How long does campaign approval and deployment take?',
      a: isTr
        ? 'Talebiniz bize ulaştıktan sonra 24 saat içinde teklif ve teknik detayları paylaşıyoruz. Reklam materyalleri onaylandığında kampanyanız genellikle aynı iş günü içinde yayına alınır.'
        : 'Once submitted, our team replies within 24 hours with custom specs. Approved creatives can go live within the same business day.',
    },
    {
      q: isTr
        ? 'Hangi reklam ve içerik türlerine izin verilmemektedir?'
        : 'Which ad categories are prohibited on Nest Social?',
      a: isTr
        ? 'Kullanıcı güvenliği önceliğimizdir. Yasa dışı bahis, yanıltıcı sağlık/ilaç ürünleri, ponzi/sahte finansal yatırımlar, müstehcen içerikler ve agresif açılır pencereler (pop-up) kesinlikle yasaktır.'
        : 'We strictly disallow illegal gambling, misleading medical claims, crypto scams, adult content, and deceptive malware/pop-up schemes.',
    },
    {
      q: isTr
        ? 'Kampanya performansını nasıl takip edebilirim?'
        : 'How do I monitor my ad performance and reporting?',
      a: isTr
        ? 'Tüm kampanyalarımız için gösterim, tekil kullanıcı erişimi, tıklama sayısı ve tıklama oranı (CTR) metrikleri anlık olarak kaydedilir. Kampanya bitiminde veya haftalık olarak detaylı analitik raporu tarafınıza iletilir.'
        : 'We track total impressions, unique reach, clicks, and CTR in real time. Advertisers receive detailed performance reports upon campaign completion.',
    },
    {
      q: isTr
        ? 'Kendi görsellerimizi veya dikey videolarımızı kullanabilir miyiz?'
        : 'Can we use our existing media creatives and video assets?',
      a: isTr
        ? 'Evet! Sağladığımız teknik şartnameye (WebP/PNG görsel veya 9:16 MP4 dikey video) uygun her türlü özgün materyali kullanabilirsiniz. Dilerseniz tasarım ekibimiz optimizasyon konusunda yardımcı olmaktadır.'
        : 'Yes. You can supply your own images and vertical MP4 videos conforming to our creative guidelines. Our creative team can also assist with format adaptations.',
    },
    {
      q: isTr
        ? 'Fatura ve kurumsal ödeme seçenekleri nelerdir?'
        : 'What are the invoicing and payment terms?',
      a: isTr
        ? 'Tüm hizmetlerimiz kurumsal faturalandırılmaktadır. Havale/EFT ve kurumsal kredi kartı ile güvenli ödeme seçenekleri sunulmaktadır.'
        : 'We provide compliant corporate invoicing. Payments can be settled via corporate bank transfer or major cards.',
    },
  ]

  // Handlers
  const handleFormatCheckbox = (fmtId) => {
    setFormData((prev) => {
      const exists = prev.formats.includes(fmtId)
      const next = exists ? prev.formats.filter((f) => f !== fmtId) : [...prev.formats, fmtId]
      return { ...prev, formats: next.length ? next : [fmtId] }
    })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    setFormError('')

    if (!formData.name.trim() || !formData.email.trim() || !formData.company.trim()) {
      setFormError(isTr ? 'Lütfen zorunlu alanları (İsim, E-posta, Şirket) doldurunuz.' : 'Please fill in required fields (Name, Email, Company).')
      return
    }

    if (!formData.email.includes('@') || !formData.email.includes('.')) {
      setFormError(isTr ? 'Lütfen geçerli bir kurumsal e-posta adresi giriniz.' : 'Please provide a valid corporate email.')
      return
    }

    setIsSubmitting(true)
    const ref = `AD-${Date.now().toString().slice(-6)}`

    setTimeout(() => {
      setIsSubmitting(false)
      setLeadRefCode(ref)
      setSubmitSuccess(true)
    }, 750)
  }

  const handleDownloadMediaKit = () => {
    const summaryText = `=====================================================
NEST SOCIAL - RESMİ MEDYA KİTİ & REKLAM ŞARTNAMESİ
=====================================================

1. PLATFORM GENEL BAKIŞ
- Aylık Aktif Kullanıcı (MAU): 520,000+
- Aylık Sayfa Gösterimi: 4,900,000+
- Ortalama Oturum Süresi: 8.6 Dakika
- Ortalama Etkileşim (CTR): %3.4

2. REKLAM BİRİMLERİ VE ÖLÇÜLER
- Feed İçi Gönderi: 1200x675px veya 1080x1080px (PNG/WebP), maks 2MB
- Loop Dikey Video: 1080x1920px (9:16 MP4), 15-30 sn, maks 25MB
- Sidebar Banner: 300x250px veya 300x600px sticky
- Header Masthead: 728x90px (Masaüstü) / 320x100px (Mobil)

3. İLETİŞİM & REKLAM SATIŞ
- E-posta: ads@nest-sc.com / info@nest-sc.com
- Web: https://nest-sc.com/${lang}/ads
=====================================================`

    const blob = new Blob([summaryText], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `Nest-Social-Media-Kit-${lang}.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <Seo
        title={`Nest Social · ${pageTitle}`}
        description={seoDescription}
      />

      <SocialLayout
        pageTitle={pageTitle}
        activeKey="ads"
        showDesktopPageHeader={false}
        desktopSidebarMode="drawer"
        hideMobileBottomBar={true}
        hideMobileCreateButton={true}
      >
        <div className="mx-auto max-w-4xl py-0 sm:py-2 px-0 space-y-4 sm:space-y-6 md:space-y-8 pb-12">
          {/* 1. LEAD GENERATION FORM */}
          <section id="ads-lead-form" className="border-0 sm:border rounded-none sm:rounded-2xl border-border bg-card p-4 sm:p-7 md:p-8 shadow-none sm:shadow-sm">
            <div className="max-w-2xl mx-auto">
              <div className="text-center mb-6">
                <h1 className="text-md sm:text-2xl font-bold tracking-tight text-text">
                  {isTr ? 'Hemen Teklif Alın & Kampanyanızı Başlatın' : 'Get a Proposal & Start Your Campaign'}
                </h1>
              </div>

              {submitSuccess ? (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center space-y-3">
                  <div className="size-12 mx-auto rounded-full bg-emerald-500 text-white flex items-center justify-center">
                    <CheckIcon className="size-6" />
                  </div>
                  <h2 className="text-base font-bold text-text">
                    {isTr ? 'Talebiniz Başarıyla Alındı!' : 'Request Received Successfully!'}
                  </h2>
                  <p className="text-xs text-muted max-w-md mx-auto leading-relaxed">
                    {isTr
                      ? `Talebiniz ekibimize iletilmiştir. Referans Kodunuz: ${leadRefCode}. Uzman ekibimiz 24 saat içinde kurumsal e-posta adresinize özel medya planını iletecektir.`
                      : `Your inquiry has been logged. Reference: ${leadRefCode}. Our sales lead will contact your corporate email within 24 hours.`}
                  </p>
                  <div className="pt-2 flex justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => setSubmitSuccess(false)}
                      className="rounded-lg border border-border bg-card px-4 py-2 text-xs font-semibold text-text hover:bg-secondary cursor-pointer"
                    >
                      {isTr ? 'Yeni Bir Talep Gönder' : 'Submit Another Request'}
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadMediaKit}
                      className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold !text-white hover:bg-primary-hover cursor-pointer"
                    >
                      {isTr ? 'Medya Kitini İndir' : 'Download Media Kit'}
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {formError && (
                    <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400 font-medium">
                      {formError}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Name */}
                    <div className="space-y-1.5">
                      <label htmlFor={nameId} className="text-xs font-semibold text-text">
                        {isTr ? 'Ad Soyad *' : 'Full Name *'}
                      </label>
                      <input
                        id={nameId}
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder={isTr ? 'Örn. Ahmet Yılmaz' : 'e.g. Jane Doe'}
                        className="w-full rounded-lg border border-border bg-secondary/50 px-3.5 py-2 text-xs text-text placeholder:text-muted focus:border-primary focus:outline-hidden"
                      />
                    </div>

                    {/* Email */}
                    <div className="space-y-1.5">
                      <label htmlFor={emailId} className="text-xs font-semibold text-text">
                        {isTr ? 'Kurumsal E-posta *' : 'Work Email *'}
                      </label>
                      <input
                        id={emailId}
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder={isTr ? 'adiniz@sirketiniz.com' : 'you@company.com'}
                        className="w-full rounded-lg border border-border bg-secondary/50 px-3.5 py-2 text-xs text-text placeholder:text-muted focus:border-primary focus:outline-hidden"
                      />
                    </div>

                    {/* Company */}
                    <div className="space-y-1.5">
                      <label htmlFor={companyId} className="text-xs font-semibold text-text">
                        {isTr ? 'Şirket / Marka Adı *' : 'Company / Brand *'}
                      </label>
                      <input
                        id={companyId}
                        type="text"
                        required
                        value={formData.company}
                        onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                        placeholder={isTr ? 'Şirket Adınız' : 'Company Name'}
                        className="w-full rounded-lg border border-border bg-secondary/50 px-3.5 py-2 text-xs text-text placeholder:text-muted focus:border-primary focus:outline-hidden"
                      />
                    </div>

                    {/* Phone */}
                    <div className="space-y-1.5">
                      <label htmlFor={phoneId} className="text-xs font-semibold text-text">
                        {isTr ? 'Telefon Numarası (İsteğe Bağlı)' : 'Phone Number (Optional)'}
                      </label>
                      <input
                        id={phoneId}
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="+90 (5xx) xxx xx xx"
                        className="w-full rounded-lg border border-border bg-secondary/50 px-3.5 py-2 text-xs text-text placeholder:text-muted focus:border-primary focus:outline-hidden"
                      />
                    </div>
                  </div>

                  {/* Budget Dropdown */}
                  <div className="space-y-1.5">
                    <label htmlFor={budgetId} className="text-xs font-semibold text-text">
                      {isTr ? 'Tahmini Kampanya Bütçesi' : 'Estimated Campaign Budget'}
                    </label>
                    <select
                      id={budgetId}
                      value={formData.budget}
                      onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                      className="w-full rounded-lg border border-border bg-secondary/50 px-3 py-2 text-xs text-text focus:border-primary focus:outline-hidden"
                    >
                      <option value="under-10k">{isTr ? '10.000 ₺ altı (Başlangıç)' : 'Under $500 (Pilot)'}</option>
                      <option value="10k-25k">{isTr ? '10.000 ₺ – 25.000 ₺ (Standart)' : '$500 – $1,500'}</option>
                      <option value="25k-50k">{isTr ? '25.000 ₺ – 50.000 ₺ (Büyüme)' : '$1,500 – $3,000'}</option>
                      <option value="50k-plus">{isTr ? '50.000 ₺ ve üzeri (Geniş Çaplı / Özel)' : '$3,000+ (Full Takeover)'}</option>
                    </select>
                  </div>

                  {/* Preferred Formats Checkboxes */}
                  <div className="space-y-1.5">
                    <span className="text-xs font-semibold text-text block">
                      {isTr ? 'İlgilendiğiniz Reklam Formatları' : 'Desired Ad Formats'}
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                      {adFormatOptions.map((f) => {
                        const checked = formData.formats.includes(f.id)
                        return (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => handleFormatCheckbox(f.id)}
                            className={`flex items-center gap-2 rounded-lg border p-2 text-xs transition cursor-pointer ${
                              checked
                                ? 'border-primary bg-primary/10 text-primary font-semibold'
                                : 'border-border bg-secondary/30 text-muted'
                            }`}
                          >
                            <span className={`size-3.5 rounded border flex items-center justify-center shrink-0 ${
                              checked ? 'border-primary bg-primary text-white' : 'border-border'
                            }`}>
                              {checked && <CheckIcon className="size-2.5" />}
                            </span>
                            <span className="truncate">{f.title}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Campaign Message / Goals */}
                  <div className="space-y-1.5">
                    <label htmlFor={messageId} className="text-xs font-semibold text-text">
                      {isTr ? 'Kampanya Hedefiniz ve Notlarınız' : 'Campaign Goals / Details'}
                    </label>
                    <textarea
                      id={messageId}
                      rows="3"
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      placeholder={isTr ? 'Hedef kitleniz, planlanan kampanya tarihi veya sormak istedikleriniz...' : 'Describe your goals, timing, or target audience...'}
                      className="w-full rounded-lg border border-border bg-secondary/50 p-3 text-xs text-text placeholder:text-muted focus:border-primary focus:outline-hidden resize-none"
                    />
                  </div>

                  {/* Submit Button */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 text-xs font-semibold !text-white transition hover:bg-primary-hover shadow-sm disabled:opacity-60 cursor-pointer"
                    >
                      {isSubmitting ? (
                        <>
                          <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                          <span>{isTr ? 'Talebiniz Gönderiliyor...' : 'Submitting Request...'}</span>
                        </>
                      ) : (
                        <>
                          <SendIcon className="size-3.5" />
                          <span>{isTr ? 'Teklif Talebini İlet' : 'Submit Proposal Request'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </section>

          {/* 2. FREQUENTLY ASKED QUESTIONS */}
          <section id="ads-faq" className="border-0 sm:border rounded-none sm:rounded-2xl border-border bg-card p-4 sm:p-7 shadow-none sm:shadow-sm space-y-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-text">
                {isTr ? 'Sıkça Sorulan Sorular' : 'Got Questions? We Have Answers'}
              </h2>
            </div>

            <div className="divide-y divide-border border-t border-border mt-2">
              {faqs.map((faq, index) => {
                const isOpen = openFaqIndex === index
                return (
                  <div key={index} className="py-3.5">
                    <button
                      type="button"
                      onClick={() => setOpenFaqIndex(isOpen ? -1 : index)}
                      className="flex w-full items-center justify-between gap-4 text-left font-semibold text-xs sm:text-sm text-text transition hover:text-primary cursor-pointer"
                    >
                      <span>{faq.q}</span>
                      <span className={`rounded-md bg-secondary p-1 text-muted transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''}`}>
                        <ChevronDownIcon className="size-3.5" />
                      </span>
                    </button>
                    {isOpen && (
                      <p className="mt-2 text-xs leading-relaxed text-muted pr-6 animate-in fade-in duration-200">
                        {faq.a}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          {/* 3. FOOTER CALL TO ACTION BANNER */}
          <section className="border-0 sm:border rounded-none sm:rounded-2xl border-border bg-card p-5 sm:p-8 text-center shadow-none sm:shadow-sm">
            <div className="max-w-xl mx-auto space-y-3">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-text">
                {isTr ? 'Markanızı Bugün Büyütmeye Başlayın' : 'Ready to Elevate Your Brand?'}
              </h2>
              <p className="text-xs sm:text-sm text-muted leading-relaxed">
                {isTr
                  ? 'Büyüyen ve özgür içerik üreten canlı topluluğumuzla markanızı tanıştırın. İlk kampanyanızda uzman desteğimizden ücretsiz faydalanın.'
                  : 'Join leading brands reaching high-value audiences on Nest Social with high-engagement native formats.'}
              </p>
              <div className="flex flex-wrap justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => document.getElementById('ads-lead-form')?.scrollIntoView({ behavior: 'smooth' })}
                  className="rounded-lg bg-primary px-5 py-2.5 text-xs font-semibold !text-white transition hover:bg-primary-hover cursor-pointer"
                >
                  {isTr ? 'Özel Teklif İsteyin' : 'Request a Custom Plan'}
                </button>
                <Link
                  to={`/${lang}/contact`}
                  className="rounded-lg border border-border bg-secondary px-5 py-2.5 text-xs font-semibold text-text transition hover:bg-secondary-hover"
                >
                  {isTr ? 'İletişim Sayfası' : 'Contact Support'}
                </Link>
              </div>
            </div>
          </section>
        </div>
      </SocialLayout>
    </>
  )
}
