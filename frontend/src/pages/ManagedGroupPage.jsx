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
import ProfileImageCropModal from '../components/media/ProfileImageCropModal.jsx'
import { getGroupsSidebarCache, removeGroupFromSidebarCache, setGroupsSidebarCache } from '../features/groups/sidebarCache.js'
import { buildShareTargets, copyTextToClipboard, isMobileShareSupported, shareWithNative } from '../utils/postShare.js'
import { useAuth } from '../store/AuthContext.jsx'
import {
  approvePendingGroupPost,
  approveJoinRequest,
  createGroup,
  createGroupPost,
  deleteGroup,
  getGroupBySlug,
  getJoinRequests,
  getGroupMembers,
  getGroupPosts,
  getGroupsSidebar,
  getPendingGroupPosts,
  rejectJoinRequest,
  rejectPendingGroupPost,
  updateGroup,
  updateGroupMemberRole,
  removeGroupMember,
} from '../services/groupsService.js'
import { MOBILE_VIEWPORT_QUERY, useMediaQuery } from '../hooks/useMediaQuery.js'

function mapGroupCard(group) {
  return { id: group.id, slug: group.slug, name: group.name, members: `${group?.stats?.memberCount || 0} uye`, avatar: `${group.name || 'G'}`.slice(0, 2).toUpperCase(), coverImageUrl: group.coverImageUrl || '' }
}

function applyGroupToSidebarCards(items, nextGroup) {
  return (items || []).map((item) =>
    item?.id === nextGroup?.id
      ? {
          ...item,
          name: nextGroup.name,
          members: `${nextGroup?.stats?.memberCount || 0} uye`,
          avatar: `${nextGroup?.name || 'G'}`.slice(0, 2).toUpperCase(),
          coverImageUrl: nextGroup.coverImageUrl || '',
        }
      : item,
  )
}

