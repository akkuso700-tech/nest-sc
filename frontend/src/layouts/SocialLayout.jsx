import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getConversations, markConversationRead } from '../services/messagesService.js'
import { getNotifications, markAllNotificationsRead } from '../services/notificationsService.js'
import {
  deleteSearchHistory,
  getSearchHistory,
  getSearchSuggestions,
  saveSearchHistory,
} from '../services/searchService.js'
import { connectSocketClient, disconnectSocketClient } from '../services/socketClient.js'
import { useAuth } from '../store/AuthContext.jsx'
import { useTheme } from '../store/ThemeContext.jsx'
import { formatNotificationContent, formatRelativeTime, getFullName } from '../utils/social.js'
import { resolveMediaUrl } from '../utils/media.js'
import { normalizeSearchText } from '../utils/searchText.js'
import UserAvatar from '../components/common/UserAvatar.jsx'
import VerifiedBadge from '../components/common/VerifiedBadge.jsx'
import { appEnvironmentLabel, isDemoEnvironment } from '../lib/appEnvironment.js'
import {
  AboutIcon,
  AdsIcon,
  ArrowLeftIcon,
  BellIcon,
  BookmarkIcon,
  ChevronDownIcon,
  CloseIcon,
  ContactIcon,
  GlobeIcon,
  GroupsIcon,
  HiddenProfileIcon,
  HomeIcon,
  LoginIcon,
  LoopIcon,
  MenuIcon,
  MessageIcon,
  MonetizationIcon,
  MoonIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  SunIcon,
  UserIcon,
} from './SocialLayoutIcons.jsx'

const supportedLangs = ['en', 'tr', 'de', 'es']
const SEARCH_HISTORY_KEY = 'Nest-Social-recent-searches'
const MAX_SEARCH_HISTORY = 8
const MIN_SEARCH_SUGGESTION_CHARS = 2
const OPEN_MOBILE_SEARCH_EVENT = 'social-layout:open-mobile-search'

function loadRecentSearches() {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const rawValue = window.localStorage.getItem(SEARCH_HISTORY_KEY)
    const parsedValue = rawValue ? JSON.parse(rawValue) : []
    if (!Array.isArray(parsedValue)) {
      return []
    }

    return parsedValue
      .map((item) => {
        if (typeof item === 'string') {
          return {
            query: item.trim(),
            searchedAt: null,
          }
        }

        if (item && typeof item.query === 'string' && item.query.trim()) {
          return {
            query: item.query.trim(),
            searchedAt: item.searchedAt || null,
          }
        }

        return null
      })
      .filter(Boolean)
      .slice(0, MAX_SEARCH_HISTORY)
  } catch {
    return []
  }
}

function persistRecentSearches(items) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(items.slice(0, MAX_SEARCH_HISTORY)))
}

function buildRecentSearches(items = [], query) {
  const normalizedQuery = normalizeSearchText(query)
  return [
    {
      query: query.trim(),
      searchedAt: new Date().toISOString(),
    },
    ...items.filter((item) => normalizeSearchText(item.query) !== normalizedQuery),
  ].slice(0, MAX_SEARCH_HISTORY)
}

function getRecentSearchKey(item) {
  return `recent-${normalizeSearchText(item.query).replace(/\s+/g, '-')}`
}

function highlightMatch(text, query) {
  const safeText = `${text || ''}`
  const trimmedQuery = query.trim()

  if (!trimmedQuery || trimmedQuery.length < MIN_SEARCH_SUGGESTION_CHARS) {
    return safeText
  }

  const normalizedText = normalizeSearchText(safeText, { trim: false })
  const normalizedQuery = normalizeSearchText(trimmedQuery)
  const matchIndex = normalizedText.indexOf(normalizedQuery)

  if (matchIndex === -1) {
    return safeText
  }

  const matchEnd = matchIndex + normalizedQuery.length

  return (
    <>
      {safeText.slice(0, matchIndex)}
      <span className="font-semibold text-accent">{safeText.slice(matchIndex, matchEnd)}</span>
      {safeText.slice(matchEnd)}
    </>
  )
}

function formatRecentSearchTime(searchedAt, t) {
  if (!searchedAt) {
    return t('search.overlay.lastSearch')
  }

  return formatRelativeTime(searchedAt)
}

function buildSearchSuggestionEntries({ query, recentSearches, items, posts, lang }) {
  const trimmedQuery = query.trim()
  const showRecentSearches = trimmedQuery.length < MIN_SEARCH_SUGGESTION_CHARS

  if (showRecentSearches) {
    return recentSearches.map((item) => ({
      key: getRecentSearchKey(item),
      type: 'recent',
      value: item.query,
    }))
  }

  return [
    ...items.map((item) => ({
      key: `person-${item.user.id || item.user.username}`,
      type: 'person',
      targetPath: `/${lang}/u/${item.user.username}`,
    })),
    ...posts.map((post) => ({
      key: `post-${post.id || post._id}`,
      type: 'post',
      targetPath: `/${lang}/posts/${post.id || post._id}`,
    })),
  ]
}

function getNavIcon(iconKey, filled = false) {
  const icons = {
    home: <HomeIcon filled={filled} />,
    loop: <LoopIcon filled={filled} />,
    groups: <GroupsIcon filled={filled} />,
    messages: <MessageIcon filled={filled} />,
    notifications: <BellIcon filled={filled} />,
    reports: <BookmarkIcon filled={filled} />,
    profile: <UserIcon filled={filled} />,
    settings: <SettingsIcon />,
    hiddenProfile: <HiddenProfileIcon />,
    monetization: <MonetizationIcon />,
    about: <AboutIcon />,
    contact: <ContactIcon />,
    ads: <AdsIcon />,
    login: <LoginIcon />,
  }

  return icons[iconKey] || <HomeIcon filled={filled} />
}

function formatBadgeCount(count) {
  if (!count) {
    return ''
  }

  return count > 99 ? '99+' : `${count}`
}

function UnreadBadge({ count, className = '' }) {
  if (!count) {
    return null
  }

  return (
    <span
      className={`inline-flex min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1 py-1 text-[10px] font-semibold leading-none text-white shadow-sm ring-2 ring-card ${className}`}
    >
      {formatBadgeCount(count)}
    </span>
  )
}

