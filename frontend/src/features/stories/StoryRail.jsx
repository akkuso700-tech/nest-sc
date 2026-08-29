import UserAvatar from '../../components/common/UserAvatar.jsx'
import VerifiedBadge from '../../components/common/VerifiedBadge.jsx'
import { useTranslation } from 'react-i18next'

function StoryRail({
  yourStoryLabel = '',
  rails = [],
  isAuthenticated = false,
  currentUser = null,
  onCreateStory,
  onOpenRail,
}) {
  const { t } = useTranslation()
  const resolvedYourStoryLabel = yourStoryLabel || t('common.yourStory', { defaultValue: 'Senin Hikayen' })
  const fallbackUsername = t('common.unknownUser', { defaultValue: 'Kullanici' })
  const truncateUsername = (value) => {
    const safeValue = String(value || '').trim()
    if (safeValue.length <= 10) {
      return safeValue
    }
    return `${safeValue.slice(0, 10)}...`
  }

  return (
    <section className="md:rounded-lg border border-border bg-card p-1 md:p-3 shadow-sm">
     
     
      <div className="subtle-scrollbar flex gap-1.5 overflow-x-auto ">
        {isAuthenticated ? (
          <button
            type="button"
            onClick={onCreateStory}
            className="group flex min-w-[78px] flex-col items-center gap-2 rounded-xl px-2 py-1 cursor-pointer transition hover:bg-secondary"
          >
            <div className="relative">
              <UserAvatar
                user={currentUser}
                className="size-18 md:size-22 border-2 border-card text-xs font-semibold"
                textClassName="text-xs font-semibold"
              />
              <span className="absolute -bottom-0.5 -right-0.5 grid size-5 md:size-6 place-items-center rounded-full border-2 border-card bg-primary text-inverse shadow-sm shadow-primary/25 transition-transform duration-200 group-hover:scale-110 group-active:scale-95">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="size-3 md:size-3.5"
                  aria-hidden="true"
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </span>
            </div>
            <span className="max-w-[78px] truncate text-xs font-medium text-muted">{resolvedYourStoryLabel}</span>
          </button>
        ) : null}

        {rails.map((rail) => (
          <button
            key={`${rail.author?.id || rail.author?._id || rail.author?.username}-story-rail`}
            type="button"
            onClick={() => onOpenRail?.(rail)}
            className="flex min-w-[78px] flex-col items-center gap-1 rounded-xl cursor-pointer px-2 py-1 transition hover:bg-secondary"
          >
            <div className={`rounded-full p-[4px]  ${rail.hasUnseen ? 'bg-gradient-to-br from-pink-500 via-amber-400 to-violet-500' : 'bg-border'}`}>
              <UserAvatar
                user={rail.author}
                className="size-18 md:size-22 border-2 border-card text-xs font-semibold"
                textClassName="text-xs font-semibold"
              />
            </div>
            <span className="flex max-w-[78px] items-center gap-1 text-xs font-semibold text-muted">
              <span className="truncate">{truncateUsername(rail.author?.username || fallbackUsername)}</span>
              <VerifiedBadge user={rail.author} size="xs" />
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

export default StoryRail
