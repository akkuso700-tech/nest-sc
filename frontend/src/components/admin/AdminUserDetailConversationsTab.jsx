import { useState } from 'react'
import UserAvatar from '../common/UserAvatar.jsx'
import VerifiedBadge from '../common/VerifiedBadge.jsx'
import AudioMessagePlayer from '../media/AudioMessagePlayer.jsx'
import ConfirmActionDialog from '../feedback/ConfirmActionDialog.jsx'
import { resolveMediaUrl } from '../../utils/media.js'
import { formatRelativeTime, getFullName } from '../../utils/social.js'
import {
  CopyButton,
  formatBytes,
  formatCallDuration,
  getOtherParticipant,
} from './AdminUserDetailCommon.jsx'

export function AdminUserDetailConversationsTab({
  user,
  conversations = [],
  messages = [],
  callLogs = [],
  lang = 'tr',
  onDeleteConversation,
  onDeleteMessage,
}) {
  const [selectedConversationId, setSelectedConversationId] = useState(
    conversations[0]?._id || null
  )
  const [conversationSearch, setConversationSearch] = useState('')
  const [chatFilter, setChatFilter] = useState('all') // 'all' | 'media' | 'deleted' | 'calls'
  const [chatSubTab, setChatSubTab] = useState('stream') // 'stream' | 'media' | 'calls'
  const [messageSearch, setMessageSearch] = useState('')
  const [previewMedia, setPreviewMedia] = useState(null)
  const [videoModalRecording, setVideoModalRecording] = useState(null)

  // Delete modal states
  const [conversationToDelete, setConversationToDelete] = useState(null)
  const [isDeletingChat, setIsDeletingChat] = useState(false)
  const [messageToDelete, setMessageToDelete] = useState(null)
  const [isDeletingMsg, setIsDeletingMsg] = useState(false)

  // Filter conversations by search and filter chips
  const filteredConversations = conversations.filter((conv) => {
    const other = getOtherParticipant(conv, user._id)
    const otherName = getFullName(other).toLowerCase()
    const otherUsername = (other?.username || '').toLowerCase()
    const preview = (conv.lastMessagePreview || '').toLowerCase()
    const search = conversationSearch.toLowerCase().trim()

    const matchesSearch = !search || otherName.includes(search) || otherUsername.includes(search) || preview.includes(search)
    if (!matchesSearch) return false

    if (chatFilter === 'media') {
      const hasMedia = messages.some(
        (m) =>
          String(typeof m.conversation === 'object' ? m.conversation?._id : m.conversation) === String(conv._id) &&
          m.media &&
          m.media.length > 0
      )
      return hasMedia
    }

    if (chatFilter === 'deleted') {
      const hasDeleted = messages.some(
        (m) =>
          String(typeof m.conversation === 'object' ? m.conversation?._id : m.conversation) === String(conv._id) &&
          m.deletedByUserIds &&
          m.deletedByUserIds.length > 0
      )
      return hasDeleted
    }

    if (chatFilter === 'calls') {
      const hasCalls = callLogs.some((c) => {
        const cConvId = typeof c.conversation === 'object' ? c.conversation?._id : c.conversation
        if (cConvId && String(cConvId) === String(conv._id)) return true
        const callerId = String(c.caller?._id || c.caller || '')
        const recipientId = String(c.recipient?._id || c.recipient || '')
        const otherId = String(other?._id || '')
        return (
          (callerId === String(user._id) && recipientId === otherId) ||
          (callerId === otherId && recipientId === String(user._id))
        )
      })
      return hasCalls
    }

    return true
  })

  // Active Conversation
  const activeConversation =
    conversations.find((c) => String(c._id) === String(selectedConversationId)) ||
    filteredConversations[0] ||
    null
  const otherParticipant = activeConversation ? getOtherParticipant(activeConversation, user._id) : null

  // Messages for the active conversation
  const activeConversationMessages = activeConversation
    ? messages
        .filter((m) => {
          const convId = typeof m.conversation === 'object' ? m.conversation?._id : m.conversation
          if (convId && activeConversation._id) {
            return String(convId) === String(activeConversation._id)
          }
          if (otherParticipant?._id) {
            const sId = typeof m.sender === 'object' ? m.sender?._id : m.sender
            const rId = typeof m.recipient === 'object' ? m.recipient?._id : m.recipient
            const oId = otherParticipant._id
            return (
              (String(sId) === String(user._id) && String(rId) === String(oId)) ||
              (String(sId) === String(oId) && String(rId) === String(user._id))
            )
          }
          return false
        })
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    : []

  // Call logs for the active conversation
  const activeConversationCallLogs = activeConversation
    ? callLogs
        .filter((c) => {
          const cConvId = typeof c.conversation === 'object' ? c.conversation?._id : c.conversation
          if (cConvId && activeConversation._id && String(cConvId) === String(activeConversation._id)) {
            return true
          }
          if (otherParticipant?._id) {
            const callerId = String(c.caller?._id || c.caller || '')
            const recipientId = String(c.recipient?._id || c.recipient || '')
            const otherId = String(otherParticipant._id)
            const currentId = String(user._id)
            return (
              (callerId === currentId && recipientId === otherId) ||
              (callerId === otherId && recipientId === currentId)
            )
          }
          return false
        })
        .sort((a, b) => new Date(b.startedAt || b.createdAt).getTime() - new Date(a.startedAt || a.createdAt).getTime())
    : []

  // Filter by messageSearch inside the active conversation
  const searchedMessages = messageSearch.trim()
    ? activeConversationMessages.filter((m) =>
        (m.text || '').toLowerCase().includes(messageSearch.toLowerCase().trim())
      )
    : activeConversationMessages

  // Media list for the active conversation
  const activeConversationMedia = activeConversationMessages.flatMap((m) =>
    (m.media || []).map((med, idx) => ({
      ...med,
      key: `${m._id}-${idx}`,
      messageId: m._id,
      createdAt: m.createdAt,
      sender: m.sender,
    }))
  )

  const handleConfirmDeleteConversation = async (reason) => {
    if (!conversationToDelete) return
    setIsDeletingChat(true)
    try {
      await onDeleteConversation(conversationToDelete.conversationId, reason)
      setSelectedConversationId(null)
      setConversationToDelete(null)
    } finally {
      setIsDeletingChat(false)
    }
  }

  const handleConfirmDeleteMessage = async (reason) => {
    if (!messageToDelete) return
    setIsDeletingMsg(true)
    try {
      await onDeleteMessage(messageToDelete.messageId, reason)
      setMessageToDelete(null)
    } finally {
      setIsDeletingMsg(false)
    }
  }

  return (
    <>
      <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-600">Denetim İstasyonu</p>
            <h3 className="text-base font-bold text-slate-900">Sohbetler & Mesaj Kayıtları</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Kullanıcının yaptığı tüm konuşmaları, silinmiş mesajları ve paylaşılan medya dosyalarını inceleyin.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1 text-xs font-semibold text-slate-700 shadow-2xs">
              Toplam {conversations.length} Sohbet · {messages.length} Mesaj Kaydı
            </span>
          </div>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[330px_1fr] xl:grid-cols-[360px_1fr]">
          {/* Sol Panel: Sohbet Listesi & Filtreler */}
          <div className="flex flex-col border-r-0 border-slate-100 pr-0 lg:border-r lg:pr-5">
            {/* Arama & Filtre Çubuğu */}
            <div className="space-y-2.5">
              <div className="relative">
                <span className="absolute inset-y-0 left-3 flex items-center text-slate-400 text-xs">🔍</span>
                <input
                  type="text"
                  placeholder="Sohbet veya kişi ara..."
                  value={conversationSearch}
                  onChange={(e) => setConversationSearch(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-2 pl-8 pr-3 text-xs text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/10"
                />
                {conversationSearch ? (
                  <button
                    type="button"
                    onClick={() => setConversationSearch('')}
                    className="absolute inset-y-0 right-2.5 flex items-center text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    ✕
                  </button>
                ) : null}
              </div>

              {/* Filtre Segment Butonları */}
              <div className="flex gap-1.5 rounded-xl border border-slate-200/80 bg-slate-50 p-1">
                <button
                  type="button"
                  onClick={() => setChatFilter('all')}
                  className={`flex-1 rounded-lg py-1.5 text-center text-[11px] font-semibold transition-all cursor-pointer ${
                    chatFilter === 'all'
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  Tümü ({conversations.length})
                </button>
                <button
                  type="button"
                  onClick={() => setChatFilter('media')}
                  className={`flex-1 rounded-lg py-1.5 text-center text-[11px] font-semibold transition-all cursor-pointer ${
                    chatFilter === 'media'
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  🖼️ Medyalı
                </button>
                <button
                  type="button"
                  onClick={() => setChatFilter('calls')}
                  className={`flex-1 rounded-lg py-1.5 text-center text-[11px] font-semibold transition-all cursor-pointer ${
                    chatFilter === 'calls'
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  📞 Aramalar
                </button>
                <button
                  type="button"
                  onClick={() => setChatFilter('deleted')}
                  className={`flex-1 rounded-lg py-1.5 text-center text-[11px] font-semibold transition-all cursor-pointer ${
                    chatFilter === 'deleted'
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  ⚠️ Silinenler
                </button>
              </div>
            </div>

            {/* Sohbet Kartları Listesi */}
            <div className="mt-3 max-h-[620px] space-y-2 overflow-y-auto pr-1">
              {filteredConversations.length ? (
                filteredConversations.map((conv) => {
                  const other = getOtherParticipant(conv, user._id)
                  const isSelected = activeConversation && String(activeConversation._id) === String(conv._id)
                  const isOtherSuspended = other?.accountStatus === 'suspended'

                  // Count messages in this conversation
                  const convMsgs = messages.filter(
                    (m) =>
                      String(typeof m.conversation === 'object' ? m.conversation?._id : m.conversation) ===
                      String(conv._id)
                  )
                  const hasDeleted = convMsgs.some((m) => m.deletedByUserIds?.length > 0)
                  const hasMedia = convMsgs.some((m) => m.media?.length > 0)

                  return (
                    <div
                      key={conv._id}
                      onClick={() => {
                        setSelectedConversationId(conv._id)
                        setMessageSearch('')
                      }}
                      className={`group flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5 transition-all ${
                        isSelected
                          ? 'border-blue-500/70 bg-blue-50/70 ring-1 ring-blue-500/20 shadow-xs'
                          : 'border-slate-200/70 bg-white hover:border-slate-300 hover:bg-slate-50/80'
                      }`}
                    >
                      <div className="relative shrink-0">
                        <UserAvatar
                          user={other}
                          className="h-10 w-10 border border-slate-200 font-bold"
                        />
                        {isOtherSuspended ? (
                          <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-rose-500" title="Kullanıcı askıda" />
                        ) : null}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className={`truncate text-xs font-bold ${isSelected ? 'text-blue-950' : 'text-slate-900'}`}>
                              {getFullName(other)}
                            </span>
                            <VerifiedBadge user={{ verification: { isVerified: other?.verification?.status === 'approved' } }} size="sm" />
                          </div>
                          <span className="shrink-0 text-[10px] font-medium text-slate-400">
                            {formatRelativeTime(conv.lastMessageAt || conv.updatedAt)}
                          </span>
                        </div>

                        <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500">
                          @{other?.username || 'user'}
                        </p>

                        <p className={`mt-1 line-clamp-1 text-xs ${isSelected ? 'text-slate-700 font-medium' : 'text-slate-600'}`}>
                          {conv.lastMessagePreview || <span className="italic text-slate-400">Mesaj metni yok</span>}
                        </p>

                        {/* Badges */}
                        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                          {hasMedia ? (
                            <span className="rounded-md border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[9px] font-bold text-blue-700">
                              🖼️ Medya
                            </span>
                          ) : null}
                          {hasDeleted ? (
                            <span className="rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">
                              ⚠️ Silinen Var
                            </span>
                          ) : null}
                          <span className="ml-auto text-[10px] font-semibold text-slate-400">
                            {convMsgs.length} mesaj
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 py-10 text-center text-xs text-slate-500">
                  {conversations.length === 0
                    ? 'Kayıtlı sohbet bulunmuyor.'
                    : 'Aramaya veya filtreye uygun sohbet bulunamadı.'}
                </div>
              )}
            </div>
          </div>

          {/* Sağ Panel: Seçili Sohbet Mesaj Akışı & Medya */}
          <div className="flex min-h-[520px] flex-col rounded-2xl border border-slate-200/90 bg-slate-50/40 p-4">
            {activeConversation && otherParticipant ? (
              <>
                {/* Sohbet Başlığı ve Muhatap Detayı */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3.5">
                  <div className="flex items-center gap-3">
                    <UserAvatar
                      user={otherParticipant}
                      className="h-11 w-11 border border-slate-200 font-bold"
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-sm font-bold text-slate-900">
                          {getFullName(otherParticipant)}
                        </h4>
                        <VerifiedBadge user={{ verification: { isVerified: otherParticipant.verification?.status === 'approved' } }} size="sm" />
                        {otherParticipant.accountStatus === 'suspended' ? (
                          <span className="rounded-md border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">
                            Askıda
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                        <span className="font-semibold text-slate-700">@{otherParticipant.username}</span>
                        <span>•</span>
                        <span className="font-mono text-[10px] text-slate-400">ID: {otherParticipant._id}</span>
                        <CopyButton text={otherParticipant._id} label="ID" />
                        <span>•</span>
                        <a
                          href={`/${lang}/profile/${encodeURIComponent(otherParticipant.username)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-blue-600 hover:text-blue-700 hover:underline"
                        >
                          Profili Gör ↗
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Görünüm Değiştirici Sekmeler & Sohbet Sil Butonu */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-2xs">
                      <button
                        type="button"
                        onClick={() => setChatSubTab('stream')}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                          chatSubTab === 'stream'
                            ? 'bg-slate-900 text-white shadow-2xs'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        💬 Mesaj Akışı ({activeConversationMessages.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setChatSubTab('media')}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                          chatSubTab === 'media'
                            ? 'bg-slate-900 text-white shadow-2xs'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        🖼️ Medya Kasası ({activeConversationMedia.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setChatSubTab('calls')}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                          chatSubTab === 'calls'
                            ? 'bg-slate-900 text-white shadow-2xs'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        📞 Görüşme Kayıtları ({activeConversationCallLogs.length})
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setConversationToDelete({
                          conversationId: activeConversation._id,
                          participantName: getFullName(otherParticipant),
                          messageCount: activeConversationMessages.length,
                        })
                      }
                      className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition-colors hover:border-rose-300 hover:bg-rose-100 shadow-2xs active:scale-95 cursor-pointer"
                      title="Bu sohbeti ve tüm mesajlarını sistemden kalıcı olarak sil"
                    >
                      <span>🗑️</span>
                      <span>Sohbeti Kalıcı Sil</span>
                    </button>
                  </div>
                </div>

                {/* Görünüm 1: Mesaj Akışı (Chat Stream) */}
                {chatSubTab === 'stream' && (
                  <div className="flex flex-1 flex-col">
                    {/* Mesaj İçi Arama Çubuğu */}
                    <div className="mt-3 flex items-center justify-between gap-2 border-b border-slate-200/60 pb-2.5">
                      <div className="relative flex-1 max-w-xs">
                        <span className="absolute inset-y-0 left-2.5 flex items-center text-xs text-slate-400">🔍</span>
                        <input
                          type="text"
                          placeholder="Bu sohbette kelime ara..."
                          value={messageSearch}
                          onChange={(e) => setMessageSearch(e.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
                        />
                      </div>
                      <span className="text-[11px] font-medium text-slate-400">
                        {searchedMessages.length} kayıt listeleniyor
                      </span>
                    </div>

                    {/* Mesaj Balonları Akışı */}
                    <div className="mt-4 max-h-[500px] flex-1 space-y-4 overflow-y-auto px-1">
                      {searchedMessages.length ? (
                        searchedMessages.map((msg) => {
                          const senderId = typeof msg.sender === 'object' ? msg.sender?._id : msg.sender
                          const isInspectedUser = String(senderId) === String(user._id)
                          const isDeleted = msg.deletedByUserIds && msg.deletedByUserIds.length > 0

                          return (
                            <div
                              key={msg._id}
                              className={`flex flex-col ${isInspectedUser ? 'items-end' : 'items-start'}`}
                            >
                              <div className="mb-1 flex items-center gap-2 text-[11px] text-slate-400">
                                <span className="font-semibold text-slate-700">
                                  {isInspectedUser ? `${getFullName(user)} (İncelenen Hesap)` : getFullName(otherParticipant)}
                                </span>
                                <span>•</span>
                                <span>{new Date(msg.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
                                <button
                                  type="button"
                                  onClick={() => setMessageToDelete({ messageId: msg._id })}
                                  title="Bu mesajı kalıcı olarak sil"
                                  className="rounded px-1 text-[11px] text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                >
                                  🗑️ Sil
                                </button>
                              </div>

                              <div
                                className={`relative max-w-[82%] rounded-2xl p-3.5 shadow-xs transition-all ${
                                  isInspectedUser
                                    ? 'rounded-tr-sm bg-blue-600 text-white'
                                    : 'rounded-tl-sm border border-slate-200/90 bg-white text-slate-900'
                                }`}
                              >
                                {/* Medya Ekleri (Fotoğraf / Video / Sesli Mesaj) */}
                                {msg.media && msg.media.length > 0 ? (
                                  <div className="mb-2.5 grid gap-2">
                                    {msg.media.map((med, mIdx) => (
                                      <div key={mIdx} className="overflow-hidden rounded-xl">
                                        {med.type === 'audio' || /\.(webm|ogg|opus|mp3|wav|m4a|aac)(\?.*)?$/i.test(String(med?.url || '')) ? (
                                          <div className={`p-2 rounded-xl border ${
                                            isInspectedUser
                                              ? 'border-blue-400/40 bg-blue-700/50'
                                              : 'border-slate-200 bg-slate-50'
                                          }`}>
                                            <AudioMessagePlayer
                                              src={med.url}
                                              duration={med.durationSeconds || 0}
                                              isMine={isInspectedUser}
                                              variant="admin"
                                            />
                                          </div>
                                        ) : med.type === 'video' ? (
                                          <div className="relative bg-black/10 rounded-xl overflow-hidden">
                                            <video
                                              src={resolveMediaUrl(med.url)}
                                              poster={med.posterUrl ? resolveMediaUrl(med.posterUrl) : ''}
                                              controls
                                              className="max-h-64 w-full rounded-xl object-contain bg-black"
                                            />
                                            <button
                                              type="button"
                                              onClick={() => setPreviewMedia({ url: resolveMediaUrl(med.url), type: 'video' })}
                                              className="absolute top-2 right-2 rounded-lg bg-black/70 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-sm hover:bg-black cursor-pointer"
                                            >
                                              Tam Ekran ↗
                                            </button>
                                          </div>
                                        ) : (
                                          <div
                                            onClick={() => setPreviewMedia({ url: resolveMediaUrl(med.url), type: 'image' })}
                                            className="group relative cursor-pointer overflow-hidden rounded-xl bg-black/10"
                                          >
                                            <img
                                              src={resolveMediaUrl(med.url)}
                                              alt="Attached media"
                                              className="max-h-64 w-full rounded-xl object-cover transition-transform group-hover:scale-105"
                                              loading="lazy"
                                            />
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
                                              <span className="rounded-lg bg-black/70 px-2.5 py-1 text-xs font-semibold text-white">
                                                🔍 Büyüt
                                              </span>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ) : null}

                                {/* Mesaj Metni */}
                                {msg.text ? (
                                  <p className="whitespace-pre-wrap break-words text-xs sm:text-sm leading-relaxed">
                                    {msg.text}
                                  </p>
                                ) : null}

                                {/* Silinmiş Mesaj Uyarısı */}
                                {isDeleted ? (
                                  <div className={`mt-2.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
                                    isInspectedUser
                                      ? 'bg-amber-500/20 text-amber-100 border border-amber-300/30'
                                      : 'bg-amber-50 text-amber-800 border border-amber-200'
                                  }`}>
                                    ⚠️ Kullanıcı tarafından silindi (Admin Denetim Arşivinde Korunuyor)
                                  </div>
                                ) : null}

                                {/* Alt Bilgi: Tarih & Okunma Durumu */}
                                <div className={`mt-2 flex items-center justify-end gap-2 text-[10px] ${
                                  isInspectedUser ? 'text-blue-100' : 'text-slate-400'
                                }`}>
                                  <span>{new Date(msg.createdAt).toLocaleDateString('tr-TR')}</span>
                                  {msg.readAt ? (
                                    <span className={isInspectedUser ? 'font-bold text-white' : 'font-semibold text-emerald-600'} title={`Okundu: ${new Date(msg.readAt).toLocaleString('tr-TR')}`}>
                                      ✓✓ Okundu
                                    </span>
                                  ) : msg.deliveredAt ? (
                                    <span title="İletildi">✓ İletildi</span>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          )
                        })
                      ) : (
                        <div className="rounded-2xl border border-dashed border-slate-200 py-12 text-center text-xs text-slate-500">
                          {messageSearch ? 'Aramanıza uygun mesaj bulunamadı.' : 'Bu sohbete ait mesaj kaydı bulunamadı.'}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Görünüm 2: Medya Kasası (Media Gallery) */}
                {chatSubTab === 'media' && (
                  <div className="mt-4 flex-1">
                    {activeConversationMedia.length ? (
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                        {activeConversationMedia.map((med) => {
                          const senderId = typeof med.sender === 'object' ? med.sender?._id : med.sender
                          const isFromInspected = String(senderId) === String(user._id)

                          return (
                            <div
                              key={med.key}
                              onClick={() => med.type !== 'audio' && setPreviewMedia({ url: resolveMediaUrl(med.url), type: med.type })}
                              className="group relative aspect-square cursor-pointer overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 shadow-2xs"
                            >
                              {med.type === 'audio' || /\.(webm|ogg|opus|mp3|wav|m4a|aac)(\?.*)?$/i.test(String(med?.url || '')) ? (
                                <div className="flex h-full w-full flex-col justify-between p-3 bg-gradient-to-b from-slate-800 to-slate-900">
                                  <div className="flex items-center justify-between">
                                    <span className="rounded-md bg-amber-500/20 text-amber-300 border border-amber-400/30 px-2 py-0.5 text-[10px] font-bold">
                                      🎙️ Sesli Mesaj
                                    </span>
                                  </div>
                                  <div className="my-auto">
                                    <AudioMessagePlayer
                                      src={med.url}
                                      duration={med.durationSeconds || 0}
                                      variant="admin"
                                    />
                                  </div>
                                  <div className="text-[10px] text-slate-400">
                                    {new Date(med.createdAt).toLocaleDateString('tr-TR')}
                                  </div>
                                </div>
                              ) : med.type === 'video' ? (
                                <video
                                  src={resolveMediaUrl(med.url)}
                                  className="h-full w-full object-cover opacity-85 group-hover:opacity-100"
                                  muted
                                />
                              ) : (
                                <img
                                  src={resolveMediaUrl(med.url)}
                                  alt="Chat media"
                                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                                  loading="lazy"
                                />
                              )}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100 p-2.5 flex flex-col justify-end">
                                <span className="text-[10px] font-semibold text-white">
                                  {isFromInspected ? 'Kullanıcı Gönderdi' : 'Karşı Taraf'}
                                </span>
                                <span className="text-[9px] text-slate-300">
                                  {new Date(med.createdAt).toLocaleDateString('tr-TR')}
                                </span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-200 py-16 text-center text-xs text-slate-500">
                        Bu sohbette henüz fotoğraf, video veya sesli mesaj paylaşılmamış.
                      </div>
                    )}
                  </div>
                )}

                {/* Görünüm 3: Sesli ve Görüntülü Görüşme Kayıtları */}
                {chatSubTab === 'calls' && (
                  <div className="mt-4 flex-1">
                    {activeConversationCallLogs.length ? (
                      <div className="space-y-3">
                        {activeConversationCallLogs.map((log) => {
                          const isVideo = log.callType === 'video'
                          const callerId = String(log.caller?._id || log.caller || '')
                          const isInspectedCaller = callerId === String(user._id)
                          const isCompleted = log.status === 'completed'
                          const isMissed = log.status === 'missed'
                          const isDeclined = log.status === 'declined'

                          return (
                            <div
                              key={log._id || log.callId}
                              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                  <div
                                    className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-lg ${
                                      isVideo
                                        ? 'bg-purple-100 text-purple-700'
                                        : 'bg-emerald-100 text-emerald-700'
                                    }`}
                                  >
                                    {isVideo ? '📹' : '📞'}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-bold text-slate-900">
                                        {isVideo ? 'Görüntülü Arama' : 'Sesli Arama'}
                                      </span>
                                      <span
                                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                          isInspectedCaller
                                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                                        }`}
                                      >
                                        {isInspectedCaller ? 'Arayan: Bu Kullanıcı' : 'Gelen Arama'}
                                      </span>
                                    </div>
                                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                      <span>
                                        Başlatan:{' '}
                                        <strong className="text-slate-700">
                                          {isInspectedCaller ? getFullName(user) : getFullName(otherParticipant)}
                                        </strong>
                                      </span>
                                      <span>•</span>
                                      <span>
                                        📅 {new Date(log.startedAt || log.createdAt).toLocaleDateString('tr-TR', {
                                          day: '2-digit',
                                          month: '2-digit',
                                          year: 'numeric',
                                        })}
                                      </span>
                                      <span>•</span>
                                      <span>
                                        🕒 Başlangıç: {new Date(log.startedAt || log.createdAt).toLocaleTimeString('tr-TR', {
                                          hour: '2-digit',
                                          minute: '2-digit',
                                          second: '2-digit',
                                        })}
                                        {log.endedAt ? ` • Bitiş: ${new Date(log.endedAt).toLocaleTimeString('tr-TR', {
                                          hour: '2-digit',
                                          minute: '2-digit',
                                          second: '2-digit',
                                        })}` : ''}
                                      </span>
                                      {log.durationSec > 0 && (
                                        <>
                                          <span>•</span>
                                          <span className="font-semibold text-slate-700">
                                            ⏱️ {formatCallDuration(log.durationSec)}
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Durum Rozeti */}
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                                      isCompleted
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : isMissed
                                          ? 'bg-amber-100 text-amber-800'
                                          : isDeclined
                                            ? 'bg-rose-100 text-rose-800'
                                            : 'bg-slate-100 text-slate-700'
                                    }`}
                                  >
                                    {isCompleted
                                      ? `✓ Görüşüldü (${formatCallDuration(log.durationSec)})`
                                      : isMissed
                                        ? '📵 Cevapsız'
                                        : isDeclined
                                          ? '🚫 Reddedildi'
                                          : log.status}
                                  </span>
                                </div>
                              </div>

                              {/* Kayıt Oynatıcı / İzleme Alanı */}
                              {log.recordingUrl ? (
                                <div className="mt-3.5 rounded-xl border border-slate-200/80 bg-slate-50/70 p-3">
                                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 pb-2 text-[11px]">
                                    <div className="flex flex-wrap items-center gap-2 font-semibold text-slate-700">
                                      <span>{isVideo ? '🎬 720p HD Video Kaydı' : '🎙️ Ses Kaydı (32kbps Opus)'}</span>
                                      {log.fileSizeBytes && (
                                        <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-mono text-slate-700">
                                          {formatBytes(log.fileSizeBytes)}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <a
                                        href={resolveMediaUrl(log.recordingUrl)}
                                        download={`call-${log.callId}.webm`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                                      >
                                        <span>📥</span>
                                        <span>Kaydı İndir</span>
                                      </a>
                                    </div>
                                  </div>

                                  <div className="mt-2.5">
                                    {isVideo ? (
                                      <div className="flex flex-wrap items-center gap-3">
                                        <button
                                          type="button"
                                          onClick={() => setVideoModalRecording(log)}
                                          className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-purple-700 active:scale-95 cursor-pointer"
                                        >
                                          <span>▶️</span>
                                          <span>720p Video Kaydını İzle</span>
                                        </button>
                                        <span className="text-[11px] text-slate-500">
                                          Düşük boyutlu 720p HD video ve çift taraflı ses kaydı.
                                        </span>
                                      </div>
                                    ) : (
                                      <audio
                                        controls
                                        className="h-9 w-full rounded-lg"
                                        src={resolveMediaUrl(log.recordingUrl)}
                                        preload="metadata"
                                      />
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div className="mt-3 flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2 text-[11px] text-slate-400">
                                  <span>ℹ️</span>
                                  <span>
                                    {isCompleted
                                      ? 'Görüşme kaydı yüklenmedi veya kaydedilmedi.'
                                      : 'Çağrı yanıtlanmadığı için ses/görüntü kaydı bulunmuyor.'}
                                  </span>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-200 py-16 text-center text-xs text-slate-500">
                        Bu sohbette henüz sesli veya görüntülü görüşme kaydı bulunmuyor.
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center py-20 text-center text-slate-500">
                <span className="text-4xl">💬</span>
                <h4 className="mt-3 text-sm font-bold text-slate-900">Sohbet Seçilmedi</h4>
                <p className="mt-1 max-w-xs text-xs text-slate-500">
                  Mesaj geçmişini, silinmiş kayıtları ve medya dosyalarını görüntülemek için sol taraftan bir sohbet seçin.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Conversation Dialog */}
      <ConfirmActionDialog
        isOpen={Boolean(conversationToDelete)}
        title="Sohbeti ve Tüm Mesajları Kalıcı Olarak Sil"
        description={`${conversationToDelete?.participantName || 'Kullanıcı'} ile olan sohbet ve bu sohbetteki ${conversationToDelete?.messageCount || 0} adet mesaj veritabanından kalıcı olarak silinecektir. Bu işlem geri alınamaz.`}
        confirmLabel="Sohbeti Kalıcı Olarak Sil"
        confirmTone="danger"
        reasonLabel="Moderatör Silme Notu (Opsiyonel)"
        reasonPlaceholder="İşlem gerekçesi belirtin"
        isProcessing={isDeletingChat}
        onCancel={() => {
          if (!isDeletingChat) setConversationToDelete(null)
        }}
        onConfirm={handleConfirmDeleteConversation}
      />

      {/* Delete Single Message Dialog */}
      <ConfirmActionDialog
        isOpen={Boolean(messageToDelete)}
        title="Mesajı Kalıcı Olarak Sil"
        description="Bu mesaj ve varsa ekli medyalar veritabanından kalıcı olarak silinecektir. Her iki kullanıcının sohbet akışından da kaybolacaktır."
        confirmLabel="Mesajı Kalıcı Olarak Sil"
        confirmTone="danger"
        reasonLabel="Moderatör Silme Notu (Opsiyonel)"
        reasonPlaceholder="İşlem gerekçesi belirtin"
        isProcessing={isDeletingMsg}
        onCancel={() => {
          if (!isDeletingMsg) setMessageToDelete(null)
        }}
        onConfirm={handleConfirmDeleteMessage}
      />

      {/* Media Lightbox Preview Modal */}
      {previewMedia && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md transition-all"
          onClick={() => setPreviewMedia(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-4xl overflow-hidden rounded-3xl bg-slate-900 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/90 px-5 py-3.5 text-white">
              <span className="text-xs font-semibold text-slate-200">
                {previewMedia.type === 'video' ? '🎥 Video Önizleme' : '📷 Fotoğraf Önizleme'}
              </span>
              <div className="flex items-center gap-2">
                <CopyButton text={previewMedia.url} label="URL Kopyala" />
                <a
                  href={previewMedia.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700"
                >
                  Yeni Sekmede Aç ↗
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewMedia(null)}
                  className="grid h-7 w-7 place-items-center rounded-full bg-slate-800 text-xs font-bold text-slate-300 hover:bg-slate-700 hover:text-white cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="grid place-items-center p-4">
              {previewMedia.type === 'video' ? (
                <video
                  src={previewMedia.url}
                  controls
                  autoPlay
                  className="max-h-[75vh] w-auto max-w-full rounded-2xl shadow-lg"
                />
              ) : (
                <img
                  src={previewMedia.url}
                  alt="Full preview"
                  className="max-h-[75vh] w-auto max-w-full rounded-2xl object-contain shadow-lg"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* 720p Video Call Recording Modal */}
      {videoModalRecording && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-md transition-all"
          onClick={() => setVideoModalRecording(null)}
        >
          <div
            className="relative w-full max-w-4xl overflow-hidden rounded-3xl bg-slate-900 shadow-2xl border border-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/90 px-5 py-3.5 text-white">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">📹 720p HD Görüntülü Görüşme Kaydı</span>
                <span className="rounded-md bg-purple-500/20 border border-purple-400/30 px-2 py-0.5 text-[10px] font-bold text-purple-300">
                  1280x720 • {formatBytes(videoModalRecording.fileSizeBytes || 0)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={resolveMediaUrl(videoModalRecording.recordingUrl)}
                  download={`video-call-${videoModalRecording.callId}.webm`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700"
                >
                  İndir 📥
                </a>
                <button
                  type="button"
                  onClick={() => setVideoModalRecording(null)}
                  className="grid h-7 w-7 place-items-center rounded-full bg-slate-800 text-xs font-bold text-slate-300 hover:bg-slate-700 hover:text-white cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="grid place-items-center bg-black p-4">
              <video
                src={resolveMediaUrl(videoModalRecording.recordingUrl)}
                controls
                autoPlay
                className="max-h-[75vh] w-auto max-w-full rounded-2xl shadow-2xl"
              />
            </div>

            <div className="flex items-center justify-between border-t border-slate-800 bg-slate-950/90 px-5 py-2.5 text-xs text-slate-400">
              <span>
                Kayıt Tarihi: {new Date(videoModalRecording.startedAt || videoModalRecording.createdAt).toLocaleString('tr-TR')}
              </span>
              <span>
                Süre: {formatCallDuration(videoModalRecording.durationSec || 0)}
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
