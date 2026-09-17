export function DisclaimerModal({
  show,
  dontShowAgain,
  setDontShowAgain,
  onAccept,
  t,
}) {
  if (!show) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div
        className="relative w-full max-w-md overflow-hidden rounded-md border border-border bg-card p-6 sm:p-7 text-text shadow-2xl animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        <div className="text-center">
          <div
            className="mx-auto mb-4 flex size-14 items-center justify-center rounded-md text-3xl shadow-md"
            style={{ background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)' }}
          >
            🎭
          </div>

          <h3 className="text-lg sm:text-xl font-bold tracking-tight text-text">
            {t('lounge.disclaimer.title', { defaultValue: 'Gizli Profile Hoş Geldiniz!' })}
          </h3>

          <p className="mt-2.5 text-xs sm:text-sm leading-relaxed text-muted">
            {t('lounge.disclaimer.desc', {
              defaultValue: 'Günün stresini atmak ve kafa dağıtmak için tasarlanmış anonim sohbet alanındasınız.',
            })}
          </p>

          <div className="mt-4 rounded-md border border-border bg-secondary/70 p-3.5 text-left text-xs text-text space-y-2">
            <div className="flex items-start gap-2.5">
              <span className="text-base shrink-0">🤫</span>
              <p>
                <strong>{t('lounge.disclaimer.rule1Title', { defaultValue: 'Tam Gizlilik:' })}</strong>{' '}
                {t('lounge.disclaimer.rule1Desc', {
                  defaultValue: 'Rastgele rumuz ve avatarlarla kimliğiniz tamamen saklı kalır.',
                })}
              </p>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="text-base shrink-0">⚠️</span>
              <p>
                <strong>{t('lounge.disclaimer.rule2Title', { defaultValue: 'Güvenlik Uyarısı:' })}</strong>{' '}
                {t('lounge.disclaimer.rule2Desc', {
                  defaultValue: 'Kişisel, finansal veya hassas bilgilerinizi kesinlikle paylaşmayın.',
                })}
              </p>
            </div>
          </div>

          <label className="mt-4 flex items-center justify-center gap-2 text-xs text-muted cursor-pointer select-none">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="rounded border-border text-primary focus:ring-primary size-4"
            />
            <span>{t('lounge.disclaimer.dontShowAgain', { defaultValue: 'Bu bilgilendirmeyi bir daha gösterme' })}</span>
          </label>

          <button
            type="button"
            onClick={onAccept}
            className="mt-4 w-full rounded-md bg-primary px-4 py-2.5 text-sm font-bold !text-white shadow hover:bg-primary-hover active:scale-[0.98] transition-all cursor-pointer"
          >
            {t('lounge.disclaimer.startBtn', { defaultValue: 'Anladım, Sohbete Başla' })}
          </button>
        </div>
      </div>
    </div>
  )
}

export function GuestTimeoutModal({ show, lang, navigate, t }) {
  if (!show) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
      <div
        className="relative w-full max-w-md overflow-hidden rounded-md border border-border bg-card p-6 sm:p-8 text-text shadow-2xl text-center animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        <div
          className="mx-auto mb-4 flex size-16 items-center justify-center rounded-md text-3xl shadow-lg"
          style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}
        >
          🚀
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-2">
          <span>⏱️</span>
          <span>{t('lounge.guestTimeout.badge', { defaultValue: 'Önizleme Süresi Doldu' })}</span>
        </div>

        <h3 className="text-xl sm:text-2xl font-black tracking-tight text-text">
          {t('lounge.guestTimeout.title', { defaultValue: 'Sohbete Katılmak İçin Üye Olun!' })}
        </h3>

        <p className="mt-2.5 text-xs sm:text-sm leading-relaxed text-muted">
          {t('lounge.guestTimeout.desc', {
            defaultValue: "Anonim Lounge'da mesaj göndermek, yeni oda kurmak ve çevrimiçi kişilerle birebir eşleşip kafa dağıtmak için hemen aramıza katılın.",
          })}
        </p>

        <div className="mt-4 rounded-md border border-border bg-secondary/80 p-3.5 text-left text-xs text-text space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-emerald-500 font-bold">✓</span>
            <span>{t('lounge.guestTimeout.perk1', { defaultValue: 'Tamamen Ücretsiz ve 1 Dakikada Kayıt' })}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-emerald-500 font-bold">✓</span>
            <span>{t('lounge.guestTimeout.perk2', { defaultValue: 'Gerçek Profiliniz Gizli Kalır (%100 Anonim)' })}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-emerald-500 font-bold">✓</span>
            <span>{t('lounge.guestTimeout.perk3', { defaultValue: 'Sınırsız Oda Sohbeti ve Canlı Radar Erişimi' })}</span>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() =>
              navigate(
                `/${lang}/signup?returnTo=${encodeURIComponent(`/${lang}/hidden-profile`)}`,
              )
            }
            className="w-full rounded-md bg-primary px-5 py-3 text-sm font-bold !text-white shadow-lg hover:bg-primary-hover active:scale-[0.98] transition-all cursor-pointer"
          >
            {t('lounge.guestTimeout.signupBtn', { defaultValue: 'Hemen Ücretsiz Kayıt Ol' })}
          </button>
          <button
            type="button"
            onClick={() =>
              navigate(
                `/${lang}/login?returnTo=${encodeURIComponent(`/${lang}/hidden-profile`)}`,
              )
            }
            className="w-full rounded-md border border-border bg-secondary px-5 py-2.5 text-sm font-semibold text-text hover:bg-secondary-hover active:scale-[0.98] transition-all cursor-pointer"
          >
            {t('lounge.guestTimeout.loginBtn', { defaultValue: 'Zaten Hesabım Var, Giriş Yap' })}
          </button>
          <button
            type="button"
            onClick={() => navigate(`/${lang}/`)}
            className="text-xs text-muted hover:text-text underline mt-1 transition-colors cursor-pointer"
          >
            {t('lounge.guestTimeout.returnHome', { defaultValue: 'Nest Social Ana Sayfasına Dön' })}
          </button>
        </div>
      </div>
    </div>
  )
}
