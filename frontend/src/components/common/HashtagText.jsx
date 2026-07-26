const TOKEN_PATTERN = /(#[\p{L}\p{N}_]+|@[\p{L}\p{N}_]+)/gu

function HashtagText({
  text = '',
  className = '',
  hashtagClassName = 'font-medium text-primary transition hover:underline',
  mentionClassName = 'font-medium text-primary transition hover:underline',
  onHashtagClick,
  onMentionClick,
}) {
  const parts = text.split(TOKEN_PATTERN)

  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (!part) {
          return null
        }

        if (/^#[\p{L}\p{N}_]+$/u.test(part)) {
          return (
            <button
              key={`${part}-${index}`}
              type="button"
              onClick={() => onHashtagClick?.(part)}
              className={hashtagClassName}
            >
              {part}
            </button>
          )
        }

        if (/^@[\p{L}\p{N}_]+$/u.test(part)) {
          return (
            <button
              key={`${part}-${index}`}
              type="button"
              onClick={() => onMentionClick?.(part)}
              className={mentionClassName}
            >
              {part}
            </button>
          )
        }

        return <span key={`${part}-${index}`}>{part}</span>
      })}
    </span>
  )
}

export default HashtagText
