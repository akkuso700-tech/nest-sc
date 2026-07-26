function PhotoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5">
      <path d="M4.5 7.5A2.5 2.5 0 0 1 7 5h10a2.5 2.5 0 0 1 2.5 2.5v9A2.5 2.5 0 0 1 17 19H7a2.5 2.5 0 0 1-2.5-2.5v-9Z" />
      <path d="m7.5 15 3-3 2.5 2.5 2-2 1.5 1.5" />
      <circle cx="9" cy="9.5" r="1.2" />
    </svg>
  )
}

function VideoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5">
      <rect x="4.5" y="6.5" width="10.5" height="11" rx="2.2" />
      <path d="m15 10 4.5-2v8L15 14" />
    </svg>
  )
}

function PostTypeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5">
      <rect x="4.5" y="5.5" width="15" height="13" rx="2.5" />
      <path d="M8 10h8M8 13h5" />
    </svg>
  )
}

function StoryIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5">
      <circle cx="12" cy="12" r="7.5" />
      <path d="M12 8.8v6.4M8.8 12h6.4" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4.5">
      <rect x="4.5" y="5.5" width="15" height="14" rx="2.5" />
      <path d="M8 4v3M16 4v3M4.5 9.5h15" />
    </svg>
  )
}

function ChevronDownIcon({ className = 'size-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

export {
  CalendarIcon,
  ChevronDownIcon,
  PhotoIcon,
  PostTypeIcon,
  StoryIcon,
  VideoIcon,
}
