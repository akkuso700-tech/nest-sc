import { useEffect, useState } from 'react'
import { createReport } from '../../services/reportService.js'

const reasonOptions = [
  'spam',
  'harassment',
  'hate speech',
  'violence',
  'sexual content',
  'misinformation',
  'other',
]

function ReportDialog({
  open,
  targetKind,
  targetId,
  title = 'Report content',
  onClose,
}) {
  const [reason, setReason] = useState('spam')
  const [details, setDetails] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState('')

  useEffect(() => {
    if (open) {
      setReason('spam')
      setDetails('')
      setFeedback('')
    }
  }, [open])

  if (!open || !targetKind || !targetId) {
    return null
  }

  async function handleSubmit() {
    setIsSubmitting(true)
    setFeedback('')

    try {
      const payload = await createReport({
        targetKind,
        targetId,
        reason,
        details,
      })
      setFeedback(payload.message || 'Report submitted.')
      setTimeout(() => {
        onClose()
      }, 900)
    } catch (error) {
      setFeedback(error.message || 'Report could not be submitted.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[90] bg-black/45 backdrop-blur-sm" onClick={onClose}>
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="w-full max-w-lg rounded-[28px] border border-zinc-200 bg-white p-6 shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <h2 className="text-xl font-semibold text-zinc-950">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-500">
            Tell us why this should be reviewed by the moderation team.
          </p>

          <label className="mt-5 block space-y-2">
            <span className="text-sm font-medium text-zinc-700">Reason</span>
            <select
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm outline-none"
            >
              {reasonOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="mt-4 block space-y-2">
            <span className="text-sm font-medium text-zinc-700">Details</span>
            <textarea
              rows={4}
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              placeholder="Optional context for the moderation team"
              className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm outline-none"
            />
          </label>

          {feedback ? (
            <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
              {feedback}
            </div>
          ) : null}

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="rounded-full bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
            >
              {isSubmitting ? 'Submitting...' : 'Submit report'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ReportDialog
