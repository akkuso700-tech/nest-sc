function ActionToast({ toast, onClose }) {
  if (!toast?.message) {
    return null
  }

  const toneClasses =
    toast.tone === 'error'
      ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/70 dark:text-rose-200'
      : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/70 dark:text-emerald-200'

  return (
    <div className="fixed bottom-5 right-5 z-[95] animate-[toast-in_220ms_ease-out]">
      <div className={`min-w-[280px] rounded-2xl border px-4 py-3 shadow-[0_20px_40px_rgba(15,23,42,0.16)] backdrop-blur ${toneClasses}`}>
        <div className="flex items-start justify-between gap-4">
          <p className="text-sm font-medium">{toast.message}</p>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold opacity-70 transition hover:opacity-100"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  )
}

export default ActionToast
