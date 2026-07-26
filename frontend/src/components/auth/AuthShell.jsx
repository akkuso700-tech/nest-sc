import { AuthArrowLeftIcon, AuthCloseIcon } from './AuthIcons.jsx'

function AuthStepIndicator({ step = 0, items = [] }) {
  if (!items.length) {
    return null
  }

  const activeIndex = items.findIndex((item) => item.id === step)

  return (
    <div className="mb-5 grid gap-2" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((item, index) => {
        const isActive = item.id === step
        const isPassed = activeIndex >= 0 ? index < activeIndex : item.id < step

        return (
          <div key={item.id} className="space-y-2">
            <div
              className={`h-2 rounded-full transition ${
                isActive || isPassed
                  ? 'bg-primary'
                  : 'bg-secondary'
              }`}
            />
            <div className="flex items-center gap-2 text-xs">
              <span
                className={`grid size-6 place-items-center rounded-full font-semibold transition ${
                  isActive || isPassed
                    ? 'bg-primary text-inverse '
                    : 'bg-secondary text-muted'
                }`}
              >
                {index + 1}
              </span>
              <span className={`${isActive ? 'text-zinc-950 dark:text-white' : 'text-zinc-500 dark:text-zinc-400'}`}>
                {item.label}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function AuthShell({
  title,
  subtitle,
  children,
  footer,
  onClose,
  onBack = null,
  step = 0,
  stepItems = [],
  stepLabel = 'Step',
  backAriaLabel = 'Go back',
}) {
  const currentStepIndex = stepItems.findIndex((item) => item.id === step)
  const displayedStep = currentStepIndex >= 0 ? currentStepIndex + 1 : step

  return (
    <div className="flex min-h-screen items-center justify-center bg-card md:bg-bg md:px-4 md:py-10 text-zinc-900 transition-colors ">
      <div className="w-full max-w-lg md:rounded-lg md:border md:border-border bg-card p-7  ">
        <div className="mb-5">
          <div className="mb-5 flex items-center justify-between gap-4">
            {stepItems.length ? (
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                {stepLabel} {displayedStep} / {stepItems.length}
              </p>
            ) : (
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                Nest Social
              </p>
            )}
            <div className="flex items-center gap-2">
              {onBack ? (
                <button
                  type="button"
                  onClick={onBack}
                  className="grid size-10 place-items-center rounded-full border border-border cursor-pointer text-muted transition hover:bg-secondary "
                  aria-label={backAriaLabel}
                >
                  <AuthArrowLeftIcon />
                </button>
              ) : null}
              <button
                type="button"
                onClick={onClose}
                className="grid size-10 place-items-center rounded-full border border-border cursor-pointer text-muted transition hover:bg-secondary"
                aria-label="Kapat"
              >
                <AuthCloseIcon />
              </button>
            </div>
          </div>

          <AuthStepIndicator step={step} items={stepItems} />

          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-text">
              {title}
            </h1>
            <p className="text-sm leading-6 text-zinc-500 dark:text-zinc-400">
              {subtitle}
            </p>
          </div>
        </div>
        {children}
        <div className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">{footer}</div>
      </div>
    </div>
  )
}

export default AuthShell
