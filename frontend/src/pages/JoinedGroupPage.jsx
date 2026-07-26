import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import SocialLayout from '../layouts/SocialLayout.jsx'
import UserAvatar from '../components/common/UserAvatar.jsx'
import Seo from '../components/seo/Seo.jsx'
import PostCard from '../features/posts/PostCard.jsx'
import PostComposer from '../features/posts/PostComposer.jsx'
import CreateGroupModal from '../components/groups/CreateGroupModal.jsx'
import GroupsSidebar from '../components/groups/GroupsSidebar.jsx'
import { getGroupsSidebarCache, setGroupsSidebarCache } from '../features/groups/sidebarCache.js'
import { buildShareTargets, copyTextToClipboard, isMobileShareSupported, shareWithNative } from '../utils/postShare.js'
import { useAuth } from '../store/AuthContext.jsx'
import { createGroup, createGroupPost, getGroupBySlug, getGroupMembers, getGroupPosts, getGroupsSidebar, joinGroup, leaveGroup } from '../services/groupsService.js'
import { MOBILE_VIEWPORT_QUERY, useMediaQuery } from '../hooks/useMediaQuery.js'

function mapGroupCard(group) {
  return {
    id: group.id,
    slug: group.slug,
    name: group.name,
    members: `${group?.stats?.memberCount || 0} uye`,
    avatar: `${group.name || 'G'}`.slice(0, 2).toUpperCase(),
    coverImageUrl: group.coverImageUrl || '',
  }
}

