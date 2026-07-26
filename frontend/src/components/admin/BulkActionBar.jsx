function BulkActionBar({ count, label, onClear, actions = [] }) {
  if (!count) {
    return null
  }

  return (
    <div className="sticky top-[84px] z-20 rounded-[24px] border border-zinc-900 bg-zinc-950 px-4 py-4 text-white shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">
            {count} {label} secildi
          </p>
          <p className="mt-1 text-xs text-zinc-300">
            Secili kayitlara toplu moderasyon uygulayabilir veya secimi temizleyebilirsin.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={action.onClick}
              disabled={action.disabled}
              className={`rounded-full px-4 py-2 text-sm font-medium ${
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
            className="rounded-full border border-white/20 px-4 py-2 text-sm font-medium text-white"
          >
            Temizle
          </button>
        </div>
      </div>
    </div>
  )
}

export default BulkActionBar
