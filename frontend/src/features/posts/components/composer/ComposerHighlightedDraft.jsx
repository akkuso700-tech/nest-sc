export function renderHighlightedDraft(text = '') {
  if (!text) {
    return null
  }

  const parts = text.split(/(#[a-zA-Z0-9_\p{L}]+|@[a-zA-Z0-9_\p{L}]*|#)/gu)
  const elements = parts.map((part, index) => {
    if (!part) {
      return null
    }

    const isTag =
      (part.startsWith('@') || part.startsWith('#')) &&
      /^(#[a-zA-Z0-9_\p{L}]*|@[a-zA-Z0-9_\p{L}]*)$/u.test(part)

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
