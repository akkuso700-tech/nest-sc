const sizeClasses = {
  xs: 'size-4',
  sm: 'size-5',
  md: 'size-6',
}

export default function VerifiedBadge({ user, size = 'sm', className = '' }) {
  if (!(user?.verification?.isVerified || user?.verification?.status === 'approved')) return null

  return (
    <span
      className={`inline-flex shrink-0 text-sky-500 ${className}`}
      role="img"
      aria-label="Onaylı profil"
      title="Onaylı profil"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className={sizeClasses[size] || sizeClasses.sm}>
        <path
          fill="currentColor"
          d="M12 2.25 14.4 4l2.97-.08.84 2.85 2.45 1.68-.99 2.8.99 2.8-2.45 1.68-.84 2.85-2.97-.08L12 20.25 9.6 18.5l-2.97.08-.84-2.85-2.45-1.68.99-2.8-.99-2.8 2.45-1.68.84-2.85L9.6 4 12 2.25Z"
        />
        <path
          d="m8.2 11.95 2.35 2.35 5.25-5.25"
          fill="none"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}
