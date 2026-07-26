export function Icon({ path, className = 'size-6', strokeWidth = 1.8 }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {path}
    </svg>
  )
}

export function SearchIcon() {
  return (
    <Icon
      path={
        <>
          <circle cx="11" cy="11" r="5.5" />
          <path d="m16 16 4.2 4.2" />
        </>
      }
    />
  )
}

export function BackIcon() {
  return <Icon path={<path d="m15 18-6-6 6-6" />} />
}

export function PhotoIcon() {
  return (
    <Icon
      path={
        <>
          <rect x="4" y="5" width="16" height="14" rx="3" />
          <circle cx="9" cy="10" r="1.5" />
          <path d="m20 15-4.5-4.5L8 18" />
        </>
      }
    />
  )
}

export function VideoIcon() {
  return (
    <Icon
      path={
        <>
          <rect x="3.5" y="6" width="11" height="12" rx="2.5" />
          <path d="m14.5 10 5-3v10l-5-3" />
        </>
      }
    />
  )
}

export function SendIcon() {
  return (
    <Icon
      path={
        <>
          <path d="M21 3 10 14" />
          <path d="m21 3-7 18-4-7-7-4 18-7Z" />
        </>
      }
    />
  )
}

export function MoreIcon() {
  return (
    <Icon
      path={
        <>
          <circle cx="6" cy="12" r="1" />
          <circle cx="12" cy="12" r="1" />
          <circle cx="18" cy="12" r="1" />
        </>
      }
    />
  )
}

export function PlusIcon() {
  return <Icon path={<path d="M12 5v14M5 12h14" />} />
}

export function CloseIcon() {
  return <Icon className="size-3.5" path={<path d="m6 6 12 12M18 6 6 18" />} />
}

export function CheckIcon({ double = false }) {
  return double ? (
    <Icon
      className="size-3.5"
      path={
        <>
          <path d="m4.8 12.5 2.3 2.3 4.3-5.1" />
          <path d="m10.8 12.5 2.3 2.3 5-6" />
        </>
      }
    />
  ) : (
    <Icon className="size-3.5" path={<path d="m6 12.5 3 3.1 8-9" />} />
  )
}

export function InfoIcon() {
  return (
    <Icon
      path={
        <>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 10.5v5" />
          <path d="M12 7.5h.01" />
        </>
      }
    />
  )
}

export function PencilIcon() {
  return <Icon className="size-4" path={<path d="m4 20 4.2-1 9.4-9.4-3.2-3.2L5 15.8 4 20Z" />} />
}

export function TrashIcon() {
  return (
    <Icon
      className="size-4"
      path={
        <>
          <path d="M5 7.5h14" />
          <path d="M9 7.5V5.8h6v1.7" />
          <path d="m7 7.5 1 11h8l1-11" />
        </>
      }
    />
  )
}

export function CopyIcon() {
  return (
    <Icon
      className="size-4"
      path={
        <>
          <rect x="9" y="9" width="10" height="10" rx="2" />
          <path d="M7 15H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v1" />
        </>
      }
    />
  )
}

export function ChevronIcon({ direction = 'right', className = 'size-5' }) {
  return (
    <Icon
      className={className}
      path={<path d={direction === 'right' ? 'm9 6 6 6-6 6' : 'm15 6-6 6 6 6'} />}
    />
  )
}

export function PlayIcon() {
  return <Icon className="size-5" path={<path d="m10 8 6 4-6 4V8Z" />} />
}

export function MessageIcon() {
  return (
    <Icon
      className="size-5"
      path={
        <>
          <path d="M4 6.5h16v9H8l-4 3v-12Z" />
          <path d="M7.5 10.5h9" />
          <path d="M7.5 13.5h5.5" />
        </>
      }
    />
  )
}

export function DownloadIcon() {
  return (
    <Icon
      className="size-5"
      path={
        <>
          <path d="M12 4.5v10" />
          <path d="m8.5 11 3.5 3.5 3.5-3.5" />
          <path d="M5 18.5h14" />
        </>
      }
    />
  )
}
