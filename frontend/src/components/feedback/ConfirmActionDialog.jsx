import { useEffect, useState } from 'react'

function ConfirmActionDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmTone = 'danger',
  reasonLabel = 'Reason',
  reasonPlaceholder = 'Optional note',
  showReasonField = true,
  defaultReason = '',
  isProcessing = false,
  onCancel,
  onClose,
  onConfirm,
}) {
  const [reason, setReason] = useState(defaultReason)

  useEffect(() => {
    if (open) {
      setReason(defaultReason || '')
    }
  }, [defaultReason, open])

  if (!open) {
    return null
  }

  const isDanger = confirmTone === 'danger'
  const handleCancel = onCancel || onClose || (() => {})

  return (
    <div className="fixed inset-0 z-[90] bg-black/52 backdrop-blur-sm" onClick={handleCancel}>
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="w-full max-w-md rounded-[24px] border border-zinc-200 bg-white p-5 shadow-[0_26px_80px_rgba(15,23,42,0.22)] sm:p-6"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start gap-3">
            <span className={`mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full ${isDanger ? 'bg-rose-50 text-rose-600' : 'bg-zinc-100 text-zinc-700'}`}>
              {isDanger ? '!' : '?'}
            </span>
            <div>
              <h2 className="text-lg font-semibold text-zinc-950">{title}</h2>
              <p className="mt-1 text-sm leading-6 text-zinc-500">{description}</p>
            </div>
          </div>

          {showReasonField ? (
            <label className="mt-5 block space-y-2">
              <span className="text-sm font-medium text-zinc-700">{reasonLabel}</span>
              <textarea
                rows={4}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder={reasonPlaceholder}
                className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm outline-none"
              />
            </label>
          ) : null}

          <div className="mt-6 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={handleCancel}
              disabled={isProcessing}
              className="rounded-full border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={() => onConfirm(reason)}
              disabled={isProcessing}
              className={`rounded-full px-4 py-2.5 text-sm font-semibold text-white transition ${
                confirmTone === 'danger' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-zinc-950 hover:bg-zinc-800'
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {isProcessing ? 'Saving...' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ConfirmActionDialog
