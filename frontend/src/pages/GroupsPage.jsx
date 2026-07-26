import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import SocialLayout from '../layouts/SocialLayout.jsx'
import UserAvatar from '../components/common/UserAvatar.jsx'
import Seo from '../components/seo/Seo.jsx'
import PostCard from '../features/posts/PostCard.jsx'
import CreateGroupModal from '../components/groups/CreateGroupModal.jsx'
import GroupsSidebar from '../components/groups/GroupsSidebar.jsx'
import { getGroupsSidebarCache, setGroupsSidebarCache } from '../features/groups/sidebarCache.js'
import { useAuth } from '../store/AuthContext.jsx'
import { getGroupsFeed, getGroupsSidebar, createGroup, joinGroup } from '../services/groupsService.js'

const GROUP_POSTS_CACHE_TTL_MS = 30 * 1000
const groupPostsCache = new Map()

function clearGroupPostsCache() {
  groupPostsCache.clear()
}

function mapGroupCard(group) {
  return {
    id: group.id,
    slug: group.slug,
    name: group.name,
    privacy: group.privacy || 'public',
    isViewerMember: Boolean(group.isViewerMember),
    members: `${group?.stats?.memberCount || 0} uye`,
    avatar: `${group.name || 'G'}`.slice(0, 2).toUpperCase(),
    coverImageUrl: group.coverImageUrl || '',
  }
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
  return to ? <Link to={to} className="block w-full rounded-lg border border-border bg-secondary px-3 py-3 text-left transition hover:bg-secondary-hover">{content}</Link> : <div className="w-full rounded-lg border border-border bg-secondary px-3 py-3">{content}</div>
}

