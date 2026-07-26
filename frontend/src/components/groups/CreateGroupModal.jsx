import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import UserAvatar from '../common/UserAvatar.jsx'
import { getFullName } from '../../utils/social.js'

const GROUP_NAME_MAX_LENGTH = 30

function CreateGroupModal({ open, onClose, user, onCreate }) {
  const { t } = useTranslation()
  const [groupName, setGroupName] = useState('')
  const [privacy, setPrivacy] = useState('public')
  const [privacyMenuOpen, setPrivacyMenuOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const privacyOptions = [
    { value: 'public', label: t('groups.privacyPublic') },
    { value: 'private', label: t('groups.privacyPrivate') },
  ]
  const selectedPrivacyLabel =
    privacyOptions.find((option) => option.value === privacy)?.label || t('groups.privacyPublic')

  if (!open) {
    return null
  }

  async function handleCreate(event) {
    event.preventDefault()
    const trimmedName = groupName.trim()
    if (!trimmedName) {
      return
    }
    if (trimmedName.length > GROUP_NAME_MAX_LENGTH) {
      setSubmitError(`Grup adi en fazla ${GROUP_NAME_MAX_LENGTH} karakter olabilir.`)
      return
    }
    setSubmitError('')
    setIsSubmitting(true)
    try {
      if (typeof onCreate === 'function') {
        await onCreate({
          name: trimmedName,
          privacy,
        })
      }
      setGroupName('')
      setPrivacy('public')
      setPrivacyMenuOpen(false)
      onClose?.()
    } catch (error) {
      setSubmitError(error?.message || t('groups.createFailed'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[95] bg-black/55 p-4 backdrop-blur-sm">
      <form
        onSubmit={handleCreate}
        className="mx-auto mt-10 w-full max-w-md rounded-[24px] border border-border bg-card p-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <UserAvatar
              user={user}
              className="size-11 text-sm font-semibold"
              textClassName="text-sm font-semibold"
            />
            <div>
              <p className="text-sm font-semibold text-text">{getFullName(user)}</p>
              <p className="text-xs text-muted">{t('groups.roleAdmin')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-9 place-items-center rounded-full border border-border text-muted transition hover:bg-secondary hover:text-text"
            aria-label={t('common.close')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-text">{t('groups.groupName')}</span>
            <input
              type="text"
              value={groupName}
              onChange={(event) => setGroupName(event.target.value)}
              maxLength={GROUP_NAME_MAX_LENGTH}
              placeholder={t('groups.groupName')}
              className="h-11 w-full rounded-lg border border-border bg-secondary px-3 text-sm text-text outline-none placeholder:text-soft focus:border-border-strong"
            />
            <span className="mt-1 block text-right text-xs text-muted">
              {groupName.length}/{GROUP_NAME_MAX_LENGTH}
            </span>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-text">{t('groups.privacyPublic')} / {t('groups.privacyPrivate')}</span>
            <div className="relative">
              <button
                type="button"
                onClick={() => setPrivacyMenuOpen((current) => !current)}
                className={`flex h-11 w-full items-center justify-between rounded-lg border px-3 text-sm transition ${
                  privacyMenuOpen
                    ? 'border-border-strong bg-card text-text'
                    : 'border-border bg-card text-text hover:bg-secondary'
                }`}
              >
                <span>{selectedPrivacyLabel}</span>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className={`size-4 transition ${privacyMenuOpen ? 'rotate-180' : ''}`}
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>

              {privacyMenuOpen ? (
                <div className="absolute left-0 top-[calc(100%+3px)] z-20 w-full rounded-lg border border-border bg-card p-2 shadow-[0_24px_60px_rgba(15,23,42,0.18)]">
                  {privacyOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setPrivacy(option.value)
                        setPrivacyMenuOpen(false)
                      }}
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition ${
                        privacy === option.value
                          ? 'bg-secondary text-text'
                          : 'text-text hover:bg-nav-hover'
                      }`}
                    >
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </label>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-inverse transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? t('groups.creating') : t('groups.createGroup')}
          </button>
          {submitError ? (
            <p className="text-sm text-rose-600">{submitError}</p>
          ) : null}
        </div>
      </form>
    </div>
  )
}

export default CreateGroupModal
