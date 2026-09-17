import React from 'react'
import { resolveMediaUrl } from '../../utils/media'

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'
export type AvatarStatus = 'online' | 'offline' | 'busy' | 'away'

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string | null
  name?: string
  alt?: string
  size?: AvatarSize
  status?: AvatarStatus
  className?: string
}

const sizeClasses: Record<AvatarSize, { container: string; text: string; dot: string }> = {
  xs: { container: 'h-6 w-6', text: 'text-[10px]', dot: 'h-1.5 w-1.5' },
  sm: { container: 'h-8 w-8', text: 'text-xs', dot: 'h-2 w-2' },
  md: { container: 'h-10 w-10', text: 'text-sm font-semibold', dot: 'h-2.5 w-2.5' },
  lg: { container: 'h-12 w-12', text: 'text-base font-bold', dot: 'h-3 w-3' },
  xl: { container: 'h-16 w-16', text: 'text-xl font-bold', dot: 'h-3.5 w-3.5' },
}

const statusClasses: Record<AvatarStatus, string> = {
  online: 'bg-emerald-500 ring-white dark:ring-zinc-950',
  offline: 'bg-zinc-400 ring-white dark:ring-zinc-950',
  busy: 'bg-rose-500 ring-white dark:ring-zinc-950',
  away: 'bg-amber-500 ring-white dark:ring-zinc-950',
}

function getInitials(name?: string): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

export function Avatar({
  src,
  name,
  alt = 'Avatar',
  size = 'md',
  status,
  className = '',
  ...props
}: AvatarProps) {
  const currentSize = sizeClasses[size]
  const [imgError, setImgError] = React.useState(false)

  const resolvedUrl = src ? resolveMediaUrl(src) : null

  return (
    <div className={`relative inline-block shrink-0 ${className}`.trim()} {...props}>
      <div
        className={`grid place-items-center overflow-hidden rounded-full bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 select-none ${currentSize.container}`}
      >
        {resolvedUrl && !imgError ? (
          <img
            src={resolvedUrl}
            alt={alt || name || 'User avatar'}
            loading="lazy"
            decoding="async"
            onError={() => setImgError(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className={currentSize.text}>{getInitials(name)}</span>
        )}
      </div>

      {status ? (
        <span
          className={`absolute bottom-0 right-0 rounded-full ring-2 ${currentSize.dot} ${statusClasses[status]}`}
        />
      ) : null}
    </div>
  )
}
