import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  getAdminShadowChats,
  getAdminShadowMessages,
  getAdminShadowCalls,
  getAdminShadowMedia,
  getAdminUnmaskedUser,
} from '../services/adminService.ts'
import { getFullName } from '../utils/social.js'

export default function AdminShadowPage() {
  const { lang = 'tr' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()

  const currentTabParam = searchParams.get('tab')
  const activeTab =
    currentTabParam === 'rooms'
      ? 'rooms'
      : currentTabParam === 'calls'
        ? 'calls'
        : currentTabParam === 'media'
          ? 'media'
          : currentTabParam === 'messages'
            ? 'messages'
            : 'direct'

  const selectedChatKey = searchParams.get('chat') || ''

  // Data states
  const [chats, setChats] = useState([])
  const [chatsLoading, setChatsLoading] = useState(true)

  const [messages, setMessages] = useState([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [messageSearch, setMessageSearch] = useState('')
  const [messageFilterDeleted, setMessageFilterDeleted] = useState(false)

  const [calls, setCalls] = useState([])
  const [callsLoading, setCallsLoading] = useState(false)
  const [callStatusFilter, setCallStatusFilter] = useState('all')

  const [mediaItems, setMediaItems] = useState([])
  const [mediaLoading, setMediaLoading] = useState(false)
  const [mediaTypeFilter, setMediaTypeFilter] = useState('all')

  // Lightbox Media Preview
  const [previewMedia, setPreviewMedia] = useState(null)

  // Unmask Modal State
  const [unmaskTargetId, setUnmaskTargetId] = useState(null)
  const [unmaskData, setUnmaskData] = useState(null)
  const [unmaskLoading, setUnmaskLoading] = useState(false)
  const [unmaskError, setUnmaskError] = useState('')

  // Split-View Chat List States
  const [isChatListVisible, setIsChatListVisible] = useState(true)
  const [splitSearch, setSplitSearch] = useState('')
  const [splitDeletedOnly, setSplitDeletedOnly] = useState(false)
  const [splitTypeFilter, setSplitTypeFilter] = useState('direct') // 'direct' | 'room'
  const [mobileSplitView, setMobileSplitView] = useState('chat') // 'chat' | 'list'

  // Jump-to-Message & Deep-Linking States
  const [pendingScrollMessageId, setPendingScrollMessageId] = useState(null)
  const [highlightedMessageId, setHighlightedMessageId] = useState(null)
  const [lastNonMediaTab, setLastNonMediaTab] = useState(null) // 'media' | 'calls' | null

  const handleTabChange = (tab, chatKey = '') => {
    const params = new URLSearchParams()
    params.set('tab', tab)
    if (chatKey) params.set('chat', chatKey)
    setSearchParams(params)
  }

  // Medya tıklandığında ilgili sohbete ve mesaja odaklanma
  const handleJumpToMediaMessage = (item) => {
    const targetType = item.roomId ? 'rooms' : 'direct'
    const targetChatKey = item.roomId || item.conversationId

    setLastNonMediaTab('media')
    setPendingScrollMessageId(item.messageId)
    handleTabChange(targetType, targetChatKey)
    setMobileSplitView('chat')
  }

  // Arama tıklandığında ilgili sohbete odaklanma
  const handleJumpToCallChat = (call) => {
    // 1. Doğrudan sessionId ile chatKey eşleştir
    let targetChat = chats.find((c) => c.chatKey === call.sessionId)
    // 2. Bulunamazsa katılımcılardan bul
    if (!targetChat) {
      targetChat = chats.find(
        (c) =>
          c.type === 'direct' &&
          c.participants?.some(
            (p) =>
              p.anonymousId === call.callerAnonymousId ||
              p.anonymousId === call.recipientAnonymousId,
          ),
      )
    }

    if (targetChat) {
      setLastNonMediaTab('calls')
      handleTabChange(targetChat.type === 'room' ? 'rooms' : 'direct', targetChat.chatKey)
      setMobileSplitView('chat')
    }
  }

  // Load All Chats once or on refresh
  const loadChats = () => {
    setChatsLoading(true)
    getAdminShadowChats({ type: 'all' })
      .then((res) => {
        if (res?.chats) {
          setChats(res.chats)
        }
      })
      .catch((err) => console.error('Chats fetch error:', err))
      .finally(() => setChatsLoading(false))
  }

  useEffect(() => {
    loadChats()
    getAdminShadowCalls()
      .then((res) => {
        if (res?.calls) setCalls(res.calls)
      })
      .catch((err) => console.error('Initial calls fetch error:', err))
    getAdminShadowMedia()
      .then((res) => {
        if (res?.media) setMediaItems(res.media)
      })
      .catch((err) => console.error('Initial media fetch error:', err))
  }, [])

  // Load Messages for selected chat
  useEffect(() => {
    if (['direct', 'rooms', 'messages'].includes(activeTab) && selectedChatKey) {
      let isCurrent = true
      setMessagesLoading(true)
      getAdminShadowMessages(selectedChatKey)
        .then((res) => {
          if (isCurrent && res?.messages) {
            setMessages(res.messages)
          }
        })
        .catch((err) => console.error('Messages fetch error:', err))
        .finally(() => {
          if (isCurrent) setMessagesLoading(false)
        })

      return () => {
        isCurrent = false
      }
    }
  }, [activeTab, selectedChatKey])

  // Otomatik mesaj konumuna kaydırma (Smooth scroll & highlight pulse)
  useEffect(() => {
    if (!pendingScrollMessageId || messagesLoading) return

    const timer = setTimeout(() => {
      const el = document.getElementById(`msg-${pendingScrollMessageId}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        setHighlightedMessageId(pendingScrollMessageId)
        const clearTimer = setTimeout(() => {
          setHighlightedMessageId(null)
        }, 3000)
        setPendingScrollMessageId(null)
        return () => clearTimeout(clearTimer)
      }
    }, 150)

    return () => clearTimeout(timer)
  }, [pendingScrollMessageId, messagesLoading, messages])

  // Sync splitTypeFilter with activeTab
  useEffect(() => {
    if (activeTab === 'direct') {
      setSplitTypeFilter('direct')
    } else if (activeTab === 'rooms') {
      setSplitTypeFilter('room')
    }
  }, [activeTab])

  // Auto-select first matching chat if none selected or selected chat does not match tab type
  useEffect(() => {
    if (['direct', 'rooms', 'messages'].includes(activeTab) && chats.length > 0) {
      const targetType = activeTab === 'rooms' ? 'room' : activeTab === 'direct' ? 'direct' : null
      const filtered = targetType ? chats.filter((c) => c.type === targetType) : chats
      const current = chats.find((c) => c.chatKey === selectedChatKey)

      const isCurrentValid = current && (!targetType || current.type === targetType)

      if (!isCurrentValid && filtered.length > 0) {
        handleTabChange(activeTab, filtered[0].chatKey)
      }
    }
  }, [activeTab, chats, selectedChatKey])

  // Load Calls
  useEffect(() => {
    if (activeTab === 'calls') {
      let isCurrent = true
      setCallsLoading(true)
      getAdminShadowCalls()
        .then((res) => {
          if (isCurrent && res?.calls) {
            setCalls(res.calls)
          }
        })
        .catch((err) => console.error('Calls fetch error:', err))
        .finally(() => {
          if (isCurrent) setCallsLoading(false)
        })

      return () => {
        isCurrent = false
      }
    }
  }, [activeTab])

  // Load Media
  useEffect(() => {
    if (activeTab === 'media') {
      let isCurrent = true
      setMediaLoading(true)
      getAdminShadowMedia()
        .then((res) => {
          if (isCurrent && res?.media) {
            setMediaItems(res.media)
          }
        })
        .catch((err) => console.error('Media fetch error:', err))
        .finally(() => {
          if (isCurrent) setMediaLoading(false)
        })

      return () => {
        isCurrent = false
      }
    }
  }, [activeTab])

  // Quick Global Stats
  const globalStats = useMemo(() => {
    const totalChats = chats.length
    const totalMessages = chats.reduce((acc, c) => acc + (c.totalMessages || 0), 0)
    const totalDeletedMessages = chats.reduce((acc, c) => acc + (c.deletedMessages || 0), 0)
    const activeRooms = chats.filter((c) => c.type === 'room').length
    const directChatsCount = chats.filter((c) => c.type === 'direct').length

    return {
      totalChats,
      totalMessages,
      totalDeletedMessages,
      activeRooms,
      directChatsCount,
    }
  }, [chats])

  // Filtered Messages
  const displayedMessages = useMemo(() => {
    let list = messages
    if (messageFilterDeleted) {
      list = list.filter((m) => m.isDeleted)
    }
    if (messageSearch.trim()) {
      const q = messageSearch.toLowerCase()
      list = list.filter(
        (m) =>
          m.text?.toLowerCase().includes(q) ||
          m.senderAlias?.toLowerCase().includes(q) ||
          m.senderUser?.username?.toLowerCase().includes(q),
      )
    }
    return list
  }, [messages, messageFilterDeleted, messageSearch])

  // Filtered Calls
  const displayedCalls = useMemo(() => {
    if (callStatusFilter === 'all') return calls
    return calls.filter((c) => c.status === callStatusFilter)
  }, [calls, callStatusFilter])

  // Filtered Media
  const displayedMedia = useMemo(() => {
    if (mediaTypeFilter === 'all') return mediaItems
    return mediaItems.filter((m) => m.type === mediaTypeFilter)
  }, [mediaItems, mediaTypeFilter])

  // Filtered Chat List for Split-View Sidebar
  const splitChatList = useMemo(() => {
    let list = chats
    if (splitTypeFilter === 'direct') {
      list = list.filter((c) => c.type === 'direct')
    } else if (splitTypeFilter === 'room') {
      list = list.filter((c) => c.type === 'room')
    }

    if (splitDeletedOnly) {
      list = list.filter((c) => c.deletedMessages > 0 || c.isDeleted)
    }

    if (splitSearch.trim()) {
      const q = splitSearch.toLowerCase()
      list = list.filter(
        (c) =>
          c.title?.toLowerCase().includes(q) ||
          c.subtitle?.toLowerCase().includes(q) ||
          c.creator?.alias?.toLowerCase().includes(q) ||
          c.creator?.user?.username?.toLowerCase().includes(q) ||
          c.participants?.some(
            (p) =>
              p.alias?.toLowerCase().includes(q) ||
              p.user?.username?.toLowerCase().includes(q) ||
              p.user?.email?.toLowerCase().includes(q),
          ),
      )
    }
    return list
  }, [chats, splitTypeFilter, splitDeletedOnly, splitSearch])

  // Trigger Unmask Modal
  const openUnmaskModal = async (anonymousId) => {
    if (!anonymousId) return
    setUnmaskTargetId(anonymousId)
    setUnmaskData(null)
    setUnmaskError('')
    setUnmaskLoading(true)

    try {
      const res = await getAdminUnmaskedUser(anonymousId)
      if (res?.user) {
        setUnmaskData(res.user)
      } else {
        setUnmaskError('Kullanıcı bilgisi çözümlenemedi.')
      }
    } catch (err) {
      setUnmaskError(err.message || 'Kullanıcı kimliği çözülürken hata oluştu.')
    } finally {
      setUnmaskLoading(false)
    }
  }

  const closeUnmaskModal = () => {
    setUnmaskTargetId(null)
    setUnmaskData(null)
    setUnmaskError('')
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    return d.toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatDuration = (sec) => {
    const s = Number(sec || 0)
    if (s <= 0) return '0 sn'
    const m = Math.floor(s / 60)
    const rem = s % 60
    if (m > 0) return `${m} dk ${rem} sn`
    return `${rem} sn`
  }

  const selectedChatObject = useMemo(() => {
    if (!selectedChatKey) return null
    return chats.find((c) => c.chatKey === selectedChatKey)
  }, [chats, selectedChatKey])

  const formatTime = (dateStr) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  }

  const getDateDividerLabel = (dateStr) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    const now = new Date()
    const isToday = d.toDateString() === now.toDateString()
    const yesterday = new Date(now)
    yesterday.setDate(now.getDate() - 1)
    const isYesterday = d.toDateString() === yesterday.toDateString()

    if (isToday) return 'Bugün'
    if (isYesterday) return 'Dün'
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  // Distinct Senders from current messages list
  const distinctSenders = useMemo(() => {
    const map = new Map()
    messages.forEach((m) => {
      if (m.senderAnonymousId && !map.has(m.senderAnonymousId)) {
        map.set(m.senderAnonymousId, {
          anonymousId: m.senderAnonymousId,
          alias: m.senderAlias,
          user: m.senderUser,
        })
      }
    })
    return Array.from(map.values())
  }, [messages])

  // Participants list (from chat object or inferred from messages)
  const participantsList = useMemo(() => {
    if (selectedChatObject?.participants && selectedChatObject.participants.length > 0) {
      return selectedChatObject.participants
    }
    return distinctSenders
  }, [selectedChatObject, distinctSenders])

  const pA = participantsList[0] || null
  const pB = participantsList[1] || null

  // Messages grouped by calendar date
  const groupedMessages = useMemo(() => {
    const groups = []
    let currentGroup = null

    displayedMessages.forEach((msg) => {
      const label = getDateDividerLabel(msg.createdAt)
      if (!currentGroup || currentGroup.dateLabel !== label) {
        currentGroup = { dateLabel: label, messages: [msg] }
        groups.push(currentGroup)
      } else {
        currentGroup.messages.push(msg)
      }
    })

    return groups
  }, [displayedMessages])

  return (
    <div>
      {/* ENTEGRE MODERASYON KONSOLU (Sohbetler, Odalar, Aramalar & Medya) */}
      <div className="w-full">
        {/* Tek Entegre Kart: Sol Sohbet Listesi + Sağ Panel (Akış / Aramalar / Medya) */}
        <div className="rounded-none min-[681px]:rounded-md border-x-0 min-[681px]:border border-slate-200/90 bg-white shadow-sm min-[681px]:shadow-md h-[calc(100dvh-66px)] min-[681px]:h-[calc(100dvh-108px)] min-h-[450px] flex overflow-hidden w-full">
            {/* SOL BÖLÜM: SOHBET LİSTESİ (Sohbet Akışları) */}
            <aside
              className={`${
                isChatListVisible ? 'flex' : 'hidden'
              } ${
                mobileSplitView === 'list' ? 'flex w-full' : 'hidden lg:flex w-80 xl:w-96'
              } flex-col border-r border-slate-200/90 bg-white shrink-0 h-full overflow-hidden`}
            >
              {/* Sol Üst Bar (50px Yükseklikte Sağ Başlıkla Birebir Hizalı) */}
              <div className="h-[50px] min-h-[50px] px-3.5 border-b border-slate-200/90 bg-slate-50/80 flex items-center justify-between shrink-0 select-none">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs sm:text-sm text-slate-900 tracking-tight">Sohbet Akışları</span>
                  <span className="rounded-full bg-blue-50 text-blue-700 border border-blue-200/80 px-2 py-0.5 text-[10px] font-bold">
                    {splitChatList.length}
                  </span>
                  <button
                    type="button"
                    onClick={loadChats}
                    title="Listeyi Yenile"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition active:scale-95 cursor-pointer"
                  >
                    <svg className={`size-3.5 ${chatsLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </div>

                {/* Mobilde doğrudan aktif sohbete geçiş butonu */}
                {selectedChatKey && (
                  <button
                    type="button"
                    onClick={() => setMobileSplitView('chat')}
                    className="lg:hidden text-xs font-bold text-blue-600 hover:underline cursor-pointer"
                  >
                    Sohbete Dön →
                  </button>
                )}
              </div>

              {/* Arama & Filtre Kontrolleri */}
              <div className="p-2.5 border-b border-slate-200/90 bg-slate-50/60 space-y-2 shrink-0">
                {/* Arama Inputu ve Silinen Checkbox */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 min-w-0">
                    <input
                      type="text"
                      placeholder="Gölge, @kullanıcı veya oda..."
                      value={splitSearch}
                      onChange={(e) => setSplitSearch(e.target.value)}
                      className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2.5 pl-7.5 pr-6 text-xs text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 shadow-2xs"
                    />
                    <svg className="absolute left-2.5 top-2.5 size-3.5 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    {splitSearch && (
                      <button
                        type="button"
                        onClick={() => setSplitSearch('')}
                        className="absolute right-2 top-1.5 text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <label className="inline-flex items-center gap-1.5 cursor-pointer text-[11px] font-semibold text-rose-600 hover:text-rose-700 select-none shrink-0 px-2 py-1 rounded-lg hover:bg-rose-50/60 transition">
                    <input
                      type="checkbox"
                      checked={splitDeletedOnly}
                      onChange={(e) => setSplitDeletedOnly(e.target.checked)}
                      className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer size-3.5"
                    />
                    <span>Silinen</span>
                  </label>
                </div>

                {/* Buton Takımı: Sohbetler, Odalar, Aramalar, Medya */}
                <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100/90 rounded-xl border border-slate-200/80 text-[11px] font-semibold text-slate-600">
                  {/* Sohbetler */}
                  <button
                    type="button"
                    onClick={() => {
                      setSplitTypeFilter('direct')
                      handleTabChange('direct')
                    }}
                    className={`py-1 px-1 rounded-lg flex items-center justify-center gap-1 transition cursor-pointer text-[11px] ${
                      activeTab === 'direct'
                        ? 'bg-white text-blue-600 font-bold shadow-xs border border-slate-200/80'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                    }`}
                    title={`Sohbetler (${globalStats.directChatsCount})`}
                  >
                    <span className="truncate">Sohbetler</span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full shrink-0 ${
                        activeTab === 'direct'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200/60'
                          : 'bg-slate-200/80 text-slate-600'
                      }`}
                    >
                      {globalStats.directChatsCount}
                    </span>
                  </button>

                  {/* Odalar */}
                  <button
                    type="button"
                    onClick={() => {
                      setSplitTypeFilter('room')
                      handleTabChange('rooms')
                    }}
                    className={`py-1 px-1 rounded-lg flex items-center justify-center gap-1 transition cursor-pointer text-[11px] ${
                      activeTab === 'rooms'
                        ? 'bg-white text-blue-600 font-bold shadow-xs border border-slate-200/80'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                    }`}
                    title={`Odalar (${globalStats.activeRooms})`}
                  >
                    <span className="truncate">Odalar</span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full shrink-0 ${
                        activeTab === 'rooms'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200/60'
                          : 'bg-slate-200/80 text-slate-600'
                      }`}
                    >
                      {globalStats.activeRooms}
                    </span>
                  </button>

                  {/* Aramalar */}
                  <button
                    type="button"
                    onClick={() => {
                      handleTabChange('calls')
                      setMobileSplitView('chat')
                    }}
                    className={`py-1 px-1 rounded-lg flex items-center justify-center gap-1 transition cursor-pointer text-[11px] ${
                      activeTab === 'calls'
                        ? 'bg-white text-blue-600 font-bold shadow-xs border border-slate-200/80'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                    }`}
                    title={`Aramalar (${calls.length})`}
                  >
                    <span className="truncate">Aramalar</span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full shrink-0 ${
                        activeTab === 'calls'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200/60'
                          : 'bg-slate-200/80 text-slate-600'
                      }`}
                    >
                      {calls.length}
                    </span>
                  </button>

                  {/* Medya */}
                  <button
                    type="button"
                    onClick={() => {
                      handleTabChange('media')
                      setMobileSplitView('chat')
                    }}
                    className={`py-1 px-1 rounded-lg flex items-center justify-center gap-1 transition cursor-pointer text-[11px] ${
                      activeTab === 'media'
                        ? 'bg-white text-blue-600 font-bold shadow-xs border border-slate-200/80'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                    }`}
                    title={`Medya (${mediaItems.length})`}
                  >
                    <span className="truncate">Medya</span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full shrink-0 ${
                        activeTab === 'media'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200/60'
                          : 'bg-slate-200/80 text-slate-600'
                      }`}
                    >
                      {mediaItems.length}
                    </span>
                  </button>
                </div>
              </div>

              {/* Sohbet Kartları Listesi */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1.5 scrollbar-thin bg-white">
                {chatsLoading ? (
                  <div className="p-8 text-center text-slate-400">
                    <div className="inline-block size-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent mb-1" />
                    <p className="text-xs">Yükleniyor...</p>
                  </div>
                ) : splitChatList.length === 0 ? (
                  <div className="p-8 text-center text-slate-400">
                    <p className="text-xs">Kriterlere uygun sohbet bulunamadı.</p>
                  </div>
                ) : (
                  splitChatList.map((chat) => {
                    const isSelected = chat.chatKey === selectedChatKey && !['calls', 'media'].includes(activeTab)
                    const isDirect = chat.type === 'direct'
                    const p1 = chat.participants?.[0]
                    const p2 = chat.participants?.[1]

                    return (
                      <button
                        key={chat.chatKey || chat.id}
                        type="button"
                        onClick={() => {
                          handleTabChange(chat.type === 'room' ? 'rooms' : 'direct', chat.chatKey)
                          setMobileSplitView('chat')
                        }}
                        className={`w-full text-left p-2.5 transition rounded-xl flex flex-col gap-1.5 cursor-pointer relative border ${
                          isSelected
                            ? 'bg-blue-50/80 border-blue-400/90 shadow-xs ring-1 ring-blue-500/20'
                            : 'bg-white hover:bg-slate-50/90 border-slate-200/80 hover:border-slate-300 shadow-2xs'
                        }`}
                      >
                        {/* Üst Satır: Tür Rozeti + Başlık + Tarih */}
                        <div className="flex items-center justify-between gap-1.5 min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <span
                              className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold shrink-0 ${
                                isDirect
                                  ? 'bg-slate-100 text-slate-600 border border-slate-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200/80'
                              }`}
                            >
                              {isDirect ? '1:1' : 'Oda'}
                            </span>
                            <span className={`font-bold text-xs truncate ${isSelected ? 'text-blue-950' : 'text-slate-900'}`}>
                              {chat.title}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                            {formatDate(chat.lastMessageAt)}
                          </span>
                        </div>

                        {/* Orta Satır: Katılımcı Alias / Unmask durumu */}
                        {isDirect && (p1 || p2) ? (
                          <div className="flex items-center gap-1 text-[11px] text-slate-600 truncate">
                            <span className="truncate">{p1?.alias || 'Anon 1'}</span>
                            {p1?.user && (
                              <span className="text-emerald-700 text-[10px] font-bold shrink-0 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200/70">
                                🔓@{p1.user.username}
                              </span>
                            )}
                            <span className="text-slate-300 shrink-0">↔</span>
                            <span className="truncate">{p2?.alias || 'Anon 2'}</span>
                            {p2?.user && (
                              <span className="text-emerald-700 text-[10px] font-bold shrink-0 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200/70">
                                🔓@{p2.user.username}
                              </span>
                            )}
                          </div>
                        ) : !isDirect && chat.creator ? (
                          <div className="flex items-center gap-1 text-[11px] text-slate-500 truncate">
                            <span>Kurucu:</span>
                            <span className="font-semibold text-slate-700 truncate">{chat.creator.alias}</span>
                            {chat.creator.user && (
                              <span className="text-emerald-700 text-[10px] font-bold shrink-0 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200/70">
                                🔓@{chat.creator.user.username}
                              </span>
                            )}
                          </div>
                        ) : null}

                        {/* Alt Satır: Mesaj Sayısı & Silinen Uyarısı */}
                        <div className="flex items-center justify-between text-[11px] pt-0.5">
                          <span className="text-slate-500 font-medium">
                            {chat.totalMessages || 0} mesaj
                          </span>
                          {chat.deletedMessages > 0 ? (
                            <span className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.2 text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-200">
                              ⚠️ {chat.deletedMessages} silindi
                            </span>
                          ) : chat.isDeleted ? (
                            <span className="inline-flex items-center rounded-md px-1.5 py-0.2 text-[10px] font-bold text-slate-500 bg-slate-100">
                              Silindi
                            </span>
                          ) : null}
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </aside>

            {/* SAĞ BÖLÜM: SEÇİLİ KONUŞMA AKIŞI / ARAMALAR KONSOLU / MEDYA GALERİSİ */}
            <main
              className={`${
                mobileSplitView === 'chat' ? 'flex' : 'hidden lg:flex'
              } flex-1 flex-col bg-[#f8fafc] min-w-0 h-full overflow-hidden`}
            >
              {activeTab === 'calls' ? (
                /* ENTEGRE ARAMA GEÇMİŞİ & SESLİ GÖRÜŞMELER KONSOLU */
                <div className="flex-1 flex flex-col min-h-0 bg-[#f8fafc] overflow-hidden">
                  {/* 50px Entegre Üst Bar */}
                  <div className="h-[50px] min-h-[50px] flex items-center justify-between px-3 sm:px-4 border-b border-slate-200/90 bg-white/95 backdrop-blur-md select-none shadow-2xs shrink-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <button
                        type="button"
                        onClick={() => setMobileSplitView('list')}
                        className="lg:hidden inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition active:scale-95 cursor-pointer shrink-0"
                      >
                        <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h7" />
                        </svg>
                        <span>Sohbetler</span>
                      </button>
                      <span className="font-bold text-xs sm:text-sm text-slate-900 tracking-tight flex items-center gap-1.5 truncate">
                        <span>📞</span>
                        <span>Arama Geçmişi & Sesli Görüşmeler</span>
                      </span>
                      <span className="rounded-full bg-blue-50 text-blue-700 border border-blue-200/80 px-2 py-0.5 text-[10px] font-bold shrink-0">
                        {displayedCalls.length}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <select
                        value={callStatusFilter}
                        onChange={(e) => setCallStatusFilter(e.target.value)}
                        className="h-8 rounded-lg border border-slate-200/90 bg-slate-50/70 hover:bg-slate-50 focus:bg-white px-2.5 text-xs font-semibold text-slate-700 outline-none transition focus:border-blue-500 cursor-pointer shadow-2xs"
                      >
                        <option value="all">Tüm Durumlar ({calls.length})</option>
                        <option value="ended">Görüşüldü</option>
                        <option value="declined">Reddedildi</option>
                        <option value="missed">Cevapsız</option>
                      </select>

                      <button
                        type="button"
                        onClick={() => {
                          setCallsLoading(true)
                          getAdminShadowCalls()
                            .then((res) => {
                              if (res?.calls) setCalls(res.calls)
                            })
                            .finally(() => setCallsLoading(false))
                        }}
                        className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-slate-200/90 bg-slate-50 hover:bg-slate-100 text-slate-600 transition cursor-pointer active:scale-95 shadow-2xs"
                        title="Aramaları Yenile"
                      >
                        <svg className={`size-3.5 ${callsLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Scrollable Arama Listesi */}
                  <div className="flex-1 overflow-y-auto p-3 sm:p-5 scrollbar-thin">
                    {callsLoading ? (
                      <div className="flex flex-col items-center justify-center p-12 text-center text-slate-500">
                        <div className="inline-block size-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent mb-2" />
                        <p className="text-sm font-medium">Sesli görüşme günlükleri taranıyor...</p>
                      </div>
                    ) : displayedCalls.length === 0 ? (
                      <div className="flex flex-col items-center justify-center p-12 text-center text-slate-500">
                        <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-center text-2xl mb-3">
                          📞
                        </div>
                        <p className="text-sm font-semibold text-slate-800">Sesli arama kaydı bulunamadı</p>
                      </div>
                    ) : (
                      <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-2xs">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs sm:text-sm">
                            <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                              <tr>
                                <th className="px-4 py-3">Arayan (Gölge & Asıl)</th>
                                <th className="px-4 py-3">Alıcı (Gölge & Asıl)</th>
                                <th className="px-4 py-3">Durum</th>
                                <th className="px-4 py-3">Süre</th>
                                <th className="px-4 py-3">Tarih</th>
                                <th className="px-4 py-3 text-right">İşlem</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {displayedCalls.map((call) => (
                                <tr key={call._id} className="transition hover:bg-slate-50/70">
                                  <td className="px-4 py-3.5">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-bold text-slate-900">{call.callerAlias}</span>
                                      {call.callerUserId ? (
                                        <span className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.2 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/90">
                                          🔓 @{call.callerUserId.username}
                                        </span>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => openUnmaskModal(call.callerAnonymousId)}
                                          className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.2 text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200/90 hover:bg-blue-100 transition cursor-pointer"
                                        >
                                          🔍 Çöz
                                        </button>
                                      )}
                                    </div>
                                  </td>

                                  <td className="px-4 py-3.5">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-bold text-slate-900">{call.recipientAlias}</span>
                                      {call.recipientUserId ? (
                                        <span className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.2 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/90">
                                          🔓 @{call.recipientUserId.username}
                                        </span>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => openUnmaskModal(call.recipientAnonymousId)}
                                          className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.2 text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200/90 hover:bg-blue-100 transition cursor-pointer"
                                        >
                                          🔍 Çöz
                                        </button>
                                      )}
                                    </div>
                                  </td>

                                  <td className="px-4 py-3.5">
                                    <span
                                      className={`rounded-md px-2 py-0.5 text-[11px] font-bold border ${
                                        call.status === 'connected' || call.status === 'ended'
                                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                          : call.status === 'declined'
                                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                                            : 'bg-slate-100 text-slate-600 border-slate-200'
                                      }`}
                                    >
                                      {call.status === 'ended'
                                        ? 'Görüşüldü'
                                        : call.status === 'declined'
                                          ? 'Reddedildi'
                                          : call.status === 'missed'
                                            ? 'Cevapsız'
                                            : call.status}
                                    </span>
                                  </td>

                                  <td className="px-4 py-3.5 font-bold text-slate-800 text-xs">
                                    {formatDuration(call.durationSec)}
                                  </td>

                                  <td className="px-4 py-3.5 text-xs text-slate-500">
                                    {formatDate(call.startedAt || call.createdAt)}
                                  </td>

                                  <td className="px-4 py-3.5 text-right">
                                    <button
                                      type="button"
                                      onClick={() => handleJumpToCallChat(call)}
                                      className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200/80 hover:bg-blue-100 transition cursor-pointer active:scale-95 shadow-2xs"
                                      title="Bu aramanın gerçekleştiği sohbete git"
                                    >
                                      <span>Sohbete Git</span>
                                      <span>→</span>
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : activeTab === 'media' ? (
                /* ENTEGRE MEDYA GALERİSİ KONSOLU */
                <div className="flex-1 flex flex-col min-h-0 bg-[#f8fafc] overflow-hidden">
                  {/* 50px Entegre Üst Bar */}
                  <div className="h-[50px] min-h-[50px] flex items-center justify-between px-3 sm:px-4 border-b border-slate-200/90 bg-white/95 backdrop-blur-md select-none shadow-2xs shrink-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <button
                        type="button"
                        onClick={() => setMobileSplitView('list')}
                        className="lg:hidden inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition active:scale-95 cursor-pointer shrink-0"
                      >
                        <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h7" />
                        </svg>
                        <span>Sohbetler</span>
                      </button>
                      <span className="font-bold text-xs sm:text-sm text-slate-900 tracking-tight flex items-center gap-1.5 truncate">
                        <span>🖼️</span>
                        <span>Paylaşılan Medyalar</span>
                      </span>
                      <span className="rounded-full bg-blue-50 text-blue-700 border border-blue-200/80 px-2 py-0.5 text-[10px] font-bold shrink-0">
                        {displayedMedia.length}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <select
                        value={mediaTypeFilter}
                        onChange={(e) => setMediaTypeFilter(e.target.value)}
                        className="h-8 rounded-lg border border-slate-200/90 bg-slate-50/70 hover:bg-slate-50 focus:bg-white px-2.5 text-xs font-semibold text-slate-700 outline-none transition focus:border-blue-500 cursor-pointer shadow-2xs"
                      >
                        <option value="all">Tüm Medyalar ({mediaItems.length})</option>
                        <option value="image">Fotoğraflar</option>
                        <option value="video">Videolar</option>
                        <option value="audio">Ses Notları</option>
                      </select>

                      <button
                        type="button"
                        onClick={() => {
                          setMediaLoading(true)
                          getAdminShadowMedia()
                            .then((res) => {
                              if (res?.media) setMediaItems(res.media)
                            })
                            .finally(() => setMediaLoading(false))
                        }}
                        className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-slate-200/90 bg-slate-50 hover:bg-slate-100 text-slate-600 transition cursor-pointer active:scale-95 shadow-2xs"
                        title="Medyaları Yenile"
                      >
                        <svg className={`size-3.5 ${mediaLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Scrollable Medya Izgarası */}
                  <div className="flex-1 overflow-y-auto p-3 sm:p-5 scrollbar-thin">
                    {mediaLoading ? (
                      <div className="flex flex-col items-center justify-center p-12 text-center text-slate-500">
                        <div className="inline-block size-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent mb-2" />
                        <p className="text-sm font-medium">Medyalar taranıyor...</p>
                      </div>
                    ) : displayedMedia.length === 0 ? (
                      <div className="flex flex-col items-center justify-center p-12 text-center text-slate-500">
                        <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-center text-2xl mb-3">
                          🖼️
                        </div>
                        <p className="text-sm font-semibold text-slate-800">Henüz medya paylaşılmamış</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                        {displayedMedia.map((item) => (
                          <div
                            key={item.id}
                            className="group relative flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs hover:border-blue-400 hover:shadow-xs transition"
                          >
                            {/* Önizleme */}
                            <div className="aspect-square w-full bg-slate-100 relative overflow-hidden">
                              {item.type === 'image' && (
                                <button
                                  type="button"
                                  onClick={() => setPreviewMedia(item)}
                                  className="h-full w-full block cursor-pointer"
                                  title="Büyük Görseli İncele"
                                >
                                  <img
                                    src={item.url}
                                    alt="Gölge Medya"
                                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                                  />
                                </button>
                              )}
                              {item.type === 'video' && (
                                <video src={item.url} className="h-full w-full object-cover" />
                              )}
                              {item.type === 'audio' && (
                                <div className="flex h-full w-full flex-col items-center justify-center p-3 text-center bg-slate-50">
                                  <span className="text-3xl mb-1">🎤</span>
                                  <span className="text-xs font-bold text-slate-800">Ses Kaydı</span>
                                </div>
                              )}

                              {item.isDeleted && (
                                <span className="absolute top-2 right-2 rounded-md bg-rose-600 px-1.5 py-0.5 text-[9px] font-extrabold text-white shadow-xs">
                                  Silindi
                                </span>
                              )}
                            </div>

                            {/* Detay & Buton */}
                            <div className="p-2.5 flex flex-col flex-1 justify-between gap-2">
                              <div>
                                <div className="truncate text-xs font-bold text-slate-900" title={item.senderAlias}>
                                  {item.senderAlias}
                                </div>
                                {item.senderUser && (
                                  <button
                                    type="button"
                                    onClick={() => openUnmaskModal(item.senderAnonymousId)}
                                    className="block truncate text-[11px] font-semibold text-blue-600 hover:underline cursor-pointer"
                                  >
                                    🔓 @{item.senderUser.username}
                                  </button>
                                )}
                                <div className="text-[10px] text-slate-400 mt-0.5">{formatDate(item.createdAt)}</div>
                              </div>

                              {/* Sohbette Göster Butonu */}
                              <button
                                type="button"
                                onClick={() => handleJumpToMediaMessage(item)}
                                className="w-full inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] border border-blue-200/80 transition active:scale-95 cursor-pointer shadow-2xs"
                                title="Bu medyanın atıldığı sohbete ve mesaja git"
                              >
                                <span>Sohbette Göster</span>
                                <span className="text-xs">↗</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* SEÇİLİ KONUŞMA AKIŞI (Detail) */
                <div className="flex-1 flex flex-col min-h-0 bg-[#f8fafc] overflow-hidden">
                  {/* 50px Entegre Üst Bar: Geri Dön + Panel Toggle + Kullanıcı Bilgileri */}
                  <div className="h-[50px] min-h-[50px] flex items-center justify-between px-3 sm:px-4 border-b border-slate-200/90 bg-white/95 backdrop-blur-md select-none shadow-2xs shrink-0">
                    {/* Sol: Panel Toggle & Kullanıcı Bilgileri */}
                    <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
                      {/* Masaüstü Sol Paneli Gizle / Göster Butonu */}
                      <button
                        type="button"
                        onClick={() => setIsChatListVisible(!isChatListVisible)}
                        className="hidden lg:inline-flex items-center gap-1.5 rounded-lg border border-slate-200/90 bg-slate-50 hover:bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition active:scale-95 cursor-pointer shrink-0 shadow-2xs"
                        title={isChatListVisible ? 'Sol Sohbet Listesini Gizle (Tam Ekran)' : 'Sol Sohbet Listesini Göster'}
                      >
                        <svg className="size-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h7" />
                        </svg>
                        <span className="text-[11px]">{isChatListVisible ? 'Listeyi Gizle' : 'Listeyi Göster'}</span>
                      </button>

                      {/* Mobil Sohbet Listesini Aç Butonu */}
                      <button
                        type="button"
                        onClick={() => setMobileSplitView('list')}
                        className="lg:hidden inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition active:scale-95 cursor-pointer shrink-0 shadow-2xs"
                      >
                        <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h7" />
                        </svg>
                        <span>Sohbetler</span>
                      </button>

                      {/* Aramalardan veya Medyadan Zıplandıysa Geri Dönüş Rozeti */}
                      {lastNonMediaTab && (
                        <button
                          type="button"
                          onClick={() => {
                            handleTabChange(lastNonMediaTab)
                            setMobileSplitView('chat')
                          }}
                          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/90 transition cursor-pointer shadow-2xs shrink-0"
                          title={lastNonMediaTab === 'media' ? 'Medya Galerisine Geri Dön' : 'Arama Geçmişine Geri Dön'}
                        >
                          <span>← {lastNonMediaTab === 'media' ? 'Medyaya Dön' : 'Aramalara Dön'}</span>
                        </button>
                      )}

                  {/* Butonların Sağında: Kullanıcıların Bilgileri */}
                  {selectedChatObject?.type === 'direct' && participantsList.length >= 2 ? (
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0 overflow-x-auto py-0.5 scrollbar-none">
                      {/* Katılımcı 1 */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <div className="h-6.5 w-6.5 rounded-full bg-slate-100 border border-slate-200/90 text-slate-700 flex items-center justify-center text-[10px] font-bold">
                          {pA?.alias?.slice(0, 1)?.toUpperCase() || '1'}
                        </div>
                        <span className="text-xs font-bold text-slate-900">{pA?.alias}</span>
                        {pA?.user ? (
                          <span className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/90 shadow-2xs">
                            🔓 @{pA.user.username}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openUnmaskModal(pA?.anonymousId)}
                            className="inline-flex items-center gap-0.5 rounded-md px-2 py-0.5 text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200/90 hover:bg-blue-100 transition cursor-pointer shadow-2xs"
                          >
                            🔍 Çöz
                          </button>
                        )}
                      </div>

                      <span className="text-slate-300 font-bold text-xs shrink-0">↔️</span>

                      {/* Katılımcı 2 */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <div className="h-6.5 w-6.5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold shadow-2xs">
                          {pB?.alias?.slice(0, 1)?.toUpperCase() || '2'}
                        </div>
                        <span className="text-xs font-bold text-slate-900">{pB?.alias}</span>
                        {pB?.user ? (
                          <span className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/90 shadow-2xs">
                            🔓 @{pB.user.username}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openUnmaskModal(pB?.anonymousId)}
                            className="inline-flex items-center gap-0.5 rounded-md px-2 py-0.5 text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200/90 hover:bg-blue-100 transition cursor-pointer shadow-2xs"
                          >
                            🔍 Çöz
                          </button>
                        )}
                      </div>
                    </div>
                  ) : selectedChatObject?.type === 'room' ? (
                    <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                      <span className="font-bold text-xs text-slate-900 truncate">
                        {selectedChatObject.title}
                      </span>
                      {selectedChatObject.creator && (
                        <div className="flex items-center gap-1 shrink-0 text-[11px] text-slate-500">
                          <span>Kurucu:</span>
                          <span className="font-semibold text-slate-800">{selectedChatObject.creator.alias}</span>
                          {selectedChatObject.creator.user ? (
                            <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200/90 shadow-2xs">
                              🔓 @{selectedChatObject.creator.user.username}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openUnmaskModal(selectedChatObject.creator.alias)}
                              className="rounded-md border border-blue-200/90 bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 hover:bg-blue-100 transition cursor-pointer shadow-2xs"
                            >
                              🔍 Çöz
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-bold text-xs text-slate-900 truncate">
                        {selectedChatObject?.title || 'Sohbet İnceleme'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Sağ: İstatistik, Hızlı Mesaj Arama & Yenileme */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* Mesaj İçi Hızlı Arama */}
                  <div className="relative hidden md:block w-36 lg:w-44">
                    <input
                      type="text"
                      placeholder="Mesajlarda ara..."
                      value={messageSearch}
                      onChange={(e) => setMessageSearch(e.target.value)}
                      className="w-full h-8 rounded-lg border border-slate-200/90 bg-slate-50/70 hover:bg-slate-50 focus:bg-white px-2.5 pl-7 pr-6 text-xs text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 shadow-2xs"
                    />
                    <svg className="absolute left-2 top-2.5 size-3.5 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    {messageSearch && (
                      <button
                        type="button"
                        onClick={() => setMessageSearch('')}
                        className="absolute right-2 top-2 text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 font-medium">
                    <span>{displayedMessages.length} mesaj</span>
                    {selectedChatObject?.deletedMessages > 0 && (
                      <span className="font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md text-[10px] border border-rose-200 shadow-2xs">
                        {selectedChatObject.deletedMessages} silindi
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (!selectedChatKey) return
                      setMessagesLoading(true)
                      getAdminShadowMessages(selectedChatKey)
                        .then((res) => setMessages(res?.messages || []))
                        .finally(() => setMessagesLoading(false))
                    }}
                    className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-slate-200/90 bg-slate-50 hover:bg-slate-100 text-slate-600 transition cursor-pointer active:scale-95 shadow-2xs"
                    title="Yenile"
                  >
                    <svg className={`size-3.5 ${messagesLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* İçerik: Yükleniyor / Seçim Bekleniyor / Boş / Mesaj Akışı */}
              {messagesLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-500">
                  <div className="inline-block size-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent mb-2" />
                  <p className="text-sm font-medium">Mesaj geçmişi ve silinen kayıtlar yükleniyor...</p>
                </div>
              ) : !selectedChatObject ? (
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-500">
                  <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-center text-2xl mb-3">
                    💬
                  </div>
                  <p className="text-base font-semibold text-slate-800">İncelemek için bir sohbet seçin</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm leading-relaxed">
                    Sol sütundaki sohbet listesinden bir görüşmeyi seçerek mesaj akışını, silinen içerikleri ve medya kayıtlarını denetleyebilirsiniz.
                  </p>
                </div>
              ) : displayedMessages.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-500">
                  <p className="text-sm font-medium">Filtre kriterlerine uygun mesaj bulunamadı.</p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto p-3 sm:p-5 scrollbar-thin">
                  {/* Chat Messages Flow Container */}
                  <div className="space-y-4 px-1 sm:px-3 py-2">
                    {groupedMessages.map((group, gIdx) => (
                      <div key={gIdx} className="space-y-3">
                        {/* Sticky Date Divider */}
                        <div className="sticky top-1 z-10 flex justify-center">
                          <span className="rounded-full bg-white/95 px-3.5 py-0.5 text-[11px] font-semibold text-slate-600 border border-slate-200/90 shadow-2xs backdrop-blur-xs">
                            {group.dateLabel}
                          </span>
                        </div>

                        {/* Messages in Date Group */}
                        {group.messages.map((msg) => {
                          const isRightSender =
                            selectedChatObject?.type === 'direct' &&
                            pB &&
                            msg.senderAnonymousId === pB.anonymousId

                          return (
                            <div
                              key={msg.id}
                              id={`msg-${msg.id}`}
                              className={`flex flex-col transition-all duration-500 rounded-2xl p-1.5 ${
                                highlightedMessageId === msg.id
                                  ? 'ring-4 ring-blue-500/80 bg-blue-50/80 shadow-md scale-[1.01]'
                                  : ''
                              } ${
                                isRightSender ? 'items-end' : 'items-start'
                              }`}
                            >
                              {/* Balon Üstü Katılımcı Bilgisi */}
                              <div
                                className={`flex items-center gap-1.5 mb-1 px-1 text-[11px] ${
                                  isRightSender ? 'flex-row-reverse' : 'flex-row'
                                }`}
                              >
                                <span className="font-semibold text-slate-700">
                                  {msg.senderAlias || 'Anonim'}
                                </span>

                                {msg.senderUser ? (
                                  <span className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.2 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 shadow-2xs">
                                    🔓 @{msg.senderUser.username}
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => openUnmaskModal(msg.senderAnonymousId)}
                                    className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.2 text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200/80 hover:bg-blue-100 transition cursor-pointer shadow-2xs"
                                  >
                                    🔍 Çöz
                                  </button>
                                )}
                              </div>

                              {/* Mesaj Balonu */}
                              <div
                                className={`relative max-w-[85%] sm:max-w-[75%] rounded-2xl px-3.5 py-2.5 shadow-xs transition ${
                                  msg.isDeleted
                                    ? 'bg-rose-50/95 border border-rose-200 text-slate-900'
                                    : isRightSender
                                    ? 'bg-blue-600 text-white rounded-tr-xs shadow-blue-600/10'
                                    : 'bg-white text-slate-900 border border-slate-200/90 rounded-tl-xs shadow-slate-200/40'
                                }`}
                              >
                                {/* Silinmiş Mesaj Uyarısı & Denetim İzi */}
                                {msg.isDeleted && (
                                  <div className="flex items-center gap-1.5 text-xs font-bold text-rose-600 mb-1 pb-1 border-b border-rose-200/80">
                                    <svg className="size-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                    <span>Kullanıcı Tarafından Silindi (Denetim İzi)</span>
                                  </div>
                                )}

                                {/* Mesaj Metni */}
                                {msg.text && (
                                  <p className="text-xs sm:text-sm whitespace-pre-wrap break-words leading-relaxed">
                                    {msg.text}
                                  </p>
                                )}

                                {/* Medya Ekleri (Fotoğraf, Video, Ses) */}
                                {msg.media && msg.media.length > 0 && (
                                  <div className="mt-2 space-y-1.5">
                                    {msg.media.map((med, idx) => (
                                      <div key={idx} className="overflow-hidden rounded-xl border border-slate-200/80">
                                        {med.type === 'image' && (
                                          <img
                                            src={med.url}
                                            alt="Medya"
                                            onClick={() => setPreviewMedia(med.url)}
                                            className="max-h-60 w-auto rounded-lg object-cover cursor-pointer transition hover:opacity-90 active:scale-98"
                                            loading="lazy"
                                          />
                                        )}
                                        {med.type === 'video' && (
                                          <video
                                            src={med.url}
                                            controls
                                            className="max-h-60 w-full rounded-lg"
                                          />
                                        )}
                                        {med.type === 'audio' && (
                                          <div className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200/60 rounded-lg">
                                            <span className="text-xs font-bold text-slate-700">
                                              🎙️ {med.duration ? formatDuration(med.duration) : 'Ses Kaydı'}
                                            </span>
                                            <audio src={med.url} controls className="h-8 w-52 sm:w-60" />
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* Zaman & Silindi İbaresi */}
                                <div
                                  className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
                                    isRightSender && !msg.isDeleted
                                      ? 'text-blue-100/90'
                                      : 'text-slate-400'
                                  }`}
                                >
                                  <span>{formatTime(msg.createdAt)}</span>
                                  {msg.isDeleted && <span className="text-rose-500 font-bold">• Silindi</span>}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>

    {/* 3. LIGHTBOX MEDIA MODAL */}
      {previewMedia && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
          onClick={() => setPreviewMedia(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white p-2 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPreviewMedia(null)}
              className="absolute right-4 top-4 z-10 rounded-full bg-slate-900/60 p-2 text-white hover:bg-slate-900/80 transition cursor-pointer"
            >
              ✕
            </button>
            <img
              src={previewMedia.url}
              alt="Büyük Önizleme"
              className="max-h-[80vh] w-auto rounded-2xl object-contain"
            />
          </div>
        </div>
      )}

      {/* 4. UNMASK USER MODAL */}
      {unmaskTargetId && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
          onClick={closeUnmaskModal}
        >
          <div
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-200 text-base">
                  🔓
                </span>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">Maske Çözümleme Kartı</h3>
                  <p className="text-xs text-slate-500">Gölge profilin arkasındaki asıl kullanıcı</p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeUnmaskModal}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              >
                ✕
              </button>
            </div>

            <div className="mt-5">
              {unmaskLoading ? (
                <div className="py-12 text-center text-sm text-slate-500">
                  <div className="inline-block size-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent mb-2" />
                  <p className="font-medium">Kullanıcının gerçek kimliği ve denetim kayıtları çözümleniyor...</p>
                </div>
              ) : unmaskError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-600">
                  {unmaskError}
                </div>
              ) : unmaskData ? (
                <div className="space-y-4">
                  {/* Real Profile Header */}
                  <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <img
                      src={unmaskData.avatarUrl || '/favicon.svg'}
                      alt="Avatar"
                      className="h-16 w-16 rounded-2xl border border-slate-200 object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <h4 className="text-base font-bold text-slate-900 truncate">
                        {getFullName(unmaskData)}
                      </h4>
                      <p className="text-sm font-semibold text-blue-600 truncate">
                        @{unmaskData.username}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <span className="rounded-md bg-white border border-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                          Rol: {unmaskData.role}
                        </span>
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-bold border ${
                            unmaskData.accountStatus === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}
                        >
                          Durum: {unmaskData.accountStatus}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Info Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5">
                      <span className="text-slate-500 font-medium">E-posta:</span>
                      <p className="mt-1 font-bold text-slate-900 truncate">{unmaskData.email || '-'}</p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5">
                      <span className="text-slate-500 font-medium">Telefon:</span>
                      <p className="mt-1 font-bold text-slate-900 truncate">{unmaskData.phone || '-'}</p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5">
                      <span className="text-slate-500 font-medium">Gölge Takma Adı:</span>
                      <p className="mt-1 font-bold text-blue-600">
                        {unmaskData.anonymousProfile?.alias || 'Belirlenmedi'}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5">
                      <span className="text-slate-500 font-medium">Kayıt Tarihi:</span>
                      <p className="mt-1 font-bold text-slate-900">{formatDate(unmaskData.createdAt)}</p>
                    </div>
                  </div>

                  {/* Shadow Activity Summary */}
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/40 p-4">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Gölge Modu Aktivite Özeti
                    </span>
                    <div className="mt-2.5 grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="rounded-xl bg-white p-2.5 border border-slate-200">
                        <span className="text-slate-500 text-[11px]">Gönderilen Mesaj</span>
                        <p className="mt-0.5 text-base font-extrabold text-slate-900">
                          {unmaskData.stats?.sentMessagesCount || 0}
                        </p>
                      </div>
                      <div className="rounded-xl bg-white p-2.5 border border-slate-200">
                        <span className="text-slate-500 text-[11px]">Başlatılan Arama</span>
                        <p className="mt-0.5 text-base font-extrabold text-slate-900">
                          {unmaskData.stats?.callsInitiatedCount || 0}
                        </p>
                      </div>
                      <div className="rounded-xl bg-white p-2.5 border border-slate-200">
                        <span className="text-slate-500 text-[11px]">Alınan Arama</span>
                        <p className="mt-0.5 text-base font-extrabold text-slate-900">
                          {unmaskData.stats?.callsReceivedCount || 0}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Footer & Link */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100 pt-4">
                    <p className="text-[11px] text-slate-500 flex items-center gap-1">
                      🛡️ Bu sorgu <strong>Audit Log</strong> sistemine kaydedildi.
                    </p>

                    <Link
                      to={`/${lang}/admin/users/${unmaskData._id}`}
                      className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm shadow-blue-500/25 hover:bg-blue-700 transition active:scale-95"
                    >
                      Kullanıcı Profiline Git →
                    </Link>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
