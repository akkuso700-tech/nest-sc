import { useTranslation } from 'react-i18next'

function UploadKindIcon({ kind, status }) {
  if (status === 'completed') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5">
        <path d="m5 12 4 4L19 6" />
      </svg>
    )
  }

  if (status === 'failed' || status === 'cancelled') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5">
        <path d="M12 8v5M12 17h.01" />
        <circle cx="12" cy="12" r="9" />
      </svg>
    )
  }

  if (kind === 'video') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5">
        <rect x="3" y="5" width="14" height="14" rx="3" />
        <path d="m17 10 4-2v8l-4-2" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5">
      <path d="M12 16V4m0 0L7 9m5-5 5 5" />
      <path d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
    </svg>
  )
}

function UploadItem({ upload, onCancel, onRetry, onRemove }) {
  const { t } = useTranslation()
  const isRunning = upload.status === 'queued' || upload.status === 'running'
  const isCompleted = upload.status === 'completed'
  const isFailed = upload.status === 'failed'
  const isCancelled = upload.status === 'cancelled'

  const toneClasses = isCompleted
    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300'
    : isFailed || isCancelled
      ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300'
      : 'bg-primary/10 text-primary'

  return (
    <article className="border-t border-border px-4 py-3 first:border-t-0" aria-live="polite">
      <div className="flex items-start gap-3">
        <span className={`grid size-9 shrink-0 place-items-center rounded-full ${toneClasses}`}>
          <UploadKindIcon kind={upload.kind} status={upload.status} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-text">{upload.title}</p>
              <p className={`mt-0.5 text-xs ${isFailed ? 'text-rose-600 dark:text-rose-300' : 'text-muted'}`}>
                {isFailed ? upload.error || upload.phase : upload.phase}
              </p>
            </div>

            {Number.isFinite(upload.progress) && isRunning ? (
              <span className="shrink-0 text-xs font-semibold tabular-nums text-text">%{upload.progress}</span>
            ) : null}
          </div>

          {isRunning ? (
            Number.isFinite(upload.progress) ? (
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary-hover">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
                  style={{ width: `${upload.progress}%` }}
                />
              </div>
            ) : (
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary-hover">
                <div className="h-full w-2/5 animate-[upload-indeterminate_1.2s_ease-in-out_infinite] rounded-full bg-primary" />
              </div>
            )
          ) : null}

          <div className="mt-2 flex items-center justify-end gap-3 text-xs font-semibold">
            {isRunning && upload.cancellable ? (
              <button type="button" onClick={() => onCancel(upload.id)} className="text-muted transition hover:text-rose-600">
                {t('uploadTray.cancel', { defaultValue: 'İptal' })}
              </button>
            ) : null}
            {isFailed || isCancelled ? (
              <button type="button" onClick={() => onRetry(upload.id)} className="text-primary transition hover:text-primary-hover">
                {t('uploadTray.retry', { defaultValue: 'Yeniden dene' })}
              </button>
            ) : null}
            {!isRunning ? (
              <button type="button" onClick={() => onRemove(upload.id)} className="text-muted transition hover:text-text">
                {t('common.close', { defaultValue: 'Kapat' })}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  )
}

function UploadTray({ uploads, isMinimized, onToggleMinimized, onCancel, onRetry, onRemove }) {
  const { t } = useTranslation()

  if (!uploads.length) {
    return null
  }

  const activeCount = uploads.filter((upload) => upload.status === 'queued' || upload.status === 'running').length
  const latestUpload = uploads[uploads.length - 1]

  if (isMinimized) {
    return (
      <button
        type="button"
        onClick={onToggleMinimized}
        className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-3 z-[115] flex max-w-[calc(100vw-1.5rem)] items-center gap-3 rounded-full border border-border bg-card px-4 py-3 text-left shadow-[0_18px_45px_rgba(15,23,42,0.2)] backdrop-blur md:bottom-5 md:right-5"
      >
        {activeCount ? (
          <span className="size-4 animate-spin rounded-full border-2 border-secondary-hover border-t-primary" />
        ) : (
          <span className="grid size-5 place-items-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5">
              <path d="m5 12 4 4L19 6" />
            </svg>
          </span>
        )}
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-text">
            {activeCount
              ? t('uploadTray.activeCount', { count: activeCount, defaultValue: '{{count}} yükleme devam ediyor' })
              : latestUpload.phase}
          </span>
        </span>
        {Number.isFinite(latestUpload.progress) && activeCount ? (
          <span className="text-xs font-semibold tabular-nums text-muted">%{latestUpload.progress}</span>
        ) : null}
      </button>
    )
  }

  return (
    <section className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] left-3 right-3 z-[115] overflow-hidden rounded-2xl border border-border bg-card/95 shadow-[0_24px_64px_rgba(15,23,42,0.24)] backdrop-blur-xl animate-[toast-in_220ms_ease-out] md:bottom-5 md:left-auto md:right-5 md:w-[390px]" aria-label={t('uploadTray.title', { defaultValue: 'Yüklemeler' })}>
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-text">{t('uploadTray.title', { defaultValue: 'Yüklemeler' })}</p>
          <p className="mt-0.5 text-xs text-muted">
            {activeCount
              ? t('uploadTray.continueBrowsing', { defaultValue: 'Siteyi kullanmaya devam edebilirsin.' })
              : t('uploadTray.completed', { defaultValue: 'Yükleme işlemi tamamlandı.' })}
          </p>
        </div>
        <button
          type="button"
          onClick={onToggleMinimized}
          className="grid size-8 place-items-center rounded-full text-muted transition hover:bg-secondary hover:text-text"
          aria-label={t('uploadTray.minimize', { defaultValue: 'Küçült' })}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4">
            <path d="M6 12h12" />
          </svg>
        </button>
      </header>

      <div className="subtle-scrollbar max-h-[min(52vh,420px)] overflow-y-auto">
        {uploads.map((upload) => (
          <UploadItem
            key={upload.id}
            upload={upload}
            onCancel={onCancel}
            onRetry={onRetry}
            onRemove={onRemove}
          />
        ))}
      </div>
    </section>
  )
}

export default UploadTray
