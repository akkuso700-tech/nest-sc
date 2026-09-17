import { getAvatarByKey } from '../../services/anonymousService.js'

export function SentRequestModal({ sentRequestModal, onClose, t }) {
  if (!sentRequestModal) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-md border border-border bg-card p-5 sm:p-6 text-text shadow-2xl text-center animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        <div
          className="mx-auto mb-3.5 flex size-14 items-center justify-center rounded-2xl text-3xl shadow-md"
          style={{ background: getAvatarByKey(sentRequestModal.avatarKey).bgStyle }}
        >
          {getAvatarByKey(sentRequestModal.avatarKey).emoji}
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-2">
          <span className="size-2 rounded-full bg-primary animate-ping" />
          <span>{t('lounge.sentModal.badge', { defaultValue: 'İstek İletildi' })}</span>
        </div>

        <h3 className="text-base sm:text-lg font-bold text-text">
          {t('lounge.sentModal.title', { defaultValue: 'Sohbet İsteği Gönderildi!' })}
        </h3>

        <p className="mt-2 text-xs leading-relaxed text-muted">
          {t('lounge.sentModal.desc', {
            alias: sentRequestModal.alias,
            defaultValue: `${sentRequestModal.alias} kullanıcısına birebir anonim sohbet davetiniz başarıyla iletildi.`,
          })}
        </p>

        <div className="mt-4 rounded-md border border-border bg-secondary/70 p-3 text-left text-xs text-text space-y-2">
          <div className="flex items-start gap-2">
            <span className="text-sm shrink-0">⏳</span>
            <p className="text-[11px] text-muted leading-tight">
              {t('lounge.sentModal.noteWait', {
                defaultValue: 'Karşı taraf isteği kabul ettiğinde ekranınızda anında bildirim penceresi açılacaktır.',
              })}
            </p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-sm shrink-0">🔒</span>
            <p className="text-[11px] text-muted leading-tight">
              {t('lounge.sentModal.notePrivacy', {
                defaultValue: 'Gerçek kimliğiniz ve profiliniz tamamen gizli tutulmaktadır.',
              })}
            </p>
          </div>
        </div>

        <div className="mt-5">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-md bg-primary py-2.5 text-xs font-bold !text-white shadow hover:bg-primary-hover active:scale-95 transition-all cursor-pointer"
          >
            {t('lounge.sentModal.okBtn', { defaultValue: 'Tamam, Bekliyorum' })}
          </button>
        </div>
      </div>
    </div>
  )
}

