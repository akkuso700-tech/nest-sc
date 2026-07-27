function BulkActionBar({ count, label, onClear, actions = [] }) {
  if (!count) {
    return null
  }

  return (
    <div className="sticky top-[84px] z-30 rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-white shadow-[0_18px_40px_rgba(15,23,42,0.22)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">
            {count} {label} seçildi
          </p>
          <p className="mt-1 text-xs text-zinc-300">
            Seçili kayıtlara toplu işlem uygulayabilir veya seçimi temizleyebilirsiniz.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={action.onClick}
              disabled={action.disabled}
              className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
                action.tone === 'danger'
                  ? 'bg-rose-500 text-white'
                  : action.tone === 'success'
                    ? 'bg-emerald-400 text-zinc-950'
                    : 'bg-white/10 text-white'
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {action.label}
            </button>
          ))}
          <button
            type="button"
            onClick={onClear}
            className="rounded-lg border border-white/20 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-white/10"
          >
            Temizle
          </button>
        </div>
      </div>
    </div>
  )
}

export default BulkActionBar
