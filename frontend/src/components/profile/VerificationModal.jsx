import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import VerifiedBadge from '../common/VerifiedBadge.jsx'
import {
  createMyVerificationRequest,
  getMyVerificationRequest,
  updateMyVerificationRequest,
  withdrawMyVerificationRequest,
} from '../../services/usersService.js'

export const categories = [
  ['individual', 'Bireysel', '👤', 'Kişisel profil ve içerik üretimi'],
  ['creator', 'İçerik Üreticisi', '✨', 'Sosyal medya üreticileri, fenomenler ve sanatçılar'],
  ['business', 'İşletme', '🏢', 'Şirketler, ticari markalar ve mağazalar'],
  ['organization', 'Kurum & STK', '🏛️', 'Vakıflar, dernekler ve sivil toplum kuruluşları'],
  ['public_figure', 'Kamuya Mal Olmuş Kişi', '⭐', 'Gazeteciler, kamu figürleri ve sanatçılar'],
]

const countryList = [
  { code: 'TR', name: 'Türkiye', dialCode: '+90', flag: '🇹🇷', placeholder: '(5XX) XXX XX XX' },
  { code: 'US', name: 'Amerika Birleşik Devletleri', dialCode: '+1', flag: '🇺🇸', placeholder: '(XXX) XXX-XXXX' },
  { code: 'GB', name: 'Birleşik Krallık', dialCode: '+44', flag: '🇬🇧', placeholder: 'XXXX XXXXXX' },
  { code: 'DE', name: 'Almanya', dialCode: '+49', flag: '🇩🇪', placeholder: 'XXXX XXXXXXX' },
  { code: 'FR', name: 'Fransa', dialCode: '+33', flag: '🇫🇷', placeholder: 'X XX XX XX XX' },
  { code: 'NL', name: 'Hollanda', dialCode: '+31', flag: '🇳🇱', placeholder: 'XX XXXXXXXX' },
  { code: 'AZ', name: 'Azerbaycan', dialCode: '+994', flag: '🇦🇿', placeholder: 'XX XXX XX XX' },
  { code: 'RU', name: 'Rusya', dialCode: '+7', flag: '🇷🇺', placeholder: '(XXX) XXX-XX-XX' },
  { code: 'UA', name: 'Ukrayna', dialCode: '+380', flag: '🇺🇦', placeholder: 'XX XXX XXXX' },
  { code: 'SA', name: 'Suudi Arabistan', dialCode: '+966', flag: '🇸🇦', placeholder: 'XX XXX XXXX' },
  { code: 'AE', name: 'Birleşik Arap Emirlikleri', dialCode: '+971', flag: '🇦🇪', placeholder: 'XX XXX XXXX' },
  { code: 'QA', name: 'Katar', dialCode: '+974', flag: '🇶🇦', placeholder: 'XXXX XXXX' },
  { code: 'KW', name: 'Kuveyt', dialCode: '+965', flag: '🇰🇼', placeholder: 'XXXX XXXX' },
  { code: 'KZ', name: 'Kazakistan', dialCode: '+7', flag: '🇰🇿', placeholder: '(XXX) XXX-XX-XX' },
  { code: 'UZ', name: 'Özbekistan', dialCode: '+998', flag: 'UZ', placeholder: 'XX XXX XX XX' },
  { code: 'IT', name: 'İtalya', dialCode: '+39', flag: '🇮🇹', placeholder: 'XXX XXXXXXX' },
  { code: 'ES', name: 'İspanya', dialCode: '+34', flag: '🇪🇸', placeholder: 'XXX XX XX XX' },
  { code: 'CH', name: 'İsviçre', dialCode: '+41', flag: '🇨🇭', placeholder: 'XX XXX XX XX' },
  { code: 'AT', name: 'Avusturya', dialCode: '+43', flag: '🇦🇹', placeholder: 'XXX XXXXXXX' },
  { code: 'BE', name: 'Belçika', dialCode: '+32', flag: '🇧🇪', placeholder: 'XXX XX XX XX' },
  { code: 'SE', name: 'İsveç', dialCode: '+46', flag: '🇸🇪', placeholder: 'XX XXX XXXX' },
  { code: 'NO', name: 'Norveç', dialCode: '+47', flag: '🇳🇴', placeholder: 'XXX XX XXX' },
  { code: 'DK', name: 'Danimarka', dialCode: '+45', flag: '🇩🇰', placeholder: 'XX XX XX XX' },
  { code: 'PL', name: 'Polonya', dialCode: '+48', flag: '🇵🇱', placeholder: 'XXX XXX XXX' },
  { code: 'CA', name: 'Kanada', dialCode: '+1', flag: '🇨🇦', placeholder: '(XXX) XXX-XXXX' },
  { code: 'AU', name: 'Avustralya', dialCode: '+61', flag: '🇦🇺', placeholder: 'XXXX XXX XXX' },
  { code: 'JP', name: 'Japonya', dialCode: '+81', flag: '🇯🇵', placeholder: 'XX XXXX XXXX' },
  { code: 'KR', name: 'Güney Kore', dialCode: '+82', flag: '🇰🇷', placeholder: 'XX XXXX XXXX' },
  { code: 'BR', name: 'Brezilya', dialCode: '+55', flag: '🇧🇷', placeholder: 'XX XXXXX-XXXX' },
  { code: 'IN', name: 'Hindistan', dialCode: '+91', flag: '🇮🇳', placeholder: 'XXXXX XXXXX' },
  { code: 'CN', name: 'Çin', dialCode: '+86', flag: '🇨🇳', placeholder: 'XXX XXXX XXXX' },
  { code: 'GR', name: 'Yunanistan', dialCode: '+30', flag: '🇬🇷', placeholder: 'XXX XXXXXXX' },
]

