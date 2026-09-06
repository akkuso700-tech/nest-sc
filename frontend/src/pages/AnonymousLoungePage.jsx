import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../store/AuthContext.jsx'
import { connectSocketClient, disconnectSocketClient } from '../services/socketClient.js'
import {
  getAnonymousProfile,
  getAnonymousRooms,
  getRoomMessages,
  getLoungeSummary,
  randomizeAlias,
  getAvatarByKey,
  deleteAnonymousRoom,
  deleteRoomMessage,
  blockAnonymousUser,
} from '../services/anonymousService.js'
import { AnonymousProfileModal } from '../components/anonymous/AnonymousProfileModal.jsx'
import { AnonymousRoomCreateModal } from '../components/anonymous/AnonymousRoomCreateModal.jsx'
import { GuestLoungeGateModal } from '../components/anonymous/GuestLoungeGateModal.jsx'
import i18n from '../i18n/index.js'
import { loungeTranslations } from '../components/anonymous/loungeTranslations.js'

// Register lounge translations for all supported languages dynamically
Object.entries(loungeTranslations).forEach(([locale, data]) => {
  i18n.addResourceBundle(locale, 'translation', { lounge: data }, true, true)
})

export default function AnonymousLoungePage() {
  const { lang = 'tr' } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { user, isAuthenticated } = useAuth()

  // State: Profile & Status
  const [anonProfile, setAnonProfile] = useState(null)
  const [profileModalOpen, setProfileModalOpen] = useState(false)
  const [createRoomModalOpen, setCreateRoomModalOpen] = useState(false)
  const [gateModalOpen, setGateModalOpen] = useState(false)
  const [gateActionLabel, setGateActionLabel] = useState('')
  const [showExitConfirmModal, setShowExitConfirmModal] = useState(false)
  const [activeMenuId, setActiveMenuId] = useState(null)
  const [confirmDialog, setConfirmDialog] = useState(null)
  const [sentRequestModal, setSentRequestModal] = useState(null)
  const [chatAcceptedModal, setChatAcceptedModal] = useState(null)
  const [revealConfirmModal, setRevealConfirmModal] = useState(null)
  const [showDisclaimerModal, setShowDisclaimerModal] = useState(() => {
    try {
      return !localStorage.getItem('nest_anon_disclaimer_accepted')
    } catch (_) {
      return true
    }
  })
  const [dontShowAgainDisclaimer, setDontShowAgainDisclaimer] = useState(false)
  const [guestTimeoutModalOpen, setGuestTimeoutModalOpen] = useState(false)

  // 20-Second Guest Timer: Non-authenticated visitors get a blurred screen and registration prompt
  useEffect(() => {
    if (isAuthenticated) {
      setGuestTimeoutModalOpen(false)
      return
    }

    const timer = setTimeout(() => {
      setGuestTimeoutModalOpen(true)
    }, 20000)

    return () => clearTimeout(timer)
  }, [isAuthenticated])

  // State: Rooms & Online
  const [rooms, setRooms] = useState([])
  const [summary, setSummary] = useState({ totalRooms: 4, activeParticipants: 1 })
  const [selectedRoom, setSelectedRoom] = useState(null)
  const [roomMessages, setRoomMessages] = useState([])
  const [onlineRadarUsers, setOnlineRadarUsers] = useState([])
  const [radarFilter, setRadarFilter] = useState('all') // 'all', 'female', 'male'

  // State: Direct Chat (1-on-1)
  const [activeDirectSession, setActiveDirectSession] = useState(null)
  const [directMessages, setDirectMessages] = useState([])
  const [incomingDirectRequest, setIncomingDirectRequest] = useState(null)
  const [partnerRequestedReveal, setPartnerRequestedReveal] = useState(false)
  const [myRequestedReveal, setMyRequestedReveal] = useState(false)
  const [revealedUsers, setRevealedUsers] = useState(null)
  const [directChats, setDirectChats] = useState(() => {
    try {
      const saved = localStorage.getItem('nest_anon_direct_chats')
      return saved ? JSON.parse(saved) : []
    } catch (_) {
      return []
    }
  })

  // State: Matchmaking
  const [isMatching, setIsMatching] = useState(false)

  // State: UI Tabs
  const [sideTab, setSideTab] = useState('rooms') // 'rooms', 'chats', 'radar'
  const [mobileTab, setMobileTab] = useState('rooms') // 'rooms', 'radar', 'chat'

  // Input states
  const [messageInput, setMessageInput] = useState('')
  const [isLoadingRooms, setIsLoadingRooms] = useState(true)
  const messagesEndRef = useRef(null)

  // Socket instance ref
  const socketRef = useRef(null)

  // 1. Load initial data
  useEffect(() => {
    let isMounted = true

    async function initLounge() {
      try {
        const [roomsData, summaryData] = await Promise.all([
          getAnonymousRooms(),
          getLoungeSummary().catch(() => ({ totalRooms: 4, activeParticipants: 1 })),
        ])
        if (!isMounted) return
        setRooms(roomsData || [])
        setSummary(summaryData)
        if (roomsData && roomsData.length > 0) {
          setSelectedRoom(roomsData[0])
        }

        if (isAuthenticated) {
          const prof = await getAnonymousProfile()
          if (isMounted) setAnonProfile(prof)
        }
      } catch (err) {
        console.error('Failed to init anonymous lounge:', err)
      } finally {
        if (isMounted) setIsLoadingRooms(false)
      }
    }

    initLounge()

    return () => {
      isMounted = false
    }
  }, [isAuthenticated])

  // 2. Connect to Socket if authenticated
  useEffect(() => {
    if (!isAuthenticated) return

    const socket = connectSocketClient()
    socketRef.current = socket

    // Join lounge
    socket.emit('anon:join_lounge', {}, (res) => {
      if (res?.success) {
        if (res.profile) setAnonProfile(res.profile)
        if (res.onlineUsers) setOnlineRadarUsers(res.onlineUsers)
      }
    })

    // Listeners
    socket.on('anon:user_joined', (newUser) => {
      setOnlineRadarUsers((prev) => {
        const exists = prev.some((u) => u.anonymousId === newUser.anonymousId)
        if (exists) return prev
        return [...prev, newUser]
      })
    })

    socket.on('anon:user_left', ({ anonymousId }) => {
      setOnlineRadarUsers((prev) => prev.filter((u) => u.anonymousId !== anonymousId))
    })

    socket.on('anon:user_status_changed', ({ anonymousId, isBusy }) => {
      setOnlineRadarUsers((prev) =>
        prev.map((u) => (u.anonymousId === anonymousId ? { ...u, isBusy } : u)),
      )
    })

    socket.on('anon:new_room_message', (msg) => {
      setRoomMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev
        return [...prev, msg]
      })
    })

    socket.on('anon:room_count_changed', ({ roomId, activeCount }) => {
      setRooms((prev) =>
        prev.map((r) => (r.id === roomId ? { ...r, activeCount } : r)),
      )
    })

    socket.on('anon:room_message_deleted', ({ messageId }) => {
      setRoomMessages((prev) => prev.filter((m) => m.id !== messageId))
    })

    socket.on('anon:room_deleted', ({ roomId }) => {
      setRooms((prev) => prev.filter((r) => r.id !== roomId))
      setSelectedRoom((prev) => (prev?.id === roomId ? null : prev))
    })

    socket.on('anon:current_room_deleted', () => {
      alert('Bulunduğunuz oda kurucusu tarafından kapatıldı.')
      getAnonymousRooms().then((latestRooms) => {
        if (latestRooms && latestRooms.length > 0) {
          setSelectedRoom(latestRooms[0])
        }
      })
    })

    // 1-on-1 Direct Chat listeners
    socket.on('anon:incoming_direct_request', ({ from }) => {
      setIncomingDirectRequest(from)
    })

    socket.on('anon:direct_started', ({ sessionId, partner }) => {
      setDirectChats((prev) => {
        const exists = prev.find((c) => c.partner?.anonymousId === partner.anonymousId)
        let updated
        if (exists) {
          updated = prev.map((c) =>
            c.partner?.anonymousId === partner.anonymousId
              ? { ...c, sessionId, partner, lastMessageAt: new Date().toISOString() }
              : c
          )
        } else {
          updated = [
            {
              sessionId,
              partner,
              lastMessage: t('lounge.chats.chatStarted', { defaultValue: 'Sohbet başladı' }),
              lastMessageAt: new Date().toISOString(),
              messages: [],
            },
            ...prev,
          ]
        }
        try {
          localStorage.setItem('nest_anon_direct_chats', JSON.stringify(updated))
        } catch (_) {}
        return updated
      })

      setIsMatching(false)
      setIncomingDirectRequest(null)
      setSentRequestModal(null)

      // Karşı taraf sohbeti kabul ettiğinde direkt sohbet ekranına geçme;
      // pop-up bilgilendirmesi ver ve kullanıcı onayladığında sohbet sayfasına gir.
      setChatAcceptedModal({ sessionId, partner })
    })

    socket.on('anon:new_direct_message', (msg) => {
      setDirectMessages((prev) => [...prev, msg])
      setDirectChats((prev) => {
        const updated = prev.map((c) => {
          if (
            c.sessionId === msg.sessionId ||
            c.partner?.anonymousId === msg.senderAnonymousId
          ) {
            return {
              ...c,
              lastMessage: msg.text,
              lastMessageAt: msg.createdAt || new Date().toISOString(),
              messages: [...(c.messages || []), msg],
            }
          }
          return c
        })
        try {
          localStorage.setItem('nest_anon_direct_chats', JSON.stringify(updated))
        } catch (_) {}
        return updated
      })
    })

    socket.on('anon:partner_reveal_requested', () => {
      setPartnerRequestedReveal(true)
    })

    socket.on('anon:identities_fully_revealed', (payload) => {
      setRevealedUsers(payload)
    })

    socket.on('anon:direct_ended', () => {
      setActiveDirectSession(null)
      setDirectMessages([])
      setMyRequestedReveal(false)
      setPartnerRequestedReveal(false)
      setRevealedUsers(null)
      setRevealConfirmModal(null)
    })

    socket.on('anon:direct_rejected', () => {
      setSentRequestModal(null)
      setConfirmDialog({
        title: t('lounge.chats.requestRejectedTitle', { defaultValue: 'Sohbet İsteği Yanıtı' }),
        description: t('lounge.chats.requestRejectedDesc', {
          defaultValue: 'Sohbet isteğiniz kullanıcı tarafından reddedildi veya zaman aşımına uğradı.',
        }),
        icon: '⏳',
        iconBg: 'linear-gradient(135deg, #64748b, #475569)',
        confirmText: t('common.ok', { defaultValue: 'Anladım' }),
        isDanger: false,
        onConfirm: () => setConfirmDialog(null),
      })
    })

    return () => {
      socket.emit('anon:leave_lounge')
      socket.off('anon:user_joined')
      socket.off('anon:user_left')
      socket.off('anon:user_status_changed')
      socket.off('anon:new_room_message')
      socket.off('anon:room_count_changed')
      socket.off('anon:room_message_deleted')
      socket.off('anon:room_deleted')
      socket.off('anon:current_room_deleted')
      socket.off('anon:incoming_direct_request')
      socket.off('anon:direct_started')
      socket.off('anon:new_direct_message')
      socket.off('anon:partner_reveal_requested')
      socket.off('anon:identities_fully_revealed')
      socket.off('anon:direct_ended')
      socket.off('anon:direct_rejected')
      disconnectSocketClient()
    }
  }, [isAuthenticated])

  // Global Outside-Click Listener for 3-dot dropdown menus
  useEffect(() => {
    function handleOutsideClick(e) {
      if (!e.target.closest('[data-dropdown-container]')) {
        setActiveMenuId(null)
      }
    }
    window.addEventListener('click', handleOutsideClick)
    return () => window.removeEventListener('click', handleOutsideClick)
  }, [])

  // 3. Load Room Messages when selectedRoom changes
  useEffect(() => {
    if (!selectedRoom?.id) return

    let isMounted = true
    getRoomMessages(selectedRoom.id)
      .then((msgs) => {
        if (isMounted) setRoomMessages(msgs || [])
      })
      .catch(console.error)

    if (socketRef.current?.connected) {
      socketRef.current.emit('anon:join_room', { roomId: selectedRoom.id })
    }

    return () => {
      isMounted = false
      if (socketRef.current?.connected) {
        socketRef.current.emit('anon:leave_room', { roomId: selectedRoom.id })
      }
    }
  }, [selectedRoom?.id])

  // Auto scroll messages to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [roomMessages, directMessages])

  // Action Guards for Guests
  function requireAuth(actionText, callback) {
    if (!isAuthenticated) {
      setGateActionLabel(actionText)
      setGateModalOpen(true)
      return
    }
    if (callback) callback()
  }

  // Room Message Submit
  function handleSendRoomMessage(e) {
    e.preventDefault()
    const text = messageInput.trim()
    if (!text || !selectedRoom) return

    requireAuth(t('lounge.gateModal.toSendMessage', { defaultValue: 'Odaya mesaj yazmak için' }), () => {
      if (socketRef.current?.connected) {
        socketRef.current.emit('anon:send_room_message', {
          roomId: selectedRoom.id,
          text,
        })
        setMessageInput('')
      }
    })
  }

  // Direct Message Submit
  function handleSendDirectMessage(e) {
    e.preventDefault()
    const text = messageInput.trim()
    if (!text || !activeDirectSession) return

    if (activeDirectSession.isOffline) {
      alert(t('lounge.messages.offlineNotice', { defaultValue: 'Kullanıcı şu anda çevrimdışı olduğu için yeni mesaj gönderilemez.' }))
      return
    }

    if (socketRef.current?.connected) {
      socketRef.current.emit('anon:send_direct_message', {
        sessionId: activeDirectSession.sessionId,
        text,
      })
      setMessageInput('')
    }
  }

  // Select Chat from Sohbet List
  function handleSelectChatFromList(chat) {
    if (
      activeDirectSession &&
      (activeDirectSession.sessionId === chat.sessionId ||
        activeDirectSession.partner?.anonymousId === chat.partner?.anonymousId)
    ) {
      setMobileTab('chat')
      return
    }

    if (activeDirectSession) {
      if (
        !confirm(
          t('lounge.chats.switchChatPrompt', {
            alias: activeDirectSession.partner?.alias,
            defaultValue: `${activeDirectSession.partner?.alias} ile olan mevcut sohbeti sonlandırıp bu sohbete geçmek istiyor musunuz?`,
          })
        )
      ) {
        return
      }
      socketRef.current?.emit('anon:leave_direct', {
        sessionId: activeDirectSession.sessionId,
      })
      setActiveDirectSession(null)
    }

    const onlineUser = onlineRadarUsers.find(
      (u) => u.anonymousId === chat.partner?.anonymousId
    )

    if (onlineUser) {
      handleRequestDirectChat(onlineUser)
    } else {
      setActiveDirectSession({
        sessionId: chat.sessionId,
        partner: chat.partner,
        isOffline: true,
      })
      setDirectMessages(chat.messages || [])
      setMobileTab('chat')
    }
  }

  // Remove Chat from History
  function handleRemoveChat(chatId) {
    setDirectChats((prev) => {
      const updated = prev.filter(
        (c) => c.partner?.anonymousId !== chatId && c.sessionId !== chatId
      )
      try {
        localStorage.setItem('nest_anon_direct_chats', JSON.stringify(updated))
      } catch (_) {}
      return updated
    })
  }

  // Direct Chat Request Handlers
  function handleRequestDirectChat(targetUser) {
    requireAuth(t('lounge.gateModal.toStartChat', { defaultValue: 'Anonim sohbet başlatmak için' }), () => {
      if (socketRef.current?.connected) {
        socketRef.current.emit(
          'anon:direct_request',
          { targetAnonymousId: targetUser.anonymousId },
          (res) => {
            if (res?.success) {
              setSentRequestModal(targetUser)
            } else {
              setConfirmDialog({
                title: t('lounge.chats.requestFailedTitle', { defaultValue: 'İstek Gönderilemedi' }),
                description:
                  res?.error ||
                  t('lounge.chats.requestFailedDesc', {
                    defaultValue: 'Kullanıcıya sohbet isteği iletilemedi. Kullanıcı çevrimdışı veya şu anda meşgul olabilir.',
                  }),
                icon: '⚠️',
                iconBg: 'linear-gradient(135deg, #f59e0b, #d97706)',
                confirmText: t('common.ok', { defaultValue: 'Tamam' }),
                isDanger: false,
                onConfirm: () => setConfirmDialog(null),
              })
            }
          },
        )
      }
    })
  }

  function handleEnterAcceptedChat() {
    if (!chatAcceptedModal) return
    const { sessionId, partner } = chatAcceptedModal
    setActiveDirectSession({ sessionId, partner })
    setDirectMessages([])
    setMobileTab('chat')
    setSideTab('chats')
    setMyRequestedReveal(false)
    setPartnerRequestedReveal(false)
    setRevealedUsers(null)
    setChatAcceptedModal(null)
  }

  function handleAcceptDirectRequest() {
    if (!incomingDirectRequest || !socketRef.current) return
    socketRef.current.emit('anon:direct_accept', {
      requesterAnonymousId: incomingDirectRequest.anonymousId,
    })
    setIncomingDirectRequest(null)
  }

  function handleRejectDirectRequest() {
    if (!incomingDirectRequest || !socketRef.current) return
    socketRef.current.emit('anon:direct_reject', {
      requesterAnonymousId: incomingDirectRequest.anonymousId,
    })
    setIncomingDirectRequest(null)
  }

  // Quick Matchmaking
  function handleToggleQuickMatch() {
    requireAuth(t('lounge.gateModal.toMatchRandom', { defaultValue: 'Rastgele biriyle eşleşmek için' }), () => {
      if (!socketRef.current) return

      if (isMatching) {
        socketRef.current.emit('anon:cancel_quick_match')
        setIsMatching(false)
      } else {
        setIsMatching(true)
        socketRef.current.emit('anon:quick_match', {}, (res) => {
          if (res?.matched) {
            setIsMatching(false)
          } else if (!res?.success) {
            setIsMatching(false)
            alert(res?.error || t('lounge.banner.matchFailed', { defaultValue: 'Eşleşme başlatılamadı.' }))
          }
        })
      }
    })
  }

  // Reveal Identity Modal Triggers
  function handleTriggerRevealModal() {
    if (myRequestedReveal) return
    if (partnerRequestedReveal) {
      setRevealConfirmModal('accept')
    } else {
      setRevealConfirmModal('request')
    }
  }

  function executeRequestReveal() {
    if (!activeDirectSession || !socketRef.current) return
    socketRef.current.emit('anon:reveal_identity_request', {
      sessionId: activeDirectSession.sessionId,
    })
    setMyRequestedReveal(true)
  }

  // Leave Direct Chat
  function handleLeaveDirectChat() {
    setRevealConfirmModal(null)
    if (!activeDirectSession) return
    if (activeDirectSession.isOffline) {
      setActiveDirectSession(null)
      setDirectMessages([])
      setMobileTab('rooms')
      return
    }

    setConfirmDialog({
      icon: '👋',
      iconBg: 'linear-gradient(135deg, #64748b, #334155)',
      title: t('lounge.chats.endChatTitle', { defaultValue: 'Sohbeti Bitir' }),
      description: t('lounge.chats.endChatDesc', {
        defaultValue:
          'Bu birebir anonim sohbetten ayrılmak istediğinize emin misiniz? Sohbet sonlanacak ve mesajlar temizlenecektir.',
      }),
      confirmText: t('lounge.chats.confirmEnd', { defaultValue: 'Sohbeti Bitir' }),
      isDanger: true,
      onConfirm: () => {
        if (socketRef.current) {
          socketRef.current.emit('anon:leave_direct', {
            sessionId: activeDirectSession.sessionId,
          })
        }
        setActiveDirectSession(null)
        setDirectMessages([])
        setMobileTab('rooms')
      },
    })
  }

  // Delete Room Message (Pop-up Onaylı)
  function promptDeleteMessage(msgId) {
    setActiveMenuId(null)
    setConfirmDialog({
      icon: '🗑️',
      iconBg: 'linear-gradient(135deg, #ef4444, #dc2626)',
      title: t('lounge.messages.deleteTitle', { defaultValue: 'Mesajı Sil' }),
      description: t('lounge.messages.deleteDesc', {
        defaultValue:
          'Bu mesajı silmek istediğinize emin misiniz? Mesaj hem sizin hem de odadaki tüm katılımcıların ekranından anında kaldırılacaktır.',
      }),
      confirmText: t('lounge.messages.confirmDelete', { defaultValue: 'Evet, Sil' }),
      isDanger: true,
      onConfirm: async () => {
        if (activeDirectSession) {
          setDirectMessages((prev) => prev.filter((m) => m.id !== msgId))
          return
        }

        try {
          if (socketRef.current?.connected) {
            socketRef.current.emit('anon:delete_room_message', {
              messageId: msgId,
              roomId: selectedRoom?.id,
            })
          } else {
            await deleteRoomMessage(msgId)
            setRoomMessages((prev) => prev.filter((m) => m.id !== msgId))
          }
        } catch (err) {
          alert(err.message || 'Mesaj silinemedi.')
        }
      },
    })
  }

  // Delete Custom Room (Pop-up Onaylı)
  function promptDeleteRoom(room) {
    setActiveMenuId(null)
    if (!room) return
    setConfirmDialog({
      icon: '🗑️',
      iconBg: 'linear-gradient(135deg, #ef4444, #991b1b)',
      title: t('lounge.rooms.deleteTitle', { defaultValue: 'Odayı Sil ve Kapat' }),
      description: t('lounge.rooms.deleteDesc', {
        roomName: room.name,
        defaultValue: `"${room.name}" odasını ve içindeki tüm sohbet geçmişini kalıcı olarak silmek istediğinize emin misiniz? Odadaki herkes ana odaya aktarılacaktır.`,
      }),
      confirmText: t('lounge.rooms.confirmDelete', { defaultValue: 'Evet, Odayı Sil' }),
      isDanger: true,
      onConfirm: async () => {
        try {
          if (socketRef.current?.connected) {
            socketRef.current.emit('anon:delete_room', { roomId: room.id })
          } else {
            await deleteAnonymousRoom(room.id)
          }
          const latestRooms = await getAnonymousRooms()
          setRooms(latestRooms || [])
          if (latestRooms && latestRooms.length > 0) {
            setSelectedRoom(latestRooms[0])
          }
        } catch (err) {
          alert(err.message || 'Oda silinemedi.')
        }
      },
    })
  }

  // Block Anonymous User (Pop-up Onaylı)
  function promptBlockUser(targetAnonymousId, targetAlias) {
    setActiveMenuId(null)
    setConfirmDialog({
      icon: '🚫',
      iconBg: 'linear-gradient(135deg, #f97316, #dc2626)',
      title: t('lounge.radar.blockTitle', { defaultValue: 'Kullanıcıyı Engelle' }),
      description: t('lounge.radar.blockDesc', {
        alias: targetAlias || 'Bu kullanıcıyı',
        defaultValue: `"${targetAlias || 'Bu kullanıcıyı'}" engellemek istediğinize emin misiniz? Mevcut sohbet sonlandırılacak, bu kullanıcı size bir daha mesaj gönderemeyecek ve radarda görünmeyecektir.`,
      }),
      confirmText: t('lounge.radar.confirmBlock', { defaultValue: 'Evet, Engelle' }),
      isDanger: true,
      onConfirm: async () => {
        try {
          if (socketRef.current?.connected) {
            socketRef.current.emit('anon:block_user', { targetAnonymousId })
          } else {
            await blockAnonymousUser(targetAnonymousId)
          }

          setAnonProfile((prev) => ({
            ...prev,
            blockedAnonymousIds: [...(prev?.blockedAnonymousIds || []), targetAnonymousId],
          }))

          if (activeDirectSession && activeDirectSession.partner?.anonymousId === targetAnonymousId) {
            setActiveDirectSession(null)
            setDirectMessages([])
            setMobileTab('rooms')
          }

          handleRemoveChat(targetAnonymousId)
          setOnlineRadarUsers((prev) => prev.filter((u) => u.anonymousId !== targetAnonymousId))
        } catch (err) {
          alert(err.message || 'Kullanıcı engellenemedi.')
        }
      },
    })
  }

  // Randomize Alias
  async function handleFastRandomize() {
    try {
      const res = await randomizeAlias()
      setAnonProfile(res)
    } catch (err) {
      console.error(err)
    }
  }

  // Filtered radar users
  const filteredRadarUsers = useMemo(() => {
    if (radarFilter === 'all') return onlineRadarUsers
    return onlineRadarUsers.filter((u) => u.gender === radarFilter)
  }, [onlineRadarUsers, radarFilter])

  const currentAvatar = getAvatarByKey(anonProfile?.avatarKey)

  return (
    <div className={`h-[100dvh] overflow-hidden bg-bg text-text flex flex-col ${mobileTab === 'chat' ? 'pt-0 lg:pt-14' : 'pt-14'} pb-0 sm:pb-2`}>
      {/* 56px Top Fixed Navbar */}
      <header className={`fixed top-0 inset-x-0 z-50 h-14 border-b border-border bg-[rgb(var(--color-card)/0.95)] backdrop-blur px-3 sm:px-4 items-center justify-between gap-3 shadow-sm ${mobileTab === 'chat' ? 'hidden lg:flex' : 'flex'}`}>
        {/* Left: Geri Dön Butonu & Başlık */}
        {/* Left: Geri Dön Butonu & Başlık */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setShowExitConfirmModal(true)}
            className="size-8 sm:size-9 rounded-md border border-border bg-secondary/80 flex items-center justify-center text-text hover:bg-secondary hover:text-primary transition-all shrink-0 shadow-sm"
            title={t('lounge.header.backToNest', { defaultValue: "Nest Social'e Dön" })}
            aria-label={t('lounge.header.backToNest', { defaultValue: "Nest Social'e Dön" })}
          >
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>

          <span className="hidden md:block h-5 w-px bg-border shrink-0" />

          <div className="flex flex-col justify-center min-w-0">
            <span className="text-xs sm:text-sm font-bold text-text truncate">
              {t('lounge.header.title', { defaultValue: 'Gizli Profil & Anonim Lounge' })}
            </span>
            <p className="hidden xl:block text-[11px] text-muted truncate max-w-[340px]">
              {t('lounge.header.subtitle', {
                defaultValue:
                  'Burada kimliğin tamamen gizli! Gerçek profilin gizlenir, otomatik rumuzla sohbet edersin.',
              })}
            </p>
          </div>
        </div>

        {/* Center: Live Stats (Desktop) */}
        <div className="hidden lg:flex items-center gap-2 text-xs text-muted shrink-0">
          <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary/60 px-2.5 py-1">
            <span className="size-2 rounded-full bg-emerald-500" />
            <strong className="text-text">{onlineRadarUsers.length + 1}</strong>
            <span className="text-[11px]">
              {t('lounge.header.onlineCount', { defaultValue: 'Çevrimiçi Anonim' })}
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary/60 px-2.5 py-1">
            <span className="size-2 rounded-full bg-primary" />
            <strong className="text-text">{rooms.length}</strong>
            <span className="text-[11px]">
              {t('lounge.header.roomCount', { defaultValue: 'Aktif Sohbet Odası' })}
            </span>
          </span>
        </div>

        {/* Right: Quick Match + Secret Profile */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Kader Çarkı Butonu (Profil logosunun solunda) */}
          <button
            type="button"
            onClick={handleToggleQuickMatch}
            className={`inline-flex items-center justify-center rounded-md px-3 py-1.5 text-xs font-semibold transition-all shadow-xs shrink-0 ${
              isMatching
                ? 'border border-amber-500/40 bg-amber-500/15 text-amber-600 dark:text-amber-400 animate-pulse'
                : 'border border-primary/30 bg-primary/10 text-primary hover:bg-primary/15 active:scale-95'
            }`}
            title={t('lounge.header.wheelTitle', { defaultValue: 'Kader Çarkı: Hızlı Eşleş' })}
          >
            <span>
              {isMatching
                ? t('lounge.header.matching', { defaultValue: 'Eşleşiyor...' })
                : t('lounge.header.wheelBtn', { defaultValue: 'Kader Çarkı' })}
            </span>
          </button>

          {/* Profil Alanı */}
          {isAuthenticated && anonProfile ? (
            <>
              {/* Mobilde Profil Alanı: Sadece Avatar (Tıklandığında Düzenleme Modalını Açar) */}
              <button
                type="button"
                onClick={() => setProfileModalOpen(true)}
                className="md:hidden size-8 rounded-md flex items-center justify-center text-lg shadow-xs border border-border shrink-0 active:scale-95 transition-transform"
                style={{ background: currentAvatar.bgStyle }}
                title={`${anonProfile.alias} - ${t('lounge.actions.save', { defaultValue: 'Profili Düzenle' })}`}
                aria-label={t('lounge.profileModal.title', { defaultValue: 'Gizli Profili Düzenle' })}
              >
                {currentAvatar.emoji}
              </button>

              {/* Masaüstünde Kullanıcı Bilgisi ve Düzenle Butonu */}
              <div className="hidden md:flex items-center gap-2 rounded-md border border-border bg-secondary/80 px-2.5 py-1">
                <button
                  type="button"
                  onClick={() => setProfileModalOpen(true)}
                  className="size-8 rounded-md flex items-center justify-center text-base shadow-sm shrink-0 hover:opacity-90 transition-opacity"
                  style={{ background: currentAvatar.bgStyle }}
                  title={t('lounge.profileModal.title', { defaultValue: 'Profili Düzenle' })}
                >
                  {currentAvatar.emoji}
                </button>
                <div className="flex flex-col text-left max-w-[120px] lg:max-w-[150px]">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-bold text-text truncate">
                      {anonProfile.alias}
                    </span>
                    <button
                      type="button"
                      onClick={handleFastRandomize}
                      className="text-muted hover:text-text text-xs transition-transform active:rotate-180"
                      title={t('lounge.profileModal.refresh', { defaultValue: 'Yeni Rumuz Çevir' })}
                    >
                      🎲
                    </button>
                  </div>
                  <span className="text-[10px] text-muted truncate">
                    {anonProfile.status || t('lounge.profileModal.defaultStatus', { defaultValue: 'Yeni katıldım 🌟' })}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setProfileModalOpen(true)}
                  className="rounded-md border border-border bg-card px-2 py-1 text-[11px] font-semibold text-text hover:bg-secondary transition-colors shrink-0"
                >
                  {t('common.edit', { defaultValue: 'Düzenle' })}
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                setGateActionLabel(t('lounge.gateModal.defaultAction', { defaultValue: 'Anonim Lounge’a Katılmak İçin' }))
                setGateModalOpen(true)
              }}
              className="rounded-md bg-primary px-2.5 sm:px-3 py-1.5 text-xs font-semibold !text-white shadow hover:bg-primary-hover active:scale-95 transition-all flex items-center gap-1.5 shrink-0"
            >
              <span>🔐</span>
              <span className="hidden sm:inline">
                {t('lounge.header.loginToJoin', { defaultValue: 'Giriş Yaparak Katıl' })}
              </span>
              <span className="sm:hidden">
                {t('lounge.header.loginShort', { defaultValue: 'Giriş' })}
              </span>
            </button>
          )}
        </div>
      </header>

      <div className="max-w-7xl mx-auto w-full p-0 sm:px-6 sm:py-2 flex-1 flex flex-col min-h-0">

        {/* Incoming 1-on-1 Request Banner */}
        {incomingDirectRequest && (
          <div className="m-2 sm:m-0 sm:mb-3 rounded-md border border-primary bg-card p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3">
              <span className="text-2xl">✨</span>
              <div>
                <p className="text-xs sm:text-sm font-semibold text-text">
                  <strong>{incomingDirectRequest.alias}</strong>{' '}
                  {t('lounge.banner.wantsToChat', {
                    defaultValue: 'seninle özel 1-e-1 anonim sohbet başlatmak istiyor!',
                  })}
                </p>
                <p className="text-[11px] text-muted">
                  {t('lounge.banner.gender', { defaultValue: 'Cinsiyet' })}:{' '}
                  {incomingDirectRequest.gender === 'female'
                    ? t('lounge.genders.female', { defaultValue: 'Kadın 👩' })
                    : incomingDirectRequest.gender === 'male'
                      ? t('lounge.genders.male', { defaultValue: 'Erkek 👨' })
                      : t('lounge.genders.unspecified', { defaultValue: 'Gizli' })}{' '}
                  • {t('lounge.banner.age', { defaultValue: 'Yaş' })}: {incomingDirectRequest.ageRange}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleRejectDirectRequest}
                className="flex-1 sm:flex-initial rounded-md border border-border bg-secondary px-3.5 py-1.5 text-xs text-text hover:bg-secondary-hover"
              >
                {t('lounge.banner.reject', { defaultValue: 'Reddet' })}
              </button>
              <button
                type="button"
                onClick={handleAcceptDirectRequest}
                className="flex-1 sm:flex-initial rounded-md bg-primary px-4 py-1.5 text-xs font-bold !text-white shadow hover:bg-primary-hover"
              >
                {t('lounge.banner.accept', { defaultValue: 'Kabul Et ve Başla' })}
              </button>
            </div>
          </div>
        )}

        {/* Main Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 sm:gap-6 flex-1 min-h-0">
          {/* Left Column: Unified Segmented Panel (Rooms / Radar) */}
          <div
            className={`lg:col-span-5 rounded-none sm:rounded-md border-0 sm:border border-border bg-card flex flex-col h-full shadow-none sm:shadow-sm overflow-hidden min-h-0 ${
              mobileTab === 'chat' ? 'hidden lg:flex' : 'flex'
            }`}
          >
            {/* Segmented Tab Header (Button Group: Odalar, Sohbet, Çevrimiçi) */}
            <div className="px-2 py-1.5 sm:px-3 sm:py-2 border-b border-border bg-secondary/30 flex items-center justify-between gap-1.5 shrink-0">
              <div className="flex items-center gap-0.5 sm:gap-1 bg-secondary p-0.5 rounded-md border border-border">
                <button
                  type="button"
                  onClick={() => {
                    setSideTab('rooms')
                    setMobileTab('rooms')
                  }}
                  className={`px-2 sm:px-2.5 py-1 rounded-md text-[11px] sm:text-xs font-semibold transition-all ${
                    sideTab === 'rooms'
                      ? 'bg-card text-text shadow-sm border border-border'
                      : 'text-muted hover:text-text'
                  }`}
                >
                  {t('lounge.tabs.rooms', { defaultValue: 'Odalar' })} ({rooms.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSideTab('chats')
                    setMobileTab('rooms')
                  }}
                  className={`px-2 sm:px-2.5 py-1 rounded-md text-[11px] sm:text-xs font-semibold transition-all ${
                    sideTab === 'chats'
                      ? 'bg-card text-text shadow-sm border border-border'
                      : 'text-muted hover:text-text'
                  }`}
                >
                  {t('lounge.tabs.chats', { defaultValue: 'Sohbet' })} ({directChats.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSideTab('radar')
                    setMobileTab('radar')
                  }}
                  className={`px-2 sm:px-2.5 py-1 rounded-md text-[11px] sm:text-xs font-semibold transition-all ${
                    sideTab === 'radar'
                      ? 'bg-card text-text shadow-sm border border-border'
                      : 'text-muted hover:text-text'
                  }`}
                >
                  {t('lounge.tabs.radar', { defaultValue: 'Çevrimiçi' })} ({onlineRadarUsers.length})
                </button>
              </div>

              {/* Action depending on active side tab */}
              {sideTab === 'rooms' && (
                <button
                  type="button"
                  onClick={() =>
                    requireAuth(
                      t('lounge.actions.createRoom', { defaultValue: 'Oda açmak için' }),
                      () => setCreateRoomModalOpen(true),
                    )
                  }
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[11px] sm:text-xs font-semibold text-text hover:bg-secondary transition-colors shrink-0"
                >
                  <span>+</span>
                  <span>{t('lounge.actions.createRoom', { defaultValue: 'Oda Aç' })}</span>
                </button>
              )}
              {sideTab === 'chats' && directChats.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSideTab('radar')}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[11px] sm:text-xs font-semibold text-text hover:bg-secondary transition-colors shrink-0"
                >
                  <span>+</span>
                  <span>{t('lounge.actions.newChat', { defaultValue: 'Yeni Sohbet' })}</span>
                </button>
              )}
              {sideTab === 'radar' && (
                <div className="flex gap-0.5 bg-secondary p-0.5 rounded-md text-[10px] border border-border shrink-0">
                  <button
                    type="button"
                    onClick={() => setRadarFilter('all')}
                    className={`px-1.5 py-0.5 rounded-md ${radarFilter === 'all' ? 'bg-primary !text-white font-bold' : 'text-muted'}`}
                  >
                    {t('lounge.tabs.all', { defaultValue: 'Tümü' })}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRadarFilter('female')}
                    className={`px-1.5 py-0.5 rounded-md ${radarFilter === 'female' ? 'bg-primary !text-white font-bold' : 'text-muted'}`}
                  >
                    {t('lounge.tabs.female', { defaultValue: 'Kadın 👩' })}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRadarFilter('male')}
                    className={`px-1.5 py-0.5 rounded-md ${radarFilter === 'male' ? 'bg-primary !text-white font-bold' : 'text-muted'}`}
                  >
                    {t('lounge.tabs.male', { defaultValue: 'Erkek 👨' })}
                  </button>
                </div>
              )}
            </div>

            {/* List Body */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
              {sideTab === 'rooms' ? (
                /* Rooms List */
                rooms.map((room) => {
                  const isSelected = selectedRoom?.id === room.id && !activeDirectSession
                  return (
                    <div
                      key={room.id}
                      onClick={() => {
                        setActiveDirectSession(null)
                        setSelectedRoom(room)
                        setMobileTab('chat')
                      }}
                      role="button"
                      tabIndex={0}
                      className={`relative flex items-center justify-between p-3 rounded-md cursor-pointer border transition-all duration-150 ${
                        isSelected
                          ? 'border-primary/50 bg-secondary/70 shadow-xs'
                          : 'border-border bg-card hover:bg-secondary/40 hover:border-border-strong'
                      }`}
                    >
                      {/* Sol aktiflik gösterge çizgisi */}
                      {isSelected && (
                        <div className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-primary" />
                      )}

                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-2xl shrink-0">{room.icon || '💬'}</span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-xs font-bold truncate ${
                                isSelected ? 'text-primary' : 'text-text'
                              }`}
                            >
                              {room.name}
                            </span>
                            {room.isSystem && (
                              <span className="rounded-md bg-secondary border border-border px-1.5 py-0.5 text-[9px] font-semibold text-muted shrink-0">
                                {t('lounge.rooms.fixed', { defaultValue: 'Sabit' })}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted line-clamp-1">
                            {room.topic || t('lounge.rooms.defaultTopic', { defaultValue: 'Genel anonim sohbet' })}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span
                          className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold transition-colors ${
                            isSelected
                              ? 'bg-primary/10 border-primary/20 text-primary'
                              : 'bg-secondary border-border text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          <span
                            className={`size-1.5 rounded-full ${
                              isSelected ? 'bg-primary animate-pulse' : 'bg-emerald-500'
                            }`}
                          />
                          {room.activeCount || 0}
                        </span>
                      </div>
                    </div>
                  )
                })
              ) : sideTab === 'chats' ? (
                /* Chats List (Mesajlaşılan Kişiler) */
                directChats.length === 0 ? (
                  <div className="py-12 text-center text-xs text-muted">
                    <p className="text-3xl mb-2">💬</p>
                    <p className="font-semibold text-text">{t('lounge.chats.empty', { defaultValue: 'Henüz sohbet geçmişiniz yok' })}</p>
                    <p className="text-[11px] opacity-75 mt-1 max-w-[240px] mx-auto">
                      {t('lounge.chats.emptySub', { defaultValue: 'Çevrimiçi sekmesindeki kullanıcılardan sohbet başlatabilir veya Kader Çarkı ile hemen eşleşebilirsiniz.' })}
                    </p>
                    <button
                      type="button"
                      onClick={() => setSideTab('radar')}
                      className="mt-3.5 rounded-md bg-primary px-3.5 py-1.5 text-xs font-semibold !text-white shadow hover:bg-primary-hover transition-colors inline-block"
                    >
                      {t('lounge.chats.viewOnline', { defaultValue: 'Çevrimiçi Kullanıcıları Gör' })}
                    </button>
                  </div>
                ) : (
                  directChats.map((chat) => {
                    const isOnline = onlineRadarUsers.some(
                      (u) => u.anonymousId === chat.partner?.anonymousId
                    )
                    const isCurrentActive =
                      activeDirectSession &&
                      (activeDirectSession.sessionId === chat.sessionId ||
                        activeDirectSession.partner?.anonymousId === chat.partner?.anonymousId)
                    const avatar = getAvatarByKey(chat.partner?.avatarKey)

                    return (
                      <div
                        key={chat.partner?.anonymousId || chat.sessionId}
                        onClick={() => handleSelectChatFromList(chat)}
                        role="button"
                        tabIndex={0}
                        className={`relative flex items-center justify-between p-2.5 sm:p-3 rounded-md cursor-pointer border transition-all duration-150 ${
                          isCurrentActive
                            ? 'border-primary/50 bg-secondary/70 shadow-xs'
                            : 'border-border bg-card hover:bg-secondary/40 hover:border-border-strong'
                        }`}
                      >
                        {/* Sol aktiflik gösterge çizgisi */}
                        {isCurrentActive && (
                          <div className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-primary" />
                        )}

                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="relative shrink-0">
                            <div
                              className="size-9 rounded-md flex items-center justify-center text-lg shadow-sm"
                              style={{ background: avatar.bgStyle }}
                            >
                              {avatar.emoji}
                            </div>
                            <span
                              className={`absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-card ${
                                isOnline ? 'bg-emerald-500' : 'bg-zinc-400 dark:bg-zinc-600'
                              }`}
                              title={isOnline ? t('lounge.chats.online', { defaultValue: 'Çevrimiçi' }) : t('lounge.chats.offline', { defaultValue: 'Çevrimdışı' })}
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`text-xs font-bold truncate ${
                                  isCurrentActive ? 'text-primary' : 'text-text'
                                }`}
                              >
                                {chat.partner?.alias}
                              </span>
                              {isCurrentActive && (
                                <span className="rounded-md bg-primary/10 border border-primary/20 text-primary px-1.5 py-0.5 text-[9px] font-bold">
                                  {t('lounge.chats.active', { defaultValue: 'Aktif' })}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-muted truncate max-w-[150px] sm:max-w-[200px]">
                              {chat.lastMessage || t('lounge.chats.chatStarted', { defaultValue: 'Sohbet başlatıldı' })}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-right">
                            <span className="text-[10px] text-muted block">
                              {chat.lastMessageAt
                                ? new Date(chat.lastMessageAt).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : ''}
                            </span>
                            <span
                              className={`text-[9px] ${
                                isOnline
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-muted'
                              }`}
                            >
                              {isOnline ? t('lounge.chats.online', { defaultValue: 'Çevrimiçi' }) : t('lounge.chats.offline', { defaultValue: 'Çevrimdışı' })}
                            </span>
                          </div>

                          {/* 3 Nokta ⋮ Menüsü (Sohbeti Kaldır veya Kullanıcıyı Engelle) */}
                          <div className="relative" data-dropdown-container>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                const mKey = `chat_item_${chat.partner?.anonymousId || chat.sessionId}`
                                setActiveMenuId(activeMenuId === mKey ? null : mKey)
                              }}
                              className="text-muted hover:text-text p-1.5 rounded hover:bg-secondary transition-colors"
                              title={t('lounge.chats.actions', { defaultValue: 'İşlemler' })}
                            >
                              <svg className="size-3.5" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                              </svg>
                            </button>

                            {activeMenuId === `chat_item_${chat.partner?.anonymousId || chat.sessionId}` && (
                              <div
                                className="absolute right-0 top-full mt-1 z-30 w-40 rounded-md bg-card border border-border shadow-lg py-1 text-xs"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveMenuId(null)
                                    handleRemoveChat(chat.partner?.anonymousId || chat.sessionId)
                                  }}
                                  className="w-full text-left px-3 py-1.5 text-text hover:bg-secondary flex items-center gap-2 transition-colors"
                                >
                                  <span>✕</span>
                                  <span>{t('lounge.chats.removeChat', { defaultValue: 'Sohbeti Kaldır' })}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    promptBlockUser(chat.partner?.anonymousId, chat.partner?.alias)
                                  }
                                  className="w-full text-left px-3 py-1.5 text-red-500 hover:bg-secondary flex items-center gap-2 transition-colors font-semibold"
                                >
                                  <span>🚫</span>
                                  <span>{t('lounge.chats.block', { defaultValue: 'Engelle' })}</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })
                )
              ) : (
                /* Radar Users List */
                filteredRadarUsers.length === 0 ? (
                  <div className="py-12 text-center text-xs text-muted">
                    <p className="text-2xl mb-1">🛰️</p>
                    <p>{t('lounge.radar.empty', { defaultValue: 'Şu an radarda eşleşen başka kullanıcı yok.' })}</p>
                    <p className="text-[10px] opacity-75 mt-1">{t('lounge.radar.emptyDesc', { defaultValue: 'Arkadaşlarını davet et veya odalara katıl!' })}</p>
                  </div>
                ) : (
                  filteredRadarUsers.map((rUser) => {
                    const avatar = getAvatarByKey(rUser.avatarKey)
                    return (
                      <div
                        key={rUser.anonymousId}
                        className="flex items-center justify-between p-2.5 rounded-md border border-border bg-card hover:bg-secondary/60 transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className="size-9 rounded-md flex items-center justify-center text-lg shadow-sm"
                            style={{ background: avatar.bgStyle }}
                          >
                            {avatar.emoji}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-text">
                                {rUser.alias}
                              </span>
                              {rUser.isBusy && (
                                <span className="text-[9px] text-amber-500 bg-secondary border border-border px-1 rounded-md">
                                  {t('lounge.radar.busy', { defaultValue: 'Sohbette' })}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-muted">
                              {rUser.gender === 'female' ? t('lounge.genders.female', { defaultValue: 'Kadın 👩' }) : rUser.gender === 'male' ? t('lounge.genders.male', { defaultValue: 'Erkek 👨' }) : t('lounge.genders.unspecified', { defaultValue: 'Belirtilmedi' })} • {rUser.ageRange}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            disabled={rUser.isBusy}
                            onClick={() => handleRequestDirectChat(rUser)}
                            className="rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-semibold text-text hover:bg-secondary-hover active:scale-95 disabled:opacity-40 transition-all"
                          >
                            {t('lounge.radar.startChat', { defaultValue: 'Sohbet Başlat' })}
                          </button>

                          {/* Radar 3 Nokta ⋮ Menüsü (Engelle) */}
                          <div className="relative" data-dropdown-container>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                const mKey = `radar_item_${rUser.anonymousId}`
                                setActiveMenuId(activeMenuId === mKey ? null : mKey)
                              }}
                              className="text-muted hover:text-text p-1.5 rounded hover:bg-secondary transition-colors"
                              title={t('lounge.radar.actions', { defaultValue: 'İşlemler' })}
                            >
                              <svg className="size-3.5" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                              </svg>
                            </button>

                            {activeMenuId === `radar_item_${rUser.anonymousId}` && (
                              <div
                                className="absolute right-0 top-full mt-1 z-30 w-36 rounded-md bg-card border border-border shadow-lg py-1 text-xs"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  onClick={() => promptBlockUser(rUser.anonymousId, rUser.alias)}
                                  className="w-full text-left px-3 py-1.5 text-red-500 hover:bg-secondary flex items-center gap-2 transition-colors font-semibold"
                                >
                                  <span>🚫</span>
                                  <span>{t('lounge.chats.block', { defaultValue: 'Engelle' })}</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })
                )
              )}
            </div>
          </div>

          {/* Right Column: Active Chat Area (Room or 1-on-1 Direct) */}
          <div
            className={`lg:col-span-7 rounded-none sm:rounded-md border-0 sm:border border-border bg-card flex flex-col h-full shadow-none sm:shadow-sm min-h-0 overflow-hidden ${
              mobileTab !== 'chat' ? 'hidden lg:flex' : 'flex'
            }`}
          >
            {/* Chat Header (Mobilde Navbar yerine geçen ana üst bar) */}
            <div className="h-14 px-3 sm:px-4 border-b border-border flex items-center justify-between bg-[rgb(var(--color-card)/0.95)] sm:bg-secondary/30 backdrop-blur sm:backdrop-blur-none rounded-t-none sm:rounded-t-md shrink-0">
              {activeDirectSession ? (
                // 1-on-1 Header
                <div className="flex items-center justify-between w-full min-w-0">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => setMobileTab('rooms')}
                      className="lg:hidden size-8 rounded-md border border-border bg-secondary/80 flex items-center justify-center text-text hover:bg-secondary hover:text-primary transition-all shrink-0 mr-0.5"
                      aria-label={t('common.back', { defaultValue: 'Geri Dön' })}
                      title={t('lounge.header.backToChats', { defaultValue: 'Sohbet Listesine Dön' })}
                    >
                      <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                      </svg>
                    </button>
                    <div
                      className="size-8 sm:size-9 rounded-md flex items-center justify-center text-base sm:text-lg shadow-sm shrink-0"
                      style={{ background: getAvatarByKey(activeDirectSession.partner?.avatarKey).bgStyle }}
                    >
                      {getAvatarByKey(activeDirectSession.partner?.avatarKey).emoji}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xs sm:text-sm font-bold text-text truncate">
                        {activeDirectSession.partner?.alias}
                      </h3>
                      <p className="text-[10px] sm:text-[11px] text-muted truncate">
                        {activeDirectSession.partner?.gender === 'female' ? t('lounge.genders.female', { defaultValue: 'Kadın 👩' }) : activeDirectSession.partner?.gender === 'male' ? t('lounge.genders.male', { defaultValue: 'Erkek 👨' }) : t('lounge.genders.unspecified', { defaultValue: 'Gizli' })} • {activeDirectSession.partner?.ageRange}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                    {/* Reveal Identity Button */}
                    {!revealedUsers ? (
                      <button
                        type="button"
                        onClick={handleTriggerRevealModal}
                        disabled={myRequestedReveal}
                        className={`rounded-md px-2 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-xs font-bold transition-all flex items-center gap-1 ${
                          myRequestedReveal
                            ? 'bg-secondary text-muted border border-border cursor-not-allowed opacity-75'
                            : partnerRequestedReveal
                            ? 'bg-emerald-600 hover:bg-emerald-700 !text-white shadow-sm animate-pulse'
                            : 'border border-border bg-secondary text-text hover:bg-secondary-hover'
                        }`}
                        title={
                          myRequestedReveal
                            ? t('lounge.reveal.tooltipWaiting', { defaultValue: 'Karşı tarafın onaylaması bekleniyor...' })
                            : partnerRequestedReveal
                            ? t('lounge.reveal.tooltipAccept', { defaultValue: 'Karşı taraf gerçek kimlikleri açmak istiyor! Tıklayarak onaylayın.' })
                            : t('lounge.reveal.tooltipDefault', { defaultValue: 'İki taraf da kabul ederse gerçek sosyal medya profilleriniz açılır!' })
                        }
                      >
                        <span>🎭</span>
                        <span>
                          {myRequestedReveal
                            ? t('lounge.reveal.waiting', { defaultValue: 'Bekleniyor...' })
                            : partnerRequestedReveal
                            ? t('lounge.reveal.acceptButton', { defaultValue: 'Maske (Kabul Et)' })
                            : t('lounge.reveal.revealButton', { defaultValue: 'Maske' })}
                        </span>
                      </button>
                    ) : null}

                    <button
                      type="button"
                      onClick={handleLeaveDirectChat}
                      className="rounded-md border border-red-500/30 bg-red-500/10 px-2.5 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-xs font-semibold text-red-500 hover:bg-red-500/20 shrink-0"
                    >
                      {t('lounge.chats.endChat', { defaultValue: 'Bitir' })}
                    </button>

                    {/* Dikey 3 Nokta ⋮ Menüsü (Kullanıcı Engelleme) */}
                    <div className="relative shrink-0" data-dropdown-container>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setActiveMenuId(activeMenuId === 'direct_header' ? null : 'direct_header')
                        }}
                        className="size-8 rounded-md border border-border bg-secondary/80 flex items-center justify-center text-text hover:bg-secondary hover:text-primary transition-all shrink-0"
                        title={t('lounge.header.otherOptions', { defaultValue: 'Diğer Seçenekler' })}
                        aria-label={t('lounge.header.chatOptions', { defaultValue: 'Sohbet Seçenekleri' })}
                      >
                        <svg className="size-4" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                        </svg>
                      </button>

                      {activeMenuId === 'direct_header' && (
                        <div
                          className="absolute right-0 top-full mt-1 z-30 w-44 rounded-md bg-card border border-border shadow-lg py-1 text-xs"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              promptBlockUser(
                                activeDirectSession.partner?.anonymousId,
                                activeDirectSession.partner?.alias,
                              )
                            }
                            className="w-full text-left px-3 py-1.5 text-red-500 hover:bg-secondary flex items-center gap-2 transition-colors font-semibold"
                          >
                            <span>🚫</span>
                            <span>{t('lounge.chats.blockUser', { defaultValue: 'Kullanıcıyı Engelle' })}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : selectedRoom ? (
                // Room Header
                <div className="flex items-center justify-between w-full min-w-0">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => setMobileTab('rooms')}
                      className="lg:hidden size-8 rounded-md border border-border bg-secondary/80 flex items-center justify-center text-text hover:bg-secondary hover:text-primary transition-all shrink-0 mr-0.5"
                      aria-label={t('common.back', { defaultValue: 'Geri Dön' })}
                      title={t('lounge.header.backToRooms', { defaultValue: 'Odalara Dön' })}
                    >
                      <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                      </svg>
                    </button>
                    <span className="text-xl sm:text-2xl shrink-0">{selectedRoom.icon}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-xs sm:text-sm font-bold text-text truncate">{selectedRoom.name}</h3>
                        <span className="text-[10px] text-muted flex items-center gap-1 shrink-0">
                          <span className="size-1.5 rounded-full bg-emerald-500" />
                          {selectedRoom.activeCount || 1} {t('lounge.rooms.live', { defaultValue: 'canlı' })}
                        </span>
                      </div>
                      <p className="text-[10px] sm:text-[11px] text-muted truncate">
                        {selectedRoom.topic}
                      </p>
                    </div>
                  </div>

                  {/* Oda Kurucusuna Özel Dikey 3 Nokta ⋮ Menüsü (Odayı Silme) */}
                  {!selectedRoom.isSystem &&
                    (selectedRoom.createdBy === (user?.id || user?._id) ||
                      selectedRoom.creatorAlias === anonProfile?.alias) && (
                      <div className="relative shrink-0 ml-2" data-dropdown-container>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setActiveMenuId(
                              activeMenuId === `room_${selectedRoom.id}`
                                ? null
                                : `room_${selectedRoom.id}`,
                            )
                          }}
                          className="size-8 rounded-md border border-border bg-secondary/80 flex items-center justify-center text-text hover:bg-secondary hover:text-red-500 transition-all shrink-0"
                          title={t('lounge.rooms.options', { defaultValue: 'Oda Seçenekleri' })}
                          aria-label={t('lounge.rooms.options', { defaultValue: 'Oda Seçenekleri' })}
                        >
                          <svg className="size-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                          </svg>
                        </button>

                        {activeMenuId === `room_${selectedRoom.id}` && (
                          <div
                            className="absolute right-0 top-full mt-1 z-30 w-36 rounded-md bg-card border border-border shadow-lg py-1 text-xs"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => promptDeleteRoom(selectedRoom)}
                              className="w-full text-left px-3 py-1.5 text-red-500 hover:bg-secondary flex items-center gap-2 transition-colors font-semibold"
                            >
                              <span>🗑️</span>
                              <span>{t('lounge.rooms.deleteRoom', { defaultValue: 'Odayı Sil' })}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                </div>
              ) : (
                <div className="text-xs text-muted">{t('lounge.rooms.selectRoom', { defaultValue: 'Bir oda seçin' })}</div>
              )}
            </div>

            {/* Incoming Identity Reveal Request Banner */}
            {partnerRequestedReveal && !revealedUsers && !myRequestedReveal && (
              <div className="p-3 bg-emerald-500/10 border-b border-emerald-500/30 flex items-center justify-between gap-3 animate-in fade-in duration-200">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">🎭</span>
                  <div>
                    <h4 className="text-xs font-bold text-text">
                      <strong>{activeDirectSession?.partner?.alias}</strong> {t('lounge.reveal.bannerTitle', { alias: '', defaultValue: 'gerçek profilini açmak için davet gönderdi!' })}
                    </h4>
                    <p className="text-[11px] text-muted">
                      {t('lounge.reveal.bannerDesc', { defaultValue: 'Kabul ederseniz iki tarafın da gerçek Nest Social profilleri birbirine görünecektir.' })}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setRevealConfirmModal('accept')}
                  className="rounded-md bg-emerald-600 px-3.5 py-1.5 text-xs font-bold !text-white shadow hover:bg-emerald-700 active:scale-95 transition-all shrink-0"
                >
                  {t('lounge.actions.confirm', { defaultValue: 'Onayla' })}
                </button>
              </div>
            )}

            {/* Fully Revealed Banner */}
            {revealedUsers && (
              <div className="p-3 bg-secondary border-b border-border flex items-center justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">🎉</span>
                  <div>
                    <h4 className="text-xs font-bold text-text">
                      {t('lounge.reveal.successTitle', { defaultValue: 'Maskeler Düştü! Gerçek Kimlikler Açıklandı:' })}
                    </h4>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted">
                      <span>
                        {t('lounge.reveal.youAnd', { defaultValue: 'Siz' })} &amp; <strong>@{activeDirectSession?.partner?.anonymousId === revealedUsers.partner1.anonymousId ? revealedUsers.partner1.username : revealedUsers.partner2.username}</strong>
                      </span>
                    </div>
                  </div>
                </div>
                <Link
                  to={`/${lang}/profile`}
                  target="_blank"
                  className="rounded-md bg-primary px-3.5 py-1.5 text-xs font-bold !text-white hover:bg-primary-hover"
                >
                  {t('lounge.reveal.goToProfile', { defaultValue: 'Profiline Git →' })}
                </Link>
              </div>
            )}

            {/* Messages Scroll View */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
              {(activeDirectSession ? directMessages : roomMessages).length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center text-muted text-xs py-10">
                  <span className="text-3xl mb-2">💬</span>
                  <p>{t('lounge.messages.empty', { defaultValue: 'Henüz mesaj yok. İlk mesajı sen gönder!' })}</p>
                  <p className="text-[10px] opacity-75 mt-1">
                    {t('lounge.messages.emptySub', { defaultValue: 'Kimliğin gizlidir, sadece anonim rumuzun görünür.' })}
                  </p>
                </div>
              ) : (
                (activeDirectSession ? directMessages : roomMessages).map((msg) => {
                  const isMe =
                    (anonProfile && msg.senderAnonymousId === anonProfile.anonymousId) ||
                    msg.senderAnonymousId === 'me'
                  const avatar = getAvatarByKey(msg.senderAvatar)
                  const isMenuOpen = activeMenuId === `msg_${msg.id}`

                  return (
                    <div
                      key={msg.id}
                      className={`flex items-start gap-2.5 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
                    >
                      <div
                        className="size-8 rounded-md flex items-center justify-center text-sm shadow-sm shrink-0"
                        style={{ background: avatar.bgStyle }}
                      >
                        {avatar.emoji}
                      </div>
                      <div
                        className={`relative max-w-[80%] sm:max-w-[70%] rounded-md px-3.5 py-2 text-xs shadow-sm ${
                          isMe
                            ? 'bg-primary !text-white rounded-tr-none'
                            : 'bg-secondary border border-border text-text rounded-tl-none'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`font-bold text-[11px] ${
                                isMe ? 'opacity-90' : 'text-primary'
                              }`}
                            >
                              {isMe ? t('lounge.messages.you', { defaultValue: 'Sen' }) : msg.senderAlias}
                            </span>
                            <span className="text-[9px] opacity-60">
                              {new Date(msg.createdAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>

                          {/* 3 Nokta ⋮ Menüsü (Kullanıcının kendi mesajları için silme) */}
                          {isMe && (
                            <div className="relative" data-dropdown-container>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setActiveMenuId(isMenuOpen ? null : `msg_${msg.id}`)
                                }}
                                className="opacity-70 hover:opacity-100 p-0.5 rounded transition-opacity"
                                title={t('lounge.messages.actions', { defaultValue: 'İşlemler' })}
                                aria-label={t('lounge.messages.actions', { defaultValue: 'Mesaj İşlemleri' })}
                              >
                                <svg className="size-3.5" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                                </svg>
                              </button>

                              {isMenuOpen && (
                                <div
                                  className="absolute right-0 top-full mt-1 z-30 w-32 rounded-md bg-card border border-border shadow-lg py-1 text-xs text-text"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    type="button"
                                    onClick={() => promptDeleteMessage(msg.id)}
                                    className="w-full text-left px-3 py-1.5 text-red-500 hover:bg-secondary flex items-center gap-2 transition-colors font-semibold"
                                  >
                                    <span>🗑️</span>
                                    <span>{t('lounge.messages.delete', { defaultValue: 'Mesajı Sil' })}</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <p className="leading-relaxed break-words text-sm">{msg.text}</p>
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat Input Bar */}
            <div className="p-2.5 sm:p-3 border-t border-border bg-secondary/30 rounded-b-none sm:rounded-b-md shrink-0">
              <form
                onSubmit={activeDirectSession ? handleSendDirectMessage : handleSendRoomMessage}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder={
                    isAuthenticated
                      ? activeDirectSession
                        ? t('lounge.messages.inputPlaceholderDirect', {
                            alias: activeDirectSession.partner?.alias,
                            defaultValue: `${activeDirectSession.partner?.alias} kullanıcısına mesaj gönder...`,
                          })
                        : t('lounge.messages.inputPlaceholderRoom', {
                            roomName: selectedRoom?.name || 'Odaya',
                            defaultValue: `${selectedRoom?.name || 'Odaya'} anonim mesaj yaz...`,
                          })
                      : t('lounge.messages.inputPlaceholderGuest', {
                          defaultValue: 'Mesaj yazmak için giriş yapın...',
                        })
                  }
                  className="flex-1 rounded-md border border-border bg-card px-3.5 py-2.5 text-xs sm:text-sm text-text placeholder:text-muted focus:border-primary focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!messageInput.trim()}
                  className="rounded-md bg-primary px-4 py-2.5 text-xs sm:text-sm font-bold !text-white shadow hover:bg-primary-hover active:scale-95 disabled:opacity-40 transition-all flex items-center gap-1.5"
                >
                  <span>{t('lounge.messages.send', { defaultValue: 'Gönder' })}</span>
                  <span>🚀</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <AnonymousProfileModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        currentProfile={anonProfile}
        onProfileUpdated={(updated) => setAnonProfile(updated)}
      />

      <AnonymousRoomCreateModal
        isOpen={createRoomModalOpen}
        onClose={() => setCreateRoomModalOpen(false)}
        onRoomCreated={(newRoom) => {
          setRooms((prev) => [newRoom, ...prev])
          setSelectedRoom(newRoom)
        }}
      />

      <GuestLoungeGateModal
        isOpen={gateModalOpen}
        onClose={() => setGateModalOpen(false)}
        actionLabel={gateActionLabel}
      />

      {/* 1. Sohbet İsteği Gönderildi Profesyonel Pop-Up Modalı */}
      {sentRequestModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSentRequestModal(null)
          }}
        >
          <div
            className="relative w-full max-w-sm overflow-hidden rounded-md border border-border bg-card p-5 sm:p-6 text-text shadow-2xl text-center animate-in zoom-in-95 duration-150"
            role="dialog"
            aria-modal="true"
          >
            <div
              className="mx-auto mb-3.5 flex size-14 items-center justify-center rounded-2xl text-3xl shadow-md"
              style={{ background: getAvatarByKey(sentRequestModal.avatarKey).bgStyle }}
            >
              {getAvatarByKey(sentRequestModal.avatarKey).emoji}
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-2">
              <span className="size-2 rounded-full bg-primary animate-ping" />
              <span>{t('lounge.sentModal.badge', { defaultValue: 'İstek İletildi' })}</span>
            </div>

            <h3 className="text-base sm:text-lg font-bold text-text">
              {t('lounge.sentModal.title', { defaultValue: 'Sohbet İsteği Gönderildi!' })}
            </h3>

            <p className="mt-2 text-xs leading-relaxed text-muted">
              {t('lounge.sentModal.desc', {
                alias: sentRequestModal.alias,
                defaultValue: `${sentRequestModal.alias} kullanıcısına birebir anonim sohbet davetiniz başarıyla iletildi.`,
              })}
            </p>

            <div className="mt-4 rounded-md border border-border bg-secondary/70 p-3 text-left text-xs text-text space-y-2">
              <div className="flex items-start gap-2">
                <span className="text-sm shrink-0">⏳</span>
                <p className="text-[11px] text-muted leading-tight">
                  {t('lounge.sentModal.noteWait', {
                    defaultValue: 'Karşı taraf isteği kabul ettiğinde ekranınızda anında bildirim penceresi açılacaktır.',
                  })}
                </p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-sm shrink-0">🔒</span>
                <p className="text-[11px] text-muted leading-tight">
                  {t('lounge.sentModal.notePrivacy', {
                    defaultValue: 'Gerçek kimliğiniz ve profiliniz tamamen gizli tutulmaktadır.',
                  })}
                </p>
              </div>
            </div>

            <div className="mt-5">
              <button
                type="button"
                onClick={() => setSentRequestModal(null)}
                className="w-full rounded-md bg-primary py-2.5 text-xs font-bold !text-white shadow hover:bg-primary-hover active:scale-95 transition-all"
              >
                {t('lounge.sentModal.okBtn', { defaultValue: 'Tamam, Bekliyorum' })}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Karşı Taraf Sohbeti Kabul Etti Profesyonel Pop-Up Modalı */}
      {chatAcceptedModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setChatAcceptedModal(null)
          }}
        >
          <div
            className="relative w-full max-w-sm overflow-hidden rounded-md border border-border bg-card p-5 sm:p-6 text-text shadow-2xl text-center animate-in zoom-in-95 duration-150"
            role="dialog"
            aria-modal="true"
          >
            <div className="relative mx-auto mb-3.5 size-16">
              <div
                className="size-16 rounded-2xl flex items-center justify-center text-3xl shadow-xl"
                style={{
                  background: getAvatarByKey(chatAcceptedModal.partner?.avatarKey).bgStyle,
                }}
              >
                {getAvatarByKey(chatAcceptedModal.partner?.avatarKey).emoji}
              </div>
              <span className="absolute -bottom-1 -right-1 size-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold ring-2 ring-card shadow">
                ✓
              </span>
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold mb-2">
              <span>🎉</span>
              <span>{t('lounge.acceptedModal.badge', { defaultValue: 'Davet Onaylandı' })}</span>
            </div>

            <h3 className="text-base sm:text-lg font-bold text-text">
              {t('lounge.acceptedModal.title', { defaultValue: 'Sohbet İsteğiniz Kabul Edildi!' })}
            </h3>

            <p className="mt-2 text-xs leading-relaxed text-muted">
              {t('lounge.acceptedModal.desc', {
                alias: chatAcceptedModal.partner?.alias,
                defaultValue: `${chatAcceptedModal.partner?.alias} sohbet isteğinizi kabul etti! Artık karşılıklı anonim olarak sohbet edebilirsiniz.`,
              })}
            </p>

            <div className="mt-4 rounded-md border border-border bg-secondary/70 p-3 text-left text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-muted text-[11px]">{t('lounge.acceptedModal.userLabel', { defaultValue: 'Kullanıcı:' })}</span>
                <span className="font-semibold text-text">{chatAcceptedModal.partner?.alias}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted text-[11px]">{t('lounge.acceptedModal.identityLabel', { defaultValue: 'Kimlik:' })}</span>
                <span className="text-text">
                  {chatAcceptedModal.partner?.gender === 'female'
                    ? t('lounge.genders.female', { defaultValue: 'Kadın 👩' })
                    : chatAcceptedModal.partner?.gender === 'male'
                      ? t('lounge.genders.male', { defaultValue: 'Erkek 👨' })
                      : t('lounge.genders.unspecified', { defaultValue: 'Gizli 🔒' })}{' '}
                  • {chatAcceptedModal.partner?.ageRange || t('lounge.profileModal.unspecifiedAge', { defaultValue: 'Gizli' })}
                </span>
              </div>
              {chatAcceptedModal.partner?.status && (
                <div className="flex items-center justify-between pt-1 border-t border-border/60">
                  <span className="text-muted text-[11px]">{t('lounge.profileModal.statusLabel', { defaultValue: 'Durum:' })}</span>
                  <span className="text-text text-[11px] truncate max-w-[180px]">
                    {chatAcceptedModal.partner.status}
                  </span>
                </div>
              )}
            </div>

            <div className="mt-5 flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setChatAcceptedModal(null)}
                className="flex-1 rounded-md border border-border bg-secondary py-2.5 text-xs font-semibold text-text hover:bg-secondary-hover transition-colors"
              >
                {t('common.later', { defaultValue: 'Daha Sonra' })}
              </button>
              <button
                type="button"
                onClick={handleEnterAcceptedChat}
                className="flex-1 rounded-md bg-primary py-2.5 text-xs font-bold !text-white shadow hover:bg-primary-hover active:scale-95 transition-all flex items-center justify-center gap-1.5"
              >
                <span>{t('lounge.acceptedModal.startBtn', { defaultValue: 'Sohbete Gir' })}</span>
                <span>💬</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Maske / Gerçek Profil Açma Onay Modalı */}
      {revealConfirmModal && activeDirectSession && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setRevealConfirmModal(null)
          }}
        >
          <div
            className="relative w-full max-w-sm overflow-hidden rounded-md border border-border bg-card p-5 sm:p-6 text-text shadow-2xl text-center animate-in zoom-in-95 duration-150"
            role="dialog"
            aria-modal="true"
          >
            {/* Icon */}
            <div
              className="mx-auto mb-3.5 flex size-14 items-center justify-center rounded-2xl text-3xl shadow-md"
              style={{
                background:
                  revealConfirmModal === 'accept'
                    ? 'linear-gradient(135deg, #10b981, #059669)'
                    : 'linear-gradient(135deg, #8b5cf6, #3b82f6)',
              }}
            >
              🎭
            </div>

            <div
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold mb-2 ${
                revealConfirmModal === 'accept'
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'bg-primary/10 text-primary'
              }`}
            >
              <span>
                {revealConfirmModal === 'accept'
                  ? t('lounge.reveal.mutualTag', { defaultValue: '🤝 Karşılıklı Onay' })
                  : t('lounge.reveal.requestTag', { defaultValue: '🔍 Kimlik Açma Talebi' })}
              </span>
            </div>

            <h3 className="text-base sm:text-lg font-bold text-text">
              {revealConfirmModal === 'accept'
                ? t('lounge.reveal.acceptConfirmTitle', { defaultValue: 'Gerçek Profilinizi Paylaşmayı Onaylıyor musunuz?' })
                : t('lounge.reveal.requestConfirmTitle', { defaultValue: 'Gerçek Profilini Açmak İstiyor musun?' })}
            </h3>

            <p className="mt-2 text-xs leading-relaxed text-muted">
              {revealConfirmModal === 'accept' ? (
                <>
                  {t('lounge.reveal.acceptConfirmDesc', {
                    alias: activeDirectSession.partner?.alias,
                    defaultValue: `${activeDirectSession.partner?.alias} kullanıcısının kimlik açma davetini kabul etmek üzeresiniz.`,
                  })}
                </>
              ) : (
                <>
                  {t('lounge.reveal.requestConfirmDesc', {
                    alias: activeDirectSession.partner?.alias,
                    defaultValue: `${activeDirectSession.partner?.alias} kullanıcısına maskeyi kaldırma ve gerçek profilleri görme isteği gönderilecek.`,
                  })}
                </>
              )}
            </p>

            {/* Info Box */}
            <div className="mt-4 rounded-md border border-border bg-secondary/70 p-3.5 text-left text-xs text-text space-y-2.5">
              <div className="flex items-start gap-2.5">
                <span className="text-base shrink-0">
                  {revealConfirmModal === 'accept' ? '🔓' : '🤝'}
                </span>
                <p className="text-[11px] leading-relaxed text-muted">
                  {revealConfirmModal === 'accept' ? (
                    <>
                      <strong>{t('lounge.reveal.boxAcceptTitle', { defaultValue: 'Profiliniz Açılacak:' })}</strong>{' '}
                      {t('lounge.reveal.boxAcceptDesc', {
                        defaultValue: 'Bu işlem onaylandığında gerçek Nest Social kullanıcı adınız ve profiliniz karşı tarafa görünecektir. Siz de karşı tarafın gerçek profilini göreceksiniz.',
                      })}
                    </>
                  ) : (
                    <>
                      <strong>{t('lounge.reveal.boxRequestTitle', { defaultValue: 'Karşı Tarafın Onayı Gerekir:' })}</strong>{' '}
                      {t('lounge.reveal.boxRequestDesc', {
                        defaultValue: 'İstek karşı tarafa iletilir. Yalnızca karşı taraf da onaylarsa birbirinizin gerçek profillerini görebilirsiniz.',
                      })}
                    </>
                  )}
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="text-base shrink-0">🛡️</span>
                <p className="text-[11px] leading-relaxed text-muted">
                  {revealConfirmModal === 'accept' ? (
                    <>
                      {t('lounge.reveal.boxAcceptNote', {
                        defaultValue: 'Karşılıklı onay verilmeden önce hiçbir gerçek profil bilgisi paylaşılmaz.',
                      })}
                    </>
                  ) : (
                    <>
                      {t('lounge.reveal.boxRequestNote', {
                        defaultValue: 'Karşı taraf kabul etmediği sürece kimliğiniz %100 gizli kalmaya devam eder.',
                      })}
                    </>
                  )}
                </p>
              </div>
            </div>

            {/* Buttons */}
            <div className="mt-5 flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setRevealConfirmModal(null)}
                className="flex-1 rounded-md border border-border bg-secondary py-2.5 text-xs font-semibold text-text hover:bg-secondary-hover transition-colors"
              >
                {t('common.cancel', { defaultValue: 'Vazgeç' })}
              </button>
              <button
                type="button"
                onClick={() => {
                  setRevealConfirmModal(null)
                  executeRequestReveal()
                }}
                className={`flex-1 rounded-md py-2.5 text-xs font-bold !text-white shadow active:scale-95 transition-all flex items-center justify-center gap-1.5 ${
                  revealConfirmModal === 'accept'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-primary hover:bg-primary-hover'
                }`}
              >
                <span>
                  {revealConfirmModal === 'accept'
                    ? t('lounge.reveal.confirmAcceptBtn', { defaultValue: 'Evet, Profilimi Paylaş' })
                    : t('lounge.reveal.confirmRequestBtn', { defaultValue: 'Evet, İstek Gönder' })}
                </span>
                <span>🎭</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Nest Social'e Geri Dönüş Onay Modalı */}
      {showExitConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div
            className="relative w-full max-w-sm overflow-hidden rounded-md border border-border bg-card p-5 sm:p-6 text-text shadow-2xl"
            role="dialog"
            aria-modal="true"
          >
            <div className="text-center">
              {/* Nest Social Brand Logo (Same as Navbar) */}
              <div className="mx-auto mb-3.5 flex items-center justify-center gap-2">
                <span className="grid size-10 place-items-center rounded-2xl bg-primary text-inverse font-bold text-base shadow-sm">
                  NS
                </span>
                <span className="text-lg font-extrabold text-text tracking-tight">Nest Social</span>
              </div>

              <h3 className="text-base sm:text-lg font-bold text-text">
                {t('lounge.exitModal.title', { defaultValue: "Nest Social'e Dönüyorsunuz" })}
              </h3>

              <p className="mt-2 text-xs leading-relaxed text-muted">
                {t('lounge.exitModal.desc', {
                  defaultValue: 'Gizli Profil & Anonim Lounge alanından çıkıp ana sosyal ağ akışınıza geri dönmek üzeresiniz. Onaylıyor musunuz?',
                })}
              </p>

              <div className="mt-5 flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowExitConfirmModal(false)}
                  className="flex-1 rounded-md border border-border bg-secondary py-2 text-xs font-semibold text-text hover:bg-secondary-hover transition-colors"
                >
                  {t('lounge.exitModal.cancel', { defaultValue: 'Vazgeç' })}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowExitConfirmModal(false)
                    navigate(`/${lang}/`)
                  }}
                  className="flex-1 rounded-md bg-primary py-2 text-xs font-bold !text-white shadow hover:bg-primary-hover active:scale-95 transition-all"
                >
                  {t('lounge.exitModal.confirm', { defaultValue: 'Evet, Geri Dön' })}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mesaj Silme, Oda Silme, Engelleme ve Sohbet Bitirme Profesyonel Pop-up Modalı */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div
            className="relative w-full max-w-sm overflow-hidden rounded-md border border-border bg-card p-5 sm:p-6 text-text shadow-2xl"
            role="dialog"
            aria-modal="true"
          >
            <div className="text-center">
              <div
                className="mx-auto mb-3.5 flex size-12 items-center justify-center rounded-md text-2xl shadow-sm"
                style={{
                  background:
                    confirmDialog.iconBg || 'linear-gradient(135deg, #ef4444, #dc2626)',
                }}
              >
                {confirmDialog.icon || '⚠️'}
              </div>

              <h3 className="text-base sm:text-lg font-bold text-text">
                {confirmDialog.title}
              </h3>

              <p className="mt-2 text-xs leading-relaxed text-muted">
                {confirmDialog.description}
              </p>

              <div className="mt-5 flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setConfirmDialog(null)}
                  className="flex-1 rounded-md border border-border bg-secondary py-2 text-xs font-semibold text-text hover:bg-secondary-hover transition-colors"
                >
                  {t('common.cancel', { defaultValue: 'Vazgeç' })}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const action = confirmDialog.onConfirm
                    setConfirmDialog(null)
                    if (action) await action()
                  }}
                  className={`flex-1 rounded-md py-2 text-xs font-bold !text-white shadow active:scale-95 transition-all ${
                    confirmDialog.isDanger !== false
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-primary hover:bg-primary-hover'
                  }`}
                >
                  {confirmDialog.confirmText || t('common.confirm', { defaultValue: 'Onayla' })}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Giriş Bilgilendirme ve Uyarı Pop-up Modalı (Kafa Dağıtma / Eğlence & Anonimlik Uyarısı) */}
      {showDisclaimerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div
            className="relative w-full max-w-md overflow-hidden rounded-md border border-border bg-card p-6 sm:p-7 text-text shadow-2xl animate-in fade-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
          >
            <div className="text-center">
              <div
                className="mx-auto mb-4 flex size-14 items-center justify-center rounded-md text-3xl shadow-md"
                style={{ background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)' }}
              >
                🎭
              </div>

              <h3 className="text-lg sm:text-xl font-bold tracking-tight text-text">
                {t('lounge.disclaimer.title', { defaultValue: "Anonim Lounge'a Hoş Geldiniz!" })}
              </h3>

              <p className="mt-2.5 text-xs sm:text-sm leading-relaxed text-muted">
                {t('lounge.disclaimer.desc', {
                  defaultValue: 'Burası tamamen günün stresini atmak, kafa dağıtmak ve eğlenceli sohbetler gerçekleştirmek için tasarlanmış bağımsız ve anonim bir alandır.',
                })}
              </p>

              <div className="mt-4 rounded-md border border-border bg-secondary/70 p-3.5 text-left text-xs text-text space-y-2">
                <div className="flex items-start gap-2.5">
                  <span className="text-base shrink-0">🤫</span>
                  <p>
                    <strong>{t('lounge.disclaimer.rule1Title', { defaultValue: 'Gizlilik ve Eğlence Esastır:' })}</strong>{' '}
                    {t('lounge.disclaimer.rule1Desc', {
                      defaultValue: 'Tüm katılımcılar rastgele rumuz ve avatarlar kullanır. Buradaki sohbetleri ciddiye almamalı, kafa dağıtma amaçlı olduğunu unutmamalısınız.',
                    })}
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="text-base shrink-0">⚠️</span>
                  <p>
                    <strong>{t('lounge.disclaimer.rule2Title', { defaultValue: 'Gerçeklik Uyarısı:' })}</strong>{' '}
                    {t('lounge.disclaimer.rule2Desc', {
                      defaultValue: 'Anonim kişilerin beyanlarına veya anlattıklarına doğrudan inanmamalı; kişisel, finansal veya özel iletişim bilgilerinizi kesinlikle paylaşmamalısınız.',
                    })}
                  </p>
                </div>
              </div>

              <label className="mt-4 flex items-center justify-center gap-2 text-xs text-muted cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={dontShowAgainDisclaimer}
                  onChange={(e) => setDontShowAgainDisclaimer(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary size-4"
                />
                <span>{t('lounge.disclaimer.dontShowAgain', { defaultValue: 'Bu bilgilendirmeyi bir daha gösterme' })}</span>
              </label>

              <button
                type="button"
                onClick={() => {
                  if (dontShowAgainDisclaimer) {
                    try {
                      localStorage.setItem('nest_anon_disclaimer_accepted', 'true')
                    } catch (_) {}
                  }
                  setShowDisclaimerModal(false)
                }}
                className="mt-4 w-full rounded-md bg-primary px-4 py-2.5 text-sm font-bold !text-white shadow hover:bg-primary-hover active:scale-[0.98] transition-all"
              >
                {t('lounge.disclaimer.startBtn', { defaultValue: 'Anladım, Sohbete Başla' })}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Üye Olmayan Ziyaretçiler İçin 20 Saniye Sonunda Puslandırma ve Üye Olma Pop-up'ı */}
      {!isAuthenticated && guestTimeoutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <div
            className="relative w-full max-w-md overflow-hidden rounded-md border border-border bg-card p-6 sm:p-8 text-text shadow-2xl text-center animate-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
          >
            <div
              className="mx-auto mb-4 flex size-16 items-center justify-center rounded-md text-3xl shadow-lg"
              style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}
            >
              🚀
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-2">
              <span>⏱️</span>
              <span>{t('lounge.guestTimeout.badge', { defaultValue: 'Önizleme Süresi Doldu' })}</span>
            </div>

            <h3 className="text-xl sm:text-2xl font-black tracking-tight text-text">
              {t('lounge.guestTimeout.title', { defaultValue: 'Sohbete Katılmak İçin Üye Olun!' })}
            </h3>

            <p className="mt-2.5 text-xs sm:text-sm leading-relaxed text-muted">
              {t('lounge.guestTimeout.desc', {
                defaultValue: "Anonim Lounge'da mesaj göndermek, yeni oda kurmak ve çevrimiçi kişilerle birebir eşleşip kafa dağıtmak için hemen aramıza katılın.",
              })}
            </p>

            <div className="mt-4 rounded-md border border-border bg-secondary/80 p-3.5 text-left text-xs text-text space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-emerald-500 font-bold">✓</span>
                <span>{t('lounge.guestTimeout.perk1', { defaultValue: 'Tamamen Ücretsiz ve 1 Dakikada Kayıt' })}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-emerald-500 font-bold">✓</span>
                <span>{t('lounge.guestTimeout.perk2', { defaultValue: 'Gerçek Profiliniz Gizli Kalır (%100 Anonim)' })}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-emerald-500 font-bold">✓</span>
                <span>{t('lounge.guestTimeout.perk3', { defaultValue: 'Sınırsız Oda Sohbeti ve Canlı Radar Erişimi' })}</span>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() =>
                  navigate(
                    `/${lang}/signup?returnTo=${encodeURIComponent(`/${lang}/hidden-profile`)}`,
                  )
                }
                className="w-full rounded-md bg-primary px-5 py-3 text-sm font-bold !text-white shadow-lg hover:bg-primary-hover active:scale-[0.98] transition-all"
              >
                {t('lounge.guestTimeout.signupBtn', { defaultValue: 'Hemen Ücretsiz Kayıt Ol' })}
              </button>
              <button
                type="button"
                onClick={() =>
                  navigate(
                    `/${lang}/login?returnTo=${encodeURIComponent(`/${lang}/hidden-profile`)}`,
                  )
                }
                className="w-full rounded-md border border-border bg-secondary px-5 py-2.5 text-sm font-semibold text-text hover:bg-secondary-hover active:scale-[0.98] transition-all"
              >
                {t('lounge.guestTimeout.loginBtn', { defaultValue: 'Zaten Hesabım Var, Giriş Yap' })}
              </button>
              <button
                type="button"
                onClick={() => navigate(`/${lang}/`)}
                className="text-xs text-muted hover:text-text underline mt-1 transition-colors"
              >
                {t('lounge.guestTimeout.returnHome', { defaultValue: 'Nest Social Ana Sayfasına Dön' })}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
