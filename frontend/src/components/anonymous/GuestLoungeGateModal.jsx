import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export function GuestLoungeGateModal({ isOpen, onClose, actionLabel }) {
  const { lang = 'tr' } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()

  if (!isOpen) return null

  const returnPath = encodeURIComponent(`/${lang}/hidden-profile`)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div
        className="relative w-full max-w-md overflow-hidden rounded-md border border-border bg-card p-6 sm:p-8 text-text shadow-2xl"
        role="dialog"
        aria-modal="true"
      >
        <button
          onClick={onClose}
          type="button"
          className="absolute top-4 right-4 rounded-full p-2 text-muted hover:text-text hover:bg-secondary transition-colors"
          aria-label={t('common.close', { defaultValue: 'Kapat' })}
        >
          <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="text-center">
          <div
            className="mx-auto mb-4 flex size-16 items-center justify-center rounded-md text-3xl shadow-lg"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)' }}
          >
            🎭
          </div>

          <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-text">
            {actionLabel || t('lounge.gateModal.defaultAction', { defaultValue: 'Anonim Dünyaya Katıl' })}
          </h3>

          <p className="mt-2 text-sm leading-relaxed text-muted">
            {t('lounge.gateModal.desc', {
              defaultValue: 'Sohbete katılmak, mesaj göndermek veya yeni oda açmak için tek tıkla oturum açın.',
            })}
          </p>

          <div className="mt-4 rounded-md border border-border bg-secondary p-3.5 text-left text-xs text-text flex items-start gap-2.5">
            <span className="text-base">🔒</span>
            <span>
              <strong>{t('lounge.gateModal.privacyTitle', { defaultValue: '%100 Gizlilik Garantisi:' })} </strong>
              {t('lounge.gateModal.privacyDesc', {
                defaultValue:
                  'Gerçek adınız, kullanıcı adınız ve profil fotoğrafınız bu alanda kimseye gösterilmez. Otomatik anonim bir rumuz ile konuşursunuz.',
              })}
            </span>
          </div>

          <div className="mt-6 flex flex-col gap-3">
            <button
              onClick={() => navigate(`/${lang}/login?returnTo=${returnPath}`)}
              className="w-full rounded-md bg-primary px-5 py-3 text-sm font-semibold !text-white shadow-md hover:bg-primary-hover active:scale-[0.98] transition-all"
            >
              {t('lounge.gateModal.loginBtn', { defaultValue: 'Giriş Yap' })}
            </button>
            <button
              onClick={() => navigate(`/${lang}/signup?returnTo=${returnPath}`)}
              className="w-full rounded-md border border-border bg-secondary px-5 py-3 text-sm font-semibold text-text hover:bg-secondary-hover active:scale-[0.98] transition-all"
            >
              {t('lounge.gateModal.signupBtn', { defaultValue: 'Ücretsiz Kaydol' })}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
