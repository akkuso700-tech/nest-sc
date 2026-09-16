import { Link } from 'react-router-dom'
import UserAvatar from '../components/common/UserAvatar.jsx'
import VerifiedBadge from '../components/common/VerifiedBadge.jsx'
import { getFullName } from '../utils/social.js'
import {
  BellIcon,
  BookmarkIcon,
  ChevronRightIcon,
  GlobeIcon,
  GroupsIcon,
  HiddenProfileIcon,
  LogOutIcon,
  MessageIcon,
  MonetizationIcon,
  MoonIcon,
  SettingsIcon,
  ShieldIcon,
  SunIcon,
} from './SocialLayoutIcons.jsx'

function DropdownMenuItem({
  to,
  icon,
  label,
  badgeCount = 0,
  badgeText = null,
  onClick,
  highlight = false,
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`group flex items-center justify-between gap-3 rounded-xl px-2.5 py-2 text-xs font-medium transition ${
        highlight
          ? 'text-accent hover:bg-secondary'
          : 'text-text hover:bg-secondary'
      }`}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-secondary text-muted transition-colors group-hover:bg-card group-hover:text-text">
          {icon}
        </span>
        <span className="truncate">{label}</span>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {badgeText ? (
          <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            {badgeText}
          </span>
        ) : null}
        {badgeCount > 0 ? (
          <span className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white shadow-xs">
            {badgeCount > 99 ? '99+' : badgeCount}
          </span>
        ) : null}
        <ChevronRightIcon className="size-3.5 text-muted/60 transition-transform group-hover:translate-x-0.5 group-hover:text-text" />
      </div>
    </Link>
  )
}

