import { resolveMediaUrl } from '../../utils/media.js'

function CloseIcon({ className = 'size-4' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  )
}

function PhotoIcon({ className = 'size-4' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="4" y="5" width="16" height="14" rx="3" />
      <circle cx="9" cy="10" r="1.5" />
      <path d="m20 15-4.5-4.5L8 18" />
    </svg>
  )
}

function SendIcon({ className = 'size-4' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M21 3 10 14" />
      <path d="m21 3-7 18-4-7-7-4 18-7Z" />
    </svg>
  )
}

function ReplyComposer({
  draft,
  onDraftChange,
  disabled,
  isSubmitting,
  placeholder,
  onCancel,
  onOpenMediaPicker,
  onSubmit,
  canSubmit,
  commentPreview,
  onClearMedia,
  submitError,
  labels = {},
}) {
  const {
    cancel = 'Vazgec',
    addMedia = 'Medya ekle',
    send = 'Gonder',
    removePreview = 'Kaldir',
  } = labels

  return (
    <div className="rounded-xl border border-border bg-card px-2.5 pb-2.5 pt-2 shadow-[0_8px_24px_rgba(15,23,42,0.06)] dark:shadow-none">
      <div className="absolute right-2.5 top-2.5 z-10 flex items-center justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="grid size-6 cursor-pointer place-items-center rounded-full text-muted transition hover:bg-secondary hover:text-text"
          aria-label={cancel}
          title={cancel}
        >
          <CloseIcon />
        </button>
      </div>
      {submitError ? (
        <div className="mb-2 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1.5 text-xs text-rose-600 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
          {submitError}
        </div>
      ) : null}
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <textarea
            rows={1}
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            disabled={disabled || isSubmitting}
            placeholder={placeholder}
            className="max-h-[170px] min-h-[68px] w-full resize-none bg-transparent pr-9 px-1 pt-1 pb-1.5 text-sm text-text outline-none placeholder:text-soft disabled:cursor-not-allowed"
          />
          {commentPreview ? (
            <div className="relative mt-2 h-16 w-16 overflow-hidden rounded-xl border border-border bg-secondary">
              {commentPreview.type === 'video' ? (
                <video src={resolveMediaUrl(commentPreview.url)} className="h-full w-full object-cover" muted playsInline />
              ) : (
                <img src={resolveMediaUrl(commentPreview.url)} alt={commentPreview.name} className="h-full w-full object-cover" />
              )}
              <button type="button" onClick={onClearMedia} className="absolute right-1 top-1 grid size-4 place-items-center rounded-full bg-black/70 text-white" aria-label={removePreview} title={removePreview}>
                <CloseIcon className="size-3" />
              </button>
            </div>
          ) : null}
        </div>
        <div className="mb-0.5 flex items-center gap-1">
          <button type="button" onClick={onOpenMediaPicker} disabled={disabled || isSubmitting} className="grid size-9 place-items-center cursor-pointer rounded-full text-muted transition hover:bg-secondary hover:text-text disabled:cursor-not-allowed disabled:opacity-50" aria-label={addMedia} title={addMedia}><PhotoIcon className="size-4" /></button>
          <button type="button" onClick={onSubmit} disabled={disabled || isSubmitting || !canSubmit} className="grid size-9 place-items-center cursor-pointer rounded-full bg-primary text-inverse transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:bg-secondary-hover disabled:text-soft" aria-label={send} title={send}><SendIcon className="size-4" /></button>
        </div>
      </div>
    </div>
  )
}

export default ReplyComposer