export default function GroupsPage() {
  const { t } = useTranslation()
  const { lang = 'tr' } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { isAuthenticated, status, user } = useAuth()
  const [sidebarState, setSidebarState] = useState(getGroupsSidebarCache())
  const [feedState, setFeedState] = useState({ posts: [], isLoading: true, error: '' })
  const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false)
  const [mobileTab, setMobileTab] = useState('0')
  const [activeListMode, setActiveListMode] = useState(
    location.state?.initialMode === 'discover' ? 'discover' : 'feed',
  )
  const [page, setPage] = useState(1)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const isMobileManagedTab = mobileTab === '2'
  const isMobileJoinedTab = mobileTab === '3'
  const showMobileGroupList = isMobileManagedTab || isMobileJoinedTab
  const mobileGroupList = isMobileManagedTab ? sidebarState.managed : sidebarState.joined

  useEffect(() => {
    if (!isAuthenticated) return
    if (showMobileGroupList) {
      setFeedState((current) => ({ ...current, isLoading: false, error: '' }))
      setIsLoadingMore(false)
      setHasMore(false)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const payload = await getGroupsSidebar({ limit: 30 })
        if (cancelled) return
        const nextSidebarState = {
          managed: (payload.managed || []).map(mapGroupCard),
          joined: (payload.joined || []).map(mapGroupCard),
          suggested: (payload.suggested || [])
            .filter((group) => group?.id && group?.slug && (group?.stats?.memberCount || 0) >= 0)
            .map(mapGroupCard),
        }
        setGroupsSidebarCache(nextSidebarState)
        setSidebarState(nextSidebarState)
      } catch {
        if (!cancelled) setSidebarState(getGroupsSidebarCache())
      }
    })()
    return () => { cancelled = true }
  }, [isAuthenticated, showMobileGroupList])

  useEffect(() => {
    setPage(1)
  }, [activeListMode, sidebarState.joined, sidebarState.managed, sidebarState.suggested])

  useEffect(() => {
    if (!isAuthenticated) return
    if (showMobileGroupList) {
      setFeedState((current) => ({ ...current, isLoading: false, error: '' }))
      setIsLoadingMore(false)
      setHasMore(false)
      return
    }
    let cancelled = false
    ;(async () => {
      if (page === 1) {
        setFeedState((current) => ({ ...current, isLoading: true, error: '' }))
      } else {
        setIsLoadingMore(true)
      }
      try {
        const sourceGroups = (() => {
          if (mobileTab === '1') {
            return sidebarState.suggested.filter((group) => group.privacy !== 'private' || group.isViewerMember)
          }
          if (mobileTab === '2') {
            return sidebarState.managed
          }
          if (mobileTab === '3') {
            return sidebarState.joined
          }
          return activeListMode === 'discover'
            ? sidebarState.suggested.filter((group) => group.privacy !== 'private' || group.isViewerMember)
            : [...sidebarState.joined, ...sidebarState.managed]
        })()
        if (!sourceGroups.length) {
          setFeedState({ posts: [], isLoading: false, error: '' })
          setHasMore(false)
          return
        }
        const maxGroupsPerBatch = 2
        const pageSizePerGroup = 4
        const currentOffset = (page - 1) * pageSizePerGroup
        const scopedGroups = sourceGroups.slice(0, maxGroupsPerBatch)
        const scopedGroupIds = scopedGroups.map((group) => group.id).filter(Boolean)

        if (!scopedGroupIds.length) {
          setFeedState({ posts: [], isLoading: false, error: '' })
          setHasMore(false)
          return
        }

        const cacheKey = `${scopedGroupIds.join(',')}:${currentOffset}:${pageSizePerGroup * scopedGroupIds.length}`
        const cached = groupPostsCache.get(cacheKey)
        const now = Date.now()

        let payload
        if (cached && now - cached.createdAt < GROUP_POSTS_CACHE_TTL_MS) {
          payload = cached.payload
        } else {
          payload = await getGroupsFeed(
            { groupIds: scopedGroupIds },
            { limit: pageSizePerGroup * scopedGroupIds.length, offset: currentOffset },
          )
          groupPostsCache.set(cacheKey, { payload, createdAt: now })
        }

        const merged = (payload?.posts || [])
          .sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0))
        if (cancelled) return
        setHasMore(Boolean(payload?.pagination?.hasMore))
        setFeedState((current) => ({
          posts: page === 1 ? merged : [...current.posts, ...merged],
          isLoading: false,
          error: '',
        }))
      } catch (error) {
        if (!cancelled) setFeedState({ posts: [], isLoading: false, error: error.message || t('groups.feedLoadFailed') })
      } finally {
        if (!cancelled) {
          setIsLoadingMore(false)
        }
      }
    })()
    return () => { cancelled = true }
  }, [isAuthenticated, sidebarState.joined, sidebarState.managed, sidebarState.suggested, activeListMode, page, mobileTab, showMobileGroupList, t])

  if (status !== 'loading' && !isAuthenticated) {
    return <Navigate to={`/${lang}/login`} replace />
  }

  return (
    <div className="groups-ui">
      <Seo title={t('groups.seoTitle')} description={t('groups.seoDescription')} />
      <SocialLayout
        pageTitle={t('groups.pageTitle')}
        activeKey="groups"
        showDesktopPageHeader={false}
        mobileHeaderMode="groups"
        mobileHeaderTitle={t('groups.pageTitle')}
        hideMobileCreateButton
        onMobileCreate={() => { setIsCreateGroupModalOpen(true); return true }}
        lockDesktopSidebar
        desktopSidebarWidth="320px"
        desktopSidebarCollapsedWidth="320px"
        desktopSidebarContent={<GroupsSidebar lang={lang} activeListMode={activeListMode} onActiveListModeChange={setActiveListMode} onOpenCreateGroup={() => setIsCreateGroupModalOpen(true)} managedGroups={sidebarState.managed} joinedGroups={sidebarState.joined} />}
        rightAside={
          <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <h2 className="text-base font-semibold text-text">{t('groups.suggestionsTitle')}</h2>
            <div className="mt-4 space-y-3">
              {sidebarState.suggested.map((group) => (
                <Link key={group.id} to={`/${lang}/groups/joined/${group.slug}`} className="block rounded-lg border border-border bg-secondary p-3 transition hover:bg-secondary-hover">
                  <div className="flex items-center gap-3">
                    <UserAvatar user={{ name: group.name, username: group.avatar, avatarUrl: group.coverImageUrl || '' }} className="size-10" textClassName="text-xs font-semibold" />
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-text">{group.name}</p><p className="mt-1 text-xs text-muted">{group.members}</p></div>
                    <button type="button" onClick={async (event) => { event.preventDefault(); await joinGroup(group.id); clearGroupPostsCache(); navigate(`/${lang}/groups/joined/${group.slug}`) }} className="shrink-0 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-inverse">{t('groups.joinShort')}</button>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        }
      >
        <div className="content-area space-y-2 overflow-x-hidden">
          <div className="md:hidden">
            <div className="subtle-scrollbar p-1 flex gap-3 overflow-x-auto overscroll-x-contain pb-1">
              {[t('groups.flow'), t('groups.exploreTab'), t('groups.managedGroups'), t('groups.joinedGroups')].map((label, index) => <button key={label} type="button" onClick={() => { setMobileTab(index.toString()); if (index === 0) setActiveListMode('feed'); if (index === 1) setActiveListMode('discover') }} className={`shrink-0 rounded-0 px-1 py-1 text-sm  transition ${mobileTab === index.toString() ? ' text-text font-medium border-b-2 border-blue-600 ' : 'font-normal text-muted'}`}>{label}</button>)}
            </div>
          </div>
          {showMobileGroupList ? (
            <section className="md:rounded-lg border border-border bg-card p-3 shadow-sm md:hidden">
              {!mobileGroupList.length ? (
                <p className="px-2 py-3 text-sm text-muted">{t('groups.noMembersFound')}</p>
              ) : (
                <div className="space-y-1">
                  {mobileGroupList.map((group) => (
                    <GroupListItem
                      key={`mobile-group-${group.id}`}
                      group={group}
                      to={`/${lang}/${isMobileManagedTab ? 'groups/manage' : 'groups/joined'}/${group.slug}`}
                    />
                  ))}
                </div>
              )}
            </section>
          ) : null}
          {!showMobileGroupList && feedState.isLoading ? <div className="rounded-[24px] border border-border bg-card p-4 shadow-sm"><div className="h-5 w-36 animate-pulse rounded-full bg-secondary" /></div> : null}
          {!showMobileGroupList && feedState.error ? <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">{feedState.error}</div> : null}
          {!showMobileGroupList && !feedState.isLoading && !feedState.error && !feedState.posts.length ? <div className="rounded-[24px] border border-dashed border-border bg-card px-4 py-8 text-center text-sm text-muted">{t('groups.noGroupPosts')}</div> : null}
          {!showMobileGroupList && (activeListMode === 'discover' ? (
            <div className="grid gap-4 md:grid-cols-2">
                {feedState.posts.map((post) => <PostCard key={post._id || post.id} post={post} followActionLabel="Katil" unfollowActionLabel="Ayril" groupName={post?.group?.name || ''} groupCoverImageUrl={post?.group?.coverImageUrl || ''} />)}
            </div>
          ) : (
              feedState.posts.map((post) => <PostCard key={post._id || post.id} post={post} followActionLabel="Katil" unfollowActionLabel="Ayril" groupName={post?.group?.name || ''} groupCoverImageUrl={post?.group?.coverImageUrl || ''} />)
          ))}
          {!showMobileGroupList && !feedState.isLoading && !feedState.error && hasMore ? (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={() => setPage((current) => current + 1)}
                disabled={isLoadingMore}
                className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-text transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoadingMore ? 'Yukleniyor...' : t('search.showAll')}
              </button>
            </div>
          ) : null}
        </div>
      </SocialLayout>
      <CreateGroupModal
        open={isCreateGroupModalOpen}
        onClose={() => setIsCreateGroupModalOpen(false)}
        user={user}
        onCreate={async (payload) => {
          const response = await createGroup(payload)
          const group = response?.group
          clearGroupPostsCache()
          if (group?.slug) {
            navigate(`/${lang}/groups/manage/${group.slug}`)
          }
        }}
      />
    </div>
  )
}
