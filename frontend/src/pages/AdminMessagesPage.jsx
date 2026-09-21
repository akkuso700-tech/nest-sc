import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  getAdminUserChats,
  getAdminUserChatMessages,
  getAdminUserCalls,
  getAdminUserMedia,
  deleteAdminMessage,
} from '../services/adminService.ts'
import UserAvatar from '../components/common/UserAvatar.jsx'
import VerifiedBadge from '../components/common/VerifiedBadge.jsx'
import { getFullName } from '../utils/social.js'
import { resolveMediaUrl } from '../utils/media.js'

function formatDuration(sec) {
  const s = Number(sec || 0)
  if (s <= 0) return '0 sn'
  const m = Math.floor(s / 60)
  const rem = s % 60
  if (m > 0) return `${m} dk ${rem} sn`
  return `${rem} sn`
}

function formatDate(dateStr) {
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

function formatTime(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
}

function getDateDividerLabel(dateStr) {
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

export default function AdminMessagesPage() {
  const { lang = 'tr' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()

  const currentTabParam = searchParams.get('tab')
  const activeTab =
    currentTabParam === 'calls'
      ? 'calls'
      : currentTabParam === 'media'
        ? 'media'
        : 'direct'

  const selectedConversationId = searchParams.get('chat') || ''

  // Data states
  const [chats, setChats] = useState([])
  const [chatsLoading, setChatsLoading] = useState(true)

  const [messages, setMessages] = useState([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [messageSearch, setMessageSearch] = useState('')

  const [calls, setCalls] = useState([])
  const [callsLoading, setCallsLoading] = useState(false)
  const [callStatusFilter, setCallStatusFilter] = useState('all')

  const [mediaItems, setMediaItems] = useState([])
  const [mediaLoading, setMediaLoading] = useState(false)
  const [mediaTypeFilter, setMediaTypeFilter] = useState('all')

  // Lightbox Media Preview
  const [previewMedia, setPreviewMedia] = useState(null)

  // Split-View Chat List States
  const [isChatListVisible, setIsChatListVisible] = useState(true)
  const [splitSearch, setSplitSearch] = useState('')
  const [mobileSplitView, setMobileSplitView] = useState('chat') // 'chat' | 'list'

  // Jump-to-Message & Deep-Linking States
  const [pendingScrollMessageId, setPendingScrollMessageId] = useState(null)
  const [highlightedMessageId, setHighlightedMessageId] = useState(null)
  const [lastNonMediaTab, setLastNonMediaTab] = useState(null) // 'media' | 'calls' | null

  // Delete message dialog state
  const [deleteTargetMessage, setDeleteTargetMessage] = useState(null)
  const [deleteReason, setDeleteReason] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  const handleTabChange = (tab, chatId = '') => {
    const params = new URLSearchParams()
    params.set('tab', tab)
    if (chatId) params.set('chat', chatId)
    setSearchParams(params)
  }

  // Load chats list
  const loadChats = () => {
    setChatsLoading(true)
    getAdminUserChats({ search: splitSearch })
      .then((res) => {
        if (res?.chats) {
          setChats(res.chats)
          // Select first chat if none selected on initial load
          if (!selectedConversationId && res.chats.length > 0 && activeTab === 'direct') {
            handleTabChange('direct', res.chats[0].id)
          }
        }
      })
      .catch((err) => console.error('Admin chats load error:', err))
      .finally(() => setChatsLoading(false))
  }

  useEffect(() => {
    loadChats()
  }, [])

  // Debounced search for split chat list
  useEffect(() => {
    const timer = setTimeout(() => {
      getAdminUserChats({ search: splitSearch }).then((res) => {
        if (res?.chats) setChats(res.chats)
      })
    }, 280)
    return () => clearTimeout(timer)
  }, [splitSearch])

  // Load messages for selected conversation
  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([])
      return
    }

    setMessagesLoading(true)
    getAdminUserChatMessages(selectedConversationId)
      .then((res) => {
        if (res?.messages) {
          setMessages(res.messages)
        }
      })
      .catch((err) => {
        console.error('Chat messages error:', err)
        setMessages([])
      })
      .finally(() => setMessagesLoading(false))
  }, [selectedConversationId])

  // Load calls
  const loadCalls = () => {
    setCallsLoading(true)
    getAdminUserCalls({ status: callStatusFilter })
      .then((res) => {
        if (res?.calls) setCalls(res.calls)
      })
      .catch((err) => console.error('Admin calls load error:', err))
      .finally(() => setCallsLoading(false))
  }

  useEffect(() => {
    if (activeTab === 'calls') {
      loadCalls()
    }
  }, [activeTab, callStatusFilter])

  // Load media
  const loadMedia = () => {
    setMediaLoading(true)
    getAdminUserMedia({ type: mediaTypeFilter })
      .then((res) => {
        if (res?.media) setMediaItems(res.media)
      })
      .catch((err) => console.error('Admin media load error:', err))
      .finally(() => setMediaLoading(false))
  }

  useEffect(() => {
    if (activeTab === 'media') {
      loadMedia()
    }
  }, [activeTab, mediaTypeFilter])

  // Deep linking scroll effect
  useEffect(() => {
    if (!pendingScrollMessageId || messagesLoading || messages.length === 0) return

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
    }, 250)

    return () => clearTimeout(timer)
  }, [pendingScrollMessageId, messagesLoading, messages])

  // Jump from media to message
  const handleJumpToMediaMessage = (item) => {
    setLastNonMediaTab('media')
    setPendingScrollMessageId(item.messageId)
    handleTabChange('direct', item.conversationId)
    setMobileSplitView('chat')
  }

  // Jump from call to chat
  const handleJumpToCallChat = (call) => {
    setLastNonMediaTab('calls')
    const convId = call.conversation?._id || call.conversation || ''
    if (convId) {
      handleTabChange('direct', convId)
      setMobileSplitView('chat')
    } else {
      const callerId = call.caller?._id || call.caller
      const recipientId = call.recipient?._id || call.recipient
      const matched = chats.find(
        (c) =>
          c.participants?.some((p) => p._id === callerId) &&
          c.participants?.some((p) => p._id === recipientId),
      )
      if (matched) {
        handleTabChange('direct', matched.id)
        setMobileSplitView('chat')
      }
    }
  }

  // Handle message delete
  const handleConfirmDelete = async () => {
    if (!deleteTargetMessage) return
    setIsDeleting(true)
    try {
      await deleteAdminMessage(deleteTargetMessage.id, deleteReason)
      setMessages((prev) =>
        prev.map((m) =>
          m.id === deleteTargetMessage.id
            ? { ...m, isDeleted: true, text: 'Bu mesaj bir yönetici tarafından silindi.' }
            : m,
        ),
      )
      setDeleteTargetMessage(null)
      setDeleteReason('')
    } catch (err) {
      alert(err.message || 'Mesaj silinemedi.')
    } finally {
      setIsDeleting(false)
    }
  }

  const selectedChat = useMemo(() => {
    return chats.find((c) => c.id === selectedConversationId) || null
  }, [chats, selectedConversationId])

  // Participants of the selected chat
  const pA = selectedChat?.participants?.[0] || null
  const pB = selectedChat?.participants?.[1] || null

  const filteredMessages = useMemo(() => {
    if (!messageSearch.trim()) return messages
    const q = messageSearch.toLowerCase()
    return messages.filter(
      (m) =>
        (m.text && m.text.toLowerCase().includes(q)) ||
        (m.sender?.username && m.sender.username.toLowerCase().includes(q)) ||
        (m.sender?.firstName && m.sender.firstName.toLowerCase().includes(q)) ||
        (m.sender?.lastName && m.sender.lastName.toLowerCase().includes(q)),
    )
  }, [messages, messageSearch])

  // Messages grouped by calendar date
  const groupedMessages = useMemo(() => {
    const groups = []
    let currentGroup = null

    filteredMessages.forEach((msg) => {
      const label = getDateDividerLabel(msg.createdAt)
      if (!currentGroup || currentGroup.dateLabel !== label) {
        currentGroup = { dateLabel: label, messages: [msg] }
        groups.push(currentGroup)
      } else {
        currentGroup.messages.push(msg)
      }
    })

    return groups
  }, [filteredMessages])

  return (
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
              <span className="font-bold text-xs sm:text-sm text-slate-900 tracking-tight">
                Sohbet Akışları
              </span>
              <span className="rounded-full bg-blue-50 text-blue-700 border border-blue-200/80 px-2 py-0.5 text-[10px] font-bold">
                {chats.length}
              </span>
              <button
                type="button"
                onClick={loadChats}
                title="Listeyi Yenile"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition active:scale-95 cursor-pointer"
              >
                <svg
                  className={`size-3.5 ${chatsLoading ? 'animate-spin' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </button>
            </div>

            {/* Mobilde doğrudan aktif sohbete geçiş butonu */}
            {selectedConversationId && (
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
            {/* Arama Inputu */}
            <div className="relative">
              <input
                type="text"
                placeholder="Kullanıcı adı, isim veya mesaj ara..."
                value={splitSearch}
                onChange={(e) => setSplitSearch(e.target.value)}
                className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2.5 pl-7.5 pr-6 text-xs text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 shadow-2xs"
              />
              <svg
                className="absolute left-2.5 top-2.5 size-3.5 text-slate-400 pointer-events-none"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
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

            {/* Buton Takımı: Sohbetler, Aramalar, Medya */}
            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100/90 rounded-xl border border-slate-200/80 text-[11px] font-semibold text-slate-600">
              {/* Sohbetler */}
              <button
                type="button"
                onClick={() => handleTabChange('direct', selectedConversationId)}
                className={`py-1 px-1 rounded-lg flex items-center justify-center gap-1 transition cursor-pointer text-[11px] ${
                  activeTab === 'direct'
                    ? 'bg-white text-blue-600 font-bold shadow-xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
                title={`Sohbetler (${chats.length})`}
              >
                <span className="truncate">Sohbetler</span>
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full shrink-0 ${
                    activeTab === 'direct'
                      ? 'bg-blue-50 text-blue-700 border border-blue-200/60'
                      : 'bg-slate-200/80 text-slate-600'
                  }`}
                >
                  {chats.length}
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
            ) : chats.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <p className="text-xs">Kriterlere uygun sohbet bulunamadı.</p>
              </div>
            ) : (
              chats.map((chat) => {
                const isSelected = chat.id === selectedConversationId && activeTab === 'direct'
                const p1 = chat.participants?.[0]
                const p2 = chat.participants?.[1]

                return (
                  <button
                    key={chat.id}
                    type="button"
                    onClick={() => {
                      handleTabChange('direct', chat.id)
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
                        <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold shrink-0 bg-slate-100 text-slate-600 border border-slate-200">
                          1:1
                        </span>
                        <span
                          className={`font-bold text-xs truncate ${
                            isSelected ? 'text-blue-950' : 'text-slate-900'
                          }`}
                        >
                          {chat.title}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                        {formatDate(chat.lastMessageAt)}
                      </span>
                    </div>

                    {/* Orta Satır: Katılımcılar */}
                    {p1 || p2 ? (
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-600 truncate">
                        <span className="truncate font-medium">
                          {getFullName(p1) || p1?.username || 'Kullanıcı 1'}
                        </span>
                        <span className="text-slate-300 shrink-0">↔</span>
                        <span className="truncate font-medium">
                          {getFullName(p2) || p2?.username || 'Kullanıcı 2'}
                        </span>
                      </div>
                    ) : null}

                    {/* Alt Satır: Son Mesaj Özeti ve Mesaj Sayısı */}
                    <div className="flex items-center justify-between text-[11px] pt-0.5">
                      <span className="text-slate-500 truncate max-w-[190px] text-xs">
                        {chat.lastMessagePreview || 'Sohbet başladı'}
                      </span>
                      <span className="text-slate-500 font-medium shrink-0">
                        {chat.totalMessages || 0} mesaj
                      </span>
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
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M4 6h16M4 12h16M4 18h7"
                      />
                    </svg>
                    <span>Sohbetler</span>
                  </button>
                  <span className="font-bold text-xs sm:text-sm text-slate-900 tracking-tight flex items-center gap-1.5 truncate">
                    <span>📞</span>
                    <span>Arama Geçmişi & Sesli/Görüntülü Görüşmeler</span>
                  </span>
                  <span className="rounded-full bg-blue-50 text-blue-700 border border-blue-200/80 px-2 py-0.5 text-[10px] font-bold shrink-0">
                    {calls.length}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <select
                    value={callStatusFilter}
                    onChange={(e) => setCallStatusFilter(e.target.value)}
                    className="h-8 rounded-lg border border-slate-200/90 bg-slate-50/70 hover:bg-slate-50 focus:bg-white px-2.5 text-xs font-semibold text-slate-700 outline-none transition focus:border-blue-500 cursor-pointer shadow-2xs"
                  >
                    <option value="all">Tüm Durumlar ({calls.length})</option>
                    <option value="completed">Görüşüldü</option>
                    <option value="declined">Reddedildi</option>
                    <option value="missed">Cevapsız</option>
                  </select>

                  <button
                    type="button"
                    onClick={loadCalls}
                    className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-slate-200/90 bg-slate-50 hover:bg-slate-100 text-slate-600 transition cursor-pointer active:scale-95 shadow-2xs"
                    title="Aramaları Yenile"
                  >
                    <svg
                      className={`size-3.5 ${callsLoading ? 'animate-spin' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Scrollable Arama Listesi */}
              <div className="flex-1 overflow-y-auto p-3 sm:p-5 scrollbar-thin">
                {callsLoading ? (
                  <div className="flex flex-col items-center justify-center p-12 text-center text-slate-500">
                    <div className="inline-block size-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent mb-2" />
                    <p className="text-sm font-medium">Görüşme günlükleri taranıyor...</p>
                  </div>
                ) : calls.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-12 text-center text-slate-500">
                    <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-center text-2xl mb-3">
                      📞
                    </div>
                    <p className="text-sm font-semibold text-slate-800">Arama kaydı bulunamadı</p>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-2xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs sm:text-sm">
                        <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          <tr>
                            <th className="px-4 py-3">Tür</th>
                            <th className="px-4 py-3">Arayan</th>
                            <th className="px-4 py-3">Alıcı</th>
                            <th className="px-4 py-3">Durum</th>
                            <th className="px-4 py-3">Süre</th>
                            <th className="px-4 py-3">Tarih</th>
                            <th className="px-4 py-3 text-right">İşlem</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {calls.map((call) => {
                            const isVideo = call.callType === 'video'
                            const isEnded =
                              call.status === 'completed' ||
                              call.status === 'ended' ||
                              call.status === 'connected'

                            return (
                              <tr key={call._id} className="transition hover:bg-slate-50/70">
                                <td className="px-4 py-3.5 whitespace-nowrap">
                                  <span
                                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-xs font-semibold ${
                                      isVideo
                                        ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    }`}
                                  >
                                    <span>{isVideo ? '📹' : '📞'}</span>
                                    <span>{isVideo ? 'Görüntülü' : 'Sesli'}</span>
                                  </span>
                                </td>

                                <td className="px-4 py-3.5">
                                  <div className="flex items-center gap-2">
                                    <UserAvatar user={call.caller} className="size-6 text-[10px]" />
                                    <div>
                                      <p className="font-bold text-slate-900 truncate">
                                        {getFullName(call.caller)}
                                      </p>
                                      <Link
                                        to={`/${lang}/admin/users/${call.caller?._id || call.caller?.id || ''}`}
                                        className="text-[10px] text-blue-600 hover:underline font-semibold"
                                      >
                                        @{call.caller?.username}
                                      </Link>
                                    </div>
                                  </div>
                                </td>

                                <td className="px-4 py-3.5">
                                  <div className="flex items-center gap-2">
                                    <UserAvatar
                                      user={call.recipient}
                                      className="size-6 text-[10px]"
                                    />
                                    <div>
                                      <p className="font-bold text-slate-900 truncate">
                                        {getFullName(call.recipient)}
                                      </p>
                                      <Link
                                        to={`/${lang}/admin/users/${call.recipient?._id || call.recipient?.id || ''}`}
                                        className="text-[10px] text-blue-600 hover:underline font-semibold"
                                      >
                                        @{call.recipient?.username}
                                      </Link>
                                    </div>
                                  </div>
                                </td>

                                <td className="px-4 py-3.5">
                                  <span
                                    className={`rounded-md px-2 py-0.5 text-[11px] font-bold border ${
                                      isEnded
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                        : call.status === 'declined'
                                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                                          : 'bg-slate-100 text-slate-600 border-slate-200'
                                    }`}
                                  >
                                    {isEnded
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
                            )
                          })}
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
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M4 6h16M4 12h16M4 18h7"
                      />
                    </svg>
                    <span>Sohbetler</span>
                  </button>
                  <span className="font-bold text-xs sm:text-sm text-slate-900 tracking-tight flex items-center gap-1.5 truncate">
                    <span>🖼️</span>
                    <span>Paylaşılan Medyalar</span>
                  </span>
                  <span className="rounded-full bg-blue-50 text-blue-700 border border-blue-200/80 px-2 py-0.5 text-[10px] font-bold shrink-0">
                    {mediaItems.length}
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
                    onClick={loadMedia}
                    className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-slate-200/90 bg-slate-50 hover:bg-slate-100 text-slate-600 transition cursor-pointer active:scale-95 shadow-2xs"
                    title="Medyaları Yenile"
                  >
                    <svg
                      className={`size-3.5 ${mediaLoading ? 'animate-spin' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
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
                ) : mediaItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-12 text-center text-slate-500">
                    <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-center text-2xl mb-3">
                      🖼️
                    </div>
                    <p className="text-sm font-semibold text-slate-800">Henüz medya paylaşılmamış</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                    {mediaItems.map((item) => {
                      const fullUrl = resolveMediaUrl(item.url)
                      return (
                        <div
                          key={item.id}
                          className="group relative flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs hover:border-blue-400 hover:shadow-xs transition"
                        >
                          {/* Önizleme */}
                          <div className="aspect-square w-full bg-slate-100 relative overflow-hidden">
                            {item.type === 'image' && (
                              <button
                                type="button"
                                onClick={() => setPreviewMedia({ url: item.url, type: 'image' })}
                                className="h-full w-full block cursor-pointer"
                                title="Büyük Görseli İncele"
                              >
                                <img
                                  src={fullUrl}
                                  alt="Medya"
                                  className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                                />
                              </button>
                            )}
                            {item.type === 'video' && (
                              <div
                                onClick={() => setPreviewMedia({ url: item.url, type: 'video' })}
                                className="h-full w-full relative cursor-pointer group"
                              >
                                <video src={fullUrl} className="h-full w-full object-cover" />
                                <div className="absolute inset-0 bg-black/20 flex items-center justify-center group-hover:bg-black/40 transition">
                                  <div className="size-8 rounded-full bg-white/90 text-black flex items-center justify-center text-xs shadow">
                                    ▶
                                  </div>
                                </div>
                              </div>
                            )}
                            {item.type === 'audio' && (
                              <div
                                onClick={() => setPreviewMedia({ url: item.url, type: 'audio' })}
                                className="flex h-full w-full flex-col items-center justify-center p-3 text-center bg-slate-50 cursor-pointer"
                              >
                                <span className="text-3xl mb-1">🎤</span>
                                <span className="text-xs font-bold text-slate-800">
                                  {formatDuration(item.durationSeconds)}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Detay & Buton */}
                          <div className="p-2.5 flex flex-col flex-1 justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-1.5 min-w-0">
                                <UserAvatar user={item.sender} className="size-4 text-[8px]" />
                                <span className="truncate text-xs font-bold text-slate-900">
                                  {getFullName(item.sender)}
                                </span>
                              </div>
                              <Link
                                to={`/${lang}/admin/users/${item.sender?._id || item.sender?.id || ''}`}
                                className="block truncate text-[11px] font-semibold text-blue-600 hover:underline cursor-pointer mt-0.5"
                              >
                                @{item.sender?.username}
                              </Link>
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                {formatDate(item.createdAt)}
                              </div>
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
                      )
                    })}
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
                    title={
                      isChatListVisible
                        ? 'Sol Sohbet Listesini Gizle (Tam Ekran)'
                        : 'Sol Sohbet Listesini Göster'
                    }
                  >
                    <svg
                      className="size-3.5 text-slate-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M4 6h16M4 12h16M4 18h7"
                      />
                    </svg>
                    <span className="text-[11px]">
                      {isChatListVisible ? 'Listeyi Gizle' : 'Listeyi Göster'}
                    </span>
                  </button>

                  {/* Mobil Sohbet Listesini Aç Butonu */}
                  <button
                    type="button"
                    onClick={() => setMobileSplitView('list')}
                    className="lg:hidden inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition active:scale-95 cursor-pointer shrink-0 shadow-2xs"
                  >
                    <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M4 6h16M4 12h16M4 18h7"
                      />
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
                        setLastNonMediaTab(null)
                      }}
                      className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/90 transition cursor-pointer shadow-2xs shrink-0"
                      title={
                        lastNonMediaTab === 'media'
                          ? 'Medya Galerisine Geri Dön'
                          : 'Arama Geçmişine Geri Dön'
                      }
                    >
                      <span>← {lastNonMediaTab === 'media' ? 'Medyaya Dön' : 'Aramalara Dön'}</span>
                    </button>
                  )}

                  {/* Butonların Sağında: Kullanıcıların Bilgileri */}
                  {pA && pB ? (
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0 overflow-x-auto py-0.5 scrollbar-none">
                      {/* Katılımcı 1 */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <UserAvatar
                          user={pA}
                          className="h-6.5 w-6.5 rounded-full border border-slate-200/90 text-slate-700 flex items-center justify-center text-[10px] font-bold"
                        />
                        <span className="text-xs font-bold text-slate-900 truncate">
                          {getFullName(pA) || pA.username}
                        </span>
                        {pA.username && (
                          <Link
                            to={`/${lang}/admin/users/${pA._id || pA.id}`}
                            className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200/90 hover:bg-blue-100 transition shadow-2xs"
                          >
                            @{pA.username}
                          </Link>
                        )}
                        {pA.isVerified && <VerifiedBadge user={pA} size="xs" />}
                      </div>

                      <span className="text-slate-300 font-bold text-xs shrink-0">↔️</span>

                      {/* Katılımcı 2 */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <UserAvatar
                          user={pB}
                          className="h-6.5 w-6.5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold shadow-2xs"
                        />
                        <span className="text-xs font-bold text-slate-900 truncate">
                          {getFullName(pB) || pB.username}
                        </span>
                        {pB.username && (
                          <Link
                            to={`/${lang}/admin/users/${pB._id || pB.id}`}
                            className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200/90 hover:bg-blue-100 transition shadow-2xs"
                          >
                            @{pB.username}
                          </Link>
                        )}
                        {pB.isVerified && <VerifiedBadge user={pB} size="xs" />}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-bold text-xs text-slate-900 truncate">
                        {selectedChat?.title || 'Sohbet İnceleme'}
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
                    <svg
                      className="absolute left-2 top-2.5 size-3.5 text-slate-400 pointer-events-none"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
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
                    <span>{filteredMessages.length} mesaj</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (!selectedConversationId) return
                      setMessagesLoading(true)
                      getAdminUserChatMessages(selectedConversationId)
                        .then((res) => setMessages(res?.messages || []))
                        .finally(() => setMessagesLoading(false))
                    }}
                    className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-slate-200/90 bg-slate-50 hover:bg-slate-100 text-slate-600 transition cursor-pointer active:scale-95 shadow-2xs"
                    title="Yenile"
                  >
                    <svg
                      className={`size-3.5 ${messagesLoading ? 'animate-spin' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              {/* İçerik: Yükleniyor / Seçim Bekleniyor / Boş / Mesaj Akışı */}
              {messagesLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-500">
                  <div className="inline-block size-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent mb-2" />
                  <p className="text-sm font-medium">Mesaj geçmişi yükleniyor...</p>
                </div>
              ) : !selectedChat ? (
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-500">
                  <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-center text-2xl mb-3">
                    💬
                  </div>
                  <p className="text-base font-semibold text-slate-800">İncelemek için bir sohbet seçin</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm leading-relaxed">
                    Sol sütundaki sohbet listesinden bir görüşmeyi seçerek mesaj akışını ve medya
                    kayıtlarını denetleyebilirsiniz.
                  </p>
                </div>
              ) : filteredMessages.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-500">
                  <p className="text-sm font-medium">Filtre kriterlerine uygun mesaj bulunamadı.</p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto p-3 sm:p-5 scrollbar-thin">
                  {/* Chat Messages Flow Container (Birebir Gölge Modu Mimarisi) */}
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
                            pB &&
                            (msg.sender?._id?.toString() === pB._id?.toString() ||
                              msg.sender?.id?.toString() === (pB._id || pB.id)?.toString() ||
                              msg.sender === pB._id)

                          return (
                            <div
                              key={msg.id}
                              id={`msg-${msg.id}`}
                              className={`flex flex-col transition-all duration-500 rounded-2xl p-1.5 ${
                                highlightedMessageId === msg.id
                                  ? 'ring-4 ring-blue-500/80 bg-blue-50/80 shadow-md scale-[1.01]'
                                  : ''
                              } ${isRightSender ? 'items-end' : 'items-start'}`}
                            >
                              {/* Balon Üstü Katılımcı Bilgisi */}
                              <div
                                className={`flex items-center gap-1.5 mb-1 px-1 text-[11px] ${
                                  isRightSender ? 'flex-row-reverse' : 'flex-row'
                                }`}
                              >
                                <UserAvatar user={msg.sender} className="size-4 text-[8px]" />
                                <span className="font-semibold text-slate-700">
                                  {getFullName(msg.sender) || msg.sender?.username}
                                </span>
                                {msg.sender?.username && (
                                  <Link
                                    to={`/${lang}/admin/users/${msg.sender?._id || msg.sender?.id || ''}`}
                                    className="text-[10px] text-blue-600 hover:underline font-semibold"
                                  >
                                    @{msg.sender.username}
                                  </Link>
                                )}
                                {msg.sender?.isVerified && (
                                  <VerifiedBadge user={msg.sender} size="xs" />
                                )}
                              </div>

                              {/* Mesaj Balonu */}
                              <div
                                className={`group relative max-w-[85%] sm:max-w-[75%] rounded-2xl px-3.5 py-2.5 shadow-xs transition ${
                                  msg.isDeleted
                                    ? 'bg-rose-50/95 border border-rose-200 text-slate-900'
                                    : isRightSender
                                      ? 'bg-blue-600 text-white rounded-tr-xs shadow-blue-600/10'
                                      : 'bg-white text-slate-900 border border-slate-200/90 rounded-tl-xs shadow-slate-200/40'
                                }`}
                              >
                                {/* Silme Aksiyon Butonu (Hover ile belirir) */}
                                {!msg.isDeleted && (
                                  <button
                                    type="button"
                                    onClick={() => setDeleteTargetMessage(msg)}
                                    className={`absolute -top-2 ${
                                      isRightSender ? '-left-2' : '-right-2'
                                    } opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-full shadow-md bg-white border border-slate-200 text-rose-500 hover:bg-rose-50 cursor-pointer z-10`}
                                    title="Bu mesajı yönetici olarak sil"
                                  >
                                    <svg
                                      className="size-3"
                                      fill="none"
                                      viewBox="0 0 24 24"
                                      stroke="currentColor"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                      />
                                    </svg>
                                  </button>
                                )}

                                {/* Silinmiş Mesaj Uyarısı & Denetim İzi */}
                                {msg.isDeleted && (
                                  <div className="flex items-center gap-1.5 text-xs font-bold text-rose-600 mb-1 pb-1 border-b border-rose-200/80">
                                    <svg
                                      className="size-3.5 shrink-0"
                                      fill="none"
                                      viewBox="0 0 24 24"
                                      stroke="currentColor"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                      />
                                    </svg>
                                    <span>Yönetici Tarafından Silindi (Denetim İzi)</span>
                                  </div>
                                )}

                                {/* Yanıtlanan Mesaj (ReplyTo) */}
                                {msg.replyTo && (
                                  <div
                                    className={`mb-2 p-2 rounded-lg text-xs ${
                                      isRightSender && !msg.isDeleted
                                        ? 'bg-blue-700/50 text-blue-100 border-l-2 border-white/80'
                                        : 'bg-slate-100/90 text-slate-600 border-l-2 border-blue-500'
                                    }`}
                                  >
                                    <span className="font-semibold">
                                      @{msg.replyTo.sender?.username || 'Kullanıcı'}:
                                    </span>{' '}
                                    <span>{msg.replyTo.text || 'Medya'}</span>
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
                                    {msg.media.map((med, idx) => {
                                      const mUrl = resolveMediaUrl(med.url)
                                      return (
                                        <div
                                          key={idx}
                                          className="overflow-hidden rounded-xl border border-slate-200/80"
                                        >
                                          {med.type === 'image' && (
                                            <img
                                              src={mUrl}
                                              alt="Medya"
                                              onClick={() =>
                                                setPreviewMedia({ url: med.url, type: 'image' })
                                              }
                                              className="max-h-60 w-auto rounded-lg object-cover cursor-pointer transition hover:opacity-90 active:scale-98"
                                              loading="lazy"
                                            />
                                          )}
                                          {med.type === 'video' && (
                                            <video
                                              src={mUrl}
                                              controls
                                              className="max-h-60 w-full rounded-lg"
                                            />
                                          )}
                                          {med.type === 'audio' && (
                                            <div className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200/60 rounded-lg">
                                              <span className="text-xs font-bold text-slate-700">
                                                🎙️{' '}
                                                {med.durationSeconds
                                                  ? formatDuration(med.durationSeconds)
                                                  : 'Ses Kaydı'}
                                              </span>
                                              <audio src={mUrl} controls className="h-8 w-52 sm:w-60" />
                                            </div>
                                          )}
                                        </div>
                                      )
                                    })}
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
                                  {msg.isDeleted && (
                                    <span className="text-rose-500 font-bold">• Silindi</span>
                                  )}
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

      {/* LIGHTBOX MEDIA MODAL (Birebir Gölge Modu Tasarımı) */}
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
            {previewMedia.type === 'video' ? (
              <video
                src={resolveMediaUrl(previewMedia.url)}
                controls
                autoPlay
                className="max-h-[80vh] w-auto rounded-2xl"
              />
            ) : previewMedia.type === 'audio' ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl">
                <span className="text-4xl mb-2 block">🎤</span>
                <p className="text-xs font-bold text-slate-700 mb-3">Ses Notu</p>
                <audio src={resolveMediaUrl(previewMedia.url)} controls autoPlay className="w-80" />
              </div>
            ) : (
              <img
                src={resolveMediaUrl(previewMedia.url)}
                alt="Büyük Önizleme"
                className="max-h-[80vh] w-auto rounded-2xl object-contain"
              />
            )}
          </div>
        </div>
      )}

      {/* MESAJ SİLME MODALI */}
      {deleteTargetMessage && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
          onClick={() => setDeleteTargetMessage(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 mb-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600 border border-rose-200 text-base">
                🗑️
              </span>
              <div>
                <h3 className="text-base font-bold text-slate-900">Mesajı Yönetici Olarak Sil</h3>
                <p className="text-xs text-slate-500">Denetim amacıyla mesaj kalıcı olarak gizlenir</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 mb-3 leading-relaxed">
              Bu mesaj platformdan kaldırılacak ve moderasyon kayıtlarında silindi olarak
              işaretlenecektir.
            </p>

            <textarea
              rows={3}
              placeholder="Silme gerekçesi (opsiyonel)..."
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900 outline-none focus:border-rose-500 focus:bg-white transition mb-4"
            />

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setDeleteTargetMessage(null)
                  setDeleteReason('')
                }}
                className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm shadow-rose-500/25 transition cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? 'Siliniyor...' : 'Evet, Mesajı Sil'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
