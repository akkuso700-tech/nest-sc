import { ToggleSwitch } from './EditProfileCommon.jsx'

export function EditProfileNotificationsTab({
  formState,
  setFormState,
  onSave,
  commSaveState,
  hasCommunicationChanges,
  showCommSavedState,
  t,
}) {
  return (
    <section
      id="tabpanel-iletisim-tercihleri"
      role="tabpanel"
      aria-labelledby="tab-iletisim-tercihleri"
      className="space-y-6"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onSave()
        }}
        className="space-y-6"
      >
        {/* Kart 1: Mesaj Bildirimleri */}
        <div className="rounded-xl border border-border bg-card p-5 md:p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-text">
              {t('profile.edit.messageNotificationsTitle', 'Mesaj Bildirimleri')}
            </h2>
            <p className="text-xs text-soft mt-1">
              {t(
                'profile.edit.messageNotificationsDesc',
                'Mesajlar ve arama izinleri ile ilgili bildirim ayarlarınızı düzenleyin.'
              )}
            </p>
          </div>

          <div className="space-y-4">
            {/* Mesaj e-posta bildirimi */}
            <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/40 p-4 transition hover:bg-secondary/60">
              <div className="pr-4">
                <p className="text-sm font-medium text-text">
                  {t('profile.edit.emailMessagesNotification', 'Mesaj e-posta bildirimi')}
                </p>
                <p className="text-xs text-muted mt-0.5">
                  {t(
                    'profile.edit.emailMessagesNotificationDesc',
                    'Yeni bir direkt mesaj aldığınızda e-posta ile bildirim alın.'
                  )}
                </p>
              </div>
              <ToggleSwitch
                checked={formState.emailMessagesEnabled}
                onChange={(checked) =>
                  setFormState((prev) => ({
                    ...prev,
                    emailMessagesEnabled: checked,
                  }))
                }
                ariaLabel="Mesaj e-posta bildirimi"
              />
            </div>

            {/* Sesli ve Görüntülü arama izinleri */}
            <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/40 p-4 transition hover:bg-secondary/60">
              <div className="pr-4">
                <p className="text-sm font-medium text-text">
                  {t('profile.edit.callingAndVideoPermissions', 'Sesli ve Görüntülü arama izinleri')}
                </p>
                <p className="text-xs text-muted mt-0.5">
                  {t(
                    'profile.edit.callingAndVideoPermissionsDesc',
                    'Diğer kullanıcıların sizinle sesli veya görüntülü arama başlatabilmesine izin verin.'
                  )}
                </p>
              </div>
              <ToggleSwitch
                checked={formState.callPermissionsEnabled}
                onChange={(checked) =>
                  setFormState((prev) => ({
                    ...prev,
                    callPermissionsEnabled: checked,
                    voiceCallEnabled: checked,
                    videoCallEnabled: checked,
                  }))
                }
                ariaLabel="Sesli ve görüntülü arama izinleri"
              />
            </div>
          </div>
        </div>

        {/* Kart 2: Gölge Modu (Shadow / Gizli Mesajlaşma) Bildirimleri */}
        <div className="rounded-xl border border-border bg-card p-5 md:p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-text">
              {t('profile.edit.shadowNotificationsTitle', 'Gölge Modu Bildirimleri')}
            </h2>
            <p className="text-xs text-soft mt-1">
              {t(
                'profile.edit.shadowNotificationsDesc',
                'Gizli eşleşmeler ve gölge mesajlaşma odaları ile ilgili uyarı tercihlerinizi yönetin.'
              )}
            </p>
          </div>

          <div className="space-y-4">
            {/* Gölge modu anlık bildirimler */}
            <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/40 p-4 transition hover:bg-secondary/60">
              <div className="pr-4">
                <p className="text-sm font-medium text-text">
                  {t('profile.edit.shadowInAppLabel', 'Gölge modu anlık bildirimleri')}
                </p>
                <p className="text-xs text-muted mt-0.5">
                  {t(
                    'profile.edit.shadowInAppDesc',
                    'Anonim mesaj ve talepler geldiğinde uygulama içinde anlık bildirim rozeti gösterilsin.'
                  )}
                </p>
              </div>
              <ToggleSwitch
                checked={formState.shadowInAppEnabled}
                onChange={(checked) =>
                  setFormState((prev) => ({
                    ...prev,
                    shadowInAppEnabled: checked,
                  }))
                }
                ariaLabel="Gölge modunda gelen mesajların anlık bildirilmesi"
              />
            </div>

            {/* Gölge modu e-posta bildirimleri */}
            <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/40 p-4 transition hover:bg-secondary/60">
              <div className="pr-4">
                <p className="text-sm font-medium text-text">
                  {t('profile.edit.shadowEmailLabel', 'Gölge modu e-posta bildirimleri')}
                </p>
                <p className="text-xs text-muted mt-0.5">
                  {t(
                    'profile.edit.allowShadowEmailNotificationsDescription',
                    'Gölge Modunda çevrimdışıyken gelen mesajlar için e-posta bildirimi gönderilsin.'
                  )}
                </p>
              </div>
              <ToggleSwitch
                checked={formState.shadowEmailEnabled}
                onChange={(checked) =>
                  setFormState((prev) => ({
                    ...prev,
                    shadowEmailEnabled: checked,
                  }))
                }
                ariaLabel="Gölge modu e-posta bildirimleri"
              />
            </div>
          </div>
        </div>

        {commSaveState.error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
            {commSaveState.error}
          </div>
        ) : null}

        {commSaveState.success ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200">
            {commSaveState.success}
          </div>
        ) : null}

        {/* Bağımsız Kaydet Butonu */}
        <div className="flex justify-end pt-1">
          <button
            type="submit"
            disabled={!hasCommunicationChanges || commSaveState.isSubmitting}
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition hover:bg-primary-hover cursor-pointer disabled:cursor-not-allowed disabled:bg-zinc-400 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400 shadow-sm"
          >
            {commSaveState.isSubmitting
              ? t('profile.edit.saving')
              : showCommSavedState
                ? t('profile.edit.saved')
                : t('profile.edit.savePreferences', 'Tercihleri Kaydet')}
          </button>
        </div>
      </form>
    </section>
  )
}
