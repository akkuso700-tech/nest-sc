function HeartIcon({ filled = false }) {
  return (
    <svg viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" className="size-5">
      <path d="M12 20s-6.8-4.5-8.7-8.2A5.1 5.1 0 0 1 12 5.6a5.1 5.1 0 0 1 8.7 6.2C18.8 15.5 12 20 12 20Z" />
    </svg>
  )
}

function CommentIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5">
      <path d="M4 6.5h16v9H8l-4 3v-12Z" />
    </svg>
  )
}

function BookmarkIcon({ filled = false }) {
  return (
    <svg viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" className="size-5">
      <path d="M7 4.5h10v15l-5-3.4L7 19.5v-15Z" />
    </svg>
  )
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5">
      <path d="m15 6 4-1-1 4" />
      <path d="M10 14 19 5" />
      <path d="M19 13.5V18a2 2 0 0 1-2 2H6.5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2H11" />
    </svg>
  )
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4.5">
      <path d="M2.5 12s3.8-6 9.5-6 9.5 6 9.5 6-3.8 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.8" />
    </svg>
  )
}

function MoreIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-5">
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </svg>
  )
}

function ExpandIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4.5">
      <path d="M8 4.5H4.5V8M20 8V4.5h-3.5M16 19.5h3.5V16M4.5 16v3.5H8" />
      <path d="M9 15 4.5 19.5M15 9l4.5-4.5M15 15l4.5 4.5M9 9 4.5 4.5" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="size-5">
      <path d="m6 6 12 12" />
      <path d="M18 6 6 18" />
    </svg>
  )
}

function VolumeOnIcon({ className = 'size-4.5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={className}>
      <path d="M5 10.5h3l4-3.5v10L8 13.5H5z" />
      <path d="M15 9a4.5 4.5 0 0 1 0 6" />
      <path d="M17.8 6.5a8 8 0 0 1 0 11" />
    </svg>
  )
}

function VolumeOffIcon({ className = 'size-4.5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={className}>
      <path d="M5 10.5h3l4-3.5v10L8 13.5H5z" />
      <path d="m15.2 9.2 3.6 3.6m0-3.6-3.6 3.6" />
    </svg>
  )
}

export {
  BookmarkIcon,
  CloseIcon,
  CommentIcon,
  ExpandIcon,
  EyeIcon,
  HeartIcon,
  MoreIcon,
  ShareIcon,
  VolumeOffIcon,
  VolumeOnIcon,
}
