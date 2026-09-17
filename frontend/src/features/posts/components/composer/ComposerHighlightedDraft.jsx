export function renderHighlightedDraft(text = '') {
  if (!text) {
    return null
  }

  const parts = text.split(/(#[\p{L}\p{N}_]+|@[\p{L}\p{N}_]+)/gu)
  const elements = parts.map((part, index) => {
    if (!part) {
      return null
    }

    const isTag = /^(#[\p{L}\p{N}_]+|@[\p{L}\p{N}_]+)$/u.test(part)
    if (isTag) {
      return (
        <span key={`${part}-${index}`} className="text-primary font-normal">
          {part}
        </span>
      )
    }

    return part
  })

  if (text.endsWith('\n')) {
    elements.push('\u200b')
  }

  return elements
}

export default function ComposerHighlightedDraft({ text }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 select-none overflow-hidden whitespace-pre-wrap break-words font-sans text-[15px] leading-7 text-text"
    >
      {renderHighlightedDraft(text)}
    </div>
  )
}
