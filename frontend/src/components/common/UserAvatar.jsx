import { getAvatarLabel } from '../../utils/social.js'
import { resolveMediaUrl } from '../../utils/media.js'

function UserAvatar({
  user,
  className = '',
  textClassName = '',
  imageClassName = '',
  loading = 'lazy',
  decoding = 'async',
}) {
  if (user?.username === 'nestai' || user?.isAi) {
    return (
      <span className={`grid shrink-0 place-items-center rounded-full bg-gradient-to-tr from-indigo-600 via-violet-600 to-sky-400 text-white ${className}`}>
        <svg viewBox="0 0 24 24" fill="currentColor" className="size-[58%]">
          <path d="m12 1 2.5 7.5L22 11l-7.5 2.5L12 21l-2.5-7.5L2 11l7.5-2.5zm7 0 1.2 3.8L24 6l-3.8 1.2L19 11l-1.2-3.8L14 6l3.8-1.2z" />
        </svg>
      </span>
    )
  }

  const avatarUrl = user?.avatarUrl

  return (
    <span
      className={`grid overflow-hidden place-items-center rounded-full bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 ${className}`.trim()}
    >
      {avatarUrl ? (
        <img
          src={resolveMediaUrl(avatarUrl)}
          alt={user?.username || 'User avatar'}
          loading={loading}
          decoding={decoding}
          fetchPriority="low"
          className={`h-full w-full object-cover ${imageClassName}`.trim()}
        />
      ) : (
        <span className={textClassName}>{getAvatarLabel(user)}</span>
      )}
    </span>
  )
}

export default UserAvatar