export default function ProfileDropdown({
  open,
  onClose,
  user,
  lang,
  t,
  theme,
  setTheme,
  onLanguageChange,
  onLogout,
  messageUnreadCount = 0,
  notificationUnreadCount = 0,
}) {
  if (!open) {
    return null
  }

  const supportedLanguages = [
    { code: 'tr', label: 'TR' },
    { code: 'en', label: 'EN' },
    { code: 'de', label: 'DE' },
    { code: 'es', label: 'ES' },
  ]

  return (
    <div
      className="dropdown-pop absolute right-0 top-[calc(100%+8px)] z-[70] w-[320px] max-w-[calc(100vw-20px)] rounded-2xl border border-border bg-card p-2.5 shadow-[0_24px_60px_rgba(15,23,42,0.22)] dark:shadow-[0_24px_60px_rgba(0,0,0,0.7)]"
      style={{ backgroundColor: 'rgb(var(--color-card))' }}
      data-dropdown-shell="true"
    >
      <div className="subtle-scrollbar max-h-[calc(100vh-80px)] space-y-2 overflow-y-auto">
        {/* User Identity Hero Card */}
        <Link
          to={`/${lang}/profile`}
          onClick={onClose}
          className="group relative flex items-center justify-between gap-3 rounded-xl border border-transparent p-2 transition hover:border-border hover:bg-secondary"
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative shrink-0">
              <UserAvatar
                user={user}
                className="size-11 border border-border transition group-hover:border-primary"
                textClassName="text-sm font-semibold"
              />
              <span
                className="absolute bottom-0 right-0 size-2.5 rounded-full bg-emerald-500 ring-2 ring-card"
                title="Online"
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-sm font-semibold text-text transition-colors group-hover:text-primary">
                  {getFullName(user)}
                </p>
                <VerifiedBadge user={user} size="xs" />
              </div>

              <div className="mt-0.5 flex items-center gap-2">
                <span className="truncate text-xs text-muted">
                  @{user?.username || 'user'}
                </span>
                {user?.role === 'admin' ? (
                  <span className="shrink-0 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                    Admin
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <ChevronRightIcon className="size-4 shrink-0 text-muted/60 transition-transform group-hover:translate-x-0.5 group-hover:text-text" />
        </Link>

        {/* Divider */}
        <div className="border-t border-border" />

        {/* Section 1: Social & Activity */}
        <div className="space-y-0.5">
          <DropdownMenuItem
            to={`/${lang}/profile?tab=saved`}
            icon={<BookmarkIcon className="size-4" />}
            label={t('profile.saved')}
            onClick={onClose}
          />
          <DropdownMenuItem
            to={`/${lang}/groups`}
            icon={<GroupsIcon className="size-4" />}
            label={t('nav.groups')}
            onClick={onClose}
          />
          <DropdownMenuItem
            to={`/${lang}/messages`}
            icon={<MessageIcon className="size-4" />}
            label={t('nav.messages')}
            badgeCount={messageUnreadCount}
            onClick={onClose}
          />
          <DropdownMenuItem
            to={`/${lang}/notifications`}
            icon={<BellIcon className="size-4" />}
            label={t('nav.notifications')}
            badgeCount={notificationUnreadCount}
            onClick={onClose}
          />
        </div>

        {/* Section 2: Management & Discovery */}
        <div className="border-t border-border" />
        <div className="space-y-0.5">
          {user?.role === 'admin' ? (
            <DropdownMenuItem
              to={`/${lang}/admin`}
              icon={<ShieldIcon className="size-4 text-amber-600 dark:text-amber-400" />}
              label={t('nav.admin')}
              badgeText="Yönetim"
              onClick={onClose}
            />
          ) : null}
          <DropdownMenuItem
            to={`/${lang}/hidden-profile`}
            icon={<HiddenProfileIcon className="size-4" />}
            label={t('nav.hiddenProfile')}
            onClick={onClose}
          />
          <DropdownMenuItem
            to={`/${lang}/monetization`}
            icon={<MonetizationIcon className="size-4" />}
            label={t('nav.monetization')}
            onClick={onClose}
          />
          <DropdownMenuItem
            to={`/${lang}/profile/edit`}
            icon={<SettingsIcon className="size-4" />}
            label={t('nav.settings')}
            onClick={onClose}
          />
        </div>

        {/* Section 3: Quick Preferences (Theme & Language) */}
        <div className="border-t border-border" />
        <div className="rounded-xl border border-border bg-secondary p-2 space-y-2">
          {/* Theme Quick Switcher */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-medium text-muted">
              <span className="grid size-6 place-items-center rounded-md bg-card text-text shadow-xs">
                {theme === 'dark' ? (
                  <MoonIcon className="size-3.5" />
                ) : (
                  <SunIcon className="size-3.5" />
                )}
              </span>
              <span>{t('common.sidebar.theme')}</span>
            </div>

            <div className="flex items-center rounded-lg border border-border bg-card p-0.5">
              <button
                type="button"
                onClick={() => setTheme('light')}
                title={t('common.sidebar.lightMode')}
                className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition cursor-pointer ${
                  theme === 'light'
                    ? 'bg-primary text-inverse shadow-xs'
                    : 'text-muted hover:text-text'
                }`}
              >
                <SunIcon className="size-3" />
                <span>{t('common.sidebar.lightMode')}</span>
              </button>
              <button
                type="button"
                onClick={() => setTheme('dark')}
                title={t('common.sidebar.darkMode')}
                className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition cursor-pointer ${
                  theme === 'dark'
                    ? 'bg-primary text-inverse shadow-xs'
                    : 'text-muted hover:text-text'
                }`}
              >
                <MoonIcon className="size-3" />
                <span>{t('common.sidebar.darkMode')}</span>
              </button>
            </div>
          </div>

          {/* Language Quick Switcher */}
          <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-border">
            <div className="flex items-center gap-2 text-xs font-medium text-muted">
              <span className="grid size-6 place-items-center rounded-md bg-card text-text shadow-xs">
                <GlobeIcon className="size-3.5" />
              </span>
              <span>{t('common.sidebar.language')}</span>
            </div>

            <div className="flex items-center gap-1">
              {supportedLanguages.map(({ code, label }) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => onLanguageChange(code)}
                  className={`rounded-md px-2 py-0.5 text-[11px] font-semibold transition cursor-pointer ${
                    lang === code
                      ? 'bg-primary text-inverse shadow-xs'
                      : 'text-muted hover:bg-card hover:text-text'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Section 4: Logout */}
        <div className="border-t border-border" />
        <button
          type="button"
          onClick={onLogout}
          className="group flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-xs font-medium text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40 cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-rose-50 text-rose-600 transition group-hover:bg-rose-100 dark:bg-rose-950/50 dark:text-rose-400 dark:group-hover:bg-rose-900/60">
              <LogOutIcon className="size-3.5" />
            </span>
            <span className="font-semibold">{t('common.logout')}</span>
          </div>
          <ChevronRightIcon className="size-3.5 opacity-60 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    </div>
  )
}
