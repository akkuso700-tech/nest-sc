import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import UserAvatar from '../common/UserAvatar.jsx'

function SearchMiniIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4">
      <circle cx="11" cy="11" r="5.5" />
      <path d="m16 16 4.2 4.2" />
    </svg>
  )
}

function HomeMiniIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-6">
      <path d="M3 11.5 12 4l9 7.5M5.5 10.5V20h13v-9.5" />
    </svg>
  )
}

function ExploreMiniIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-6">
      <circle cx="12" cy="12" r="8.5" />
      <path d="m15.8 8.2-2.8 7-7 2.8 2.8-7 7-2.8Z" />
    </svg>
  )
}

function PlusMiniIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-6">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function GroupListItem({ group, to = '' }) {
  const content = (
    <div className="flex items-center gap-3">
      <UserAvatar user={{ name: group.name, username: group.avatar, avatarUrl: group.coverImageUrl || '' }} className="size-10" textClassName="text-xs font-semibold" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-text">{group.name}</p>
        <p className="mt-1 text-xs text-muted">{group.members}</p>
      </div>
    </div>
  )

  if (to) {
    return (
      <Link to={to} className="block w-full rounded-lg   px-3 py-3 text-left transition hover:bg-secondary-hover">
        {content}
      </Link>
    )
  }

  return <div className="w-full rounded-lg border border-border bg-secondary px-3 py-3">{content}</div>
}

export default function GroupsSidebar({
  lang = 'tr',
  activeListMode = 'feed',
  onActiveListModeChange = () => {},
  onOpenCreateGroup = () => {},
  managedGroups = [],
  joinedGroups = [],
}) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const searchShellRef = useRef(null)
  const mergedGroups = useMemo(() => {
    const map = new Map()
    ;[...managedGroups, ...joinedGroups].forEach((group) => {
      if (group?.id && !map.has(group.id)) {
        map.set(group.id, group)
      }
    })
    return Array.from(map.values())
  }, [managedGroups, joinedGroups])
  const filteredGroups = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) {
      return mergedGroups
    }
    return mergedGroups.filter((group) => (group?.name || '').toLowerCase().includes(query))
  }, [search, mergedGroups])

  useEffect(() => {
    function handleDocumentClick(event) {
      if (!searchShellRef.current) return
      if (searchShellRef.current.contains(event.target)) return
      setIsSearchOpen(false)
    }
    document.addEventListener('mousedown', handleDocumentClick)
    return () => document.removeEventListener('mousedown', handleDocumentClick)
  }, [])

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden">
      <div>
        <h2 className="text-lg font-semibold text-text">{t('groups.pageTitle')}</h2>
        <div ref={searchShellRef} className="relative mt-3">
          <input
            value={search}
            onFocus={() => setIsSearchOpen(true)}
            onChange={(event) => { setSearch(event.target.value); setIsSearchOpen(true) }}
            type="text"
            placeholder={t('groups.searchPlaceholder')}
            className="w-full rounded-lg border border-border bg-secondary px-3 py-2.5 pr-10 text-sm text-text outline-none placeholder:text-soft focus:border-border-strong"
          />
          <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-muted">
            <SearchMiniIcon />
          </span>
          {isSearchOpen ? (
            <div className="dropdown-pop absolute left-0 top-[calc(100%+8px)] z-[70] w-full overflow-hidden rounded-lg border border-border bg-card p-2 shadow-[0_24px_60px_rgba(15,23,42,0.18)]">
              {!filteredGroups.length ? (
                <p className="px-3 py-2 text-sm text-muted">{t('search.overlay.noResults')}</p>
              ) : (
                filteredGroups.slice(0, 8).map((group) => {
                  const isManaged = managedGroups.some((item) => item.id === group.id)
                  const href = isManaged ? `/${lang}/groups/manage/${group.slug}` : `/${lang}/groups/joined/${group.slug}`
                  return (
                    <Link
                      key={`search-group-${group.id}`}
                      to={href}
                      onClick={() => setIsSearchOpen(false)}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 transition hover:bg-secondary"
                    >
                      <UserAvatar user={{ name: group.name, username: group.avatar, avatarUrl: group.coverImageUrl || '' }} className="size-8" textClassName="text-[10px] font-semibold" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-text">{group.name}</p>
                        <p className="truncate text-xs text-muted">{group.members}</p>
                      </div>
                    </Link>
                  )
                })
              )}
            </div>
          ) : null}
        </div>
      </div>
      <div className="space-y-1">
        <button type="button" onClick={() => onActiveListModeChange('feed')} className={`flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-sm transition hover:bg-nav-hover hover:text-text w-full ${activeListMode === 'feed' ? 'font-semibold bg-nav-active text-text' : 'font-regular text-muted'}`}>
          <span className="relative grid size-10 shrink-0 place-items-center rounded-2xl text-text"><HomeMiniIcon /></span>
          <span className="min-w-0  truncate">{t('groups.flow')}</span>
        </button>
        <button type="button" onClick={() => onActiveListModeChange('discover')} className={`flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-sm transition hover:bg-nav-hover hover:text-text w-full ${activeListMode === 'discover' ? 'font-semibold bg-nav-active text-text' : 'font-regular text-muted'}`}>
          <span className="relative grid size-10 shrink-0 place-items-center rounded-2xl text-text"><ExploreMiniIcon /></span>
          <span className="min-w-0  truncate">{t('groups.exploreTab')}</span>
        </button>
        <button type="button" onClick={onOpenCreateGroup} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-sm font-regular text-muted transition hover:bg-nav-hover hover:text-text w-full">
          <span className="relative grid size-10 shrink-0 place-items-center rounded-2xl text-text"><PlusMiniIcon /></span>
          <span className="min-w-0  truncate">{t('groups.createGroup')}</span>
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted">{t('groups.managedGroups')}</h3>
          <div className="space-y-2">
            {managedGroups.map((group) => (
              <GroupListItem key={group.id} group={group} to={`/${lang}/groups/manage/${group.slug}`} />
            ))}
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted">{t('groups.joinedGroups')}</h3>
          <div className="space-y-2">
            {joinedGroups.map((group) => (
              <GroupListItem key={group.id} group={group} to={`/${lang}/groups/joined/${group.slug}`} />
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
