function BulkActionBar({ count, label, onClear, actions = [], className = '' }) {
  if (!count) {
    return null
  }

  return (
    <div
      className={`z-50 rounded-xl border border-slate-700/80 bg-slate-900/95 backdrop-blur-md px-4 py-2 text-white shadow-[0_20px_50px_rgba(15,23,42,0.35)] animate-in fade-in slide-in-from-top-2 duration-150 ${className || 'sticky top-[84px]'}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs md:text-sm font-semibold truncate">
            {count} {label} seçildi
          </p>
          <p className="hidden sm:block text-[11px] text-zinc-300">
            Seçili kayıtlara toplu işlem uygulayabilir veya seçimi temizleyebilirsiniz.
          </p>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={action.onClick}
              disabled={action.disabled}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                action.tone === 'danger'
                  ? 'bg-rose-500 text-white hover:bg-rose-600'
                  : action.tone === 'success'
                    ? 'bg-emerald-400 text-zinc-950 hover:bg-emerald-300'
                    : 'bg-white/10 text-white hover:bg-white/20'
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {action.label}
            </button>
          ))}
          <button
            type="button"
            onClick={onClear}
            className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/10"
          >
            Temizle
          </button>
        </div>
      </div>
    </div>
  )
}

export default BulkActionBar