const subscriptionPlans = [
  {
    id: 'plus',
    name: 'Plus',
    fullName: 'Nest Plus',
    price: 99,
    period: 'ay',
    badge: 'Popüler',
    multiplierText: '2X Gösterim',
    description: 'Etkileşimini ve profil görünürlüğünü katlamak isteyen üreticiler için.',
    features: [
      { text: '2X Daha Fazla Gösterim', desc: 'Akışta ve aramalarda 2 kat daha fazla öne çıkma' },
      { text: 'Mavi Doğrulama Rozeti', desc: 'Profilinizde resmi onaylı mavi rozet' },
      { text: 'Üretici Stüdyosu Temel', desc: 'Kitle ve etkileşim analizlerine tam erişim' },
      { text: '100 Hediye Jetonu', desc: 'Topluluk Bahşişleri & Hediyeler için aylık jeton' },
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    fullName: 'Nest Pro',
    price: 249,
    period: 'ay',
    badge: 'Maksimum Güç',
    multiplierText: '5X Gösterim',
    description: 'Maksimum keşfet desteği, zirve sıralama ve VIP ayrıcalıklar.',
    features: [
      { text: '5X Daha Fazla Gösterim', desc: 'En üst seviye keşfet desteği ve arama önceliği' },
      { text: 'Mavi Rozet & VIP Öncelik', desc: 'Hızlı başvuru onayı ve VIP profil koruması' },
      { text: 'Üretici Stüdyosu Tam Erişim', desc: 'Gelişmiş gelir analitiği ve kitle raporları' },
      { text: '300 Hediye Jetonu', desc: 'Topluluk Bahşişleri & Hediyeler için ekstra jeton' },
    ],
  },
]

const planLabels = {
  pro: 'Pro (Aylık)',
  plus: 'Plus (Aylık)',
  monthly: 'Aylık',
  yearly: 'Yıllık',
}

const statusCopy = {
  pending: ['Başvurunuz ve ödemeniz alındı', 'Başvurunuz ve aylık aboneliğiniz yönetim ekibinin inceleme kuyruğunda.'],
  in_review: ['Başvurunuz inceleniyor', 'Bir yönetici verdiğiniz bilgileri değerlendiriyor.'],
  needs_info: ['Ek bilgi gerekiyor', 'İstenen bilgileri ekleyip başvurunuzu yeniden gönderin.'],
  approved: ['Profiliniz onaylandı', 'Doğrulama rozetiniz ve aboneliğiniz profilinizde aktif duruma getirildi.'],
  rejected: ['Başvurunuz reddedildi', 'Tekrar başvuru tarihi geldiğinde yeni başvuru oluşturabilirsiniz.'],
  revoked: ['Profil doğrulaması kaldırıldı', 'Yeni bir inceleme için tekrar başvurabilirsiniz.'],
  withdrawn: ['Başvuru geri çekildi', 'Hazır olduğunuzda yeniden başvurabilirsiniz.'],
}

function requestToForm(request, user) {
  return {
    category: request?.category || user?.verification?.category || 'individual',
    phoneCountryCode: request?.phoneCountryCode || '+90',
    phoneNumber: request?.phoneNumber || '',
    termsAccepted: false,
    plan: request?.payment?.plan === 'pro' ? 'pro' : 'plus',
    cardHolder: '',
    cardNumber: '',
    cardExpiry: '',
    cardCvc: '',
  }
}

function formatCardNumber(value) {
  const digits = value.replace(/\D/g, '').slice(0, 16)
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ')
}

function formatExpiry(value) {
  const digits = value.replace(/\D/g, '').slice(0, 4)
  if (digits.length >= 3) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`
  }
  return digits
}

function formatPhoneInput(value, dialCode) {
  const digits = value.replace(/\D/g, '')
  if (dialCode === '+90') {
    if (digits.length === 0) return ''
    if (digits.length <= 3) return `(${digits}`
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
    if (digits.length <= 8) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)} ${digits.slice(6)}`
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)} ${digits.slice(6, 8)} ${digits.slice(8, 10)}`
  }
  if (digits.length > 3 && digits.length <= 7) {
    return `${digits.slice(0, 3)} ${digits.slice(3)}`
  }
  if (digits.length > 7) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 12)}`
  }
  return digits
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5" aria-hidden="true">
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  )
}

function ShieldCheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}

