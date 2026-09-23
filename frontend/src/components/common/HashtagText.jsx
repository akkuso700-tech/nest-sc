const TOKEN_PATTERN = /(#[\p{L}\p{N}_]+|@[\p{L}\p{N}_]+)/gu

export default function HashtagText({
  text = '',
  className = '',
  hashtagClassName = 'font-medium text-primary transition hover:underline cursor-pointer',
  mentionClassName = hashtagClassName,
  onHashtagClick,
  onMentionClick,
}) {
  return (
    <span className={className}>
      {text.split(TOKEN_PATTERN).map((part, index) => {
        if (!part) return null
        const key = `${part}-${index}`

        if (part[0] === '#') {
          return (
            <button key={key} type="button" onClick={() => onHashtagClick?.(part)} className={hashtagClassName}>
              {part}
            </button>
          )
        }

        if (part[0] === '@') {
          if (part.toLowerCase() === '@nestai') {
            return (
              <span key={key} className="font-medium text-primary select-none">
                {part}
              </span>
            )
          }

          return (
            <button key={key} type="button" onClick={() => onMentionClick?.(part)} className={mentionClassName}>
              {part}
            </button>
          )
        }

        return <span key={key}>{part}</span>
      })}
    </span>
  )
}