export function ChatAcceptedModal({ chatAcceptedModal, onClose, onEnterChat, t }) {
  if (!chatAcceptedModal) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-md border border-border bg-card p-5 sm:p-6 text-text shadow-2xl text-center animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        <div className="relative mx-auto mb-3.5 size-16">
          <div
            className="size-16 rounded-2xl flex items-center justify-center text-3xl shadow-xl"
            style={{
              background: getAvatarByKey(chatAcceptedModal.partner?.avatarKey).bgStyle,
            }}
          >
            {getAvatarByKey(chatAcceptedModal.partner?.avatarKey).emoji}
          </div>
          <span className="absolute -bottom-1 -right-1 size-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold ring-2 ring-card shadow">
            ✓
          </span>
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold mb-2">
          <span>🎉</span>
          <span>{t('lounge.acceptedModal.badge', { defaultValue: 'Davet Onaylandı' })}</span>
        </div>

        <h3 className="text-base sm:text-lg font-bold text-text">
          {t('lounge.acceptedModal.title', { defaultValue: 'Sohbet İsteğiniz Kabul Edildi!' })}
        </h3>

        <p className="mt-2 text-xs leading-relaxed text-muted">
          {t('lounge.acceptedModal.desc', {
            alias: chatAcceptedModal.partner?.alias,
            defaultValue: `${chatAcceptedModal.partner?.alias} sohbet isteğinizi kabul etti! Artık karşılıklı anonim olarak sohbet edebilirsiniz.`,
          })}
        </p>

        <div className="mt-4 rounded-md border border-border bg-secondary/70 p-3 text-left text-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-muted text-[11px]">{t('lounge.acceptedModal.userLabel', { defaultValue: 'Kullanıcı:' })}</span>
            <span className="font-semibold text-text">{chatAcceptedModal.partner?.alias}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted text-[11px]">{t('lounge.acceptedModal.identityLabel', { defaultValue: 'Kimlik:' })}</span>
            <span className="text-text">
              {chatAcceptedModal.partner?.gender === 'female'
                ? t('lounge.genders.female', { defaultValue: 'Kadın 👩' })
                : chatAcceptedModal.partner?.gender === 'male'
                  ? t('lounge.genders.male', { defaultValue: 'Erkek 👨' })
                  : t('lounge.genders.unspecified', { defaultValue: 'Gizli 🔒' })}{' '}
              • {chatAcceptedModal.partner?.ageRange || t('lounge.profileModal.unspecifiedAge', { defaultValue: 'Gizli' })}
            </span>
          </div>
          {chatAcceptedModal.partner?.status && (
            <div className="flex items-center justify-between pt-1 border-t border-border/60">
              <span className="text-muted text-[11px]">{t('lounge.profileModal.statusLabel', { defaultValue: 'Durum:' })}</span>
              <span className="text-text text-[11px] truncate max-w-[180px]">
                {chatAcceptedModal.partner.status}
              </span>
            </div>
          )}
        </div>

        <div className="mt-5 flex items-center gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-md border border-border bg-secondary py-2.5 text-xs font-semibold text-text hover:bg-secondary-hover transition-colors cursor-pointer"
          >
            {t('common.later', { defaultValue: 'Daha Sonra' })}
          </button>
          <button
            type="button"
            onClick={onEnterChat}
            className="flex-1 rounded-md bg-primary py-2.5 text-xs font-bold !text-white shadow hover:bg-primary-hover active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>{t('lounge.acceptedModal.startBtn', { defaultValue: 'Sohbete Gir' })}</span>
            <span>💬</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export function RevealConfirmModal({
  revealConfirmModal,
  activeDirectSession,
  onClose,
  onConfirmReveal,
  t,
}) {
  if (!revealConfirmModal || !activeDirectSession) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-md border border-border bg-card p-5 sm:p-6 text-text shadow-2xl text-center animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        <div
          className="mx-auto mb-3.5 flex size-14 items-center justify-center rounded-2xl text-3xl shadow-md"
          style={{
            background:
              revealConfirmModal === 'accept'
                ? 'linear-gradient(135deg, #10b981, #059669)'
                : 'linear-gradient(135deg, #8b5cf6, #3b82f6)',
          }}
        >
          🎭
        </div>

        <div
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold mb-2 ${
            revealConfirmModal === 'accept'
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : 'bg-primary/10 text-primary'
          }`}
        >
          <span>
            {revealConfirmModal === 'accept'
              ? t('lounge.reveal.mutualTag', { defaultValue: '🤝 Karşılıklı Onay' })
              : t('lounge.reveal.requestTag', { defaultValue: '🔍 Kimlik Açma Talebi' })}
          </span>
        </div>

        <h3 className="text-base sm:text-lg font-bold text-text">
          {revealConfirmModal === 'accept'
            ? t('lounge.reveal.acceptConfirmTitle', { defaultValue: 'Gerçek Profilinizi Paylaşmayı Onaylıyor musunuz?' })
            : t('lounge.reveal.requestConfirmTitle', { defaultValue: 'Gerçek Profilini Açmak İstiyor musun?' })}
        </h3>

        <p className="mt-2 text-xs leading-relaxed text-muted">
          {revealConfirmModal === 'accept' ? (
            <>
              {t('lounge.reveal.acceptConfirmDesc', {
                alias: activeDirectSession.partner?.alias,
                defaultValue: `${activeDirectSession.partner?.alias} kullanıcısının kimlik açma davetini kabul etmek üzeresiniz.`,
              })}
            </>
          ) : (
            <>
              {t('lounge.reveal.requestConfirmDesc', {
                alias: activeDirectSession.partner?.alias,
                defaultValue: `${activeDirectSession.partner?.alias} kullanıcısına maskeyi kaldırma ve gerçek profilleri görme isteği gönderilecek.`,
              })}
            </>
          )}
        </p>

        <div className="mt-4 rounded-md border border-border bg-secondary/70 p-3.5 text-left text-xs text-text space-y-2.5">
          <div className="flex items-start gap-2.5">
            <span className="text-base shrink-0">
              {revealConfirmModal === 'accept' ? '🔓' : '🤝'}
            </span>
            <p className="text-[11px] leading-relaxed text-muted">
              {revealConfirmModal === 'accept' ? (
                <>
                  <strong>{t('lounge.reveal.boxAcceptTitle', { defaultValue: 'Profiliniz Açılacak:' })}</strong>{' '}
                  {t('lounge.reveal.boxAcceptDesc', {
                    defaultValue: 'Bu işlem onaylandığında gerçek Nest Social kullanıcı adınız ve profiliniz karşı tarafa görünecektir. Siz de karşı tarafın gerçek profilini göreceksiniz.',
                  })}
                </>
              ) : (
                <>
                  <strong>{t('lounge.reveal.boxRequestTitle', { defaultValue: 'Karşı Tarafın Onayı Gerekir:' })}</strong>{' '}
                  {t('lounge.reveal.boxRequestDesc', {
                    defaultValue: 'İstek karşı tarafa iletilir. Yalnızca karşı taraf da onaylarsa birbirinizin gerçek profillerini görebilirsiniz.',
                  })}
                </>
              )}
            </p>
          </div>
          <div className="flex items-start gap-2.5">
            <span className="text-base shrink-0">🛡️</span>
            <p className="text-[11px] leading-relaxed text-muted">
              {revealConfirmModal === 'accept' ? (
                <>
                  {t('lounge.reveal.boxAcceptNote', {
                    defaultValue: 'Karşılıklı onay verilmeden önce hiçbir gerçek profil bilgisi paylaşılmaz.',
                  })}
                </>
              ) : (
                <>
                  {t('lounge.reveal.boxRequestNote', {
                    defaultValue: 'Karşı taraf kabul etmediği sürece kimliğiniz %100 gizli kalmaya devam eder.',
                  })}
                </>
              )}
            </p>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-md border border-border bg-secondary py-2.5 text-xs font-semibold text-text hover:bg-secondary-hover transition-colors cursor-pointer"
          >
            {t('common.cancel', { defaultValue: 'Vazgeç' })}
          </button>
          <button
            type="button"
            onClick={onConfirmReveal}
            className={`flex-1 rounded-md py-2.5 text-xs font-bold !text-white shadow active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              revealConfirmModal === 'accept'
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-primary hover:bg-primary-hover'
            }`}
          >
            <span>
              {revealConfirmModal === 'accept'
                ? t('lounge.reveal.confirmAcceptBtn', { defaultValue: 'Evet, Profilimi Paylaş' })
                : t('lounge.reveal.confirmRequestBtn', { defaultValue: 'Evet, İstek Gönder' })}
            </span>
            <span>🎭</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export function ExitConfirmModal({ show, onClose, onConfirm, t }) {
  if (!show) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-md border border-border bg-card p-5 sm:p-6 text-text shadow-2xl"
        role="dialog"
        aria-modal="true"
      >
        <div className="text-center">
          <div className="mx-auto mb-3.5 flex items-center justify-center gap-2">
            <span className="grid size-10 place-items-center rounded-2xl bg-primary text-inverse font-bold text-base shadow-sm">
              NS
            </span>
            <span className="text-lg font-extrabold text-text tracking-tight">Nest Social</span>
          </div>

          <h3 className="text-base sm:text-lg font-bold text-text">
            {t('lounge.exitModal.title', { defaultValue: "Nest Social'e Dönüyorsunuz" })}
          </h3>

          <p className="mt-2 text-xs leading-relaxed text-muted">
            {t('lounge.exitModal.desc', {
              defaultValue: 'Gizli Profil & Anonim Lounge alanından çıkıp ana sosyal ağ akışınıza geri dönmek üzeresiniz. Onaylıyor musunuz?',
            })}
          </p>

          <div className="mt-5 flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-md border border-border bg-secondary py-2 text-xs font-semibold text-text hover:bg-secondary-hover transition-colors cursor-pointer"
            >
              {t('lounge.exitModal.cancel', { defaultValue: 'Vazgeç' })}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="flex-1 rounded-md bg-primary py-2 text-xs font-bold !text-white shadow hover:bg-primary-hover active:scale-95 transition-all cursor-pointer"
            >
              {t('lounge.exitModal.confirm', { defaultValue: 'Evet, Geri Dön' })}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
