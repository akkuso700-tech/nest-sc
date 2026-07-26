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

export function HomeIcon() {
  return <Icon path={<path d="M3 11.5 12 4l9 7.5M5.5 10.5V20h13v-9.5" />} />
}

export function MessageIcon() {
  return (
    <Icon
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

export function BellIcon() {
  return (
    <Icon
      path={
        <>
          <path d="M8 18h8" />
          <path d="M6 18h12l-1.6-2.2V11a4.4 4.4 0 1 0-8.8 0v4.8L6 18Z" />
          <path d="M10 20a2 2 0 0 0 4 0" />
        </>
      }
    />
  )
}

export function UserIcon() {
  return (
    <Icon
      path={
        <>
          <circle cx="12" cy="8" r="3.25" />
          <path d="M5 19c1.7-3 4.2-4.5 7-4.5s5.3 1.5 7 4.5" />
        </>
      }
    />
  )
}

export function SettingsIcon() {
  return (
    <Icon
      path={
        <>
          <path d="M12 8.8a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4Z" />
          <path d="m19.2 15 .9 1.6-1.7 3-1.9-.3-1.2 1.2.3 1.9-3 1.7-1.6-.9-1.6.9-3-1.7.3-1.9-1.2-1.2-1.9.3-1.7-3 .9-1.6-.9-1.6 1.7-3 1.9.3 1.2-1.2-.3-1.9 3-1.7 1.6.9 1.6-.9 3 1.7-.3 1.9 1.2 1.2 1.9-.3 1.7 3-.9 1.6Z" />
        </>
      }
    />
  )
}

export function GlobeIcon() {
  return (
    <Icon
      path={
        <>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M3.8 12h16.4" />
          <path d="M12 3.7c2.3 2.2 3.8 5.1 3.8 8.3S14.3 18.1 12 20.3c-2.3-2.2-3.8-5.1-3.8-8.3S9.7 5.9 12 3.7Z" />
        </>
      }
    />
  )
}

export function MoonIcon() {
  return <Icon path={<path d="M15.5 3.8a7.8 7.8 0 1 0 4.7 14.1A8.6 8.6 0 0 1 15.5 3.8Z" />} />
}

export function SunIcon() {
  return (
    <Icon
      path={
        <>
          <circle cx="12" cy="12" r="3.6" />
          <path d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2 5.5 5.5" />
        </>
      }
    />
  )
}

export function BookmarkIcon() {
  return <Icon path={<path d="M7 4.5h10v15l-5-3.4L7 19.5v-15Z" />} />
}

export function LoginIcon() {
  return (
    <Icon
      path={
        <>
          <path d="M9 5H5.5v14H9" />
          <path d="M13 8.5 17 12l-4 3.5" />
          <path d="M7 12h10" />
        </>
      }
    />
  )
}

export function MonetizationIcon() {
  return (
    <Icon
      path={
        <>
          <path d="M12 4v16" />
          <path d="M16 7.5c0-1.4-1.8-2.5-4-2.5S8 6.1 8 7.5 9.8 10 12 10s4 1.1 4 2.5S14.2 15 12 15s-4-1.1-4-2.5" />
        </>
      }
    />
  )
}

export function HiddenProfileIcon() {
  return (
    <Icon
      path={
        <>
          <path d="M3.5 12s3-5 8.5-5 8.5 5 8.5 5-3 5-8.5 5-8.5-5-8.5-5Z" />
          <path d="m4.5 4.5 15 15" />
        </>
      }
    />
  )
}

export function AboutIcon() {
  return (
    <Icon
      path={
        <>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 10v5" />
          <path d="M12 7.5h.01" />
        </>
      }
    />
  )
}

export function ContactIcon() {
  return (
    <Icon
      path={
        <>
          <rect x="4" y="6" width="16" height="12" rx="2.2" />
          <path d="m5.5 8 6.5 5 6.5-5" />
        </>
      }
    />
  )
}

export function AdsIcon() {
  return (
    <Icon
      path={
        <>
          <path d="M4 14h4l9-5v10l-9-5H4v-0Z" />
          <path d="M8 14v4.5" />
        </>
      }
    />
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

export function PlusIcon() {
  return <Icon path={<path d="M12 5v14M5 12h14" />} />
}

export function LoopIcon() {
  return (
    <Icon
      path={
        <>
          <rect x="4.5" y="4.5" width="15" height="15" rx="4.2" />
          <path d="m10 8.7 5 3.3-5 3.3V8.7Z" />
        </>
      }
    />
  )
}

export function GroupsIcon() {
  return (
    <Icon
      path={
        <>
          <circle cx="8" cy="9" r="2.2" />
          <circle cx="16" cy="8" r="1.8" />
          <path d="M4.8 17c.8-2.1 2.5-3.2 4.8-3.2s4 1.1 4.8 3.2" />
          <path d="M13.3 16.6c.5-1.5 1.7-2.3 3.3-2.3 1.4 0 2.5.7 3.1 2" />
        </>
      }
    />
  )
}

export function MenuIcon() {
  return <Icon path={<path d="M4.5 7h15M4.5 12h15M4.5 17h15" />} />
}

export function CloseIcon() {
  return <Icon path={<path d="m6 6 12 12M18 6 6 18" />} />
}

export function ChevronDownIcon({ className = 'size-4' }) {
  return <Icon path={<path d="m6 9 6 6 6-6" />} className={className} />
}

export function ArrowLeftIcon({ className = 'size-6' }) {
  return <Icon path={<path d="M14.5 6.5 9 12l5.5 5.5M9.5 12H20" />} className={className} />
}
