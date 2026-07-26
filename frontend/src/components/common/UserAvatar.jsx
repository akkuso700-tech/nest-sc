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