export default function ManagedGroupPage() {
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
  const [pendingPosts, setPendingPosts] = useState([])
  const [joinRequests, setJoinRequests] = useState([])
  const [sidebarState, setSidebarState] = useState(() => {
    const cache = getGroupsSidebarCache()
    return { managed: cache.managed || [], joined: cache.joined || [] }
  })
  const [isPublishing, setIsPublishing] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [groupAbout, setGroupAbout] = useState('')
  const [selectedManagerUserId, setSelectedManagerUserId] = useState('')
  const [selectedModeratorUserId, setSelectedModeratorUserId] = useState('')
  const [isManagerMenuOpen, setIsManagerMenuOpen] = useState(false)
  const [isModeratorMenuOpen, setIsModeratorMenuOpen] = useState(false)
  const [managerSearch, setManagerSearch] = useState('')
  const [moderatorSearch, setModeratorSearch] = useState('')
  const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false)
  const [isCoverUploading, setIsCoverUploading] = useState(false)
  const [coverCropState, setCoverCropState] = useState({ open: false, file: null, target: 'cover' })
  const [isCoverActionMenuOpen, setIsCoverActionMenuOpen] = useState(false)
  const [isCoverDeleteConfirmOpen, setIsCoverDeleteConfirmOpen] = useState(false)
  const [sidebarMode, setSidebarMode] = useState('feed')
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [isDeletingGroup, setIsDeletingGroup] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [postApprovalNotice, setPostApprovalNotice] = useState('')
  const [isPageLoading, setIsPageLoading] = useState(true)
  const [isShareMenuOpen, setIsShareMenuOpen] = useState(false)
  const [isShareProcessing, setIsShareProcessing] = useState(false)
  const [composerOpenKey, setComposerOpenKey] = useState(0)
  const [forceComposerExpanded, setForceComposerExpanded] = useState(false)
  const isMobileViewport = useMediaQuery(MOBILE_VIEWPORT_QUERY)
  const coverInputRef = useRef(null)
  const coverActionMenuRef = useRef(null)
  const shareMenuRef = useRef(null)

  function syncGroupToSidebar(nextGroup) {
    setSidebarState((current) => {
      const nextState = {
        managed: applyGroupToSidebarCards(current.managed, nextGroup),
        joined: applyGroupToSidebarCards(current.joined, nextGroup),
      }
      setGroupsSidebarCache({ ...getGroupsSidebarCache(), ...nextState })
      return nextState
    })
  }

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
      setGroupAbout(groupPayload.group?.about || '')
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
    return () => { cancelled = true }
  }, [isAuthenticated, groupSlug])

  useEffect(() => {
    if (!group?.id) return
    ;(async () => {
      const [postsPayload, pendingPayload, joinRequestsPayload] = await Promise.all([
        getGroupPosts(group.id, { limit: 20 }),
        getPendingGroupPosts(group.id),
        getJoinRequests(group.id),
      ])
      setPosts(postsPayload.posts || [])
      setPendingPosts(pendingPayload.posts || [])
      setJoinRequests(joinRequestsPayload.members || [])
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

  useEffect(() => {
    if (!group?.id) return
    syncGroupToSidebar(group)
  }, [group])

  const managerList = useMemo(() => members.filter((member) => ['owner', 'admin'].includes(member.role)), [members])
  const moderatorList = useMemo(() => members.filter((member) => member.role === 'moderator'), [members])
  const eligibleForManager = useMemo(
    () => members.filter((member) => !['owner', 'admin'].includes(member.role)),
    [members],
  )
  const eligibleForModerator = useMemo(
    () => members.filter((member) => member.role === 'member'),
    [members],
  )
  const selectedManagerMember = useMemo(
    () => eligibleForManager.find((member) => member.userId === selectedManagerUserId) || null,
    [eligibleForManager, selectedManagerUserId],
  )
  const selectedModeratorMember = useMemo(
    () => eligibleForModerator.find((member) => member.userId === selectedModeratorUserId) || null,
    [eligibleForModerator, selectedModeratorUserId],
  )
  const filteredManagerCandidates = useMemo(() => {
    const query = managerSearch.trim().toLowerCase()
    if (!query) {
      return eligibleForManager
    }
    return eligibleForManager.filter((member) =>
      `${member.firstName} ${member.lastName}`.trim().toLowerCase().includes(query),
    )
  }, [eligibleForManager, managerSearch])
  const filteredModeratorCandidates = useMemo(() => {
    const query = moderatorSearch.trim().toLowerCase()
    if (!query) {
      return eligibleForModerator
    }
    return eligibleForModerator.filter((member) =>
      `${member.firstName} ${member.lastName}`.trim().toLowerCase().includes(query),
    )
  }, [eligibleForModerator, moderatorSearch])

  async function handleCreateGroupPost(payload) {
    if (!group?.id) return null
    setIsPublishing(true)
    try {
      const response = await createGroupPost(group.id, payload)
      if (response?.post && !response.pendingApproval) {
        setPosts((current) => [response.post, ...current])
      }
      if (response?.pendingApproval) {
        setPostApprovalNotice(t('groups.requestActionDone'))
      }
      return response
    } finally {
      setIsPublishing(false)
    }
  }

  async function handleCoverFileChange(event) {
    const file = event.target.files?.[0]
    if (!file || !group?.id) {
      return
    }
    setCoverCropState({ open: true, file, target: 'cover' })
    if (coverInputRef.current) {
      coverInputRef.current.value = ''
    }
  }

  async function handleCoverCropConfirm(croppedImage) {
    if (!group?.id || !croppedImage) {
      return
    }
    setIsCoverUploading(true)
    try {
      const payload = await updateGroup(group.id, { coverImageUrl: croppedImage })
      setGroup(payload.group)
      syncGroupToSidebar(payload.group)
      setPostApprovalNotice(t('profile.photoActions.coverUpdated'))
    } catch (error) {
      setPostApprovalNotice(error?.message || 'Kapak gorseli guncellenemedi.')
    } finally {
      setIsCoverUploading(false)
      setCoverCropState({ open: false, file: null, target: 'cover' })
    }
  }

  async function handleDeleteCoverImage() {
    if (!group?.id) {
      return
    }
    setIsCoverUploading(true)
    try {
      const payload = await updateGroup(group.id, { coverImageUrl: '' })
      setGroup(payload.group)
      syncGroupToSidebar(payload.group)
      setPostApprovalNotice(t('profile.photoActions.coverDeleted'))
    } catch (error) {
      setPostApprovalNotice(error?.message || 'Kapak gorseli silinemedi.')
    } finally {
      setIsCoverUploading(false)
      setIsCoverDeleteConfirmOpen(false)
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
      if (!shareMenuRef.current?.contains(event.target)) {
        setIsShareMenuOpen(false)
      }
    }
    if (isShareMenuOpen) {
      document.addEventListener('mousedown', handleOutside)
      return () => document.removeEventListener('mousedown', handleOutside)
    }
    return undefined
  }, [isShareMenuOpen])

  useEffect(() => {
    function handleOutside(event) {
      if (!coverActionMenuRef.current?.contains(event.target)) {
        setIsCoverActionMenuOpen(false)
      }
    }
    if (isCoverActionMenuOpen) {
      document.addEventListener('mousedown', handleOutside)
      return () => document.removeEventListener('mousedown', handleOutside)
    }
    return undefined
  }, [isCoverActionMenuOpen])

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

  return (
    <div className="groups-ui">
      <Seo title={`${displayName} - ${t('groups.pageTitle')}`} description={t('groups.seoDescription')} />
      <SocialLayout pageTitle={t('groups.pageTitle')} activeKey="groups" showDesktopPageHeader={false} mobileHeaderMode="groups" mobileHeaderTitle={displayName} onMobileCreate={handleMobileCreate} lockDesktopSidebar desktopSidebarWidth="320px" desktopSidebarCollapsedWidth="320px" desktopSidebarContent={<GroupsSidebar lang={lang} activeListMode={sidebarMode} onActiveListModeChange={(mode) => { setSidebarMode(mode); navigate(`/${lang}/groups`, { state: { initialMode: mode } }) }} onOpenCreateGroup={() => setIsCreateGroupModalOpen(true)} managedGroups={sidebarState.managed} joinedGroups={sidebarState.joined} />} rightAside={<section className="rounded-lg border border-border bg-card p-4 shadow-sm"><h2 className="text-base font-semibold text-text">{t('nav.about')}</h2><p className="mt-3 text-sm leading-6 text-muted">{group?.about || (isPageLoading ? t('search.loading') : t('groups.noDescription'))}</p><div className="mt-4 border-t border-border pt-3"><p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{t('groups.roleAdmin')}</p><div className="mt-2 space-y-2">{managerList.map((manager) => <div key={manager.userId} className="flex items-center gap-2"><UserAvatar user={manager} className="size-8" textClassName="text-[10px] font-semibold" /><p className="truncate text-sm text-text">{`${manager.firstName} ${manager.lastName}`.trim()}</p></div>)}</div></div><div className="mt-3"><p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{t('groups.roleModerator')}</p><div className="mt-2 space-y-2">{moderatorList.map((moderator) => <div key={moderator.userId} className="flex items-center gap-2"><UserAvatar user={moderator} className="size-8" textClassName="text-[10px] font-semibold" /><p className="truncate text-sm text-text">{`${moderator.firstName} ${moderator.lastName}`.trim()}</p></div>)}</div></div></section>}>
        <div className="content-area space-y-2">
          {isPageLoading || !group ? <section className="rounded-[24px] border border-border bg-card p-4 shadow-sm"><div className="h-5 w-44 animate-pulse rounded-full bg-secondary" /></section> : <section className="overflow-visible rounded-[24px] border border-border bg-card shadow-sm">
            <div
              className="relative h-[140px] md:h-[220px] bg-gradient-to-r from-sky-500/40 via-cyan-500/30 to-emerald-500/40"
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
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleCoverFileChange}
              />
              <div ref={coverActionMenuRef} className="absolute left-4 top-4">
                <button
                  type="button"
                  onClick={() => setIsCoverActionMenuOpen((current) => !current)}
                  disabled={isCoverUploading}
                  className="rounded-lg border border-white/40 bg-white/20 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isCoverUploading ? 'Yukleniyor...' : group.coverImageUrl ? 'Kapak Gorselini Duzenle' : 'Kapak Gorseli Ekle'}
                </button>
                {isCoverActionMenuOpen ? (
                  <div className="dropdown-pop absolute left-0 top-[calc(100%+8px)] z-[140] flex min-w-[220px] flex-col rounded-lg border border-border bg-card p-2 shadow-[0_24px_60px_rgba(15,23,42,0.18)]">
                    <button
                      type="button"
                      onClick={() => {
                        setIsCoverActionMenuOpen(false)
                        coverInputRef.current?.click()
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-text transition hover:bg-secondary"
                    >
                      {group.coverImageUrl ? 'Kapak Gorselini Degistir' : 'Kapak Gorseli Ekle'}
                    </button>
                    {group.coverImageUrl ? (
                      <button
                        type="button"
                        onClick={() => {
                          setIsCoverActionMenuOpen(false)
                          setIsCoverDeleteConfirmOpen(true)
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-rose-600 transition hover:bg-rose-50"
                      >
                        Kapak Gorselini Sil
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-black/65 to-transparent px-4 pb-4">
                <div><h1 className="text-base md:text-xl font-bold text-white">{group.name}</h1><p className="mt-1 text-xs text-white/90">{group.privacy === 'private' ? 'Gizli Grup' : 'Herkese Acik'} â€¢ {group?.stats?.memberCount || 0} uye</p>{group.postApprovalRequired ? <p className="mt-1 text-[11px] font-semibold text-amber-200">Gonderi onayi aktif</p> : null}</div>
                <div className="flex items-center gap-2"><div ref={shareMenuRef} className="relative"><button type="button" onClick={handleGroupShareClick} className="rounded-lg border border-white/35 bg-white/15 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60" disabled={isShareProcessing}>Grubu Paylas</button>{isShareMenuOpen ? <div className="dropdown-pop absolute right-0 top-[calc(100%+8px)] z-[140] flex min-w-[220px] flex-col rounded-lg border border-border bg-card p-2 shadow-[0_24px_60px_rgba(15,23,42,0.18)]"><button type="button" onClick={handleShareCopyLink} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-text transition hover:bg-secondary"><span>ðŸ”—</span><span>Linki Kopyala</span></button><button type="button" onClick={() => handleShareToPlatform('whatsapp')} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-text transition hover:bg-secondary"><span>ðŸŸ¢</span><span>WhatsApp'ta Paylas</span></button><button type="button" onClick={() => handleShareToPlatform('x')} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-text transition hover:bg-secondary"><span>ð•</span><span>X'te Paylas</span></button><button type="button" onClick={() => handleShareToPlatform('facebook')} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-text transition hover:bg-secondary"><span>Facebook'ta Paylas</span></button></div> : null}</div><button type="button" onClick={() => setIsEditModalOpen(true)} className="rounded-lg border border-white/35 bg-white/15 px-3 py-2 text-xs font-semibold text-white">Grubu Duzenle</button></div>
              </div>
            </div>
          </section>}
          <div className="md:rounded-lg border border-border bg-card p-2"><div className="flex items-center gap-2"><button type="button" onClick={() => setActiveTab('posts')} className={`rounded-sm px-2 py-2 text-sm font-medium transition ${activeTab === 'posts' ? 'border-b-3 border-primary text-primary hover:bg-secondary' : 'text-muted hover:bg-secondary'}`}>Gonderiler</button><button type="button" onClick={() => setActiveTab('members')} className={`rounded-sm px-2 py-2 text-sm font-medium transition ${activeTab === 'members' ? 'border-b-3 border-primary text-primary hover:bg-secondary' : 'text-muted hover:bg-secondary'}`}>Uyeler</button><button type="button" onClick={() => setActiveTab('pending')} className={`rounded-sm px-2 py-2 text-sm font-medium transition ${activeTab === 'pending' ? 'border-b-3 border-primary text-primary hover:bg-secondary' : 'text-muted hover:bg-secondary'}`}>Onay Bekleyenler</button></div></div>
          {activeTab === 'posts' && group ? <>{(!isMobileViewport || forceComposerExpanded) ? <PostComposer key={`managed-group-composer-${composerOpenKey}`} user={user} onSubmit={handleCreateGroupPost} isSubmitting={isPublishing} allowStoryOption={false} allowLoopOption={false} groupName={group.name} groupCoverImageUrl={group.coverImageUrl || ''} hideCollapsed={isMobileViewport} defaultExpanded={forceComposerExpanded} onExpandedChange={(expanded) => { if (!expanded) setForceComposerExpanded(false) }} /> : null}{posts.map((post) => <PostCard key={post._id || post.id} post={post} followActionLabel="Katil" unfollowActionLabel="Ayril" groupName={group.name} groupCoverImageUrl={group.coverImageUrl || ''} />)}</> : null}
          {activeTab === 'members' && group ? <section className="md:rounded-lg border border-border bg-card p-4 shadow-sm"><div className="flex items-center gap-3"><h3 className="text-base font-semibold text-text">Uyeler</h3><input type="text" value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} placeholder="Uye ara" className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-secondary px-3 text-sm text-text outline-none placeholder:text-soft focus:border-border-strong" /></div><div className="mt-3 space-y-3">{members.map((member) => <div key={member.userId} className="flex items-center justify-between gap-3 rounded-lg bg-secondary px-3 py-3"><div className="flex items-center gap-3"><UserAvatar user={member} className="size-10" textClassName="text-xs font-semibold" /><div><p className="text-sm font-semibold text-text">{`${member.firstName} ${member.lastName}`.trim()}</p></div></div><div className="flex items-center gap-2"><span className="rounded-full bg-card px-2.5 py-1 text-[11px] text-muted">{member.role}</span>{member.role !== 'owner' ? <button type="button" onClick={async () => { await removeGroupMember(group.id, member.userId); setMembers((current) => current.filter((item) => item.userId !== member.userId)); setGroup((current) => current ? ({ ...current, stats: { ...(current.stats || {}), memberCount: Math.max(0, (current?.stats?.memberCount || 1) - 1) } }) : current) }} className="text-xs font-semibold text-rose-600">Sil</button> : null}</div></div>)}</div></section> : null}
          {activeTab === 'pending' && group ? (
            <section className="md:rounded-lg border border-border bg-card p-4 shadow-sm">
              
              <div className="mt-3 space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Katilim Istekleri</p>
                  <div className="mt-2 space-y-2">
                    {!joinRequests.length ? <p className="rounded-lg bg-secondary px-3 py-2 text-sm text-muted">Bekleyen katilim istegi yok.</p> : null}
                    {joinRequests.map((member) => (
                      <div key={`join-request-${member.userId}`} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-secondary px-3 py-2">
                        <button
                          type="button"
                          onClick={() => member.username ? navigate(`/${lang}/u/${member.username}`) : null}
                          className="flex min-w-0 items-center gap-2 text-left"
                        >
                          <UserAvatar user={member} className="size-8" textClassName="text-[10px] font-semibold" />
                          <p className="truncate text-sm text-text">{`${member.firstName} ${member.lastName}`.trim()}</p>
                        </button>
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={async () => { await approveJoinRequest(group.id, member.userId); setJoinRequests((current) => current.filter((item) => item.userId !== member.userId)); const membersPayload = await getGroupMembers(group.id, { q: memberSearch, limit: 100 }); setMembers(membersPayload.members || []); setGroup((current) => current ? ({ ...current, stats: { ...(current.stats || {}), memberCount: (current?.stats?.memberCount || 0) + 1 } }) : current) }} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white">Onayla</button>
                          <button type="button" onClick={async () => { await rejectJoinRequest(group.id, member.userId); setJoinRequests((current) => current.filter((item) => item.userId !== member.userId)) }} className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-text">Reddet</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Gonderi Onaylari</p>
                  <div className="mt-2 space-y-3">
                    {!pendingPosts.length ? <p className="rounded-lg bg-secondary px-3 py-2 text-sm text-muted">Bekleyen gonderi yok.</p> : null}
                    {pendingPosts.map((post) => (
                      <div key={post._id || post.id} className="rounded-lg border border-border bg-secondary px-3 py-3">
                        <button type="button" onClick={() => post.author?.username ? navigate(`/${lang}/u/${post.author.username}`) : null} className="flex items-center gap-2 text-left">
                          <UserAvatar user={post.author} className="size-8" textClassName="text-[10px] font-semibold" />
                          <p className="text-sm font-semibold text-text">{post.author?.firstName} {post.author?.lastName}</p>
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate(`/${lang}/posts/${post._id || post.id}`)}
                          className="mt-2 w-full overflow-hidden rounded-lg border border-border bg-card text-left"
                        >
                          {post.media?.[0]?.url ? <img src={post.media[0].url} alt="Gonderi kapagi" loading="lazy" decoding="async" className="h-36 w-full object-cover" /> : null}
                          <p className="px-3 py-2 text-sm text-text">{post.text}</p>
                        </button>
                        <div className="mt-3 flex items-center gap-2">
                          <button type="button" onClick={async () => { const postId = post._id || post.id; await approvePendingGroupPost(group.id, postId); setPendingPosts((current) => current.filter((item) => (item._id || item.id) !== postId)); const postsPayload = await getGroupPosts(group.id, { limit: 20 }); setPosts(postsPayload.posts || []) }} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-inverse">Onayla</button>
                          <button type="button" onClick={async () => { const postId = post._id || post.id; await rejectPendingGroupPost(group.id, postId); setPendingPosts((current) => current.filter((item) => (item._id || item.id) !== postId)) }} className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-text">Reddet</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          ) : null}
        </div>
      </SocialLayout>

      {isEditModalOpen ? (
        <div className="fixed inset-0 z-[90] bg-black/55 p-4 backdrop-blur-sm">
          <div className="mx-auto mt-8 w-full max-w-2xl rounded-[24px] border border-border bg-card p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold text-text">Grubu Duzenle</h2><button type="button" onClick={() => setIsEditModalOpen(false)} className="rounded-lg border border-border px-3 py-1.5 text-sm text-text hover:bg-secondary">Kapat</button></div>
            <div className="mt-4 space-y-4">
              <section><p className="text-sm font-semibold text-text">Hakkinda</p><textarea value={groupAbout} onChange={(event) => setGroupAbout(event.target.value)} rows={4} className="mt-2 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-text outline-none" /></section>
              <section><p className="text-sm font-semibold text-text">Gonderi Onayi</p><label className="mt-2 inline-flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-secondary px-3 py-2"><input type="checkbox" checked={Boolean(group.postApprovalRequired)} onChange={(event) => setGroup((current) => ({ ...current, postApprovalRequired: event.target.checked }))} className="size-4 accent-[rgb(var(--color-primary))]" /><span className="text-sm text-text">Gonderi onayi gereksin</span></label></section>
              <section><p className="text-sm font-semibold text-text">Katilim Istegi Onayi</p><label className="mt-2 inline-flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-secondary px-3 py-2"><input type="checkbox" checked={Boolean(group.joinApprovalRequired)} onChange={(event) => setGroup((current) => ({ ...current, joinApprovalRequired: event.target.checked }))} className="size-4 accent-[rgb(var(--color-primary))]" /><span className="text-sm text-text">Gruba katilim icin yonetici onayi gereksin</span></label></section>
              <section>
                <p className="text-sm font-semibold text-text">Yonetici Ekle</p>
                <div className="mt-2 flex gap-2">
                  <div className="relative min-w-0 flex-1">
                    <div
                      className={`flex h-10 w-full items-center justify-between rounded-lg border px-3 text-sm transition ${
                        isManagerMenuOpen
                          ? 'border-border-strong bg-card text-text'
                          : 'border-border bg-secondary text-text hover:bg-card'
                      }`}
                      onClick={() => {
                        if (!isManagerMenuOpen) {
                          setIsManagerMenuOpen(true)
                          setIsModeratorMenuOpen(false)
                        }
                      }}
                    >
                      <input
                        type="text"
                        value={isManagerMenuOpen ? managerSearch : (selectedManagerMember ? `${selectedManagerMember.firstName} ${selectedManagerMember.lastName}`.trim() : managerSearch)}
                        onChange={(event) => {
                          setManagerSearch(event.target.value)
                          setIsManagerMenuOpen(true)
                          setIsModeratorMenuOpen(false)
                          setSelectedManagerUserId('')
                        }}
                        onFocus={() => {
                          setIsManagerMenuOpen(true)
                          setIsModeratorMenuOpen(false)
                        }}
                        placeholder="Yonetici ara"
                        className="w-full bg-transparent outline-none placeholder:text-soft"
                      />
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={`size-4 transition ${isManagerMenuOpen ? 'rotate-180' : ''}`}>
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </div>
                    {isManagerMenuOpen ? (
                      <div className="absolute left-0 top-[calc(100%+4px)] z-20 w-full rounded-lg border border-border bg-card p-2 shadow-[0_24px_60px_rgba(15,23,42,0.18)]">
                        {!filteredManagerCandidates.length ? (
                          <p className="px-3 py-2 text-sm text-muted">Uygun uye yok</p>
                        ) : (
                          filteredManagerCandidates.map((member) => (
                            <button
                              key={member.userId}
                              type="button"
                              onClick={() => {
                                setSelectedManagerUserId(member.userId)
                                setManagerSearch(`${member.firstName} ${member.lastName}`.trim())
                                setIsManagerMenuOpen(false)
                              }}
                              className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition ${
                                selectedManagerUserId === member.userId
                                  ? 'bg-secondary text-text'
                                  : 'text-text hover:bg-nav-hover'
                              }`}
                            >
                              <span className="truncate">{`${member.firstName} ${member.lastName}`.trim()}</span>
                            </button>
                          ))
                        )}
                      </div>
                    ) : null}
                  </div>
                  <button type="button" onClick={async () => { if (!selectedManagerUserId) return; await updateGroupMemberRole(group.id, selectedManagerUserId, { role: 'admin' }); const payload = await getGroupMembers(group.id, { q: memberSearch, limit: 100 }); setMembers(payload.members || []); setSelectedManagerUserId(''); setManagerSearch('') }} className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-inverse">Ekle</button>
                </div>
                <div className="mt-2 space-y-2">
                  {managerList.filter((member) => member.role !== 'owner').map((member) => (
                    <div key={`manager-${member.userId}`} className="flex items-center justify-between rounded-lg bg-secondary px-3 py-2">
                      <p className="text-sm text-text">{`${member.firstName} ${member.lastName}`.trim()}</p>
                      <button type="button" onClick={async () => { await updateGroupMemberRole(group.id, member.userId, { role: 'member' }); const payload = await getGroupMembers(group.id, { q: memberSearch, limit: 100 }); setMembers(payload.members || []) }} className="text-xs font-semibold text-rose-600">Yetkiyi Kaldir</button>
                    </div>
                  ))}
                </div>
              </section>
              <section>
                <p className="text-sm font-semibold text-text">Moderator Ekle</p>
                <div className="mt-2 flex gap-2">
                  <div className="relative min-w-0 flex-1">
                    <div
                      className={`flex h-10 w-full items-center justify-between rounded-lg border px-3 text-sm transition ${
                        isModeratorMenuOpen
                          ? 'border-border-strong bg-card text-text'
                          : 'border-border bg-secondary text-text hover:bg-card'
                      }`}
                      onClick={() => {
                        if (!isModeratorMenuOpen) {
                          setIsModeratorMenuOpen(true)
                          setIsManagerMenuOpen(false)
                        }
                      }}
                    >
                      <input
                        type="text"
                        value={isModeratorMenuOpen ? moderatorSearch : (selectedModeratorMember ? `${selectedModeratorMember.firstName} ${selectedModeratorMember.lastName}`.trim() : moderatorSearch)}
                        onChange={(event) => {
                          setModeratorSearch(event.target.value)
                          setIsModeratorMenuOpen(true)
                          setIsManagerMenuOpen(false)
                          setSelectedModeratorUserId('')
                        }}
                        onFocus={() => {
                          setIsModeratorMenuOpen(true)
                          setIsManagerMenuOpen(false)
                        }}
                        placeholder="Moderator ara"
                        className="w-full bg-transparent outline-none placeholder:text-soft"
                      />
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={`size-4 transition ${isModeratorMenuOpen ? 'rotate-180' : ''}`}>
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </div>
                    {isModeratorMenuOpen ? (
                      <div className="absolute left-0 top-[calc(100%+4px)] z-20 w-full rounded-lg border border-border bg-card p-2 shadow-[0_24px_60px_rgba(15,23,42,0.18)]">
                        {!filteredModeratorCandidates.length ? (
                          <p className="px-3 py-2 text-sm text-muted">Uygun uye yok</p>
                        ) : (
                          filteredModeratorCandidates.map((member) => (
                            <button
                              key={member.userId}
                              type="button"
                              onClick={() => {
                                setSelectedModeratorUserId(member.userId)
                                setModeratorSearch(`${member.firstName} ${member.lastName}`.trim())
                                setIsModeratorMenuOpen(false)
                              }}
                              className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition ${
                                selectedModeratorUserId === member.userId
                                  ? 'bg-secondary text-text'
                                  : 'text-text hover:bg-nav-hover'
                              }`}
                            >
                              <span className="truncate">{`${member.firstName} ${member.lastName}`.trim()}</span>
                            </button>
                          ))
                        )}
                      </div>
                    ) : null}
                  </div>
                  <button type="button" onClick={async () => { if (!selectedModeratorUserId) return; await updateGroupMemberRole(group.id, selectedModeratorUserId, { role: 'moderator' }); const payload = await getGroupMembers(group.id, { q: memberSearch, limit: 100 }); setMembers(payload.members || []); setSelectedModeratorUserId(''); setModeratorSearch('') }} className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-inverse">Ekle</button>
                </div>
                <div className="mt-2 space-y-2">
                  {moderatorList.map((member) => (
                    <div key={`moderator-${member.userId}`} className="flex items-center justify-between rounded-lg bg-secondary px-3 py-2">
                      <p className="text-sm text-text">{`${member.firstName} ${member.lastName}`.trim()}</p>
                      <button type="button" onClick={async () => { await updateGroupMemberRole(group.id, member.userId, { role: 'member' }); const payload = await getGroupMembers(group.id, { q: memberSearch, limit: 100 }); setMembers(payload.members || []) }} className="text-xs font-semibold text-rose-600">Yetkiyi Kaldir</button>
                    </div>
                  ))}
                </div>
              </section>
              <div className="flex gap-2 border-t border-border pt-3"><button type="button" onClick={async () => { const payload = await updateGroup(group.id, { about: groupAbout, postApprovalRequired: Boolean(group.postApprovalRequired), joinApprovalRequired: Boolean(group.joinApprovalRequired) }); setGroup(payload.group); syncGroupToSidebar(payload.group); setIsEditModalOpen(false) }} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">Kaydet</button><button type="button" onClick={() => setIsDeleteConfirmOpen(true)} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white">Grubu Sil</button></div>
            </div>
          </div>
        </div>
      ) : null}

      {isDeleteConfirmOpen ? (
        <div className="fixed inset-0 z-[95] bg-black/55 p-4 backdrop-blur-sm">
          <div className="mx-auto mt-20 w-full max-w-md rounded-[24px] border border-border bg-card p-5 shadow-2xl">
            <h3 className="text-lg font-semibold text-text">Grup Silme Onayi</h3>
            <p className="mt-3 text-sm leading-6 text-muted">
              Grubunuz tamamen silinecektir. Bu islem geri alinamaz.
              Devam etmek istediginize emin misiniz?
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsDeleteConfirmOpen(false)}
                disabled={isDeletingGroup}
                className="rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-semibold text-text disabled:opacity-60"
              >
                Vazgec
              </button>
              <button
                type="button"
                onClick={async () => {
                  setDeleteError('')
                  setIsDeletingGroup(true)
                  try {
                    await deleteGroup(group.id)
                    const nextCache = removeGroupFromSidebarCache(group.id)
                    setSidebarState({ managed: nextCache.managed, joined: nextCache.joined })
                    navigate(`/${lang}/groups`)
                  } catch (error) {
                    setDeleteError(error?.message || 'Grup silinirken bir hata olustu.')
                  } finally {
                    setIsDeletingGroup(false)
                  }
                }}
                disabled={isDeletingGroup}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {isDeletingGroup ? 'Siliniyor...' : 'Evet, Sil'}
              </button>
            </div>
            {deleteError ? <p className="mt-3 text-sm text-rose-600">{deleteError}</p> : null}
          </div>
        </div>
      ) : null}

      {postApprovalNotice ? (
        <div className="fixed inset-0 z-[96] bg-black/45 p-4 backdrop-blur-sm">
          <div className="mx-auto mt-24 w-full max-w-md rounded-[20px] border border-border bg-card p-5 shadow-2xl">
            <h3 className="text-base font-semibold text-text">Bilgilendirme</h3>
            <p className="mt-2 text-sm text-muted">{postApprovalNotice}</p>
            <div className="mt-4 flex justify-end">
              <button type="button" onClick={() => setPostApprovalNotice('')} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-inverse">Tamam</button>
            </div>
          </div>
        </div>
      ) : null}

      <ProfileImageCropModal
        open={coverCropState.open}
        file={coverCropState.file}
        target={coverCropState.target}
        onClose={() => setCoverCropState({ open: false, file: null, target: 'cover' })}
        onConfirm={handleCoverCropConfirm}
      />

      {isCoverDeleteConfirmOpen ? (
        <div className="fixed inset-0 z-[101] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-2xl">
            <h3 className="text-base font-semibold text-text">Kapak fotografi silinsin mi?</h3>
            <p className="mt-2 text-sm text-muted">Kapak fotografi kaldirilacak ve varsayilan arka plan gosterilecek.</p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCoverDeleteConfirmOpen(false)}
                disabled={isCoverUploading}
                className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-text transition hover:bg-secondary disabled:opacity-60"
              >
                Vazgec
              </button>
              <button
                type="button"
                onClick={handleDeleteCoverImage}
                disabled={isCoverUploading}
                className="rounded-lg bg-rose-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-rose-600 disabled:opacity-60"
              >
                Sil
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <CreateGroupModal open={isCreateGroupModalOpen} onClose={() => setIsCreateGroupModalOpen(false)} user={user} onCreate={async (payload) => { const response = await createGroup(payload); const created = response?.group; if (created?.slug) navigate(`/${lang}/groups/manage/${created.slug}`) }} />
    </div>
  )
}



