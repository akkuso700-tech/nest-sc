import {
  PasswordInput,
  AlertTriangleIcon,
  TrashIcon,
} from './EditProfileCommon.jsx'

export function EditProfileSecurityTab({
  passwordState,
  setPasswordState,
  showCurrentPassword,
  setShowCurrentPassword,
  showNewPassword,
  setShowNewPassword,
  showConfirmNewPassword,
  setShowConfirmNewPassword,
  onChangePassword,
  deleteState,
  setDeleteState,
  showDeletePassword,
  setShowDeletePassword,
  onDeleteAccount,
  t,
}) {
  return (
    <section
      id="tabpanel-hesap-guvenlik"
      role="tabpanel"
      aria-labelledby="tab-hesap-guvenlik"
      className="space-y-6"
    >
      {/* Kart 1: Şifre Değiştir */}
      <div className="rounded-xl border border-border bg-card p-5 md:p-6 shadow-sm">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-text">
            {t('profile.edit.passwordSectionTitle', 'Şifre Değiştir')}
          </h2>
          <p className="text-xs text-soft mt-1">
            {t(
              'profile.edit.passwordSectionDescription',
              'Mevcut şifrenizi ve yeni şifrenizi girerek hesap şifrenizi güncelleyebilirsiniz.'
            )}
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            onChangePassword()
          }}
        >
          <div className="grid gap-4 md:grid-cols-3">
            <PasswordInput
              label={t('profile.edit.currentPassword', 'Mevcut Şifre')}
              value={passwordState.currentPassword}
              visible={showCurrentPassword}
              onToggle={() => setShowCurrentPassword((current) => !current)}
              showLabel={t('auth.showPassword')}
              hideLabel={t('auth.hidePassword')}
              placeholder="••••••••"
              onChange={(event) =>
                setPasswordState((currentState) => ({
                  ...currentState,
                  currentPassword: event.target.value,
                  error: '',
                }))
              }
            />

            <PasswordInput
              label={t('profile.edit.newPassword', 'Yeni Şifre')}
              value={passwordState.newPassword}
              visible={showNewPassword}
              onToggle={() => setShowNewPassword((current) => !current)}
              showLabel={t('auth.showPassword')}
              hideLabel={t('auth.hidePassword')}
              placeholder="••••••••"
              onChange={(event) =>
                setPasswordState((currentState) => ({
                  ...currentState,
                  newPassword: event.target.value,
                  error: '',
                }))
              }
            />

            <PasswordInput
              label={t('profile.edit.confirmNewPassword', 'Yeni Şifre (Tekrar)')}
              value={passwordState.confirmNewPassword}
              visible={showConfirmNewPassword}
              onToggle={() => setShowConfirmNewPassword((current) => !current)}
              showLabel={t('auth.showPassword')}
              hideLabel={t('auth.hidePassword')}
              placeholder="••••••••"
              onChange={(event) =>
                setPasswordState((currentState) => ({
                  ...currentState,
                  confirmNewPassword: event.target.value,
                  error: '',
                }))
              }
            />
          </div>

          {passwordState.error ? (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
              {passwordState.error}
            </div>
          ) : null}

          <div className="mt-5 flex justify-end">
            <button
              type="submit"
              disabled={
                passwordState.isSubmitting ||
                !passwordState.currentPassword ||
                !passwordState.newPassword ||
                !passwordState.confirmNewPassword
              }
              className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-zinc-400 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400 shadow-sm cursor-pointer"
            >
              {passwordState.isSubmitting
                ? t('profile.edit.updating')
                : t('profile.edit.changePassword')}
            </button>
          </div>
        </form>
      </div>

      {/* Kart 2: Hesabı Sil (Tehlikeli Alan) */}
      <div className="rounded-xl border-2 border-rose-500/30 bg-rose-500/5 dark:bg-rose-950/20 p-5 md:p-6 shadow-sm">
        <div className="mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangleIcon />
            <h2 className="text-base font-bold text-rose-600 dark:text-rose-400">
              {t('profile.edit.deleteSectionTitle', 'Hesabı Sil')}
            </h2>
            <span className="rounded-full bg-rose-500/15 px-2.5 py-0.5 text-xs font-semibold text-rose-600 dark:text-rose-300">
              {t('profile.edit.dangerZone', 'Tehlikeli Alan')}
            </span>
          </div>
          <p className="mt-1.5 text-xs leading-5 text-rose-800/80 dark:text-rose-200/80">
            {t(
              'profile.edit.deleteAccountWarning',
              'Dikkat: Hesabınızı sildiğinizde profiliniz, tüm paylaşımlarınız, mesajlarınız ve verileriniz kalıcı olarak silinir. Bu işlem kesinlikle geri alınamaz.'
            )}
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            onDeleteAccount()
          }}
          className="mt-4 max-w-md space-y-4"
        >
          <PasswordInput
            label={t('profile.edit.deleteConfirmPasswordLabel', 'Onaylamak için mevcut şifrenizi girin')}
            value={deleteState.currentPassword}
            visible={showDeletePassword}
            onToggle={() => setShowDeletePassword((current) => !current)}
            showLabel={t('auth.showPassword')}
            hideLabel={t('auth.hidePassword')}
            placeholder="••••••••"
            onChange={(event) =>
              setDeleteState((currentState) => ({
                ...currentState,
                currentPassword: event.target.value,
                error: '',
              }))
            }
          />

          {deleteState.error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
              {deleteState.error}
            </div>
          ) : null}

          <div className="pt-2">
            <button
              type="submit"
              disabled={deleteState.isSubmitting || !deleteState.currentPassword}
              className="flex items-center gap-2 rounded-lg bg-rose-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-rose-300 dark:disabled:bg-rose-900/50 shadow-sm cursor-pointer"
            >
              <TrashIcon />
              <span>
                {deleteState.isSubmitting
                  ? t('profile.edit.deleting')
                  : t('profile.edit.deleteAccount', 'Hesabı Kalıcı Olarak Sil')}
              </span>
            </button>
          </div>
        </form>
      </div>
    </section>
  )
}
