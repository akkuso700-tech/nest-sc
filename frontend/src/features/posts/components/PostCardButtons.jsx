export function InlineActionButton({
  icon,
  count,
  label,
  onClick,
  onCountClick,
  active = false,
  disabled = false,
}) {
  const shouldRenderCount = count !== null && typeof count !== 'undefined' && `${count}`.length > 0
  const canClickCount = typeof onCountClick === 'function' && shouldRenderCount && Number(count) > 0

  if (canClickCount) {
    return (
      <div
        className={`inline-flex min-h-11 items-center rounded-lg transition ${
          active
            ? 'bg-nav-active text-primary'
            : 'text-text hover:bg-secondary hover:text-text'
        } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
      >
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
          title={label}
          className="inline-flex min-h-11 min-w-8 items-center justify-center p-2.5 cursor-pointer disabled:cursor-not-allowed"
        >
          {icon}
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onCountClick()
          }}
          className="py-2.5 pr-2.5 -ml-1 text-xs font-semibold hover:underline cursor-pointer focus:outline-none"
        >
          {count}
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`inline-flex min-h-11 min-w-11 items-center cursor-pointer justify-center gap-2 rounded-lg px-3 text-sm transition ${
        active
          ? 'bg-nav-active text-primary'
          : 'text-text hover:bg-secondary hover:text-text'
      } disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {icon}
      {shouldRenderCount ? <span className="text-xs font-semibold">{count}</span> : null}
    </button>
  )
}

export function LoopVerticalActionButton({
  icon,
  count,
  label,
  onClick,
  onCountClick,
  disabled = false,
  active = false,
  isDesktop = false,
}) {
  const shouldRenderCount = count !== null && typeof count !== 'undefined' && `${count}`.length > 0
  const canClickCount = typeof onCountClick === 'function' && shouldRenderCount && Number(count) > 0

  if (isDesktop) {
    return (
      <div className="flex flex-col items-center gap-1">
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
          className={`grid size-11 place-items-center rounded-full border shadow-lg backdrop-blur-md transition-all active:scale-95 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
            active
              ? 'bg-primary/20 border-primary/40 text-primary'
              : 'bg-card/90 border-border text-text hover:bg-secondary hover:text-primary'
          }`}
        >
          {icon}
        </button>
        {shouldRenderCount ? (
          canClickCount ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onCountClick()
              }}
              className="text-xs font-bold leading-tight text-text/90 hover:text-primary hover:underline cursor-pointer py-0.5"
              title="Beğenenleri gör"
            >
              {count}
            </button>
          ) : (
            <span className="text-xs font-bold leading-tight text-text/90 select-none">{count}</span>
          )
        ) : null}
      </div>
    )
  }

  return (
    <div className="inline-flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-1 text-white">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className="grid size-8 place-items-center cursor-pointer transition active:scale-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {icon}
      </button>
      {shouldRenderCount ? (
        canClickCount ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onCountClick()
            }}
            className="text-[10px] font-semibold leading-none text-white/90 hover:text-white hover:underline cursor-pointer py-0.5"
            title="Beğenenleri gör"
          >
            {count}
          </button>
        ) : (
          <span className="text-[10px] font-semibold leading-none select-none">{count}</span>
        )
      ) : null}
    </div>
  )
}
