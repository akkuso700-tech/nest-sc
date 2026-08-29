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

export function HomeIcon({ filled = false, className = 'size-6' }) {
  if (filled) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1"
        className={`${className} transition-transform duration-200`}
        aria-hidden="true"
      >
        <path d="M11.27 2.34a1.1 1.1 0 0 1 1.46 0l8.5 7.44a1.1 1.1 0 0 1 .37.83v9.64a1.75 1.75 0 0 1-1.75 1.75H15.5a1 1 0 0 1-1-1v-4.75a1 1 0 0 0-1-1h-3a1 1 0 0 0-1 1v4.75a1 1 0 0 1-1 1H4.15A1.75 1.75 0 0 1 2.4 20.25V10.61a1.1 1.1 0 0 1 .37-.83l8.5-7.44Z" />
      </svg>
    )
  }
  return (
    <Icon className={className} strokeWidth={1.9}>
      <path d="M3.5 10.75 12 3.5l8.5 7.25v8.5a1.75 1.75 0 0 1-1.75 1.75h-4.5a1 1 0 0 1-1-1v-4.75a1 1 0 0 0-1-1h-2.5a1 1 0 0 0-1 1v4.75a1 1 0 0 1-1 1H5.25A1.75 1.75 0 0 1 3.5 19.25v-8.5Z" />
    </Icon>
  )
}

export function MessageIcon({ filled = false, className = 'size-6' }) {
  if (filled) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className={`${className} transition-transform duration-200`}
        aria-hidden="true"
      >
        <path d="M12 2C6.48 2 2 6.13 2 11.23c0 2.87 1.43 5.43 3.68 7.07-.15 1.12-.66 2.68-1.92 3.97a.75.75 0 0 0 .61 1.23c2.72 0 4.96-1.3 6.01-2.07.52.07 1.06.1 1.62.1 5.52 0 10-4.13 10-9.23C22 6.13 17.52 2 12 2Z" />
      </svg>
    )
  }
  return (
    <Icon className={className} strokeWidth={1.9}>
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
      <path d="M8 10h8" />
      <path d="M8 14h5" />
    </Icon>
  )
}

export function BellIcon({ filled = false, className = 'size-6' }) {
  if (filled) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className={`${className} transition-transform duration-200`}
        aria-hidden="true"
      >
        <path d="M12 2a6.5 6.5 0 0 0-6.5 6.5c0 5.42-2.14 7.23-2.3 7.37a1 1 0 0 0 .64 1.76h16.32a1 1 0 0 0 .64-1.76c-.16-.14-2.3-1.95-2.3-7.37A6.5 6.5 0 0 0 12 2Zm0 20a2.75 2.75 0 0 0 2.6-1.87.75.75 0 0 0-.71-.98H10.1a.75.75 0 0 0-.71.98A2.75 2.75 0 0 0 12 22Z" />
      </svg>
    )
  }
  return (
    <Icon className={className} strokeWidth={1.9}>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </Icon>
  )
}

export function UserIcon({ filled = false, className = 'size-6' }) {
  if (filled) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className={`${className} transition-transform duration-200`}
        aria-hidden="true"
      >
        <path d="M12 12c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5Zm0 2.5c-4.42 0-8 2.24-8 5.5v1.25c0 .41.34.75.75.75h14.5c.41 0 .75-.34.75-.75V20c0-3.26-3.58-5.5-8-5.5Z" />
      </svg>
    )
  }
  return (
    <Icon className={className} strokeWidth={1.9}>
      <circle cx="12" cy="7.5" r="4" />
      <path d="M4.5 20.5c0-3.59 3.36-6.5 7.5-6.5s7.5 2.91 7.5 6.5" />
    </Icon>
  )
}

export function LoopIcon({ filled = false, className = 'size-6' }) {
  if (filled) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        className={`${className} transition-transform duration-200`}
        aria-hidden="true"
      >
        <rect x="3" y="3" width="18" height="18" rx="5.5" stroke="currentColor" strokeWidth="2.3" />
        <polygon points="10 8.2 16.5 12 10 15.8" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    )
  }
  return (
    <Icon className={className} strokeWidth={1.9}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <polygon points="10 8.2 16.5 12 10 15.8" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" strokeLinecap="round" />
    </Icon>
  )
}