function SidebarLink({ item, open, onNavigate, badgeCount = 0 }) {
  return (
    <NavLink
      to={item.to}
      end={item.key === 'home'}
      onClick={onNavigate}
      className={({ isActive }) =>
        `group flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm transition-all duration-200 ${
          isActive
            ? 'bg-nav-active text-primary font-semibold shadow-xs'
            : 'text-muted hover:bg-nav-hover hover:text-text'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={`relative grid size-10 shrink-0 place-items-center rounded-2xl transition-transform duration-200 group-hover:scale-105 group-active:scale-95 ${
              isActive ? 'text-primary' : 'text-text'
            }`}
          >
            {getNavIcon(item.iconKey, isActive)}
            {!open ? <UnreadBadge count={badgeCount} className="absolute -right-1 -top-1" /> : null}
          </span>
          {open ? (
            <>
              <span className={`min-w-0 flex-1 truncate ${isActive ? 'text-primary font-semibold' : ''}`}>
                {item.label}
              </span>
              <UnreadBadge count={badgeCount} />
            </>
          ) : null}
        </>
      )}
    </NavLink>
  )
}

function HeaderIconButton({ children, onClick, active = false, ariaLabel, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={`grid size-10 place-items-center rounded-full border cursor-pointer transition ${className} ${
        active
          ? 'border-border bg-primary text-inverse'
          : 'border-border bg-card text-text hover:border-border-strong hover:bg-secondary'
      }`}
    >
      {children}
    </button>
  )
}

function DropdownPanel({ open, align = 'right', title, action = null, children }) {
  if (!open) {
    return null
  }

  return (
    <div
      className={`dropdown-pop absolute top-[calc(100%+6px)] z-[70] w-[280px] rounded-lg border border-border bg-card p-4 shadow-[0_24px_60px_rgba(15,23,42,0.18)] transition ${
        align === 'right' ? 'right-0' : 'left-0'
      }`}
    >
      {title ? (
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">
            {title}
          </p>
          {action}
        </div>
      ) : null}
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function DropdownInfoItem({ title, meta }) {
  return (
    <div className="rounded-2xl bg-secondary px-4 py-3">
      <p className="text-sm font-medium text-text">{title}</p>
      <p className="mt-1 text-xs text-muted">{meta}</p>
    </div>
  )
}

function DropdownPreviewLink({
  to,
  user,
  title,
  meta,
  body,
  onNavigate,
  badgeCount = 0,
  media = null,
  isHighlighted = false,
  isActive = false,
}) {
  return (
    <Link
      to={to}
      onClick={onNavigate}
      className={`group flex items-start gap-3 rounded-lg border px-3 py-3 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${
        isHighlighted
          ? 'border-rose-200 bg-rose-50/80 hover:border-rose-300 hover:bg-rose-50 dark:border-rose-900/60 dark:bg-rose-950/20 dark:hover:border-rose-800 dark:hover:bg-rose-950/30'
          : 'border-transparent hover:border-border hover:bg-secondary'
      }`}
    >
      <div className="relative shrink-0">
        <UserAvatar
          user={user}
          className="size-11 bg-primary text-inverse"
          textClassName="text-xs font-semibold"
        />
        {isActive ? (
          <span className="absolute bottom-0 right-0 size-3 rounded-full border-2 border-white bg-emerald-500 shadow-sm dark:border-zinc-950" />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-medium text-text">{title}</p>
          <div className="flex shrink-0 items-center gap-1.5">
            {isHighlighted ? (
              <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-rose-600 animate-pulse dark:bg-rose-500/15 dark:text-rose-300">
                Yeni
              </span>
            ) : null}
            <UnreadBadge count={badgeCount} className="shrink-0" />
          </div>
        </div>
        {meta ? (
          <p className="mt-0.5 truncate text-xs text-muted">{meta}</p>
        ) : null}
        <div className="mt-1 flex items-start gap-2">
          {media?.url ? (
            <div className="h-10 w-10 overflow-hidden rounded-xl border border-border bg-secondary">
              {media.type === 'video' ? (
                <div className="relative h-full w-full">
                  <video
                    src={resolveMediaUrl(media.url)}
                    className="h-full w-full object-cover"
                    muted
                    playsInline
                  />
                  <span className="absolute inset-0 grid place-items-center bg-black/25 text-white">
                    <svg
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="size-4"
                      aria-hidden="true"
                    >
                      <path d="m9 7 8 5-8 5V7Z" />
                    </svg>
                  </span>
                </div>
              ) : (
                <img
                  src={resolveMediaUrl(media.url)}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              )}
            </div>
          ) : null}
          {body ? (
            <p className="line-clamp-2 text-xs leading-5 text-muted">
              {body}
            </p>
          ) : null}
        </div>
      </div>
      <span className="pt-1 text-zinc-300 transition group-hover:text-zinc-500 dark:text-zinc-700 dark:group-hover:text-zinc-400">
        →
      </span>
    </Link>
  )
}

function DropdownSkeletonList({ count = 3 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={`dropdown-skeleton-${index}`}
          className="flex items-start gap-3 rounded-2xl border border-border px-3 py-3"
        >
          <div className="size-11 shrink-0 animate-pulse rounded-full bg-secondary-hover" />
          <div className="min-w-0 flex-1 space-y-2 pt-1">
            <div className="h-3 w-2/3 animate-pulse rounded-full bg-secondary-hover" />
            <div className="h-2.5 w-1/3 animate-pulse rounded-full bg-secondary" />
            <div className="h-2.5 w-full animate-pulse rounded-full bg-secondary" />
          </div>
        </div>
      ))}
    </div>
  )
}

function ProfileMenuLink({ to, label, onNavigate, icon, badgeCount = 0 }) {
  return (
    <Link
      to={to}
      onClick={onNavigate}
      className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-text transition hover:bg-secondary"
    >
      <span className="text-muted">{icon}</span>
      <span>{label}</span>
      <UnreadBadge count={badgeCount} className="ml-auto" />
    </Link>
  )
}

function LanguageSelector({
  currentLang,
  onChange,
  open,
  onToggle,
  buttonClassName = '',
  menuDirection = 'down',
}) {
  const { t } = useTranslation()
  const labels = {
    en: t('common.languages.en'),
    tr: t('common.languages.tr'),
    de: t('common.languages.de'),
    es: t('common.languages.es'),
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm transition ${
          open
            ? 'border-border-strong bg-card text-text'
            : 'border-border bg-card text-text cursor-pointer hover:bg-secondary'
        } ${buttonClassName}`}
      >
        <span>{labels[currentLang] || currentLang}</span>
        <ChevronDownIcon className={`size-4 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open ? (
        <div className={`dropdown-pop absolute left-0 z-20 w-full min-w-[180px] rounded-lg border border-border bg-card p-2 shadow-[0_24px_60px_rgba(15,23,42,0.18)] ${menuDirection === 'up' ? 'bottom-[calc(100%+3px)]' : 'top-[calc(100%+3px)]'}`}>
          {supportedLangs.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onChange(item)}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition ${
                currentLang === item
                  ? 'bg-secondary text-text'
                  : 'text-text hover:bg-nav-hover'
              }`}
            >
              <span>{labels[item]}</span>
              {currentLang === item ? <span></span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function SearchSuggestionList({
  t,
  items,
  posts = [],
  recentSearches = [],
  lang,
  onNavigate,
  onSelectRecent,
  onClearRecentItem,
  onClearAllRecent,
  query = '',
  mobile = false,
  activeEntryKey = '',
  onEntryHover = null,
}) {
  const trimmedQuery = query.trim()
  const showRecentSearches = trimmedQuery.length < MIN_SEARCH_SUGGESTION_CHARS
  const hasSuggestions = items.length > 0
  const hasPostSuggestions = posts.length > 0
  const hasRecentSearches = recentSearches.length > 0

  if (!showRecentSearches && !hasSuggestions && !hasPostSuggestions) {
    return null
  }

  return (
    <div
      data-dropdown-shell="true"
      className={
        mobile
          ? 'flex h-full min-h-0 flex-col bg-card'
          : 'dropdown-pop absolute left-0 top-[calc(100%+8px)] z-[70] w-full overflow-hidden rounded-lg border border-border bg-card p-2 shadow-[0_24px_60px_rgba(15,23,42,0.18)]'
      }
    >
      {showRecentSearches && hasRecentSearches ? (
        <div className={mobile ? 'flex items-center justify-between px-4 py-3' : 'mb-1 flex items-center justify-between px-3 py-2'}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-soft">
            {t('search.overlay.recentTitle')}
          </p>
          <button
            type="button"
            onClick={onClearAllRecent}
            className="text-xs font-medium cursor-pointer text-accent transition hover:opacity-80"
          >
            {t('search.overlay.clearAll')}
          </button>
        </div>
      ) : showRecentSearches ? (
        <div className={mobile ? 'px-4 py-3' : 'mb-1 px-3 py-2'}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-soft">
            {t('search.overlay.recentTitle')}
          </p>
        </div>
      ) : null}
      <div className={`subtle-scrollbar overflow-y-auto pr-1 ${mobile ? 'max-h-full' : 'max-h-72'}`}>
        {showRecentSearches && hasRecentSearches
          ? recentSearches.map((item) => (
              <div
                key={getRecentSearchKey(item)}
                onMouseEnter={() => onEntryHover?.(getRecentSearchKey(item))}
                className={`group flex items-center gap-3 transition ${
                  activeEntryKey === getRecentSearchKey(item) ? 'bg-secondary' : ''
                } ${mobile ? 'px-4 py-3 hover:bg-secondary' : 'rounded-lg px-3 py-2.5 hover:bg-secondary'}`}
              >
                <button
                  type="button"
                  onClick={() => onSelectRecent(item.query)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-muted transition group-hover:bg-secondary-hover">
                    <SearchIcon />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium text-text">{highlightMatch(item.query, query)}</p>
                    <p className="mt-0.5 text-xs text-muted">{formatRecentSearchTime(item.searchedAt, t)}</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => onClearRecentItem(item.query)}
                  aria-label={t('search.overlay.removeRecentAria', { query: item.query })}
                  className="grid size-8 shrink-0 place-items-center rounded-full text-muted transition hover:bg-secondary hover:text-text"
                >
                  <CloseIcon />
                </button>
              </div>
            ))
          : (
            <>
              {hasSuggestions ? (
                <div className={mobile ? 'px-4 pb-2 pt-3' : 'px-3 pb-2 pt-2'}>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-soft">
                    {t('search.people.title')}
                  </p>
                </div>
              ) : null}
              {items.map((item) => (
                <Link
                  key={item.user.id || item.user.username}
                  to={`/${lang}/u/${item.user.username}`}
                  onMouseEnter={() => onEntryHover?.(`person-${item.user.id || item.user.username}`)}
                  onClick={(event) => {
                    if (!onNavigate) {
                      return
                    }

                    event.preventDefault()
                    onNavigate(`/${lang}/u/${item.user.username}`)
                  }}
                  className={`group flex items-center gap-3 transition ${
                    activeEntryKey === `person-${item.user.id || item.user.username}` ? 'bg-secondary' : ''
                  } ${mobile ? 'px-4 py-3 hover:bg-secondary' : 'rounded-2xl px-3 py-2.5 hover:bg-secondary'}`}
                >
                  <UserAvatar user={item.user} className="size-10" textClassName="text-sm font-semibold" />
                  <div className="min-w-0 flex-1">
                    <p className="flex min-w-0 items-center gap-1 text-[15px] font-medium text-text"><span className="truncate">{highlightMatch(getFullName(item.user), query)}</span><VerifiedBadge user={item.user} size="xs" /></p>
                    <p className="mt-0.5 truncate text-xs text-muted">@{highlightMatch(item.user.username, query)}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium text-muted transition group-hover:bg-secondary-hover">
                    {item.mutualConnectionCount
                      ? t('search.overlay.mutualShort', { count: item.mutualConnectionCount })
                      : item.isFollowing
                        ? t('search.overlay.following')
                        : t('search.overlay.user')}
                  </span>
                </Link>
              ))}
              {hasPostSuggestions ? (
                <div className={mobile ? 'px-4 pb-2 pt-4' : 'px-3 pb-2 pt-3'}>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-soft">
                    {t('search.posts.title')}
                  </p>
                </div>
              ) : null}
              {posts.map((post) => (
                <Link
                  key={post.id || post._id}
                  to={`/${lang}/posts/${post.id || post._id}`}
                  onMouseEnter={() => onEntryHover?.(`post-${post.id || post._id}`)}
                  onClick={(event) => {
                    const targetPath = `/${lang}/posts/${post.id || post._id}`

                    if (!onNavigate) {
                      return
                    }

                    event.preventDefault()
                    onNavigate(targetPath)
                  }}
                  className={`group flex items-start gap-3 transition ${
                    activeEntryKey === `post-${post.id || post._id}` ? 'bg-secondary' : ''
                  } ${mobile ? 'px-4 py-3 hover:bg-secondary' : 'rounded-2xl px-3 py-2.5 hover:bg-secondary'}`}
                >
                  {post.media?.[0]?.url ? (
                    <div className="size-12 shrink-0 overflow-hidden rounded-2xl border border-border bg-secondary">
                      {post.media[0].type === 'video' ? (
                        <div className="relative h-full w-full">
                          <video
                            src={resolveMediaUrl(post.media[0].url)}
                            className="h-full w-full object-cover"
                            muted
                            playsInline
                          />
                          <span className="absolute inset-0 grid place-items-center bg-black/20 text-white">
                            <svg viewBox="0 0 24 24" fill="currentColor" className="size-4" aria-hidden="true">
                              <path d="m9 7 8 5-8 5V7Z" />
                            </svg>
                          </span>
                        </div>
                      ) : (
                        <img
                          src={resolveMediaUrl(post.media[0].url)}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                  ) : (
                    <div className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary text-muted transition group-hover:bg-secondary-hover">
                      <SearchIcon />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium text-text">
                      {post.author
                        ? highlightMatch(getFullName(post.author), query)
                        : t('search.posts.title')}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted">
                      {highlightMatch(post.text || t('search.overlay.mediaOnlyPost'), query)}
                    </p>
                    {post.author?.username ? (
                      <p className="mt-1 truncate text-[11px] font-medium text-soft">@{highlightMatch(post.author.username, query)}</p>
                    ) : null}
                  </div>
                </Link>
              ))}
              {!hasSuggestions && !hasPostSuggestions ? (
                <div className={mobile ? 'px-4 py-4' : 'px-3 py-3'}>
                  <p className="text-sm text-muted">{t('search.overlay.noResults')}</p>
                </div>
              ) : null}
            </>
          )}
        {showRecentSearches && !hasRecentSearches ? (
          <div className={mobile ? 'px-4 py-4' : 'px-3 py-3'}>
            <p className="text-sm text-muted">{t('search.overlay.noRecent')}</p>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function DesktopSearch({
  t,
  lang,
  value,
  onChange,
  onSubmit,
  onNavigate,
  suggestions,
  postSuggestions,
  recentSearches,
  showSuggestions,
  onFocus,
  onSelectRecent,
  onClearRecentItem,
  onClearAllRecent,
  onKeyDown,
  activeEntryKey,
  onEntryHover,
}) {
  return (
    <div className="hidden flex-1 justify-center md:flex">
      <div className="relative flex w-full max-w-[640px] items-center" data-dropdown-shell="true">
        <label className="group flex h-11 min-w-0 flex-1 text-sm items-center gap-3 rounded-l-lg border border-r-0 border-border bg-secondary px-4 transition focus-within:border-border-strong focus-within:bg-card">
          <span className="text-soft">
            <SearchIcon />
          </span>
          <input
            type="text"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onFocus={onFocus}
            onKeyDown={onKeyDown}
            placeholder={t('common.search')}
            className="w-full bg-transparent text-sm text-text outline-none placeholder:text-muted"
          />
        </label>
        <button
          type="button"
          onClick={onSubmit}
          className="flex h-11 cursor-pointer items-center gap-2 rounded-r-lg border border-border bg-card px-5 text-sm font-medium text-muted hover:text-text transition hover:bg-secondary"
        >
          <SearchIcon />
          <span>{t('search.overlay.searchAction')}</span>
        </button>
        {showSuggestions ? (
          <SearchSuggestionList
            t={t}
            items={suggestions}
            posts={postSuggestions}
            recentSearches={recentSearches}
            lang={lang}
            query={value}
            onNavigate={onNavigate}
            onSelectRecent={onSelectRecent}
            onClearRecentItem={onClearRecentItem}
            onClearAllRecent={onClearAllRecent}
            activeEntryKey={activeEntryKey}
            onEntryHover={onEntryHover}
          />
        ) : null}
      </div>
    </div>
  )
}

function RightRail({ children }) {
  if (!children) {
    return null
  }

  return (
    <aside className="hidden xl:block xl:w-[320px]">
      <div className="sticky top-[88px] flex flex-col gap-4">
        {children}
      </div>
    </aside>
  )
}

function MobileBottomBar({
  visible = true,
  messageUnreadCount = 0,
  notificationUnreadCount = 0,
  onCreateClick = null,
  hideCreateButton = false,
  forceDark = false,
}) {
  const { lang } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation()
  const [showCreateMenu, setShowCreateMenu] = useState(false)
  const createMenuRef = useRef(null)

  const normalizedPath =
    location.pathname.length > 1 && location.pathname.endsWith('/')
      ? location.pathname.slice(0, -1)
      : location.pathname
  const langRootPath = `/${lang}`
  const items = useMemo(
    () => [
      { key: 'home', to: `/${lang}/`, label: t('nav.home'), icon: <HomeIcon /> },
      {
        key: 'messages',
        to: `/${lang}/messages`,
        label: t('nav.messages'),
        icon: <MessageIcon />,
        badgeCount: messageUnreadCount,
      },
      {
        key: 'loop',
        to: `/${lang}/loop`,
        label: t('nav.loop'),
        icon: <LoopIcon />,
      },
      {
        key: 'notifications',
        to: `/${lang}/notifications`,
        label: t('nav.notifications'),
        icon: <BellIcon />,
        badgeCount: notificationUnreadCount,
      },
      { key: 'profile', to: `/${lang}/profile`, label: t('nav.profile'), icon: <UserIcon /> },
    ],
    [lang, messageUnreadCount, notificationUnreadCount, t],
  )

  const isItemActive = useCallback((itemKey) => {
    if (itemKey === 'home') {
      return normalizedPath === langRootPath
    }

    if (itemKey === 'messages') {
      return normalizedPath === `${langRootPath}/messages` || normalizedPath.startsWith(`${langRootPath}/messages/`)
    }

    if (itemKey === 'loop') {
      return normalizedPath === `${langRootPath}/loop` || normalizedPath.startsWith(`${langRootPath}/loop/`)
    }

    if (itemKey === 'notifications') {
      return normalizedPath === `${langRootPath}/notifications` || normalizedPath.startsWith(`${langRootPath}/notifications/`)
    }

    if (itemKey === 'profile') {
      return (
        normalizedPath === `${langRootPath}/profile` ||
        normalizedPath.startsWith(`${langRootPath}/profile/`) ||
        normalizedPath.startsWith(`${langRootPath}/u/`)
      )
    }

    return false
  }, [langRootPath, normalizedPath])

  function handleCreateClick() {
    const isGroupsRoute =
      normalizedPath === `${langRootPath}/groups` ||
      normalizedPath.startsWith(`${langRootPath}/groups/`)

    if (isGroupsRoute && typeof onCreateClick === 'function') {
      const handledByParent = onCreateClick('post') === true
      if (handledByParent) {
        setShowCreateMenu(false)
        return
      }
    }

    setShowCreateMenu((current) => !current)
  }

  function handleCreateAction(action) {
    setShowCreateMenu(false)

    let handledByParent = false
    if (typeof onCreateClick === 'function') {
      handledByParent = onCreateClick(action) === true
    }

    if (handledByParent) {
      return
    }

    const currentPath = `${location.pathname}${location.search}${location.hash}`
    const homePath = `/${lang}/`
    const params = new URLSearchParams()
    params.set('compose', '1')
    if (action === 'loopVideo') {
      params.set('composerMedia', 'video')
      params.set('composerType', 'post')
    } else if (action === 'story') {
      params.delete('composerMedia')
      params.set('composerType', 'story')
    } else {
      params.delete('composerMedia')
      params.set('composerType', 'post')
    }

    if (currentPath !== homePath) {
      params.set('returnTo', currentPath)
    }

    navigate(`/${lang}/?${params.toString()}`)
  }

  useEffect(() => {
    setShowCreateMenu(false)
  }, [normalizedPath])

  useEffect(() => {
    if (!showCreateMenu) {
      return undefined
    }

    function handlePointerDown(event) {
      if (!createMenuRef.current?.contains(event.target)) {
        setShowCreateMenu(false)
      }
    }

    function handleEscape(event) {
      if (event.key === 'Escape') {
        setShowCreateMenu(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [showCreateMenu])

  return (
    <nav
      className={`fixed inset-x-0 bottom-0 z-40 h-[56px] max-h-[58px] border-t border-border bg-[rgb(var(--color-card)/0.96)] text-text px-1.5 py-1 backdrop-blur-lg transition-transform duration-300 md:hidden ${
        forceDark ? 'dark' : ''
      } ${
        visible ? 'translate-y-0' : 'translate-y-full'
      }`}
    >
      <div className="grid grid-cols-5 gap-1">
        {items.map((item) => {
          const active = isItemActive(item.key)
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={() =>
                `group flex h-[46px] flex-col items-center justify-center gap-0.5 rounded-xl py-0.5 text-[10px] leading-none transition-all duration-200 ${
                  active
                    ? 'bg-nav-active text-primary font-semibold shadow-xs'
                    : 'text-muted hover:bg-nav-hover hover:text-text'
                }`
              }
            >
              <span className={`relative grid size-6 place-items-center transition-transform duration-200 ${active ? 'scale-105 text-primary' : 'group-active:scale-95'}`}>
                {item.key === 'home' && <HomeIcon filled={active} className="size-5" />}
                {item.key === 'messages' && <MessageIcon filled={active} className="size-5" />}
                {item.key === 'loop' && <LoopIcon filled={active} className="size-5" />}
                {item.key === 'notifications' && <BellIcon filled={active} className="size-5" />}
                {item.key === 'profile' && <UserIcon filled={active} className="size-5" />}
                <UnreadBadge count={item.badgeCount} className="absolute -right-2 -top-1 ring-1.5 ring-card text-[9px] min-w-[16px] h-[16px] px-0.5" />
              </span>
              <span className={`leading-none tracking-tight ${active ? 'text-primary font-semibold' : ''}`}>
                {item.label}
              </span>
            </NavLink>
          )
        })}
      </div>
      {!hideCreateButton ? (
        <div ref={createMenuRef} className="absolute -top-13 right-3.5 z-[45]">
          {showCreateMenu ? (
            <div className="absolute bottom-[calc(100%+10px)] right-0 w-52 rounded-2xl border border-border bg-card p-2 shadow-[0_20px_45px_rgba(15,23,42,0.18)] backdrop-blur-md">
              <p className="px-3 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-soft">
                {t('common.createMenu.title')}
              </p>
              <button
                type="button"
                onClick={() => handleCreateAction('post')}
                className="flex w-full cursor-pointer items-center rounded-xl px-3 py-2.5 text-left text-sm font-medium text-text transition hover:bg-secondary active:scale-[0.98]"
              >
                {t('common.createMenu.post')}
              </button>
              <button
                type="button"
                onClick={() => handleCreateAction('loopVideo')}
                className="flex w-full cursor-pointer items-center rounded-xl px-3 py-2.5 text-left text-sm font-medium text-text transition hover:bg-secondary active:scale-[0.98]"
              >
                {t('common.createMenu.loopVideo')}
              </button>
              <button
                type="button"
                onClick={() => handleCreateAction('story')}
                className="flex w-full cursor-pointer items-center rounded-xl px-3 py-2.5 text-left text-sm font-medium text-text transition hover:bg-secondary active:scale-[0.98]"
              >
                <span>{t('common.createMenu.story')}</span>
              </button>
            </div>
          ) : null}
          <button
            type="button"
            onClick={handleCreateClick}
            className={`grid size-11 place-items-center rounded-full bg-primary text-inverse shadow-xl shadow-primary/25 transition-all duration-200 hover:scale-105 active:scale-95 hover:bg-primary-hover ${
              showCreateMenu ? 'rotate-45' : ''
            }`}
            aria-label={t('common.createMenu.openAria')}
            title={t('common.createMenu.openAria')}
          >
            <PlusIcon className="size-5.5" />
          </button>
        </div>
      ) : null}
    </nav>
  )
}

function MobileSearchOverlay({
  onClose,
  t,
  lang,
  value,
  onChange,
  onNavigate,
  suggestions,
  postSuggestions,
  recentSearches,
  showSuggestions,
  onFocus,
  onSelectRecent,
  onClearRecentItem,
  onClearAllRecent,
  onKeyDown,
  activeEntryKey,
  onEntryHover,
}) {
  return (
    <div className="fixed inset-0 z-[75] flex h-[100dvh] flex-col bg-card md:hidden">
      <div className="flex items-center gap-3 border-b border-border px-4 py-2">
        <label className="flex h-11 flex-1 items-center gap-3 rounded-lg border border-border bg-secondary px-4" data-dropdown-shell="true">
          <span className="text-soft">
            <SearchIcon />
          </span>
          <input
            autoFocus
            type="text"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onFocus={onFocus}
            onKeyDown={onKeyDown}
            placeholder={t('common.search')}
            className="w-full bg-transparent text-base text-text outline-none placeholder:text-muted"
          />
        </label>
        <button
          type="button"
          onClick={onClose}
          className="grid size-10 place-items-center rounded-full border border-border text-text"
        >
          <CloseIcon />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {showSuggestions ? (
          <SearchSuggestionList
            t={t}
            items={suggestions}
            posts={postSuggestions}
            recentSearches={recentSearches}
            lang={lang}
            query={value}
            mobile
            onNavigate={onNavigate}
            onSelectRecent={onSelectRecent}
            onClearRecentItem={onClearRecentItem}
            onClearAllRecent={onClearAllRecent}
            activeEntryKey={activeEntryKey}
            onEntryHover={onEntryHover}
          />
        ) : null}
      </div>
    </div>
  )
}

function replaceLangInPath(pathname, nextLang) {
  const segments = pathname.split('/')
  if (segments.length > 1 && supportedLangs.includes(segments[1])) {
    segments[1] = nextLang
    return segments.join('/')
  }

  return `/${nextLang}${pathname.startsWith('/') ? pathname : `/${pathname}`}`
}

function buildMessageThreadLink(lang, peer) {
  const searchParams = new URLSearchParams()

  if (peer?._id) {
    searchParams.set('recipientId', peer._id)
  }

  if (peer?.username) {
    searchParams.set('username', peer.username)
  }

  if (getFullName(peer)) {
    searchParams.set('name', getFullName(peer))
  }

  if (peer?.avatarUrl) {
    searchParams.set('avatarUrl', peer.avatarUrl)
  }

  const queryString = searchParams.toString()
  return `/${lang}/messages${queryString ? `?${queryString}` : ''}`
}

function isUserRecentlyActive(user) {
  if (!user?.lastLoginAt) {
    return false
  }

  return Date.now() - new Date(user.lastLoginAt).getTime() <= 5 * 60 * 1000
}

function SocialLayout({
  children,
  rightAside = null,
  desktopSidebarContent = null,
  desktopSidebarWidth = '240px',
  desktopSidebarCollapsedWidth = '80px',
  lockDesktopSidebar = false,
  mobileHeaderMode = 'default',
  mobileHeaderTitle = '',
  pageTitle,
  activeKey = 'home',
  showDesktopPageHeader = true,
  initialSidebarOpen = true,
  desktopSidebarMode = 'fixed',
  fixedViewport = false,
  hideMobileBottomBar = false,
  mainClassName = '',
  mobileBleed = false,
  mobileFlushTop = false,
  hideHeaderOnMobile = false,
  onMobileCreate = null,
  hideMobileCreateButton = false,
  forceMobileBottomBarDark = false,
}) {
  const { lang } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const { isAuthenticated, status, user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [sidebarOpen, setSidebarOpen] = useState(initialSidebarOpen)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const [openDropdown, setOpenDropdown] = useState('')
  const [isBottomBarVisible, setIsBottomBarVisible] = useState(true)
  const [messageUnreadCount, setMessageUnreadCount] = useState(0)
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0)
  const [messagePreviewItems, setMessagePreviewItems] = useState([])
  const [notificationPreviewItems, setNotificationPreviewItems] = useState([])
  const [isMessageDropdownLoading, setIsMessageDropdownLoading] = useState(false)
  const [isNotificationDropdownLoading, setIsNotificationDropdownLoading] = useState(false)
  const [isMarkingMessagesRead, setIsMarkingMessagesRead] = useState(false)
  const [isMarkingNotificationsRead, setIsMarkingNotificationsRead] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchSuggestionItems, setSearchSuggestionItems] = useState([])
  const [searchSuggestionPosts, setSearchSuggestionPosts] = useState([])
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false)
  const [recentSearches, setRecentSearches] = useState([])
  const [activeSearchSuggestionIndex, setActiveSearchSuggestionIndex] = useState(-1)
  const previousSearchQueryRef = useRef('')
  const shellRef = useRef(null)
  const lastScrollYRef = useRef(0)
  const sidebarLanguageRef = useRef(null)
  const mobileLanguageRef = useRef(null)
  const [showSidebarLanguageMenu, setShowSidebarLanguageMenu] = useState(false)
  const [showMobileLanguageMenu, setShowMobileLanguageMenu] = useState(false)
  const isGroupsMobileHeader = mobileHeaderMode === 'groups'

  useEffect(() => {
    setSidebarOpen(initialSidebarOpen)
  }, [initialSidebarOpen])

  useEffect(() => {
    if (lockDesktopSidebar) {
      setSidebarOpen(true)
    }
  }, [lockDesktopSidebar])

  useEffect(() => {
    let cancelled = false

    async function loadSearchHistory() {
      if (!isAuthenticated) {
        if (!cancelled) {
          setRecentSearches(loadRecentSearches())
        }
        return
      }

      try {
        const payload = await getSearchHistory()

        if (!cancelled) {
          setRecentSearches(payload.items || [])
        }
      } catch {
        if (!cancelled) {
          setRecentSearches(loadRecentSearches())
        }
      }
    }

    loadSearchHistory()

    return () => {
      cancelled = true
    }
  }, [isAuthenticated, user?.id])

  useEffect(() => {
    const nextQuery = location.pathname.endsWith('/search')
      ? new URLSearchParams(location.search).get('q') || ''
      : ''
    previousSearchQueryRef.current = nextQuery
    setSearchQuery(nextQuery)
    setSearchSuggestionItems([])
    setSearchSuggestionPosts([])
    setShowSearchSuggestions(false)
  }, [location.pathname, location.search])

  useEffect(() => {
    const query = searchQuery.trim()
    const previousQuery = previousSearchQueryRef.current.trim()
    const hasBackspaced = query.length < previousQuery.length

    previousSearchQueryRef.current = searchQuery

    if (query.length < MIN_SEARCH_SUGGESTION_CHARS) {
      setSearchSuggestionItems([])
      setSearchSuggestionPosts([])
      setActiveSearchSuggestionIndex(-1)
      return undefined
    }

    if (hasBackspaced) {
      setSearchSuggestionItems([])
      setSearchSuggestionPosts([])
      setActiveSearchSuggestionIndex(-1)
    }

    let cancelled = false
    const timeoutId = window.setTimeout(async () => {
      try {
        const payload = await getSearchSuggestions({ q: query, limit: 6 })

        if (!cancelled) {
          setSearchSuggestionItems(payload.items || [])
          setSearchSuggestionPosts(payload.posts || [])
          setShowSearchSuggestions((current) =>
            current ? Boolean(payload.items?.length || payload.posts?.length) : false,
          )
        }
      } catch {
        if (!cancelled) {
          setSearchSuggestionItems([])
          setSearchSuggestionPosts([])
          setShowSearchSuggestions(false)
        }
      }
    }, 220)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [searchQuery])

  const refreshMessageUnreadCount = useCallback(async ({ showLoader = false } = {}) => {
    if (!isAuthenticated) {
      setMessageUnreadCount(0)
      setMessagePreviewItems([])
      setIsMessageDropdownLoading(false)
      return
    }

    try {
      if (showLoader) {
        setIsMessageDropdownLoading(true)
      }
      const payload = await getConversations(100)
      const conversations = payload.conversations || []
      const totalUnread = (payload.conversations || []).reduce(
        (sum, conversation) => sum + Number(conversation.unreadCount || 0),
        0,
      )

      setMessageUnreadCount(totalUnread)
      setMessagePreviewItems(conversations.slice(0, 4))
    } catch {
      setMessageUnreadCount((current) => current)
      setMessagePreviewItems((current) => current)
    } finally {
      if (showLoader) {
        setIsMessageDropdownLoading(false)
      }
    }
  }, [isAuthenticated])

  const refreshNotificationUnreadCount = useCallback(async ({ showLoader = false } = {}) => {
    if (!isAuthenticated) {
      setNotificationUnreadCount(0)
      setNotificationPreviewItems([])
      setIsNotificationDropdownLoading(false)
      return
    }

    try {
      if (showLoader) {
        setIsNotificationDropdownLoading(true)
      }
      const payload = await getNotifications({ limit: 100 })
      const notifications = payload.notifications || []
      setNotificationUnreadCount(notifications.filter((item) => !item.readAt).length)
      setNotificationPreviewItems(notifications.slice(0, 4))
    } catch {
      setNotificationUnreadCount((current) => current)
      setNotificationPreviewItems((current) => current)
    } finally {
      if (showLoader) {
        setIsNotificationDropdownLoading(false)
      }
    }
  }, [isAuthenticated])

  useEffect(() => {
    refreshMessageUnreadCount()
    refreshNotificationUnreadCount()
  }, [location.pathname, refreshMessageUnreadCount, refreshNotificationUnreadCount, user?.id])

  useEffect(() => {
    if (!isAuthenticated) {
      return undefined
    }

    const socket = connectSocketClient()

    function handleRealtimeMessageUpdate() {
      refreshMessageUnreadCount()
    }

    function handleRealtimeNotificationUpdate() {
      refreshNotificationUnreadCount()
    }

    function handleSocketConnect() {
      refreshMessageUnreadCount()
      refreshNotificationUnreadCount()
    }

    function handleFocus() {
      refreshMessageUnreadCount()
      refreshNotificationUnreadCount()
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        refreshMessageUnreadCount()
        refreshNotificationUnreadCount()
      }
    }

    socket.on('connect', handleSocketConnect)
    socket.on('new_message', handleRealtimeMessageUpdate)
    socket.on('messages_read', handleRealtimeMessageUpdate)
    socket.on('notification:new', handleRealtimeNotificationUpdate)
    socket.on('notification:read', handleRealtimeNotificationUpdate)
    socket.on('notification:read:all', handleRealtimeNotificationUpdate)
    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      socket.off('connect', handleSocketConnect)
      socket.off('new_message', handleRealtimeMessageUpdate)
      socket.off('messages_read', handleRealtimeMessageUpdate)
      socket.off('notification:new', handleRealtimeNotificationUpdate)
      socket.off('notification:read', handleRealtimeNotificationUpdate)
      socket.off('notification:read:all', handleRealtimeNotificationUpdate)
      disconnectSocketClient()
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isAuthenticated, refreshMessageUnreadCount, refreshNotificationUnreadCount])

  useEffect(() => {
    setOpenDropdown('')
    setShowSidebarLanguageMenu(false)
    setShowMobileLanguageMenu(false)
    setIsBottomBarVisible(true)
  }, [location.pathname])

  useEffect(() => {
    function handleScroll() {
      const currentScrollY = window.scrollY
      const scrollDelta = currentScrollY - lastScrollYRef.current

      if (Math.abs(scrollDelta) < 8) {
        return
      }

      if (currentScrollY <= 24) {
        setIsBottomBarVisible(true)
      } else if (scrollDelta > 0) {
        setIsBottomBarVisible(false)
      } else {
        setIsBottomBarVisible(true)
      }

      lastScrollYRef.current = currentScrollY
    }

    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  useEffect(() => {
    function handlePointerDown(event) {
      const clickedInsideShell = shellRef.current?.contains(event.target)
      const clickedInsideDropdown = event.target instanceof Element && event.target.closest('[data-dropdown-shell="true"]')
      const clickedInsideSidebarLanguage = sidebarLanguageRef.current?.contains(event.target)
      const clickedInsideMobileLanguage = mobileLanguageRef.current?.contains(event.target)

      if (!clickedInsideSidebarLanguage) {
        setShowSidebarLanguageMenu(false)
      }

      if (!clickedInsideMobileLanguage) {
        setShowMobileLanguageMenu(false)
      }

      if (clickedInsideShell && !clickedInsideDropdown) {
        setOpenDropdown('')
        setShowSearchSuggestions(false)
      }

      if (!clickedInsideShell) {
        setOpenDropdown('')
        setShowSearchSuggestions(false)
      }
    }

    function handleEscape(event) {
      if (event.key === 'Escape') {
        setOpenDropdown('')
        setMobileSearchOpen(false)
        setMobileMenuOpen(false)
        setShowSearchSuggestions(false)
        setShowSidebarLanguageMenu(false)
        setShowMobileLanguageMenu(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    function handleOpenMobileSearchEvent() {
      setMobileSearchOpen(true)
      setShowSearchSuggestions(true)
    }

    window.addEventListener(OPEN_MOBILE_SEARCH_EVENT, handleOpenMobileSearchEvent)
    return () => window.removeEventListener(OPEN_MOBILE_SEARCH_EVENT, handleOpenMobileSearchEvent)
  }, [])

  const desktopPrimary = useMemo(() => {
    if (!isAuthenticated) {
      return [
        { key: 'home', to: `/${lang}/`, label: t('nav.home'), iconKey: 'home' },
        { key: 'loop', to: `/${lang}/loop`, label: t('nav.loop'), iconKey: 'loop' },
        { key: 'login', to: `/${lang}/login`, label: t('common.login'), iconKey: 'login' },
      ]
    }

    return [
      { key: 'home', to: `/${lang}/`, label: t('nav.home'), iconKey: 'home' },
      { key: 'loop', to: `/${lang}/loop`, label: t('nav.loop'), iconKey: 'loop' },
      { key: 'messages', to: `/${lang}/messages`, label: t('nav.messages'), iconKey: 'messages' },
      { key: 'notifications', to: `/${lang}/notifications`, label: t('nav.notifications'), iconKey: 'notifications' },
      { key: 'groups', to: `/${lang}/groups`, label: 'Gruplar', iconKey: 'groups' },
      { key: 'profile', to: `/${lang}/profile`, label: t('nav.profile'), iconKey: 'profile' },
      ...(user?.role === 'admin'
        ? [{ key: 'admin', to: `/${lang}/admin`, label: 'Admin', iconKey: 'settings' }]
        : []),
      { key: 'hiddenProfile', to: `/${lang}/hidden-profile`, label: t('nav.hiddenProfile'), iconKey: 'hiddenProfile' },
      { key: 'monetization', to: `/${lang}/monetization`, label: t('nav.monetization'), iconKey: 'monetization' },
    ]
  }, [isAuthenticated, lang, t, user?.role])

  const footerLinks = useMemo(
    () => [
      { key: 'about', to: `/${lang}/about`, label: t('nav.about') },
      { key: 'contact', to: `/${lang}/contact`, label: t('nav.contact') },
      { key: 'ads', to: `/${lang}/ads`, label: t('nav.ads') },
    ],
    [lang, t],
  )

  async function handleLogout() {
    await logout()
    setOpenDropdown('')
    navigate(`/${lang}/`)
  }

  async function handleMarkAllMessagesRead() {
    if (!messageUnreadCount || isMarkingMessagesRead) {
      return
    }

    setIsMarkingMessagesRead(true)

    try {
      const payload = await getConversations(100)
      const unreadConversations = (payload.conversations || []).filter(
        (conversation) => Number(conversation.unreadCount || 0) > 0,
      )

      await Promise.all(
        unreadConversations.map((conversation) => markConversationRead(conversation.id)),
      )

      await refreshMessageUnreadCount()
    } finally {
      setIsMarkingMessagesRead(false)
    }
  }

  async function handleMarkAllNotificationsRead() {
    if (!notificationUnreadCount || isMarkingNotificationsRead) {
      return
    }

    setIsMarkingNotificationsRead(true)

    try {
      await markAllNotificationsRead()
      await refreshNotificationUnreadCount()
    } finally {
      setIsMarkingNotificationsRead(false)
    }
  }

  function handleLanguageChange(nextLang) {
    i18n.changeLanguage(nextLang)
    navigate(replaceLangInPath(location.pathname, nextLang))
  }

  function toggleDropdown(key) {
    setOpenDropdown((current) => {
      const nextValue = current === key ? '' : key

      if (nextValue === 'messages') {
        refreshMessageUnreadCount({ showLoader: !messagePreviewItems.length })
      }

      if (nextValue === 'notifications') {
        refreshNotificationUnreadCount({ showLoader: !notificationPreviewItems.length })
      }

      return nextValue
    })
  }

  const visibleSearchSuggestions = useMemo(
    () =>
      buildSearchSuggestionEntries({
        query: searchQuery,
        recentSearches,
        items: searchSuggestionItems,
        posts: searchSuggestionPosts,
        lang,
      }),
    [lang, recentSearches, searchQuery, searchSuggestionItems, searchSuggestionPosts],
  )

  useEffect(() => {
    if (!showSearchSuggestions || !visibleSearchSuggestions.length) {
      setActiveSearchSuggestionIndex(-1)
      return
    }

    setActiveSearchSuggestionIndex((current) =>
      current >= visibleSearchSuggestions.length ? -1 : current,
    )
  }, [showSearchSuggestions, visibleSearchSuggestions])

  function handleSearchSubmit() {
    const query = searchQuery.trim()

    if (!query) {
      return
    }

    const nextRecentSearches = buildRecentSearches(recentSearches, query)
    setRecentSearches(nextRecentSearches)

    if (isAuthenticated) {
      saveSearchHistory(query)
        .then((payload) => {
          if (payload?.items) {
            setRecentSearches(payload.items)
          }
        })
        .catch(() => undefined)
    } else {
      persistRecentSearches(nextRecentSearches)
    }

    const searchParams = new URLSearchParams()
    searchParams.set('q', query)
    searchParams.set('tab', 'all')
    searchParams.set('sort', 'popular')
    setShowSearchSuggestions(false)
    setMobileSearchOpen(false)
    navigate(`/${lang}/search?${searchParams.toString()}`)
  }

  function handleSearchFocus() {
    setShowSearchSuggestions(true)
  }

  function handleSearchInputKeyDown(event) {
    if (event.key === 'ArrowDown') {
      if (!showSearchSuggestions) {
        setShowSearchSuggestions(true)
      }

      if (!visibleSearchSuggestions.length) {
        return
      }

      event.preventDefault()
      setActiveSearchSuggestionIndex((current) =>
        current < 0 ? 0 : (current + 1) % visibleSearchSuggestions.length,
      )
      return
    }

    if (event.key === 'ArrowUp') {
      if (!visibleSearchSuggestions.length) {
        return
      }

      event.preventDefault()
      setActiveSearchSuggestionIndex((current) =>
        current <= 0 ? visibleSearchSuggestions.length - 1 : current - 1,
      )
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      handleSearchSubmit()
    }
  }

  function handleSelectRecentSearch(query) {
    setSearchQuery(query)
    const nextRecentSearches = buildRecentSearches(recentSearches, query)
    setRecentSearches(nextRecentSearches)

    if (isAuthenticated) {
      saveSearchHistory(query)
        .then((payload) => {
          if (payload?.items) {
            setRecentSearches(payload.items)
          }
        })
        .catch(() => undefined)
    } else {
      persistRecentSearches(nextRecentSearches)
    }

    const searchParams = new URLSearchParams()
    searchParams.set('q', query)
    searchParams.set('tab', 'all')
    searchParams.set('sort', 'popular')
    setShowSearchSuggestions(false)
    setMobileSearchOpen(false)
    navigate(`/${lang}/search?${searchParams.toString()}`)
  }

  function handleClearRecentSearch(itemToRemove) {
    const filteredSearches = recentSearches.filter((item) => item.query !== itemToRemove)
    setRecentSearches(filteredSearches)

    if (isAuthenticated) {
      deleteSearchHistory(itemToRemove)
        .then((payload) => {
          if (payload?.items) {
            setRecentSearches(payload.items)
          }
        })
        .catch(() => undefined)
    } else {
      persistRecentSearches(filteredSearches)
    }

    setShowSearchSuggestions(Boolean(filteredSearches.length || searchQuery.trim().length >= MIN_SEARCH_SUGGESTION_CHARS))
  }

  function handleClearAllRecentSearches() {
    setRecentSearches([])

    if (isAuthenticated) {
      deleteSearchHistory()
        .then((payload) => {
          if (payload?.items) {
            setRecentSearches(payload.items)
          }
        })
        .catch(() => undefined)
    } else {
      persistRecentSearches([])
    }

    setShowSearchSuggestions(searchQuery.trim().length >= MIN_SEARCH_SUGGESTION_CHARS)
  }

  function handleSearchSuggestionNavigate(targetPath) {
    setShowSearchSuggestions(false)
    setMobileSearchOpen(false)
    navigate(targetPath)
  }

  return (
    <div
      ref={shellRef}
      className="min-h-screen bg-bg text-text transition-colors"
      style={{
        '--sidebar-width': sidebarOpen ? desktopSidebarWidth : desktopSidebarCollapsedWidth,
      }}
    >
      <header
        className={`fixed inset-x-0 top-0 z-50 border-b border-border bg-[rgb(var(--color-card)/0.92)] backdrop-blur ${
          hideHeaderOnMobile ? 'hidden md:block' : ''
        }`}
      >
        <div className="mx-auto flex h-12 items-center gap-1 px-3 md:h-14 md:px-4">
          <button
            type="button"
            onClick={() => {
              if (window.innerWidth < 768 && isGroupsMobileHeader) {
                navigate(-1)
                return
              }

              if (window.innerWidth >= 768) {
                if (desktopSidebarMode === 'drawer') {
                  setMobileMenuOpen((value) => !value)
                } else {
                  if (lockDesktopSidebar) {
                    return
                  }
                  setSidebarOpen((value) => !value)
                }
              } else {
                setMobileMenuOpen((value) => !value)
              }
            }}
            className="grid size-10 place-items-center rounded-full text-text transition hover:bg-nav-hover cursor-pointer"
            aria-label={isGroupsMobileHeader ? 'Geri don' : t('common.menu')}
          >
            {isGroupsMobileHeader ? (
              <>
                <span className="md:hidden">
                  <ArrowLeftIcon />
                </span>
                <span className="hidden md:block">
                  <MenuIcon />
                </span>
              </>
            ) : (
              <MenuIcon />
            )}
          </button>

          {isGroupsMobileHeader ? (
            <>
              <p className="text-base font-semibold text-text md:hidden">{mobileHeaderTitle || pageTitle}</p>
              <Link
                to={`/${lang}/`}
                className="hidden shrink-0 items-center gap-2 text-sm font-semibold text-text md:flex"
              >
                <span className="grid size-8 place-items-center rounded-2xl bg-primary text-inverse">
                  NS
                </span>
                <span className="hidden sm:block text-[18px] font-extrabold text-text">Nest Social</span>
                {isDemoEnvironment ? (
                  <span className="rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/60 dark:text-amber-200">
                    {appEnvironmentLabel}
                  </span>
                ) : null}
              </Link>
            </>
          ) : (
            <Link
              to={`/${lang}/`}
              className="flex shrink-0 items-center gap-2 text-sm font-semibold text-text"
            >
              <span className="grid size-8 place-items-center rounded-2xl bg-primary text-inverse">
                NS
              </span>
              <span className="hidden sm:block text-[18px] font-extrabold text-text">Nest Social</span>
              {isDemoEnvironment ? (
                <span className="rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/60 dark:text-amber-200">
                  {appEnvironmentLabel}
                </span>
              ) : null}
            </Link>
          )}

          <DesktopSearch
            t={t}
            lang={lang}
            value={searchQuery}
            onChange={setSearchQuery}
            onFocus={handleSearchFocus}
            onSubmit={handleSearchSubmit}
            onNavigate={handleSearchSuggestionNavigate}
            suggestions={searchSuggestionItems}
            postSuggestions={searchSuggestionPosts}
            recentSearches={recentSearches}
            showSuggestions={showSearchSuggestions}
            onSelectRecent={handleSelectRecentSearch}
            onClearRecentItem={handleClearRecentSearch}
            onClearAllRecent={handleClearAllRecentSearches}
            onKeyDown={handleSearchInputKeyDown}
            activeEntryKey={visibleSearchSuggestions[activeSearchSuggestionIndex]?.key || ''}
            onEntryHover={(entryKey) =>
              setActiveSearchSuggestionIndex(
                visibleSearchSuggestions.findIndex((entry) => entry.key === entryKey),
              )}
          />

          <div className="ml-auto flex items-center gap-2">
            <HeaderIconButton
              onClick={() => setMobileSearchOpen(true)}
              ariaLabel={t('common.search')}
              className="md:hidden"
            >
              <SearchIcon />
            </HeaderIconButton>

            {isAuthenticated ? (
              <>
                <div className="relative hidden md:block" data-dropdown-shell="true">
                  <HeaderIconButton
                    onClick={() => toggleDropdown('messages')}
                    active={openDropdown === 'messages'}
                    ariaLabel={t('nav.messages')}
                    className="relative"
                  >
                    <MessageIcon />
                    <UnreadBadge count={messageUnreadCount} className="absolute -right-1 -top-1" />
                  </HeaderIconButton>
                  <DropdownPanel
                    open={openDropdown === 'messages'}
                    title={t('nav.messages')}
                    action={
                      messageUnreadCount ? (
                        <button
                          type="button"
                          onClick={handleMarkAllMessagesRead}
                          disabled={isMarkingMessagesRead}
                          className="rounded-full border border-border px-3 py-1.5 text-[11px] font-medium text-muted transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isMarkingMessagesRead ? '...' : 'Hepsi okundu'}
                        </button>
                      ) : null
                    }
                  >
                    {isMessageDropdownLoading ? (
                      <DropdownSkeletonList />
                    ) : messagePreviewItems.length ? (
                      <>
                        {messagePreviewItems.map((conversation) => {
                          const peer = conversation?.participants?.[0] || null
                          const previewBody = conversation.lastMessagePreview || 'Medya gonderildi'
                          const previewMeta = [
                            peer?.username ? `@${peer.username}` : '',
                            conversation.lastMessageAt
                              ? formatRelativeTime(conversation.lastMessageAt)
                              : '',
                          ]
                            .filter(Boolean)
                            .join(' • ')

                          return (
                            <DropdownPreviewLink
                              key={conversation.id || peer?._id || peer?.username}
                              to={buildMessageThreadLink(lang, peer)}
                              user={peer}
                              title={getFullName(peer)}
                              meta={previewMeta}
                              body={previewBody}
                              badgeCount={conversation.unreadCount || 0}
                              media={conversation.lastMessageMedia?.[0] || null}
                              isActive={isUserRecentlyActive(peer)}
                              isHighlighted={Boolean(conversation.unreadCount)}
                              onNavigate={() => setOpenDropdown('')}
                            />
                          )
                        })}
                        <Link
                          to={`/${lang}/messages`}
                          onClick={() => setOpenDropdown('')}
                          className="flex items-center justify-center rounded-lg border border-border px-4 py-3 text-sm font-medium text-text transition hover:bg-secondary"
                        >
                          Tum mesajlari gor
                        </Link>
                      </>
                    ) : (
                      <>
                        <DropdownInfoItem title="Yeni mesaj yok" meta="Son konusmalar burada gorunecek." />
                        <DropdownInfoItem title="Canli sohbetler" meta="Aktif konusmalar bu menuden acilacak." />
                      </>
                    )}
                  </DropdownPanel>
                </div>

                <div className="relative hidden md:block" data-dropdown-shell="true">
                  <HeaderIconButton
                    onClick={() => toggleDropdown('notifications')}
                    active={openDropdown === 'notifications'}
                    ariaLabel={t('nav.notifications')}
                    className="relative"
                  >
                    <BellIcon />
                    <UnreadBadge count={notificationUnreadCount} className="absolute -right-1 -top-1" />
                  </HeaderIconButton>
                  <DropdownPanel
                    open={openDropdown === 'notifications'}
                    title={t('nav.notifications')}
                    action={
                      notificationUnreadCount ? (
                        <button
                          type="button"
                          onClick={handleMarkAllNotificationsRead}
                          disabled={isMarkingNotificationsRead}
                          className="rounded-full border border-border px-3 py-1.5 text-[11px] font-medium text-muted transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isMarkingNotificationsRead ? '...' : 'Hepsi okundu'}
                        </button>
                      ) : null
                    }
                  >
                    {isNotificationDropdownLoading ? (
                      <DropdownSkeletonList />
                    ) : notificationPreviewItems.length ? (
                      <>
                        {notificationPreviewItems.map((notification) => {
                          const actor = notification.actor || {}
                          const content = formatNotificationContent(notification, t)
                          const previewMeta = notification.createdAt
                            ? formatRelativeTime(notification.createdAt)
                            : ''

                          return (
                            <DropdownPreviewLink
                              key={notification._id}
                              to={`/${lang}/notifications`}
                              user={actor}
                              title={content.title}
                              meta={previewMeta}
                              body={content.body}
                              badgeCount={notification.readAt ? 0 : 1}
                              isActive={isUserRecentlyActive(actor)}
                              isHighlighted={!notification.readAt}
                              onNavigate={() => setOpenDropdown('')}
                            />
                          )
                        })}
                        <Link
                          to={`/${lang}/notifications`}
                          onClick={() => setOpenDropdown('')}
                          className="flex items-center justify-center rounded-2xl border border-border px-4 py-3 text-sm font-medium text-text transition hover:bg-secondary"
                        >
                          Tum bildirimleri gor
                        </Link>
                      </>
                    ) : (
                      <>
                        <DropdownInfoItem title="Bildirim yok" meta="Yeni uyarilar burada listelenecek." />
                        <DropdownInfoItem title="Moderasyon ve sosyal olaylar" meta="Begeni, yorum ve sistem bildirimleri." />
                      </>
                    )}
                  </DropdownPanel>
                </div>

                <div className="relative" data-dropdown-shell="true">
                  <HeaderIconButton
                    onClick={() => {
                      if (isGroupsMobileHeader && window.innerWidth < 768) {
                        onMobileCreate?.('group')
                        return
                      }
                      toggleDropdown('profile')
                    }}
                    active={openDropdown === 'profile'}
                    ariaLabel={isGroupsMobileHeader ? 'Grup olustur' : t('nav.profile')}
                  >
                    {isGroupsMobileHeader ? (
                      <>
                        <span className="md:hidden">
                          <PlusIcon />
                        </span>
                        <span className="hidden md:block">
                          <UserAvatar
                            user={user}
                            className="size-8 bg-transparent text-current dark:bg-transparent dark:text-current"
                            textClassName="text-sm font-semibold"
                          />
                        </span>
                      </>
                    ) : (
                      <UserAvatar
                        user={user}
                        className="size-8 bg-transparent text-current dark:bg-transparent dark:text-current"
                        textClassName="text-sm font-semibold"
                      />
                    )}
                  </HeaderIconButton>
                  <DropdownPanel
                    open={openDropdown === 'profile'}
                    title={user?.username ? `@${user.username}` : t('nav.profile')}
                  >
                    <ProfileMenuLink
                      to={`/${lang}/profile`}
                      label={getFullName(user)}
                      onNavigate={() => setOpenDropdown('')}
                      icon={
                        <UserAvatar
                          user={user}
                          className="size-5 bg-transparent text-current dark:bg-transparent dark:text-current"
                          textClassName="text-[10px] font-semibold"
                        />
                      }
                    />
                    <ProfileMenuLink
                      to={`/${lang}/messages`}
                      label={t('nav.messages')}
                      onNavigate={() => setOpenDropdown('')}
                      icon={<MessageIcon />}
                      badgeCount={messageUnreadCount}
                    />
                    <ProfileMenuLink
                      to={`/${lang}/notifications`}
                      label={t('nav.notifications')}
                      onNavigate={() => setOpenDropdown('')}
                      icon={<BellIcon />}
                      badgeCount={notificationUnreadCount}
                    />
                    <ProfileMenuLink
                      to={`/${lang}/profile?tab=saved`}
                      label={t('profile.saved')}
                      onNavigate={() => setOpenDropdown('')}
                      icon={<BookmarkIcon />}
                    />
                    <ProfileMenuLink
                      to={`/${lang}/groups`}
                      label="Gruplar"
                      onNavigate={() => setOpenDropdown('')}
                      icon={<GroupsIcon />}
                    />
                    <ProfileMenuLink
                      to={`/${lang}/settings`}
                      label={t('nav.settings')}
                      onNavigate={() => setOpenDropdown('')}
                      icon={<SettingsIcon />}
                    />
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-medium text-rose-600 transition hover:bg-rose-50"
                    >
                      <span className="text-current">
                        <LoginIcon />
                      </span>
                      <span>Oturumu Kapat</span>
                    </button>
                  </DropdownPanel>
                </div>
              </>
            ) : (
              <Link
                to={`/${lang}/login`}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-normal hover:bg-primary-hover !text-inverse"
              >
                {status === 'loading' ? '...' : t('common.login')}
              </Link>
            )}
          </div>
        </div>
      </header>

      {mobileSearchOpen ? (
        <MobileSearchOverlay
          onClose={() => {
            setMobileSearchOpen(false)
            setShowSearchSuggestions(false)
          }}
          t={t}
          lang={lang}
          value={searchQuery}
          onChange={setSearchQuery}
          onFocus={handleSearchFocus}
          onNavigate={handleSearchSuggestionNavigate}
          suggestions={searchSuggestionItems}
          postSuggestions={searchSuggestionPosts}
          recentSearches={recentSearches}
          showSuggestions={showSearchSuggestions}
            onSelectRecent={handleSelectRecentSearch}
            onClearRecentItem={handleClearRecentSearch}
            onClearAllRecent={handleClearAllRecentSearches}
            onKeyDown={handleSearchInputKeyDown}
            activeEntryKey={visibleSearchSuggestions[activeSearchSuggestionIndex]?.key || ''}
            onEntryHover={(entryKey) =>
              setActiveSearchSuggestionIndex(
                visibleSearchSuggestions.findIndex((entry) => entry.key === entryKey),
              )}
          />
      ) : null}

      {desktopSidebarMode === 'fixed' ? (
        <div className="hidden md:block">
          <aside
            className="fixed left-0 top-14 z-40 flex h-[calc(100vh-56px)] flex-col border-r border-border bg-[rgb(var(--color-card)/0.94)] px-3 py-5 backdrop-blur"
            style={{ width: 'var(--sidebar-width)' }}
          >
            {desktopSidebarContent || (
              <div className="flex flex-1 flex-col justify-between gap-6 overflow-hidden">
                <div className="space-y-1">
                  {desktopPrimary.map((item) => (
                    <SidebarLink
                      key={item.key}
                      item={item}
                      open={sidebarOpen}
                      badgeCount={
                        item.key === 'messages'
                          ? messageUnreadCount
                          : item.key === 'notifications'
                            ? notificationUnreadCount
                            : 0
                      }
                      onNavigate={() => setMobileMenuOpen(false)}
                    />
                  ))}
                </div>

                <div className="space-y-4 ">
                  <div className="rounded-lg border border-border  bg-secondary p-2">
                    {sidebarOpen ? (
                      <>
                        <div className="space-y-3">
                          <label className="block">
                            <span className="mb-2 flex items-center gap-2 text-xs font-medium text-muted">
                              <GlobeIcon />
                              {t('common.sidebar.language')}
                            </span>
                            <div className="text-sm" ref={sidebarLanguageRef}>
                              <LanguageSelector
                                currentLang={lang}
                                onChange={(nextLang) => {
                                  setShowSidebarLanguageMenu(false)
                                  handleLanguageChange(nextLang)
                                }}
                                open={showSidebarLanguageMenu}
                                onToggle={() => setShowSidebarLanguageMenu((current) => !current)}
                                menuDirection="up"
                              />
                            </div>
                          </label>

                          <div>
                            <span className="mb-2 flex items-center gap-2 text-xs font-medium text-muted">
                              {theme === 'dark' ? <MoonIcon /> : <SunIcon />}
                              {t('common.sidebar.theme')}
                            </span>
                            <button
                              type="button"
                              onClick={toggleTheme}
                              className="flex w-full items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm  hover:bg-secondary"
                            >
                              <span className="text-sm ">{theme === 'dark' ? t('common.sidebar.darkMode') : t('common.sidebar.lightMode')}</span>
                              <span className="text-soft">{theme === 'dark' ? <MoonIcon /> : <SunIcon />}</span>
                            </button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="space-y-2">
                        <button
                          type="button"
                          onClick={toggleTheme}
                          className="grid size-10 place-items-center cursor-pointer rounded-2xl bg-card text-text"
                        >
                          {theme === 'dark' ? <MoonIcon /> : <SunIcon />}
                        </button>
                      </div>
                    )}
                  </div>

                  {sidebarOpen ? (
                    <div className="px-2 text-xs leading-6 text-muted">
                      <div className="flex flex-wrap gap-x-3">
                        {footerLinks.map((item) => (
                          <Link
                            key={item.key}
                            to={item.to}
                            className="transition hover:text-text"
                          >
                            {item.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </aside>
        </div>
      ) : null}

      <div className={`${desktopSidebarMode === 'drawer' ? 'block' : 'md:hidden'}`}>
        {mobileMenuOpen ? (
          <div className="fixed inset-0 z-[72] bg-black/45 backdrop-blur-sm">
            <div className="h-full w-[280px] overflow-y-auto bg-card py-2 px-2 md:px-4 md:py-4 text-text shadow-2xl md:w-[240px]">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm font-semibold text-text">{pageTitle}</p>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="grid size-10 place-items-center rounded-full border border-border text-text"
                >
                  <CloseIcon />
                </button>
              </div>

              <div className="space-y-1">
                {desktopPrimary.map((item) => (
                  <SidebarLink
                    key={item.key}
                    item={item}
                    open
                    badgeCount={
                      item.key === 'messages'
                        ? messageUnreadCount
                        : item.key === 'notifications'
                          ? notificationUnreadCount
                          : 0
                    }
                    onNavigate={() => setMobileMenuOpen(false)}
                  />
                ))}
              </div>

              <div className="mt-6 rounded-lg border border-border bg-secondary p-4">
                <label className="block">
                  <span className="mb-2 block text-xs font-medium text-muted">{t('common.sidebar.language')}</span>
                  <div ref={mobileLanguageRef}>
                    <LanguageSelector
                      currentLang={lang}
                      onChange={(nextLang) => {
                        setShowMobileLanguageMenu(false)
                        handleLanguageChange(nextLang)
                      }}
                      open={showMobileLanguageMenu}
                      onToggle={() => setShowMobileLanguageMenu((current) => !current)}
                    />
                  </div>
                </label>

                <button
                  type="button"
                  onClick={toggleTheme}
                  className="mt-3 flex w-full items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm "
                >
                  <span>{theme === 'dark' ? t('common.sidebar.darkMode') : t('common.sidebar.lightMode')}</span>
                  <span>{theme === 'dark' ? <MoonIcon /> : <SunIcon />}</span>
                </button>
              </div>

              <div className="mt-6 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
                {footerLinks.map((item) => (
                  <Link key={item.key} to={item.to} onClick={() => setMobileMenuOpen(false)}>
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
      <div
        className={`${mobileBleed ? 'px-0' : 'px-0'} ${
          hideHeaderOnMobile ? 'pt-0' : mobileFlushTop ? 'pt-12' : 'pt-12'
        } md:pr-5 md:pt-[60px] ${
          fixedViewport ? 'h-[100dvh] overflow-hidden pb-0' : 'pb-24'
        } ${desktopSidebarMode === 'fixed' ? 'md:pl-[calc(var(--sidebar-width)+20px)]' : 'md:pl-5'}`}
      >
        <div className={`mx-auto max-w-[1500px] ${fixedViewport ? 'h-full' : ''}`}>
          <div className={`flex flex-col gap-5 xl:flex-row ${fixedViewport ? 'h-full' : ''}`}>
            <main className={`min-w-0 flex-1 ${fixedViewport ? 'h-full overflow-hidden' : ''} ${mainClassName}`}>
              {!showDesktopPageHeader ? <h1 className="sr-only">{pageTitle}</h1> : null}
              {showDesktopPageHeader ? (
                <div className="mb-4 hidden items-center justify-between px-1 md:flex">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-soft">
                      {activeKey}
                    </p>
                    <h1 className="mt-1 text-2xl font-bold tracking-tight text-text">
                      {pageTitle}
                    </h1>
                  </div>
                </div>
              ) : null}
              {children}
            </main>
            <RightRail>{rightAside}</RightRail>
          </div>
        </div>
      </div>

      {!hideMobileBottomBar ? (
        <MobileBottomBar
          visible={isBottomBarVisible}
          messageUnreadCount={messageUnreadCount}
          notificationUnreadCount={notificationUnreadCount}
          onCreateClick={onMobileCreate}
          hideCreateButton={hideMobileCreateButton}
          forceDark={activeKey === 'loop' || forceMobileBottomBarDark}
        />
      ) : null}
    </div>
  )
}

export default SocialLayout
