export function Icon({
  children,
  className = 'size-6',
  strokeWidth = 1.8,
  fill = 'none',
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={fill}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`${className} transition-transform duration-200`}
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export function SearchIcon({ className = 'size-5' }) {
  return (
    <Icon className={className} strokeWidth={1.9}>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </Icon>
  )
}

export function BackIcon({ className = 'size-5' }) {
  return (
    <Icon className={className} strokeWidth={2}>
      <path d="m15 18-6-6 6-6" />
    </Icon>
  )
}

export function PhotoIcon({ className = 'size-5' }) {
  return (
    <Icon className={className} strokeWidth={1.9}>
      <rect width="18" height="18" x="3" y="3" rx="4.5" />
      <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none" />
      <path d="m21 15-5-5L5 21" />
    </Icon>
  )
}

export function VideoIcon({ className = 'size-5' }) {
  return (
    <Icon className={className} strokeWidth={1.9}>
      <path d="m16 7 5-3v16l-5-3" />
      <rect width="13" height="14" x="3" y="5" rx="3.5" />
    </Icon>
  )
}

export function SendIcon({ className = 'size-5' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`${className} transition-transform duration-200`}
      aria-hidden="true"
    >
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  )
}

export function MoreIcon({ className = 'size-5' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={`${className} transition-transform duration-200`}
      aria-hidden="true"
    >
      <circle cx="5" cy="12" r="1.75" />
      <circle cx="12" cy="12" r="1.75" />
      <circle cx="19" cy="12" r="1.75" />
    </svg>
  )
}

export function PlusIcon({ className = 'size-5' }) {
  return (
    <Icon className={className} strokeWidth={2.1}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  )
}

export function CloseIcon({ className = 'size-3.5' }) {
  return (
    <Icon className={className} strokeWidth={2.2}>
      <path d="M18 6 6 18M6 6l12 12" />
    </Icon>
  )
}

export function CheckIcon({ double = false, className = 'size-3.5' }) {
  return double ? (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m2 12 5 5L18 6" />
      <path d="m8 12 4.5 4.5L22 7" />
    </svg>
  ) : (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m4 12 5 5L20 6" />
    </svg>
  )
}

export function InfoIcon({ className = 'size-5' }) {
  return (
    <Icon className={className} strokeWidth={1.9}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </Icon>
  )
}

export function PencilIcon({ className = 'size-4' }) {
  return (
    <Icon className={className} strokeWidth={1.9}>
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </Icon>
  )
}

export function TrashIcon({ className = 'size-4' }) {
  return (
    <Icon className={className} strokeWidth={1.9}>
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <line x1="10" x2="10" y1="11" y2="17" />
      <line x1="14" x2="14" y1="11" y2="17" />
    </Icon>
  )
}

export function CopyIcon({ className = 'size-4' }) {
  return (
    <Icon className={className} strokeWidth={1.9}>
      <rect width="14" height="14" x="8" y="8" rx="2.5" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </Icon>
  )
}

export function ChevronIcon({ direction = 'right', className = 'size-5' }) {
  return (
    <Icon className={className} strokeWidth={2}>
      <path d={direction === 'right' ? 'm9 18 6-6-6-6' : 'm15 18-6-6 6-6'} />
    </Icon>
  )
}

export function PlayIcon({ className = 'size-5' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <polygon points="6 3 20 12 6 21 6 3" />
    </svg>
  )
}

export function MessageIcon({ className = 'size-5' }) {
  return (
    <Icon className={className} strokeWidth={1.9}>
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    </Icon>
  )
}

export function DownloadIcon({ className = 'size-5' }) {
  return (
    <Icon className={className} strokeWidth={1.9}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" x2="12" y1="15" y2="3" />
    </Icon>
  )
}

export function ReplyIcon({ className = 'size-4' }) {
  return (
    <Icon className={className} strokeWidth={1.9}>
      <polyline points="9 17 4 12 9 7" />
      <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
    </Icon>
  )
}