export function GroupsIcon({ filled = false, className = 'size-6' }) {
  if (filled) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className={`${className} transition-transform duration-200`}
        aria-hidden="true"
      >
        <path d="M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3Zm-8 0c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3Zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5Zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5Z" />
      </svg>
    )
  }
  return (
    <Icon className={className} strokeWidth={1.9}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </Icon>
  )
}

export function SettingsIcon({ className = 'size-6' }) {
  return (
    <Icon className={className} strokeWidth={1.9}>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  )
}

export function GlobeIcon({ className = 'size-5' }) {
  return (
    <Icon className={className} strokeWidth={1.8}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </Icon>
  )
}

export function MoonIcon({ className = 'size-5' }) {
  return (
    <Icon className={className} strokeWidth={1.9}>
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </Icon>
  )
}

export function SunIcon({ className = 'size-5' }) {
  return (
    <Icon className={className} strokeWidth={1.9}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </Icon>
  )
}

export function BookmarkIcon({ filled = false, className = 'size-6' }) {
  if (filled) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className={`${className} transition-transform duration-200`}
        aria-hidden="true"
      >
        <path d="M19 21.25a.75.75 0 0 1-1.18.61L12 17.8l-5.82 4.06A.75.75 0 0 1 5 21.25V4.75A2.25 2.25 0 0 1 7.25 2.5h9.5A2.25 2.25 0 0 1 19 4.75v16.5Z" />
      </svg>
    )
  }
  return (
    <Icon className={className} strokeWidth={1.9}>
      <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
    </Icon>
  )
}

export function LoginIcon({ className = 'size-6' }) {
  return (
    <Icon className={className} strokeWidth={1.9}>
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <polyline points="10 17 15 12 10 7" />
      <line x1="15" y1="12" x2="3" y2="12" />
    </Icon>
  )
}

export function MonetizationIcon({ className = 'size-6' }) {
  return (
    <Icon className={className} strokeWidth={1.9}>
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </Icon>
  )
}

export function HiddenProfileIcon({ className = 'size-6' }) {
  return (
    <Icon className={className} strokeWidth={1.9}>
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </Icon>
  )
}

export function AboutIcon({ className = 'size-5' }) {
  return (
    <Icon className={className} strokeWidth={1.9}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </Icon>
  )
}

export function ContactIcon({ className = 'size-5' }) {
  return (
    <Icon className={className} strokeWidth={1.9}>
      <rect width="20" height="16" x="2" y="4" rx="3" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </Icon>
  )
}

export function AdsIcon({ className = 'size-5' }) {
  return (
    <Icon className={className} strokeWidth={1.9}>
      <path d="m3 11 18-5v12L3 13v-2z" />
      <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
    </Icon>
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

export function PlusIcon({ className = 'size-6' }) {
  return (
    <Icon className={className} strokeWidth={2.1}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  )
}

export function MenuIcon({ className = 'size-6' }) {
  return (
    <Icon className={className} strokeWidth={1.9}>
      <line x1="4" x2="20" y1="12" y2="12" />
      <line x1="4" x2="20" y1="6" y2="6" />
      <line x1="4" x2="20" y1="18" y2="18" />
    </Icon>
  )
}

export function CloseIcon({ className = 'size-6' }) {
  return (
    <Icon className={className} strokeWidth={2}>
      <path d="M18 6 6 18M6 6l12 12" />
    </Icon>
  )
}

export function ChevronDownIcon({ className = 'size-4' }) {
  return (
    <Icon className={className} strokeWidth={2}>
      <path d="m6 9 6 6 6-6" />
    </Icon>
  )
}

export function ArrowLeftIcon({ className = 'size-6' }) {
  return (
    <Icon className={className} strokeWidth={2}>
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </Icon>
  )
}