export function ChevronDownIcon({ className = 'size-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

export function CheckIcon({ className = 'size-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={className} aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function LockIcon({ className = 'size-3.5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

function CreditCardIcon({ className = 'size-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <rect width="20" height="14" x="2" y="5" rx="2" />
      <line x1="2" x2="22" y1="10" y2="10" />
    </svg>
  )
}

function SparklesIcon({ className = 'size-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3Z" />
    </svg>
  )
}

export default function VerificationModal({ open, user, onClose }) {
  const [state, setState] = useState({ loading: false, request: null, canApply: false, error: '' })
  const [form, setForm] = useState(() => requestToForm(null, user))
  const [currentStep, setCurrentStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState({ message: '', tone: 'success' })

  // Custom Dropdowns state & refs
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false)
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false)
  const [countrySearch, setCountrySearch] = useState('')

  const categoryMenuRef = useRef(null)
  const countryMenuRef = useRef(null)

  const loadRequest = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: '' }))
    try {
      const payload = await getMyVerificationRequest()
      setState({ loading: false, request: payload.request, canApply: payload.canApply, error: '' })
      if (payload.request?.status === 'needs_info') setForm(requestToForm(payload.request, user))
      if (!payload.request) setForm(requestToForm(null, user))
    } catch (error) {
      setState({ loading: false, request: null, canApply: false, error: error.message || 'Başvuru bilgileri yüklenemedi.' })
    }
  }, [user])

  useEffect(() => {
    if (!open) return undefined
    loadRequest()
    setFeedback({ message: '', tone: 'success' })
    setCurrentStep(1)
    setCategoryDropdownOpen(false)
    setCountryDropdownOpen(false)

    return undefined
  }, [loadRequest, open])

  useEffect(() => {
    if (!open) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !submitting) {
        if (categoryDropdownOpen) {
          setCategoryDropdownOpen(false)
          return
        }
        if (countryDropdownOpen) {
          setCountryDropdownOpen(false)
          return
        }
        onClose()
      }
    }

    const handleOutsideClick = (event) => {
      if (categoryMenuRef.current && !categoryMenuRef.current.contains(event.target)) {
        setCategoryDropdownOpen(false)
      }
      if (countryMenuRef.current && !countryMenuRef.current.contains(event.target)) {
        setCountryDropdownOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleOutsideClick)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [open, onClose, submitting, categoryDropdownOpen, countryDropdownOpen])

  const isAdditionalInfo = state.request?.status === 'needs_info'
  const canShowForm = isAdditionalInfo || state.canApply
  const currentCopy = state.request ? statusCopy[state.request.status] : null

  const selectedCategoryObj = useMemo(
    () => categories.find(([val]) => val === form.category) || categories[0],
    [form.category],
  )

  const selectedCountryObj = useMemo(
    () => countryList.find((c) => c.dialCode === form.phoneCountryCode) || countryList[0],
    [form.phoneCountryCode],
  )

  const filteredCountries = useMemo(() => {
    const q = countrySearch.trim().toLowerCase()
    if (!q) return countryList
    return countryList.filter(
      (c) => c.name.toLowerCase().includes(q) || c.dialCode.includes(q) || c.code.toLowerCase().includes(q),
    )
  }, [countrySearch])

  const selectedPlan = useMemo(
    () => subscriptionPlans.find((p) => p.id === form.plan) || subscriptionPlans[0],
    [form.plan],
  )
  const selectedPrice = selectedPlan.price

  function handleProceedToPayment() {
    const cleanedPhone = form.phoneNumber.replace(/\D/g, '')
    if (!cleanedPhone || cleanedPhone.length < 7) {
      setFeedback({ message: 'Lütfen geçerli bir iletişim & güvenlik numarası giriniz.', tone: 'error' })
      return
    }
    setFeedback({ message: '', tone: 'success' })
    setCurrentStep(2)
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (!isAdditionalInfo && currentStep === 1) {
      handleProceedToPayment()
      return
    }

    // Telefon doğrulaması
    const cleanedPhone = form.phoneNumber.replace(/\D/g, '')
    if (!cleanedPhone || cleanedPhone.length < 7) {
      setFeedback({ message: 'Lütfen geçerli bir iletişim & güvenlik numarası giriniz.', tone: 'error' })
      setCurrentStep(1)
      return
    }

    if (!isAdditionalInfo) {
      const cleanedCard = form.cardNumber.replace(/\D/g, '')
      if (!cleanedCard || !/^1+$/.test(cleanedCard) || cleanedCard.length < 12) {
        setFeedback({
          message: 'Geçersiz test kartı. Test aşamasında kart numarasının tüm rakamlarını 1 olarak giriniz (Örn: 1111 1111 1111 1111).',
          tone: 'error',
        })
        return
      }

      if (!form.cardHolder.trim() || form.cardHolder.trim().length < 2) {
        setFeedback({ message: 'Lütfen kart üzerindeki isim alanını doldurunuz.', tone: 'error' })
        return
      }

      if (!form.cardExpiry.trim() || form.cardExpiry.trim().length < 4) {
        setFeedback({ message: 'Lütfen son kullanma tarihini geçerli biçimde giriniz (Örn: 11/11).', tone: 'error' })
        return
      }

      if (!form.cardCvc.trim() || form.cardCvc.trim().length < 3) {
        setFeedback({ message: 'Lütfen 3 haneli güvenlik kodunu (CVV) giriniz (Örn: 111).', tone: 'error' })
        return
      }
    }

    setSubmitting(true)
    setFeedback({ message: '', tone: 'success' })
    try {
      const payload = isAdditionalInfo
        ? await updateMyVerificationRequest({
            category: form.category,
            phoneNumber: form.phoneNumber.trim(),
            phoneCountryCode: form.phoneCountryCode,
          })
        : await createMyVerificationRequest({
            category: form.category,
            phoneNumber: form.phoneNumber.trim(),
            phoneCountryCode: form.phoneCountryCode,
            termsAccepted: form.termsAccepted,
            payment: {
              plan: form.plan || 'plus',
              cardNumber: form.cardNumber,
              cardHolder: form.cardHolder.trim(),
              cardExpiry: form.cardExpiry.trim(),
              cardCvc: form.cardCvc.trim(),
            },
          })
      setFeedback({ message: payload.message, tone: 'success' })
      await loadRequest()
    } catch (error) {
      setFeedback({ message: error.message || 'Başvuru gönderilemedi.', tone: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleWithdraw() {
    setSubmitting(true)
    setFeedback({ message: '', tone: 'success' })
    try {
      const payload = await withdrawMyVerificationRequest()
      setFeedback({ message: payload.message, tone: 'success' })
      await loadRequest()
    } catch (error) {
      setFeedback({ message: error.message || 'Başvuru geri çekilemedi.', tone: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[150] flex items-end justify-center bg-zinc-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-5" role="presentation" onMouseDown={() => { if (!submitting) onClose() }}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="verification-modal-title"
        className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-md border border-border bg-card shadow-[0_30px_100px_rgba(0,0,0,0.35)] sm:rounded-md"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-5 py-4 sm:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-md bg-sky-50 text-sky-500 dark:bg-sky-950/40">
              <VerifiedBadge user={{ verification: { isVerified: true } }} size="md" />
            </span>
            <h2 id="verification-modal-title" className="text-lg font-bold text-text sm:text-xl">Doğrulanmış Profil & Abonelik</h2>
          </div>
          <button type="button" autoFocus onClick={onClose} disabled={submitting} className="grid size-9 shrink-0 place-items-center rounded-md bg-secondary text-muted transition hover:text-text disabled:opacity-40 cursor-pointer" aria-label="Pencereyi kapat">
            <CloseIcon />
          </button>
        </header>

        {state.loading ? (
          <div className="flex flex-1 items-center justify-center p-12 text-sm text-muted">
            Başvuru bilgileri yükleniyor...
          </div>
        ) : !canShowForm ? (
          <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6 space-y-4">
            {state.error ? (
              <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
                {state.error}
              </div>
            ) : null}

            {currentCopy ? (
              <div className="rounded-md border border-border bg-secondary/60 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase text-primary">
                        {state.request.status}
                      </span>
                      {state.request.payment?.status === 'paid' ? (
                        <span className="rounded-md bg-emerald-500/10 px-3 py-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                          ₺{state.request.payment.amount} · {planLabels[state.request.payment.plan] || 'Aylık'} (Ödendi)
                        </span>
                      ) : null}
                    </div>
                    <h3 className="mt-3 text-lg font-bold text-text">{currentCopy[0]}</h3>
                    <p className="mt-1 text-sm text-muted">{currentCopy[1]}</p>
                    {state.request.phoneNumber ? (
                      <p className="mt-2 text-xs text-muted">
                        İletişim numarası: <span className="font-mono font-medium text-text">{state.request.phoneCountryCode || ''} {state.request.phoneNumber}</span>
                      </p>
                    ) : null}
                    {state.request.payment?.cardLast4 ? (
                      <p className="mt-1 text-xs text-muted">Ödeme yöntemi: **** {state.request.payment.cardLast4} (Test Kartı)</p>
                    ) : null}
                  </div>
                  {state.request.status === 'pending' ? (
                    <button
                      type="button"
                      onClick={handleWithdraw}
                      disabled={submitting}
                      className="rounded-md border border-rose-200 bg-card px-4 py-2 text-xs font-bold text-rose-600 disabled:opacity-40 hover:bg-rose-50 cursor-pointer dark:border-rose-900/40 dark:hover:bg-rose-950/40"
                    >
                      Geri çek
                    </button>
                  ) : null}
                </div>
                {state.request.requestedInformation ? (
                  <p className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                    İstenen bilgi: {state.request.requestedInformation}
                  </p>
                ) : null}
                {state.request.rejectionReason ? (
                  <p className="mt-4 rounded-md bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                    Ret nedeni: {state.request.rejectionReason}
                  </p>
                ) : null}
                {state.request.resubmissionAllowedAt ? (
                  <p className="mt-3 text-xs text-muted">
                    Tekrar başvuru tarihi: {new Date(state.request.resubmissionAllowedAt).toLocaleDateString('tr-TR')}
                  </p>
                ) : null}
              </div>
            ) : null}

            {feedback.message ? (
              <div className={`rounded-md border p-3 text-sm ${feedback.tone === 'error' ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300' : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300'}`}>
                {feedback.message}
              </div>
            ) : null}

            {!currentCopy && !state.error ? (
              <div className="py-8 text-center text-sm text-muted">Şu anda yeni başvuru oluşturulamıyor.</div>
            ) : null}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {/* Kaydırılabilir Form Gövdesi */}
            <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6 space-y-5">
              {state.error ? (
                <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
                  {state.error}
                </div>
              ) : null}

              {/* Ek Bilgi Talebi Notu (Varsa) */}
              {isAdditionalInfo && currentCopy ? (
                <div className="rounded-md border border-border bg-secondary/60 p-4">
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-bold uppercase text-amber-600 dark:text-amber-400">
                      Ek Bilgi Talebi
                    </span>
                  </div>
                  <h3 className="mt-2 text-base font-bold text-text">{currentCopy[0]}</h3>
                  <p className="mt-0.5 text-xs text-muted">{currentCopy[1]}</p>
                  {state.request?.requestedInformation ? (
                    <p className="mt-3 rounded-md bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                      <strong>Yönetici Notu:</strong> {state.request.requestedInformation}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {/* Ek Bilgi Modu Form Alanları */}
              {isAdditionalInfo ? (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-sm font-semibold text-text">Hesap türü</label>
                    <div ref={categoryMenuRef} className="relative">
                      <button
                        type="button"
                        onClick={() => {
                          setCategoryDropdownOpen((prev) => !prev)
                          setCountryDropdownOpen(false)
                        }}
                        className="flex w-full items-center justify-between gap-3 rounded-md border border-border bg-secondary hover:border-border-strong px-4 py-3 text-sm font-medium text-text transition cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="grid size-7 shrink-0 place-items-center rounded-md bg-primary/10 text-sm">
                            {selectedCategoryObj[2]}
                          </span>
                          <div className="text-left min-w-0">
                            <span className="font-semibold text-sm text-text block truncate">{selectedCategoryObj[1]}</span>
                            <span className="text-[11px] text-muted block truncate">{selectedCategoryObj[3]}</span>
                          </div>
                        </div>
                        <ChevronDownIcon className={`size-4 shrink-0 transition-transform duration-200 ${categoryDropdownOpen ? 'rotate-180 text-primary' : 'text-muted'}`} />
                      </button>
                      {categoryDropdownOpen && (
                        <div className="absolute left-0 bottom-[calc(100%+6px)] z-50 w-full max-h-72 overflow-y-auto rounded-md border border-border bg-card p-1.5 shadow-[0_16px_36px_rgba(0,0,0,0.22)] dark:shadow-[0_16px_36px_rgba(0,0,0,0.6)] animate-in fade-in slide-in-from-bottom-2 zoom-in-95 duration-150 origin-bottom">
                          {categories.map(([value, label, icon, desc]) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() => {
                                setForm((curr) => ({ ...curr, category: value }))
                                setCategoryDropdownOpen(false)
                              }}
                              className={`flex w-full items-center justify-between gap-3 rounded-md px-3.5 py-2.5 text-left text-sm transition cursor-pointer ${
                                form.category === value ? 'bg-primary/10 text-primary font-semibold' : 'text-text hover:bg-secondary'
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <span className="grid size-7 shrink-0 place-items-center rounded-md bg-secondary text-sm">{icon}</span>
                                <div className="min-w-0">
                                  <p className="font-semibold text-sm">{label}</p>
                                  <p className="text-xs text-muted truncate">{desc}</p>
                                </div>
                              </div>
                              {form.category === value && <CheckIcon className="size-4 text-primary shrink-0" />}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-semibold text-text">İletişim & Güvenlik Numarası</label>
                      <span className="rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary">Doğrulama & Güvenlik Hattı</span>
                    </div>
                    <p className="text-xs text-muted">Hesap doğrulaması ve güvenlik bildirimleri için kullanılacaktır.</p>
                    <div className="flex items-center gap-2">
                      <div ref={countryMenuRef} className="relative shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setCountryDropdownOpen((prev) => !prev)
                            setCategoryDropdownOpen(false)
                          }}
                          className="flex h-11 items-center gap-1.5 rounded-md border border-border bg-secondary hover:border-border-strong px-3 text-sm font-semibold text-text transition cursor-pointer"
                        >
                          <span className="text-base">{selectedCountryObj.flag}</span>
                          <span className="font-mono text-xs font-bold text-text">{selectedCountryObj.dialCode}</span>
                          <ChevronDownIcon className={`size-3 transition-transform duration-200 ${countryDropdownOpen ? 'rotate-180 text-primary' : 'text-muted'}`} />
                        </button>
                        {countryDropdownOpen && (
                          <div className="dropdown-pop absolute left-0 top-[calc(100%+6px)] z-50 w-72 rounded-md border border-border bg-card p-2 shadow-[0_16px_36px_rgba(0,0,0,0.22)] dark:shadow-[0_16px_36px_rgba(0,0,0,0.6)] animate-in fade-in zoom-in-95 duration-150">
                            <input
                              type="text"
                              value={countrySearch}
                              onChange={(e) => setCountrySearch(e.target.value)}
                              placeholder="Ülke ara..."
                              className="mb-2 h-9 w-full rounded-md border border-border bg-secondary px-3 text-xs outline-none focus:border-primary"
                              autoFocus
                            />
                            <div className="max-h-56 overflow-y-auto divide-y divide-border/40">
                              {filteredCountries.map((c) => (
                                <button
                                  key={c.code + c.dialCode}
                                  type="button"
                                  onClick={() => {
                                    setForm((curr) => ({ ...curr, phoneCountryCode: c.dialCode }))
                                    setCountryDropdownOpen(false)
                                    setCountrySearch('')
                                  }}
                                  className={`flex w-full items-center justify-between px-2.5 py-2 text-left text-xs transition cursor-pointer ${
                                    form.phoneCountryCode === c.dialCode ? 'bg-primary/10 text-primary font-semibold' : 'text-text hover:bg-secondary'
                                  }`}
                                >
                                  <span className="flex items-center gap-2 truncate">
                                    <span className="text-base">{c.flag}</span>
                                    <span className="truncate">{c.name}</span>
                                  </span>
                                  <span className="font-mono text-[11px] text-muted ml-2 shrink-0">{c.dialCode}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <input
                        type="tel"
                        required
                        value={form.phoneNumber}
                        onChange={(e) => setForm((curr) => ({ ...curr, phoneNumber: formatPhoneInput(e.target.value, curr.phoneCountryCode) }))}
                        placeholder={selectedCountryObj.placeholder}
                        className="h-11 w-full flex-1 rounded-md border border-border bg-secondary px-4 text-sm font-medium text-text outline-none focus:border-primary font-mono"
                      />
                    </div>
                  </div>
                </div>
              ) : currentStep === 1 ? (
                /* ADIM 1: Paket Seçimi & Profil Bilgileri */
                <div className="space-y-5 animate-in fade-in duration-200">
                  {/* Abonelik Planı Kartları */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="block text-xs font-bold uppercase tracking-wider text-muted">Abonelik Planı</span>
                      <span className="text-[11px] font-medium text-muted">Aylık Esnek Abonelik</span>
                    </div>

                    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                      {subscriptionPlans.map((plan) => {
                        const isSelected = form.plan === plan.id
                        return (
                          <div
                            key={plan.id}
                            onClick={() => setForm((curr) => ({ ...curr, plan: plan.id }))}
                            className={`relative flex cursor-pointer flex-col justify-between rounded-md p-4 sm:p-5 transition-all duration-150 select-none ${
                              isSelected
                                ? 'border border-primary/25 dark:border-primary/30 bg-primary/[0.02] dark:bg-primary/[0.04] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05),0_2px_8px_-1px_rgba(37,99,235,0.08)] dark:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.3),0_2px_8px_-1px_rgba(59,130,246,0.12)]'
                                : 'border border-border bg-card/60 hover:bg-secondary/40 hover:border-border-strong'
                            }`}
                          >
                            <div>
                              {/* Başlık, Rozet ve Seçim İndikatörü */}
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-base font-bold text-text">{plan.name}</span>
                                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide ${
                                    isSelected
                                      ? 'bg-primary/15 text-primary border border-primary/25 font-bold'
                                      : 'bg-secondary text-muted border border-border font-medium'
                                  }`}>
                                    {plan.badge}
                                  </span>
                                </div>

                                <div
                                  className={`size-5 shrink-0 rounded-full flex items-center justify-center transition-all ${
                                    isSelected
                                      ? 'bg-primary text-inverse shadow-xs'
                                      : 'border border-border-strong bg-secondary/60 text-transparent'
                                  }`}
                                >
                                  <CheckIcon className="size-3 stroke-[3]" />
                                </div>
                              </div>

                              {/* Fiyat & Gösterim Çarpanı */}
                              <div className="mt-3 flex items-baseline justify-between gap-2">
                                <div>
                                  <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-text">₺{plan.price}</span>
                                  <span className="ml-1 text-xs font-medium text-muted">/ {plan.period}</span>
                                </div>
                                <span className="inline-flex items-center rounded-md bg-secondary border border-border px-2 py-0.5 text-[11px] font-bold text-text">
                                  {plan.multiplierText}
                                </span>
                              </div>

                              {/* Açıklama */}
                              <p className="mt-2 text-xs text-muted leading-relaxed">{plan.description}</p>

                              {/* Çizgi */}
                              <div className="my-3.5 border-t border-border/60" />

                              {/* Sade ve Profesyonel Ayrıcalıklar (Renkli ikonlar yok) */}
                              <div className="space-y-2.5">
                                {plan.features.map((feat, idx) => (
                                  <div key={idx} className="flex items-start gap-2.5 text-xs">
                                    <span className="mt-0.5 flex size-3.5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                                      <CheckIcon className="size-2.5 stroke-[3]" />
                                    </span>
                                    <div className="min-w-0">
                                      <span className="font-semibold text-text block leading-tight">{feat.text}</span>
                                      <span className="text-[11px] text-muted leading-tight block mt-0.5">{feat.desc}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Hesap Türü Özel Dropdown */}
                  <div className="space-y-1.5">
                    <label className="block text-sm font-semibold text-text">Hesap türü</label>
                    <div ref={categoryMenuRef} className="relative">
                      <button
                        type="button"
                        onClick={() => {
                          setCategoryDropdownOpen((prev) => !prev)
                          setCountryDropdownOpen(false)
                        }}
                        className="flex w-full items-center justify-between gap-3 rounded-md border border-border bg-secondary hover:border-border-strong px-4 py-3 text-sm font-medium text-text transition cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="grid size-7 shrink-0 place-items-center rounded-md bg-primary/10 text-sm">
                            {selectedCategoryObj[2]}
                          </span>
                          <div className="text-left min-w-0">
                            <span className="font-semibold text-sm text-text block truncate">{selectedCategoryObj[1]}</span>
                            <span className="text-[11px] text-muted block truncate">{selectedCategoryObj[3]}</span>
                          </div>
                        </div>
                        <ChevronDownIcon
                          className={`size-4 shrink-0 transition-transform duration-200 ${
                            categoryDropdownOpen ? 'rotate-180 text-primary' : 'text-muted'
                          }`}
                        />
                      </button>

                      {categoryDropdownOpen && (
                        <div className="absolute left-0 bottom-[calc(100%+6px)] z-50 w-full max-h-72 overflow-y-auto rounded-md border border-border bg-card p-1.5 shadow-[0_16px_36px_rgba(0,0,0,0.22)] dark:shadow-[0_16px_36px_rgba(0,0,0,0.6)] animate-in fade-in slide-in-from-bottom-2 zoom-in-95 duration-150 origin-bottom">
                          {categories.map(([value, label, icon, desc]) => {
                            const isSelected = form.category === value
                            return (
                              <button
                                key={value}
                                type="button"
                                onClick={() => {
                                  setForm((curr) => ({ ...curr, category: value }))
                                  setCategoryDropdownOpen(false)
                                }}
                                className={`flex w-full items-center justify-between gap-3 rounded-md px-3.5 py-2.5 text-left text-sm transition cursor-pointer ${
                                  isSelected
                                    ? 'bg-primary/10 text-primary font-semibold'
                                    : 'text-text hover:bg-secondary hover:text-text'
                                }`}
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <span className="grid size-7 shrink-0 place-items-center rounded-md bg-secondary text-sm">
                                    {icon}
                                  </span>
                                  <div className="min-w-0">
                                    <p className="font-semibold text-sm">{label}</p>
                                    <p className="text-xs text-muted truncate">{desc}</p>
                                  </div>
                                </div>
                                {isSelected && <CheckIcon className="size-4 text-primary shrink-0" />}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* İletişim & Güvenlik Numarası */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-semibold text-text">İletişim & Güvenlik Numarası</label>
                      <span className="rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary">Doğrulama & Güvenlik Hattı</span>
                    </div>
                    <p className="text-xs text-muted">Hesap doğrulaması ve güvenlik bildirimleri için kullanılacaktır.</p>
                    <div className="flex items-center gap-2">
                      {/* Ülke Kodu Seçici Dropdown */}
                      <div ref={countryMenuRef} className="relative shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setCountryDropdownOpen((prev) => !prev)
                            setCategoryDropdownOpen(false)
                          }}
                          className="flex h-11 items-center gap-1.5 rounded-md border border-border bg-secondary hover:border-border-strong px-3 text-sm font-semibold text-text transition cursor-pointer"
                        >
                          <span className="text-base">{selectedCountryObj.flag}</span>
                          <span className="font-mono text-xs font-bold text-text">{selectedCountryObj.dialCode}</span>
                          <ChevronDownIcon
                            className={`size-3 transition-transform duration-200 ${
                              countryDropdownOpen ? 'rotate-180 text-primary' : 'text-muted'
                            }`}
                          />
                        </button>

                        {countryDropdownOpen && (
                          <div className="dropdown-pop absolute left-0 top-[calc(100%+6px)] z-50 w-72 rounded-md border border-border bg-card p-2 shadow-[0_16px_36px_rgba(0,0,0,0.22)] dark:shadow-[0_16px_36px_rgba(0,0,0,0.6)] animate-in fade-in zoom-in-95 duration-150">
                            <div className="mb-2">
                              <input
                                type="text"
                                value={countrySearch}
                                onChange={(e) => setCountrySearch(e.target.value)}
                                placeholder="Ülke veya kod ara..."
                                className="h-9 w-full rounded-md border border-border bg-secondary px-3 text-xs outline-none focus:border-primary"
                                autoFocus
                              />
                            </div>
                            <div className="max-h-56 overflow-y-auto divide-y border-border/40">
                              {filteredCountries.map((c) => {
                                const isSelected = form.phoneCountryCode === c.dialCode
                                return (
                                  <button
                                    key={c.code + c.dialCode}
                                    type="button"
                                    onClick={() => {
                                      setForm((curr) => ({ ...curr, phoneCountryCode: c.dialCode }))
                                      setCountryDropdownOpen(false)
                                      setCountrySearch('')
                                    }}
                                    className={`flex w-full items-center justify-between px-2.5 py-2 text-left text-xs transition cursor-pointer ${
                                      isSelected
                                        ? 'bg-primary/10 text-primary font-semibold'
                                        : 'text-text hover:bg-secondary'
                                    }`}
                                  >
                                    <span className="flex items-center gap-2 truncate">
                                      <span className="text-base">{c.flag}</span>
                                      <span className="truncate">{c.name}</span>
                                    </span>
                                    <span className="font-mono text-[11px] text-muted ml-2 shrink-0">{c.dialCode}</span>
                                  </button>
                                )
                              })}
                              {!filteredCountries.length && (
                                <p className="p-3 text-center text-xs text-muted">Ülke bulunamadı.</p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Telefon Numarası Girişi */}
                      <div className="relative flex-1 min-w-0">
                        <input
                          type="tel"
                          required
                          value={form.phoneNumber}
                          onChange={(e) =>
                            setForm((curr) => ({
                              ...curr,
                              phoneNumber: formatPhoneInput(e.target.value, curr.phoneCountryCode),
                            }))
                          }
                          placeholder={selectedCountryObj.placeholder}
                          className="h-11 w-full rounded-md border border-border bg-secondary px-4 text-sm font-medium text-text outline-none focus:border-primary font-mono"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* ADIM 2: Ödeme Bilgileri & Onay */
                <div className="space-y-5 animate-in fade-in duration-200">
                  {/* Seçilen Plan Özeti */}
                  <div className="flex items-center justify-between rounded-md border border-primary/30 bg-primary/5 p-4">
                    <div className="flex items-center gap-3">
                      <div className="grid size-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary font-black text-sm">
                        {selectedPlan.name}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <strong className="text-sm font-bold text-text">{selectedPlan.fullName}</strong>
                          <span className="rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary">
                            {selectedPlan.multiplierText}
                          </span>
                        </div>
                        <p className="text-xs text-muted">Aylık ₺{selectedPlan.price} · {selectedPlan.features[0].text}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(1)}
                      className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-text hover:bg-secondary transition cursor-pointer"
                    >
                      Planı Değiştir
                    </button>
                  </div>

                  {/* Ödeme Kart Bilgileri (Test Modu) */}
                  <div className="space-y-3 rounded-md border border-border bg-secondary/40 p-4">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-text">
                        <CreditCardIcon />
                        Ödeme Bilgileri (Test Ortamı)
                      </span>
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-sky-600 dark:text-sky-400">
                        <ShieldCheckIcon />
                        Güvenli Test Modu
                      </span>
                    </div>

                    <div className="rounded-md border border-amber-200/80 bg-amber-50/70 p-2.5 text-xs leading-5 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                      💡 <strong>Test Kurulumu:</strong> Ödemeyi onaylamak için kart numarasının tüm rakamlarını <strong>1</strong> olarak giriniz (Örn: <code>1111 1111 1111 1111</code>, SKT: <code>11/11</code>, CVV: <code>111</code>).
                    </div>

                    <div className="space-y-3">
                      <label className="block text-xs font-semibold text-text">Kart Üzerindeki İsim
                        <input
                          type="text"
                          required
                          value={form.cardHolder}
                          onChange={(e) => setForm((curr) => ({ ...curr, cardHolder: e.target.value }))}
                          placeholder="Ad Soyad"
                          className="mt-1.5 h-10 w-full rounded-md border border-border bg-card px-3 text-sm outline-none focus:border-primary"
                        />
                      </label>

                      <label className="block text-xs font-semibold text-text">Kart Numarası
                        <input
                          type="text"
                          required
                          value={form.cardNumber}
                          onChange={(e) => setForm((curr) => ({ ...curr, cardNumber: formatCardNumber(e.target.value) }))}
                          placeholder="1111 1111 1111 1111"
                          maxLength={19}
                          className="mt-1.5 h-10 w-full font-mono rounded-md border border-border bg-card px-3 text-sm outline-none focus:border-primary"
                        />
                      </label>

                      <div className="grid grid-cols-2 gap-3">
                        <label className="block text-xs font-semibold text-text">Son Kullanma (AA/YY)
                          <input
                            type="text"
                            required
                            value={form.cardExpiry}
                            onChange={(e) => setForm((curr) => ({ ...curr, cardExpiry: formatExpiry(e.target.value) }))}
                            placeholder="11/11"
                            maxLength={5}
                            className="mt-1.5 h-10 w-full font-mono rounded-md border border-border bg-card px-3 text-sm outline-none focus:border-primary"
                          />
                        </label>
                        <label className="block text-xs font-semibold text-text">Güvenlik Kodu (CVV)
                          <input
                            type="password"
                            required
                            value={form.cardCvc}
                            onChange={(e) => setForm((curr) => ({ ...curr, cardCvc: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                            placeholder="111"
                            maxLength={4}
                            className="mt-1.5 h-10 w-full font-mono rounded-md border border-border bg-card px-3 text-sm outline-none focus:border-primary"
                          />
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Sözleşme Onayı Checkbox */}
                  <label className="flex items-start gap-3 rounded-md border border-border bg-secondary/70 p-4 text-xs text-text cursor-pointer">
                    <input required type="checkbox" checked={form.termsAccepted} onChange={(event) => setForm((current) => ({ ...current, termsAccepted: event.target.checked }))} className="mt-0.5 size-4 rounded" />
                    <span>Bilgilerin doğruluğunu, profil onaylandığında mavi rozetin tanımlanacağını ve <strong>₺{selectedPrice}</strong> tutarındaki aylık <strong>{selectedPlan.name}</strong> abonelik şartlarını kabul ediyorum.</span>
                  </label>
                </div>
              )}

              {/* Geribildirim Mesajı (Form içi hata/bilgilendirme) */}
              {feedback.message ? (
                <div className={`rounded-md border p-3 text-sm ${feedback.tone === 'error' ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300' : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300'}`}>
                  {feedback.message}
                </div>
              ) : null}
            </div>

            {/* SABİT ALT BUTON (STICKY / FIXED FOOTER) */}
            <footer className="shrink-0 border-t border-border bg-card px-5 py-3.5 sm:px-7 sm:py-4">
              {isAdditionalInfo ? (
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-md bg-primary px-5 py-3.5 text-sm font-bold text-inverse transition hover:bg-primary-hover disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {submitting ? 'İşleniyor...' : 'Ek bilgileri gönder'}
                </button>
              ) : currentStep === 1 ? (
                <button
                  type="button"
                  onClick={handleProceedToPayment}
                  className="w-full rounded-md bg-primary px-5 py-3.5 text-sm font-bold text-inverse transition hover:bg-primary-hover flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  <span>Ödeme Adımına İlerle</span>
                  <span className="text-base font-bold">→</span>
                </button>
              ) : (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    disabled={submitting}
                    className="w-1/3 rounded-md border border-border bg-secondary px-4 py-3.5 text-sm font-semibold text-text hover:bg-secondary-hover transition cursor-pointer disabled:opacity-50"
                  >
                    ← Geri
                  </button>

                  <button
                    type="submit"
                    disabled={submitting || !form.termsAccepted}
                    className="flex-1 rounded-md bg-primary px-5 py-3.5 text-sm font-bold text-inverse transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer shadow-xs"
                  >
                    {submitting ? 'İşleniyor...' : `₺${selectedPrice} Öde ve Başvuruyu Tamamla`}
                  </button>
                </div>
              )}
            </footer>
          </form>
        )}
      </section>
    </div>
  )
}