export default function JoinedGroupPage() {
  const { t } = useTranslation()
  const { lang = 'tr', groupSlug = '' } = useParams()
  const navigate = useNavigate()
  const { isAuthenticated, status, user } = useAuth()
  const [activeTab, setActiveTab] = useState('posts')
  const [memberSearch, setMemberSearch] = useState('')
  const [debouncedMemberSearch, setDebouncedMemberSearch] = useState('')
  const [group, setGroup] = useState(null)
  const [posts, setPosts] = useState([])
  const [members, setMembers] = useState([])
  const [sidebarState, setSidebarState] = useState(() => {
    const cache = getGroupsSidebarCache()
    return { managed: cache.managed || [], joined: cache.joined || [] }
  })
  const [isPublishing, setIsPublishing] = useState(false)
  const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false)
  const [sidebarMode, setSidebarMode] = useState('feed')
  const [joinNotice, setJoinNotice] = useState('')
  const [postApprovalNotice, setPostApprovalNotice] = useState('')
  const [isPageLoading, setIsPageLoading] = useState(true)
  const [isShareMenuOpen, setIsShareMenuOpen] = useState(false)
  const [isShareProcessing, setIsShareProcessing] = useState(false)
  const [composerOpenKey, setComposerOpenKey] = useState(0)
  const [forceComposerExpanded, setForceComposerExpanded] = useState(false)
  const isMobileViewport = useMediaQuery(MOBILE_VIEWPORT_QUERY)
  const shareMenuRef = useRef(null)

  useEffect(() => {
    if (!isAuthenticated) return
    let cancelled = false
    ;(async () => {
      setIsPageLoading(true)
      const [groupPayload, sidebarPayload] = await Promise.all([
        getGroupBySlug(groupSlug),
        getGroupsSidebar({ limit: 30 }),
      ])
      if (cancelled) return
      setGroup(groupPayload.group)
      const nextSidebarState = {
        managed: (sidebarPayload.managed || []).map(mapGroupCard),
        joined: (sidebarPayload.joined || []).map(mapGroupCard),
      }
      setGroupsSidebarCache({ ...getGroupsSidebarCache(), ...nextSidebarState })
      setSidebarState(nextSidebarState)
      setIsPageLoading(false)
    })().catch(() => {
      if (!cancelled) setIsPageLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [isAuthenticated, groupSlug])

  useEffect(() => {
    if (!group?.id) return
    ;(async () => {
      const postsPayload = await getGroupPosts(group.id, { limit: 20 })
      setPosts(postsPayload.posts || [])
    })().catch(() => {})
  }, [group?.id])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedMemberSearch(memberSearch.trim())
    }, 250)

    return () => clearTimeout(timeoutId)
  }, [memberSearch])

  useEffect(() => {
    if (!group?.id) return
    ;(async () => {
      const membersPayload = await getGroupMembers(group.id, {
        q: debouncedMemberSearch,
        limit: 100,
      })
      setMembers(membersPayload.members || [])
    })().catch(() => {})
  }, [group?.id, debouncedMemberSearch])

  async function handleCreateGroupPost(payload) {
    if (!group?.id) return null
    setIsPublishing(true)
    try {
      const response = await createGroupPost(group.id, payload)
      if (response?.post && !response.pendingApproval) setPosts((current) => [response.post, ...current])
      if (response?.pendingApproval) setPostApprovalNotice(t('groups.requestActionDone'))
      return response
    } finally {
      setIsPublishing(false)
    }
  }

  const groupSharePayload = useMemo(() => {
    const safeLang = `${lang || 'tr'}`.trim() || 'tr'
    const slug = group?.slug || groupSlug
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    return {
      title: group?.name || 'Grup',
      text: `${group?.name || 'Grup'} grubuna goz at.`,
      url: `${origin}/${safeLang}/groups/joined/${slug}`,
    }
  }, [group?.name, group?.slug, groupSlug, lang])

  const groupShareTargets = useMemo(
    () => buildShareTargets({ url: groupSharePayload.url, text: groupSharePayload.text }),
    [groupSharePayload.text, groupSharePayload.url],
  )

  useEffect(() => {
    function handleOutside(event) {
      if (!shareMenuRef.current?.contains(event.target)) setIsShareMenuOpen(false)
    }
    if (isShareMenuOpen) {
      document.addEventListener('mousedown', handleOutside)
      return () => document.removeEventListener('mousedown', handleOutside)
    }
    return undefined
  }, [isShareMenuOpen])

  async function handleShareCopyLink() {
    try {
      await copyTextToClipboard(groupSharePayload.url)
      setPostApprovalNotice(t('common.shareActions.linkCopied'))
      setIsShareMenuOpen(false)
    } catch {
      setPostApprovalNotice(t('common.shareActions.copyFailed'))
    }
  }

  function handleShareToPlatform(platformKey) {
    const targetUrl = groupShareTargets[platformKey]
    if (!targetUrl) return
    window.open(targetUrl, '_blank', 'noopener,noreferrer')
    setIsShareMenuOpen(false)
  }

  async function handleGroupShareClick() {
    if (isShareProcessing) return
    if (isMobileShareSupported()) {
      setIsShareProcessing(true)
      const result = await shareWithNative(groupSharePayload)
      setIsShareProcessing(false)
      if (result.status === 'shared') {
        setIsShareMenuOpen(false)
        return
      }
    }
    setIsShareMenuOpen((current) => !current)
  }

  function handleMobileCreate(action) {
    if (action !== 'post' && action !== 'group') {
      return false
    }
    setActiveTab('posts')
    setForceComposerExpanded(true)
    setComposerOpenKey((current) => current + 1)
    return true
  }

  if (status !== 'loading' && !isAuthenticated) return <Navigate to={`/${lang}/login`} replace />

  const displayName = group?.name || t('groups.pageTitle')
  const isPrivateLocked = Boolean(group?.privacy === 'private' && !group?.isViewerMember && user?.role !== 'admin')

  return (
    <div className="groups-ui">
      <Seo title={`${displayName} - ${t('groups.pageTitle')}`} description={t('groups.seoDescription')} />
      <SocialLayout
        pageTitle={t('groups.pageTitle')}
        activeKey="groups"
        showDesktopPageHeader={false}
        mobileHeaderMode="groups"
        mobileHeaderTitle={displayName}
        onMobileCreate={handleMobileCreate}
        lockDesktopSidebar
        desktopSidebarWidth="320px"
        desktopSidebarCollapsedWidth="320px"
        desktopSidebarContent={
          <GroupsSidebar
            lang={lang}
            activeListMode={sidebarMode}
            onActiveListModeChange={(mode) => {
              setSidebarMode(mode)
              navigate(`/${lang}/groups`, { state: { initialMode: mode } })
            }}
            onOpenCreateGroup={() => setIsCreateGroupModalOpen(true)}
            managedGroups={sidebarState.managed}
            joinedGroups={sidebarState.joined}
          />
        }
        rightAside={
          <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <h2 className="text-base font-semibold text-text">{t('groups.aboutTitle')}</h2>
            <p className="mt-3 text-sm leading-6 text-muted">{group?.about || (isPageLoading ? t('search.loading') : t('groups.noDescription'))}</p>
            <div className="mt-4 space-y-2 text-xs text-muted">
              <p>{t('groups.privacyPublic').split(' ')[0]}: {group?.privacy === 'private' ? 'Gizli Grup' : 'Herkese Acik'}</p>
              <p>{t('groups.members')}: {group?.stats?.memberCount || 0}</p>
            </div>
            <div className="mt-4 border-t border-border pt-3">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{t('groups.roleAdmin')}</p>
              <div className="mt-2 space-y-2">
                {(group?.managers || []).map((manager) => (
                  <div key={`manager-${manager.userId}`} className="flex items-center gap-2">
                    <UserAvatar user={manager} className="size-8" textClassName="text-[10px] font-semibold" />
                    <p className="truncate text-sm text-text">{`${manager.firstName} ${manager.lastName}`.trim()}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{t('groups.roleModerator')}</p>
              <div className="mt-2 space-y-2">
                {(group?.moderators || []).map((moderator) => (
                  <div key={`moderator-${moderator.userId}`} className="flex items-center gap-2">
                    <UserAvatar user={moderator} className="size-8" textClassName="text-[10px] font-semibold" />
                    <p className="truncate text-sm text-text">{`${moderator.firstName} ${moderator.lastName}`.trim()}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        }
      >
        <div className="content-area space-y-2">
          {isPageLoading || !group ? (
            <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <div className="h-5 w-44 animate-pulse rounded-full bg-secondary" />
            </section>
          ) : (
            <section className="overflow-visible md:rounded-t-lg border border-border bg-card shadow-sm">
              <div
                className="relative md:rounded-t-lg h-[140px] md:h-[220px] bg-gradient-to-r from-sky-500/40 via-cyan-500/30 to-emerald-500/40"
                style={
                  group.coverImageUrl
                    ? {
                        backgroundImage: `url(${group.coverImageUrl})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }
                    : undefined
                }
              >
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-black/65 to-transparent px-4 pb-4">
                  <div>
                    <h1 className="text-base md:text-xl font-bold text-white">{group.name}</h1>
                    <p className="mt-1 text-xs text-white/90">
                      {group.privacy === 'private' ? t('groups.privacyPrivate') : t('groups.privacyPublic')} • {group?.stats?.memberCount || 0} {t('groups.members')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!['owner', 'admin'].includes(group.viewerRole || '') ? (
                      <button
                        type="button"
                        disabled={group.viewerMembershipStatus === 'pending'}
                        onClick={async () => {
                          if (group.viewerMembershipStatus === 'active') {
                            await leaveGroup(group.id)
                            setGroup((current) => ({ ...current, viewerMembershipStatus: 'none', isViewerMember: false }))
                            setSidebarState((current) => ({
                              ...current,
                              joined: current.joined.filter((item) => item.id !== group.id),
                            }))
                            const cache = getGroupsSidebarCache()
                            setGroupsSidebarCache({
                              ...cache,
                              joined: cache.joined.filter((item) => item.id !== group.id),
                            })
                            return
                          }

                          const response = await joinGroup(group.id)
                          if (response?.pendingApproval) {
                            setGroup((current) => ({ ...current, viewerMembershipStatus: 'pending', isViewerMember: false }))
                            setJoinNotice(t('groups.joinRequestSentNotice'))
                            return
                          }

                          setGroup((current) => ({ ...current, viewerMembershipStatus: 'active', isViewerMember: true }))
                          const joinedItem = mapGroupCard(group)
                          setSidebarState((current) => ({
                            ...current,
                            joined: current.joined.some((item) => item.id === group.id)
                              ? current.joined
                              : [joinedItem, ...current.joined],
                          }))
                          const cache = getGroupsSidebarCache()
                          setGroupsSidebarCache({
                            ...cache,
                            joined: cache.joined.some((item) => item.id === group.id) ? cache.joined : [joinedItem, ...cache.joined],
                          })
                        }}
                        className={`rounded-lg border border-white/35 bg-white/15 px-3 py-2 text-xs font-semibold text-white transition-all duration-200 ease-out hover:bg-white/25 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 ${group.viewerMembershipStatus === 'pending' ? 'animate-pulse' : ''}`}
                      >
                        {group.viewerMembershipStatus === 'pending'
                          ? t('groups.requestSent')
                          : group.viewerMembershipStatus === 'active'
                            ? t('groups.leaveGroup')
                            : t('groups.joinGroup')}
                      </button>
                    ) : null}
                    <div ref={shareMenuRef} className="relative">
                      <button
                        type="button"
                        onClick={handleGroupShareClick}
                        className="rounded-lg border border-white/35 bg-white/15 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                        disabled={isShareProcessing}
                      >
                        {t('common.share')}
                      </button>
                      {isShareMenuOpen ? (
                        <div className="dropdown-pop absolute right-0 top-[calc(100%+8px)] z-[140] flex min-w-[220px] flex-col rounded-lg border border-border bg-card p-2 shadow-[0_24px_60px_rgba(15,23,42,0.18)]">
                          <button type="button" onClick={handleShareCopyLink} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-text transition hover:bg-secondary">
                            <span>{t('common.shareActions.copyLink')}</span>
                          </button>
                          <button type="button" onClick={() => handleShareToPlatform('whatsapp')} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-text transition hover:bg-secondary">
                            <span>{t('common.shareActions.whatsapp')}</span>
                          </button>
                          <button type="button" onClick={() => handleShareToPlatform('x')} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-text transition hover:bg-secondary">
                            <span>{t('common.shareActions.x')}</span>
                          </button>
                          <button type="button" onClick={() => handleShareToPlatform('facebook')} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-text transition hover:bg-secondary">
                            <span>{t('common.shareActions.facebook')}</span>
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          <div className=" bg-card p-2 mb-1 md:mb-2 rounded-b-lg border border-border">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('posts')}
                className={`rounded-lg px-2 py-2 text-sm font-medium  transition ${
                  activeTab === 'posts' ? 'border-b-3 border-primary text-primary hover:bg-secondary' : 'text-muted hover:bg-secondary '
                }`}
              >
                {t('common.posts')}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('members')}
                className={`rounded-sm px-2 py-2 text-sm font-medium transition ${
                  activeTab === 'members' ? 'border-b-3 border-primary text-primary hover:bg-secondary' : 'text-muted hover:bg-secondary '
                }`}
              >
                {t('common.followers')}
              </button>
            </div>
          </div>

          {activeTab === 'posts' && group ? (
            <>
              {isPrivateLocked ? (
                <section className="rounded-[24px] border border-border bg-card px-4 py-6 text-sm text-muted">
                  {t('groups.joinRequestSentNotice')}
                </section>
              ) : (
                <>
                {(!isMobileViewport || forceComposerExpanded) ? (
                  <PostComposer key={`joined-group-composer-${composerOpenKey}`} user={user} onSubmit={handleCreateGroupPost} isSubmitting={isPublishing} allowStoryOption={false} allowLoopOption={false} groupName={group.name} groupCoverImageUrl={group.coverImageUrl || ''} hideCollapsed={isMobileViewport} defaultExpanded={forceComposerExpanded} onExpandedChange={(expanded) => { if (!expanded) setForceComposerExpanded(false) }} />
                ) : null}
                  {posts.map((post) => (
                    <PostCard key={post._id || post.id} post={post} followActionLabel={t('groups.joinShort')} unfollowActionLabel={t('groups.leaveGroup')} groupName={group.name} groupCoverImageUrl={group.coverImageUrl || ''} />
                  ))}
                </>
              )}
            </>
          ) : null}

          {activeTab === 'members' && group ? (
            <>
              {isPrivateLocked ? (
                <section className="rounded-lg border border-border bg-card px-4 py-6 text-sm text-muted">
                  {t('groups.joinRequestSentNotice')}
                </section>
              ) : (
                <section className="md:rounded-lg border border-border bg-card p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <h3 className="text-base font-semibold text-text">{t('common.followers')}</h3>
                    <input
                      type="text"
                      value={memberSearch}
                      onChange={(event) => setMemberSearch(event.target.value)}
                      placeholder={t('groups.searchMemberPlaceholder')}
                      className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-secondary px-3 text-sm text-text outline-none placeholder:text-soft focus:border-border-strong"
                    />
                  </div>
                  <div className="mt-3 space-y-3">
                    {members.map((member) => (
                      <div key={member.userId} className="flex items-center cursor-pointer justify-between gap-3 rounded-lg hover:bg-secondary px-3 py-3">
                        <div className="flex items-center gap-3">
                          <UserAvatar user={member} className="size-10" textClassName="text-xs font-semibold" />
                          <div>
                            <p className="text-sm font-semibold text-text">{`${member.firstName} ${member.lastName}`.trim()}</p>
                          </div>
                        </div>
                        <span className="rounded-full bg-card px-2.5 py-1 text-[11px] text-muted">{member.role}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          ) : null}
        </div>
      </SocialLayout>

      {joinNotice ? (
        <div className="fixed inset-0 z-[95] bg-black/45 p-4 backdrop-blur-sm">
          <div className="mx-auto mt-24 w-full max-w-md rounded-[20px] border border-border bg-card p-5 shadow-2xl">
            <h3 className="text-base font-semibold text-text">{t('groups.pendingTab')}</h3>
            <p className="mt-2 text-sm text-muted">{joinNotice}</p>
            <div className="mt-4 flex justify-end">
              <button type="button" onClick={() => setJoinNotice('')} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-inverse">
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {postApprovalNotice ? (
        <div className="fixed inset-0 z-[96] bg-black/45 p-4 backdrop-blur-sm">
          <div className="mx-auto mt-24 w-full max-w-md rounded-[20px] border border-border bg-card p-5 shadow-2xl">
            <h3 className="text-base font-semibold text-text">{t('notificationsPage.title')}</h3>
            <p className="mt-2 text-sm text-muted">{postApprovalNotice}</p>
            <div className="mt-4 flex justify-end">
              <button type="button" onClick={() => setPostApprovalNotice('')} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-inverse">
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <CreateGroupModal
        open={isCreateGroupModalOpen}
        onClose={() => setIsCreateGroupModalOpen(false)}
        user={user}
        onCreate={async (payload) => {
          const response = await createGroup(payload)
          const created = response?.group
          if (created?.slug) navigate(`/${lang}/groups/manage/${created.slug}`)
        }}
      />
    </div>
  )
}





