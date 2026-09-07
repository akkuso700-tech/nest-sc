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
  uploadAnonymousMedia,
  getAnonymousDirectChats,
  getDirectChatMessages,
  deleteAnonymousDirectChat,
  markAnonymousDirectChatRead,
} from '../services/anonymousService.js'
import { compressImageToFile } from '../utils/imageUpload.js'
import { resolveMediaUrl } from '../utils/media.js'
import AudioMessagePlayer from '../components/media/AudioMessagePlayer.jsx'
import {
  PhotoIcon,
  MicrophoneIcon,
  PhoneIcon,
  SendIcon,
  CloseIcon,
  TrashIcon,
} from './MessagesPageIcons.jsx'
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

  // Derived state: Unread direct chats & notification counts
  const unreadDirectChats = useMemo(() => {
    return directChats.filter((c) => (c.unreadCount && c.unreadCount > 0) || c.hasUnread)
  }, [directChats])

  const totalUnreadDirectCount = useMemo(() => {
    return directChats.reduce((sum, c) => sum + (c.unreadCount || (c.hasUnread ? 1 : 0)), 0)
  }, [directChats])

  const unreadNotificationsCount = useMemo(() => {
    return (incomingDirectRequest ? 1 : 0) + totalUnreadDirectCount
  }, [incomingDirectRequest, totalUnreadDirectCount])

  // Input states
  const [messageInput, setMessageInput] = useState('')
  const [isLoadingRooms, setIsLoadingRooms] = useState(true)
  const messagesEndRef = useRef(null)
  const messagesContainerRef = useRef(null)

  // Socket instance ref
  const socketRef = useRef(null)

  // Responsive viewport
  const [isMobileViewport, setIsMobileViewport] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false,
  )

  useEffect(() => {
    function handleResize() {
      setIsMobileViewport(window.innerWidth < 768)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Media (Image) upload states
  const [isUploadingMedia, setIsUploadingMedia] = useState(false)
  const [selectedImage, setSelectedImage] = useState(null)
  const [selectedImagePreview, setSelectedImagePreview] = useState('')
  const [uploadedMediaItem, setUploadedMediaItem] = useState(null)
  const [alertModal, setAlertModal] = useState(null)
  const imageInputRef = useRef(null)

  function showAlert(message, title = 'Bilgilendirme', tone = 'error') {
    setAlertModal({ title, message, tone })
  }

  // Voice recording states
  const [isRecordingVoice, setIsRecordingVoice] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const recordingTimerRef = useRef(null)
  const recordingStartTimeRef = useRef(0)
  const audioStreamRef = useRef(null)

  // WebRTC Anonymous Voice Calling
  const [anonCallState, setAnonCallState] = useState('idle') // 'idle' | 'calling' | 'incoming' | 'connected'
  const [anonCallInfo, setAnonCallInfo] = useState(null)
  const [isCallMuted, setIsCallMuted] = useState(false)
  const [callDuration, setCallDuration] = useState(0)

  const peerConnectionRef = useRef(null)
  const localCallStreamRef = useRef(null)
  const remoteAudioRef = useRef(null)
  const callTimerRef = useRef(null)

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
          try {
            const savedChats = await getAnonymousDirectChats()
            if (isMounted && Array.isArray(savedChats)) {
              setDirectChats(savedChats)
              try {
                localStorage.setItem('nest_anon_direct_chats', JSON.stringify(savedChats))
              } catch (_) {}
            }
          } catch (chatErr) {
            console.error('Failed to load direct chats:', chatErr)
          }
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

    socket.on('anon:direct_started', ({ sessionId, chatKey, partner }) => {
      const key = chatKey || sessionId
      setDirectChats((prev) => {
        const exists = prev.find((c) => (c.chatKey || c.sessionId) === key || c.partner?.anonymousId === partner.anonymousId)
        let updated
        if (exists) {
          updated = prev.map((c) =>
            (c.chatKey || c.sessionId) === key || c.partner?.anonymousId === partner.anonymousId
              ? { ...c, sessionId: key, chatKey: key, partner, lastMessageAt: new Date().toISOString() }
              : c
          )
        } else {
          updated = [
            {
              id: key,
              sessionId: key,
              chatKey: key,
              partner,
              lastMessage: t('lounge.chats.chatStarted', { defaultValue: 'Sohbet başladı' }),
              lastMessageAt: new Date().toISOString(),
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

      // Karşı taraf sohbeti kabul ettiğinde pop-up bilgilendirmesi ver
      setChatAcceptedModal({ sessionId: key, partner })
    })

    socket.on('anon:new_direct_message', (msg) => {
      setDirectMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev
        return [...prev, msg]
      })
      setDirectChats((prev) => {
        const updated = prev.map((c) => {
          if (
            c.sessionId === msg.sessionId ||
            c.chatKey === msg.sessionId ||
            c.partner?.anonymousId === msg.senderAnonymousId
          ) {
            return {
              ...c,
              lastMessage: {
                text: msg.text || (msg.media?.length ? (msg.media[0].type === 'audio' ? '🎤 Sesli Mesaj' : '📷 Fotoğraf') : ''),
                senderAnonymousId: msg.senderAnonymousId,
                senderAlias: msg.senderAlias,
                hasMedia: Boolean(msg.media?.length),
              },
              lastMessageAt: msg.createdAt || new Date().toISOString(),
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

    socket.on('anon:direct_message_notification', ({ sessionId, message }) => {
      setDirectChats((prev) => {
        const exists = prev.some((c) => (c.chatKey || c.sessionId) === sessionId)
        if (!exists) {
          getAnonymousDirectChats()
            .then((chats) => {
              if (Array.isArray(chats)) {
                setDirectChats(chats)
                try {
                  localStorage.setItem('nest_anon_direct_chats', JSON.stringify(chats))
                } catch (_) {}
              }
            })
            .catch(() => {})
          return prev
        }
        const updated = prev.map((c) => {
          if (c.sessionId === sessionId || c.chatKey === sessionId) {
            return {
              ...c,
              lastMessage: {
                text: message.text || (message.media?.length ? (message.media[0].type === 'audio' ? '🎤 Sesli Mesaj' : '📷 Fotoğraf') : ''),
                senderAnonymousId: message.senderAnonymousId,
                senderAlias: message.senderAlias,
                hasMedia: Boolean(message.media?.length),
              },
              lastMessageAt: message.createdAt || new Date().toISOString(),
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

    socket.on('anon:messages_read', ({ sessionId, chatKey }) => {
      const targetKey = chatKey || sessionId
      setDirectMessages((prev) =>
        prev.map((m) =>
          m.sessionId === targetKey || m.conversationId === targetKey
            ? { ...m, status: 'read' }
            : m,
        ),
      )
      setDirectChats((prev) =>
        prev.map((c) =>
          (c.chatKey || c.sessionId) === targetKey
            ? { ...c, unreadCount: 0, hasUnread: false }
            : c,
        ),
      )
    })

    socket.on('anon:partner_reveal_requested', () => {
      setPartnerRequestedReveal(true)
    })

    socket.on('anon:identities_fully_revealed', (payload) => {
      setRevealedUsers(payload)
    })

    socket.on('anon:direct_blocked', () => {
      setActiveDirectSession(null)
      setDirectMessages([])
      setMobileTab('rooms')
      showAlert(
        t('lounge.messages.chatBlocked', { defaultValue: 'Bu sohbet engellendi.' }),
        'Engellendi',
        'info'
      )
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

    socket.on('anon:incoming_call', ({ sessionId, callerAnonId, callerAlias, callerAvatar, offer }) => {
      setAnonCallInfo({
        sessionId,
        callerAnonId,
        partnerAlias: callerAlias,
        partnerAvatar: callerAvatar,
        offer,
      })
      setAnonCallState('incoming')
    })

    socket.on('anon:call_answered', async ({ answer }) => {
      if (peerConnectionRef.current && answer) {
        try {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer))
          setAnonCallState('connected')
        } catch (err) {
          console.error('Failed to set remote description on answer:', err)
        }
      }
    })

    socket.on('anon:call_ice_candidate', async ({ candidate }) => {
      if (peerConnectionRef.current && candidate) {
        try {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate))
        } catch (err) {
          console.error('Failed to add ICE candidate:', err)
        }
      }
    })

    socket.on('anon:call_ended', () => {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current)
        callTimerRef.current = null
      }
      if (localCallStreamRef.current) {
        localCallStreamRef.current.getTracks().forEach((t) => t.stop())
        localCallStreamRef.current = null
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close()
        peerConnectionRef.current = null
      }
      setAnonCallState('idle')
      setAnonCallInfo(null)
      setCallDuration(0)
      setIsCallMuted(false)
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
      socket.off('anon:direct_blocked')
      socket.off('anon:direct_message_notification')
      socket.off('anon:messages_read')
      socket.off('anon:direct_rejected')
      socket.off('anon:incoming_call')
      socket.off('anon:call_answered')
      socket.off('anon:call_ice_candidate')
      socket.off('anon:call_ended')
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

  // Window Scroll Lock: Ensure the browser window/body is strictly locked at 0 on mobile
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [mobileTab, selectedRoom?.id, activeDirectSession?.sessionId])

  // Container-isolated auto scroll to bottom without shaking or shifting the window
  useEffect(() => {
    const scrollToBottom = () => {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
      }
    }

    scrollToBottom()
    const frameId = requestAnimationFrame(scrollToBottom)
    const timeoutId = setTimeout(scrollToBottom, 60)

    return () => {
      cancelAnimationFrame(frameId)
      clearTimeout(timeoutId)
    }
  }, [roomMessages, directMessages, mobileTab, selectedRoom?.id, activeDirectSession?.sessionId])

  // Action Guards for Guests
  function requireAuth(actionText, callback) {
    if (!isAuthenticated) {
      setGateActionLabel(actionText)
      setGateModalOpen(true)
      return
    }
    if (callback) callback()
  }

  // Image selection, client-side compression and immediate upload/processing
  async function handleImageSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return

    // Immediately show preview from raw file and mark uploading/processing
    const rawPreviewUrl = URL.createObjectURL(file)
    setSelectedImagePreview(rawPreviewUrl)
    setIsUploadingMedia(true)
    setUploadedMediaItem(null)
    setSelectedImage(file)

    try {
      // 1. Compress image to clean EXIF and reduce bandwidth
      let compressedFile = file
      try {
        compressedFile = await compressImageToFile(file, {
          maxWidth: 1600,
          maxHeight: 1600,
          quality: 0.82,
          maxBytes: 1.2 * 1024 * 1024,
        })
      } catch (compressionErr) {
        console.warn('Image compression fallback:', compressionErr)
      }

      // 2. Upload to server to process and get durable URL
      const formData = new FormData()
      formData.append('media', compressedFile)
      const resMedia = await uploadAnonymousMedia(formData)

      if (resMedia && resMedia.length > 0) {
        const item = resMedia[0]
        setUploadedMediaItem({ ...item, type: 'image' })
        setSelectedImage(compressedFile)
      } else {
        throw new Error('Dosya işlenemedi.')
      }
    } catch (err) {
      console.error('Image upload error:', err)
      showAlert(err.message || 'Görsel işlenemedi.', 'Görsel Hatası')
      clearSelectedImage()
    } finally {
      setIsUploadingMedia(false)
    }
  }

  function clearSelectedImage() {
    setSelectedImage(null)
    setUploadedMediaItem(null)
    setIsUploadingMedia(false)
    if (selectedImagePreview) {
      URL.revokeObjectURL(selectedImagePreview)
      setSelectedImagePreview('')
    }
    if (imageInputRef.current) {
      imageInputRef.current.value = ''
    }
  }

  // Voice recording handlers
  function cleanupAudioStreams() {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop())
      audioStreamRef.current = null
    }
  }

  async function startVoiceRecording() {
    if (isRecordingVoice || isUploadingMedia) return

    requireAuth(t('lounge.gateModal.toSendMessage', { defaultValue: 'Sesli mesaj göndermek için' }), async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          showAlert('Tarayıcınız ses kaydını desteklemiyor.', 'Tarayıcı Desteği')
          return
        }

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        audioStreamRef.current = stream

        let mimeType = 'audio/webm;codecs=opus'
        if (typeof MediaRecorder !== 'undefined') {
          if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
            mimeType = 'audio/webm;codecs=opus'
          } else if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('audio/webm')) {
            mimeType = 'audio/webm'
          } else if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
            mimeType = 'audio/ogg;codecs=opus'
          } else if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('audio/mp4')) {
            mimeType = 'audio/mp4'
          } else {
            mimeType = ''
          }
        }

        const options = mimeType ? { mimeType } : {}
        const recorder = new MediaRecorder(stream, options)
        mediaRecorderRef.current = recorder
        audioChunksRef.current = []

        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            audioChunksRef.current.push(event.data)
          }
        }

        recorder.start(200)
        recordingStartTimeRef.current = Date.now()
        setIsRecordingVoice(true)
        setRecordingDuration(0)

        recordingTimerRef.current = setInterval(() => {
          const elapsed = Math.floor((Date.now() - recordingStartTimeRef.current) / 1000)
          setRecordingDuration(elapsed)
        }, 1000)
      } catch (error) {
        console.error('Microphone error:', error)
        showAlert('Mikrofon erişimi engellendi. Lütfen tarayıcı ayarlarından mikrofon iznini verin.', 'Mikrofon İzni Gerekli')
      }
    })
  }

  function cancelVoiceRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.onstop = null
      mediaRecorderRef.current.stop()
    }
    cleanupAudioStreams()
    audioChunksRef.current = []
    setIsRecordingVoice(false)
    setRecordingDuration(0)
  }

  async function stopVoiceRecordingAndSend() {
    const recorder = mediaRecorderRef.current
    if (!recorder || recorder.state === 'inactive') {
      cleanupAudioStreams()
      setIsRecordingVoice(false)
      return
    }

    const duration = Math.max(1, Math.round((Date.now() - recordingStartTimeRef.current) / 1000))
    cleanupAudioStreams()

    recorder.onstop = async () => {
      const mimeType = recorder.mimeType || 'audio/webm'
      const audioBlob = new Blob(audioChunksRef.current, { type: mimeType })
      audioChunksRef.current = []
      setIsRecordingVoice(false)
      setRecordingDuration(0)

      if (audioBlob.size > 0) {
        const extension = mimeType.includes('mp4') ? 'm4a' : mimeType.includes('ogg') ? 'ogg' : 'webm'
        const audioFile = new File([audioBlob], `anon-voice-${Date.now()}.${extension}`, {
          type: mimeType,
          lastModified: Date.now(),
        })

        setIsUploadingMedia(true)
        try {
          const formData = new FormData()
          formData.append('media', audioFile)
          formData.set('durationSeconds', String(duration))
          const uploadedMedia = await uploadAnonymousMedia(formData)

          if (uploadedMedia && uploadedMedia.length > 0) {
            const mediaItem = { ...uploadedMedia[0], type: 'audio', durationSeconds: duration }

            if (activeDirectSession) {
              socketRef.current?.emit('anon:send_direct_message', {
                sessionId: activeDirectSession.sessionId,
                text: '',
                media: [mediaItem],
              })
            } else if (selectedRoom) {
              socketRef.current?.emit('anon:send_room_message', {
                roomId: selectedRoom.id,
                text: '',
                media: [mediaItem],
              })
            }
          }
        } catch (err) {
          console.error('Audio upload error:', err)
          showAlert('Sesli mesaj gönderilemedi: ' + (err.message || 'Bilinmeyen hata'), 'Sesli Mesaj Hatası')
        } finally {
          setIsUploadingMedia(false)
        }
      }
    }

    recorder.stop()
  }

  // Room Message Submit
  async function handleSendRoomMessage(e) {
    e?.preventDefault?.()
    const text = messageInput.trim()
    if ((!text && !uploadedMediaItem) || !selectedRoom || isUploadingMedia) return

    requireAuth(t('lounge.gateModal.toSendMessage', { defaultValue: 'Odaya mesaj yazmak için' }), () => {
      const media = uploadedMediaItem ? [uploadedMediaItem] : []

      if (socketRef.current?.connected) {
        socketRef.current.emit('anon:send_room_message', {
          roomId: selectedRoom.id,
          text,
          media,
        })
        setMessageInput('')
        clearSelectedImage()
      }
    })
  }

  // Direct Message Submit
  async function handleSendDirectMessage(e) {
    e?.preventDefault?.()
    const text = messageInput.trim()
    if ((!text && !uploadedMediaItem) || !activeDirectSession || isUploadingMedia) return

    const media = uploadedMediaItem ? [uploadedMediaItem] : []

    if (socketRef.current?.connected) {
      socketRef.current.emit('anon:send_direct_message', {
        sessionId: activeDirectSession.chatKey || activeDirectSession.sessionId,
        text,
        media,
      })
      setMessageInput('')
      clearSelectedImage()
    }
  }

  // WebRTC Anonymous Voice Call Handlers
  function cleanupCallResources() {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current)
      callTimerRef.current = null
    }
    if (localCallStreamRef.current) {
      localCallStreamRef.current.getTracks().forEach((track) => track.stop())
      localCallStreamRef.current = null
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
    }
  }

  function endAnonymousCall(emitSocket = true) {
    if (emitSocket && anonCallInfo?.sessionId) {
      socketRef.current?.emit('anon:call_end', {
        sessionId: anonCallInfo.sessionId,
        reason: 'hangup',
      })
    }
    cleanupCallResources()
    setAnonCallState('idle')
    setAnonCallInfo(null)
    setCallDuration(0)
    setIsCallMuted(false)
  }

  function toggleCallMute() {
    if (localCallStreamRef.current) {
      const audioTrack = localCallStreamRef.current.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        setIsCallMuted(!audioTrack.enabled)
      }
    }
  }

  async function startAnonymousCall() {
    if (!activeDirectSession || anonCallState !== 'idle') return

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      localCallStreamRef.current = stream

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      })
      peerConnectionRef.current = pc

      stream.getTracks().forEach((track) => pc.addTrack(track, stream))

      pc.ontrack = (event) => {
        if (remoteAudioRef.current && event.streams[0]) {
          remoteAudioRef.current.srcObject = event.streams[0]
        }
      }

      pc.onicecandidate = (event) => {
        if (event.candidate && socketRef.current) {
          socketRef.current.emit('anon:call_ice_candidate', {
            sessionId: activeDirectSession.sessionId,
            candidate: event.candidate,
          })
        }
      }

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      setAnonCallInfo({
        sessionId: activeDirectSession.sessionId,
        partnerAlias: activeDirectSession.partner?.alias,
        partnerAvatar: activeDirectSession.partner?.avatarKey,
      })
      setAnonCallState('calling')

      socketRef.current?.emit('anon:call_start', {
        sessionId: activeDirectSession.sessionId,
        offer,
      })
    } catch (err) {
      console.error('startAnonymousCall error:', err)
      showAlert('Sesli arama başlatılamadı: ' + (err.message || 'Mikrofon izni verilmedi'), 'Arama Başlatılamadı')
      cleanupCallResources()
    }
  }

  async function acceptAnonymousCall() {
    if (!anonCallInfo || !anonCallInfo.offer) return

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      localCallStreamRef.current = stream

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      })
      peerConnectionRef.current = pc

      stream.getTracks().forEach((track) => pc.addTrack(track, stream))

      pc.ontrack = (event) => {
        if (remoteAudioRef.current && event.streams[0]) {
          remoteAudioRef.current.srcObject = event.streams[0]
        }
      }

      pc.onicecandidate = (event) => {
        if (event.candidate && socketRef.current) {
          socketRef.current.emit('anon:call_ice_candidate', {
            sessionId: anonCallInfo.sessionId,
            candidate: event.candidate,
          })
        }
      }

      await pc.setRemoteDescription(new RTCSessionDescription(anonCallInfo.offer))
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)

      socketRef.current?.emit('anon:call_answer', {
        sessionId: anonCallInfo.sessionId,
        answer,
      })

      setAnonCallState('connected')
      setCallDuration(0)
      callTimerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1)
      }, 1000)
    } catch (err) {
      console.error('acceptAnonymousCall error:', err)
      showAlert('Arama yanıtlanamadı: ' + err.message, 'Arama Hatası')
      endAnonymousCall(true)
    }
  }

  function rejectAnonymousCall() {
    if (anonCallInfo?.sessionId) {
      socketRef.current?.emit('anon:call_end', {
        sessionId: anonCallInfo.sessionId,
        reason: 'rejected',
      })
    }
    setAnonCallState('idle')
    setAnonCallInfo(null)
  }

  // Open Chat Helper (Persistent MongoDB chat)
  async function openSelectedChat(chat) {
    const key = chat.chatKey || chat.sessionId
    const isOnline = onlineRadarUsers.some(
      (u) => u.anonymousId === chat.partner?.anonymousId
    )
    setSelectedRoom(null)
    setActiveDirectSession({
      sessionId: key,
      chatKey: key,
      partner: chat.partner,
      isOffline: !isOnline,
    })
    setMobileTab('chat')

    // Reset unread count locally
    setDirectChats((prev) =>
      prev.map((c) =>
        (c.chatKey || c.sessionId) === key
          ? { ...c, unreadCount: 0, hasUnread: false }
          : c
      )
    )

    socketRef.current?.emit('anon:join_direct', { chatKey: key, sessionId: key })
    socketRef.current?.emit('anon:mark_messages_read', { chatKey: key, sessionId: key })

    try {
      const msgs = await getDirectChatMessages(key)
      setDirectMessages(msgs || [])
    } catch (err) {
      console.error('Failed to load messages for direct chat:', err)
      setDirectMessages([])
    }
  }

  // Select Chat from Sohbet List
  function handleSelectChatFromList(chat) {
    const key = chat.chatKey || chat.sessionId
    if (
      activeDirectSession &&
      (activeDirectSession.sessionId === key ||
        activeDirectSession.chatKey === key ||
        activeDirectSession.partner?.anonymousId === chat.partner?.anonymousId)
    ) {
      setMobileTab('chat')
      return
    }

    if (activeDirectSession) {
      socketRef.current?.emit('anon:leave_direct', {
        sessionId: activeDirectSession.chatKey || activeDirectSession.sessionId,
      })
    }

    openSelectedChat(chat)
  }

  // Delete / Remove Chat from History
  function handleDeleteDirectChat(chatKey) {
    const key = chatKey || activeDirectSession?.chatKey || activeDirectSession?.sessionId
    if (!key) return
    setActiveMenuId(null)

    setConfirmDialog({
      icon: '🗑️',
      iconBg: 'linear-gradient(135deg, #ef4444, #dc2626)',
      title: t('lounge.chats.deleteChatTitle', { defaultValue: 'Sohbeti Sil' }),
      description: t('lounge.chats.deleteChatDesc', {
        defaultValue:
          'Bu sohbeti listenizden silmek istediğinize emin misiniz? Sohbet listenizden kaldırılacaktır.',
      }),
      confirmText: t('common.delete', { defaultValue: 'Sil' }),
      isDanger: true,
      onConfirm: async () => {
        try {
          await deleteAnonymousDirectChat(key)
        } catch (err) {
          console.error('Delete direct chat error:', err)
        }
        if (socketRef.current) {
          socketRef.current.emit('anon:delete_direct_chat', { chatKey: key })
        }
        setDirectChats((prev) => prev.filter((c) => (c.chatKey || c.sessionId) !== key))
        try {
          const saved = localStorage.getItem('nest_anon_direct_chats')
          if (saved) {
            const parsed = JSON.parse(saved).filter((c) => (c.chatKey || c.sessionId) !== key)
            localStorage.setItem('nest_anon_direct_chats', JSON.stringify(parsed))
          }
        } catch (_) {}

        if (activeDirectSession && (activeDirectSession.chatKey === key || activeDirectSession.sessionId === key)) {
          setActiveDirectSession(null)
          setDirectMessages([])
          setMobileTab('rooms')
        }
      },
    })
  }

  function handleRemoveChat(chatId) {
    handleDeleteDirectChat(chatId)
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
              setSentRequestModal({
                alias: targetUser.alias,
                avatarKey: targetUser.avatarKey,
              })
            } else {
              showAlert(res?.error || t('lounge.radar.requestFailed', { defaultValue: 'Sohbet isteği iletilemedi.' }), 'Sohbet İsteği')
            }
          },
        )
      }
    })
  }

  function handleDirectStarted({ sessionId, partner }) {
    setActiveDirectSession({ sessionId, chatKey: sessionId, partner, isOffline: false })
    setDirectMessages([])
    setMobileTab('chat')
    setSideTab('chats')
    setMyRequestedReveal(false)
    setPartnerRequestedReveal(false)
    setRevealedUsers(null)
    setChatAcceptedModal({ partner })

    setDirectChats((prev) => {
      const existing = prev.filter(
        (c) =>
          c.sessionId !== sessionId &&
          c.chatKey !== sessionId &&
          c.partner?.anonymousId !== partner?.anonymousId,
      )
      const updated = [
        {
          id: sessionId,
          sessionId,
          chatKey: sessionId,
          partner,
          lastMessage: t('lounge.chats.chatStarted', { defaultValue: 'Sohbet başlatıldı' }),
          lastMessageAt: new Date().toISOString(),
        },
        ...existing,
      ]
      try {
        localStorage.setItem('nest_anon_direct_chats', JSON.stringify(updated))
      } catch (_) {}
      return updated
    })
  }

  async function handleEnterAcceptedChat() {
    if (!chatAcceptedModal) return
    const { sessionId, partner } = chatAcceptedModal
    setActiveDirectSession({ sessionId, chatKey: sessionId, partner, isOffline: false })
    setDirectMessages([])
    setMobileTab('chat')
    setSideTab('chats')
    setMyRequestedReveal(false)
    setPartnerRequestedReveal(false)
    setRevealedUsers(null)
    setChatAcceptedModal(null)

    socketRef.current?.emit('anon:join_direct', { chatKey: sessionId, sessionId })
    try {
      const msgs = await getDirectChatMessages(sessionId)
      if (Array.isArray(msgs)) setDirectMessages(msgs)
    } catch (_) {}
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
            showAlert(res?.error || t('lounge.banner.matchFailed', { defaultValue: 'Eşleşme başlatılamadı.' }), 'Kader Çarkı')
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
      sessionId: activeDirectSession.chatKey || activeDirectSession.sessionId,
    })
    setMyRequestedReveal(true)
  }

  // Close Direct Chat (Returns to room/radar without wiping messages or deleting chat)
  function handleCloseDirectChat() {
    setRevealConfirmModal(null)
    if (!activeDirectSession) return

    if (socketRef.current) {
      socketRef.current.emit('anon:leave_direct', {
        sessionId: activeDirectSession.chatKey || activeDirectSession.sessionId,
      })
    }
    setActiveDirectSession(null)
    setMobileTab('rooms')
  }

  function handleLeaveDirectChat() {
    handleCloseDirectChat()
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
          showAlert(err.message || 'Mesaj silinemedi.', 'Silme Hatası')
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
          showAlert(err.message || 'Oda silinemedi.', 'Oda Silme Hatası')
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
          showAlert(err.message || 'Kullanıcı engellenemedi.', 'Engelleme Hatası')
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
    <div className={`fixed inset-0 lg:static lg:h-[100dvh] overflow-hidden bg-bg text-text flex flex-col ${mobileTab === 'chat' ? 'pt-0 lg:pt-14' : 'pt-14'} pb-0 sm:pb-2`}>
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
          {/* Kader Çarkı Butonu (Mobilde Sadece İkon, Masaüstünde Metinle) */}
          <button
            type="button"
            onClick={handleToggleQuickMatch}
            className={`inline-flex items-center justify-center rounded-md px-2.5 sm:px-3 py-1.5 text-xs font-semibold transition-all shadow-xs shrink-0 ${
              isMatching
                ? 'border border-amber-500/40 bg-amber-500/15 text-amber-600 dark:text-amber-400 animate-pulse'
                : 'border border-primary/30 bg-primary/10 text-primary hover:bg-primary/15 active:scale-95'
            }`}
            title={t('lounge.header.wheelTitle', { defaultValue: 'Kader Çarkı: Hızlı Eşleş' })}
          >
            <span className={`text-sm ${isMatching ? 'animate-spin inline-block' : ''}`}>🎡</span>
            <span className="hidden md:inline ml-1.5 font-medium">
              {isMatching
                ? t('lounge.header.matching', { defaultValue: 'Eşleşiyor...' })
                : t('lounge.header.wheelBtn', { defaultValue: 'Kader Çarkı' })}
            </span>
          </button>

          {/* Bildirim İkonu & Paneli */}
          {isAuthenticated && (
            <div className="relative shrink-0" data-dropdown-container>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setActiveMenuId(activeMenuId === 'lounge_notifications' ? null : 'lounge_notifications')
                }}
                className={`relative size-8 sm:size-9 rounded-md border flex items-center justify-center transition-all ${
                  unreadNotificationsCount > 0
                    ? 'border-primary/50 bg-primary/10 text-primary hover:bg-primary/20'
                    : 'border-border bg-secondary/80 text-text hover:bg-secondary hover:text-primary'
                }`}
                title={t('lounge.notifications.title', { defaultValue: 'Gölge Bildirimleri' })}
                aria-label={t('lounge.notifications.title', { defaultValue: 'Gölge Bildirimleri' })}
              >
                <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadNotificationsCount > 0 && (
                  <span className="absolute -top-1 -right-1 size-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-card animate-pulse">
                    {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                  </span>
                )}
              </button>

              {/* Bildirim Paneli Dropdown */}
              {activeMenuId === 'lounge_notifications' && (
                <div
                  className="absolute right-0 top-full mt-2 z-40 w-72 sm:w-80 rounded-md bg-card border border-border shadow-2xl overflow-hidden text-xs"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="px-3 py-2.5 bg-secondary/60 border-b border-border flex items-center justify-between">
                    <span className="font-bold text-text flex items-center gap-1.5">
                      <span>🔔</span>
                      <span>{t('lounge.notifications.title', { defaultValue: 'Gölge Bildirimleri' })}</span>
                    </span>
                    {unreadNotificationsCount > 0 && (
                      <span className="rounded-full bg-primary/15 text-primary border border-primary/30 px-2 py-0.5 text-[10px] font-bold">
                        {unreadNotificationsCount} yeni
                      </span>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-border/50">
                    {/* Gelen Sohbet İsteği Varsa */}
                    {incomingDirectRequest && (
                      <div className="p-3 bg-primary/5 hover:bg-primary/10 transition-colors">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="size-8 rounded-md flex items-center justify-center text-sm shrink-0"
                            style={{ background: getAvatarByKey(incomingDirectRequest.avatarKey).bgStyle }}
                          >
                            {getAvatarByKey(incomingDirectRequest.avatarKey).emoji}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-text truncate">{incomingDirectRequest.alias}</p>
                            <p className="text-[11px] text-muted truncate">
                              {t('lounge.notifications.requestReceived', { defaultValue: 'Sizinle sohbet başlatmak istiyor' })}
                            </p>
                          </div>
                        </div>
                        <div className="mt-2.5 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuId(null)
                              handleAcceptDirectRequest()
                            }}
                            className="flex-1 rounded-md bg-primary py-1 text-[11px] font-bold !text-white hover:bg-primary-hover transition-colors"
                          >
                            {t('lounge.actions.accept', { defaultValue: 'Kabul Et' })}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuId(null)
                              handleRejectDirectRequest()
                            }}
                            className="flex-1 rounded-md border border-border bg-secondary py-1 text-[11px] font-semibold text-text hover:bg-secondary-hover transition-colors"
                          >
                            {t('lounge.actions.reject', { defaultValue: 'Reddet' })}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Okunmamış Mesajı Olan Sohbetler */}
                    {unreadDirectChats.length > 0 ? (
                      unreadDirectChats.map((chat) => (
                        <div
                          key={chat.chatKey || chat.sessionId}
                          onClick={() => {
                            setActiveMenuId(null)
                            openSelectedChat(chat)
                          }}
                          className="p-3 hover:bg-secondary/60 cursor-pointer flex items-center gap-2.5 transition-colors"
                        >
                          <div
                            className="size-8 rounded-md flex items-center justify-center text-sm shrink-0"
                            style={{ background: getAvatarByKey(chat.partner?.avatarKey).bgStyle }}
                          >
                            {getAvatarByKey(chat.partner?.avatarKey).emoji}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-text truncate">{chat.partner?.alias}</span>
                              <span className="rounded-full bg-primary text-white text-[9px] font-bold px-1.5 py-0.2">
                                {chat.unreadCount || 1}
                              </span>
                            </div>
                            <p className="text-[11px] text-muted truncate">
                              {chat.lastMessage?.text || (chat.lastMessage?.hasMedia ? '📷 Medya' : '') || t('lounge.notifications.newMessage', { defaultValue: 'Yeni mesaj' })}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : null}

                    {/* Boş Durum */}
                    {!incomingDirectRequest && unreadDirectChats.length === 0 && (
                      <div className="py-8 text-center text-muted">
                        <span className="text-2xl block mb-1">🔕</span>
                        <p className="font-semibold text-text">{t('lounge.notifications.empty', { defaultValue: 'Yeni bildiriminiz yok' })}</p>
                        <p className="text-[10px] mt-0.5 opacity-75">{t('lounge.notifications.emptySub', { defaultValue: 'Gelen mesaj ve sohbet istekleri burada görünür' })}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

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
                  className={`px-2 sm:px-2.5 py-1 rounded-md text-[11px] sm:text-xs font-semibold transition-all relative flex items-center gap-1 ${
                    sideTab === 'chats'
                      ? 'bg-card text-text shadow-sm border border-border'
                      : 'text-muted hover:text-text'
                  }`}
                >
                  <span>{t('lounge.tabs.chats', { defaultValue: 'Sohbet' })} ({directChats.length})</span>
                  {totalUnreadDirectCount > 0 && (
                    <span className="min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                      {totalUnreadDirectCount > 99 ? '99+' : totalUnreadDirectCount}
                    </span>
                  )}
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
                              {chat.lastMessage?.text ||
                                (typeof chat.lastMessage === 'string' ? chat.lastMessage : '') ||
                                (chat.lastMessage?.hasMedia ? (chat.lastMessage?.mediaType === 'audio' ? '🎤 Sesli Mesaj' : '📷 Fotoğraf') : '') ||
                                t('lounge.chats.chatStarted', { defaultValue: 'Sohbet başlatıldı' })}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-right flex flex-col items-end">
                            <span className="text-[10px] text-muted block">
                              {chat.lastMessageAt
                                ? new Date(chat.lastMessageAt).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : ''}
                            </span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {chat.unreadCount > 0 && (
                                <span className="min-w-[17px] h-[17px] px-1 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center leading-none shadow-xs animate-pulse">
                                  {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                                </span>
                              )}
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
                          </div>

                          {/* 3 Nokta ⋮ Menüsü (Sohbeti Sil veya Kullanıcıyı Engelle) */}
                          <div className="relative" data-dropdown-container>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                const mKey = `chat_item_${chat.chatKey || chat.sessionId || chat.partner?.anonymousId}`
                                setActiveMenuId(activeMenuId === mKey ? null : mKey)
                              }}
                              className="text-muted hover:text-text p-1.5 rounded hover:bg-secondary transition-colors"
                              title={t('lounge.chats.actions', { defaultValue: 'İşlemler' })}
                            >
                              <svg className="size-3.5" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                              </svg>
                            </button>

                            {activeMenuId === `chat_item_${chat.chatKey || chat.sessionId || chat.partner?.anonymousId}` && (
                              <div
                                className="absolute right-0 top-full mt-1 z-30 w-40 rounded-md bg-card border border-border shadow-lg py-1 text-xs"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveMenuId(null)
                                    handleDeleteDirectChat(chat.chatKey || chat.sessionId)
                                  }}
                                  className="w-full text-left px-3 py-1.5 text-text hover:bg-secondary flex items-center gap-2 transition-colors"
                                >
                                  <span>🗑️</span>
                                  <span>{t('lounge.chats.deleteChatTitle', { defaultValue: 'Sohbeti Sil' })}</span>
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
                    {/* Sesli Arama Butonu */}
                    <button
                      type="button"
                      onClick={startAnonymousCall}
                      disabled={anonCallState !== 'idle'}
                      className="rounded-md border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 p-1.5 sm:px-2.5 sm:py-1.5 text-[11px] sm:text-xs font-semibold flex items-center gap-1 shrink-0 transition-colors disabled:opacity-40"
                      title={t('calling.voiceCall', { defaultValue: 'Sesli Arama' })}
                      aria-label={t('calling.voiceCall', { defaultValue: 'Sesli Arama' })}
                    >
                      <PhoneIcon className="size-3.5 sm:size-4" />
                      <span className="hidden sm:inline">{t('calling.voiceCall', { defaultValue: 'Ara' })}</span>
                    </button>

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


                    {/* Dikey 3 Nokta ⋮ Menüsü (Sohbeti Sil / Kullanıcı Engelleme) */}
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
                              handleDeleteDirectChat(
                                activeDirectSession.chatKey || activeDirectSession.sessionId,
                              )
                            }
                            className="w-full text-left px-3 py-1.5 text-text hover:bg-secondary flex items-center gap-2 transition-colors font-medium border-b border-border/50"
                          >
                            <span>🗑️</span>
                            <span>{t('lounge.chats.deleteChatTitle', { defaultValue: 'Sohbeti Sil' })}</span>
                          </button>
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

                  {/* Oda Kurucusu veya Admin Özel Dikey 3 Nokta ⋮ Menüsü (Odayı Silme) */}
                  {!selectedRoom.isSystem &&
                    (selectedRoom.createdBy === (user?.id || user?._id) ||
                      selectedRoom.creatorAlias === anonProfile?.alias ||
                      user?.role === 'admin') && (
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
                              <span>
                                {user?.role === 'admin' &&
                                selectedRoom.createdBy !== (user?.id || user?._id)
                                  ? 'Odayı Kapat (Admin)'
                                  : t('lounge.rooms.deleteRoom', { defaultValue: 'Odayı Sil' })}
                              </span>
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
            <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0 overscroll-contain">
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
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] opacity-60">
                                {new Date(msg.createdAt).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                              {isMe && activeDirectSession && (
                                <span
                                  className="inline-flex items-center ml-0.5"
                                  title={
                                    msg.status === 'read'
                                      ? t('lounge.messages.seen', { defaultValue: 'Görüldü' })
                                      : msg.status === 'delivered'
                                      ? t('lounge.messages.delivered', { defaultValue: 'İletildi' })
                                      : t('lounge.messages.sent', { defaultValue: 'Gönderildi' })
                                  }
                                >
                                  {msg.status === 'read' ? (
                                    /* Çift Mavi / Açık Renk Tik (Görüldü) */
                                    <svg
                                      className="size-3.5 text-sky-300 drop-shadow-xs"
                                      viewBox="0 0 16 16"
                                      fill="currentColor"
                                    >
                                      <path d="M12.354 4.354a.5.5 0 0 0-.708-.708L5 10.293 2.354 7.646a.5.5 0 1 0-.708.708l3 3a.5.5 0 0 0 .708 0l7-7z" />
                                      <path d="M14.354 4.354a.5.5 0 0 0-.708-.708L7 10.293 5.354 8.646a.5.5 0 1 0-.708.708l2 2a.5.5 0 0 0 .708 0l7-7z" />
                                    </svg>
                                  ) : msg.status === 'delivered' ? (
                                    /* Çift Gri / Soluk Tik (İletildi) */
                                    <svg
                                      className="size-3.5 text-white/70"
                                      viewBox="0 0 16 16"
                                      fill="currentColor"
                                    >
                                      <path d="M12.354 4.354a.5.5 0 0 0-.708-.708L5 10.293 2.354 7.646a.5.5 0 1 0-.708.708l3 3a.5.5 0 0 0 .708 0l7-7z" />
                                      <path d="M14.354 4.354a.5.5 0 0 0-.708-.708L7 10.293 5.354 8.646a.5.5 0 1 0-.708.708l2 2a.5.5 0 0 0 .708 0l7-7z" />
                                    </svg>
                                  ) : (
                                    /* Tek Tik (Gönderildi) */
                                    <svg
                                      className="size-3 text-white/60"
                                      viewBox="0 0 16 16"
                                      fill="currentColor"
                                    >
                                      <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z" />
                                    </svg>
                                  )}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* 3 Nokta ⋮ Menüsü (Kullanıcının kendi mesajları veya Admin için silme) */}
                          {(isMe || user?.role === 'admin') && (
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
                                  className="absolute right-0 top-full mt-1 z-30 w-36 rounded-md bg-card border border-border shadow-lg py-1 text-xs text-text"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    type="button"
                                    onClick={() => promptDeleteMessage(msg.id)}
                                    className="w-full text-left px-3 py-1.5 text-red-500 hover:bg-secondary flex items-center gap-2 transition-colors font-semibold"
                                  >
                                    <span>🗑️</span>
                                    <span>
                                      {user?.role === 'admin' && !isMe
                                        ? 'Sil (Admin)'
                                        : t('lounge.messages.delete', { defaultValue: 'Mesajı Sil' })}
                                    </span>
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Media display (Image & Audio) */}
                        {Array.isArray(msg.media) && msg.media.length > 0 && (
                          <div className="mb-2 space-y-1.5">
                            {msg.media.map((item, idx) => {
                              if (item.type === 'image') {
                                return (
                                  <div key={idx} className="relative overflow-hidden rounded-md border border-border/50 max-w-xs">
                                    <img
                                      src={resolveMediaUrl(item.url)}
                                      alt="Anonim Medya"
                                      className="max-h-60 w-auto object-cover rounded-md cursor-pointer hover:opacity-95 transition-opacity"
                                      onClick={() => window.open(resolveMediaUrl(item.url), '_blank')}
                                    />
                                  </div>
                                )
                              }
                              if (item.type === 'audio') {
                                return (
                                  <div key={idx} className="py-1">
                                    <AudioMessagePlayer
                                      src={resolveMediaUrl(item.url)}
                                      duration={item.durationSeconds || 0}
                                      isMine={isMe}
                                    />
                                  </div>
                                )
                              }
                              return null
                            })}
                          </div>
                        )}

                        {msg.text ? <p className="leading-relaxed break-words text-sm">{msg.text}</p> : null}
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat Input Bar */}
            <div className="p-2.5 sm:p-3 border-t border-border bg-secondary/30 rounded-b-none sm:rounded-b-md shrink-0">
              {/* Hidden file input for image upload */}
              <input
                type="file"
                ref={imageInputRef}
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />

              {/* Selected Image Preview Thumbnail */}
              {selectedImagePreview && (
                <div className="mb-2 relative inline-block">
                  <div className="relative rounded-lg overflow-hidden border border-border bg-card shadow-sm w-20 h-20 group">
                    <img
                      src={selectedImagePreview}
                      alt="Önizleme"
                      className="w-full h-full object-cover"
                    />

                    {/* Processing overlay with animated spinner */}
                    {isUploadingMedia && (
                      <div className="absolute inset-0 bg-black/65 backdrop-blur-[1px] flex flex-col items-center justify-center gap-1">
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span className="text-[9px] text-white font-semibold">İşleniyor...</span>
                      </div>
                    )}

                    {/* Ready badge when upload succeeds */}
                    {!isUploadingMedia && uploadedMediaItem && (
                      <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-emerald-600/90 text-white text-[9px] font-bold shadow-xs flex items-center gap-0.5">
                        <span>✓</span>
                        <span>Hazır</span>
                      </div>
                    )}

                    {/* Remove button */}
                    <button
                      type="button"
                      onClick={clearSelectedImage}
                      disabled={isUploadingMedia}
                      className="absolute top-1 right-1 p-0.5 rounded-full bg-black/70 text-white hover:bg-black transition-colors disabled:opacity-40"
                      title="Görseli kaldır"
                    >
                      <CloseIcon className="size-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Live Voice Recording Bar */}
              {isRecordingVoice ? (
                <div className="flex items-center justify-between gap-3 bg-card border border-destructive/30 rounded-xl px-4 py-2 text-sm shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-3 h-3 rounded-full bg-destructive animate-ping" />
                    <span className="font-bold text-destructive font-mono">
                      {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}
                    </span>
                    <span className="text-xs text-muted">Ses kaydediliyor...</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={cancelVoiceRecording}
                      className="p-2 rounded-full text-muted hover:text-destructive hover:bg-destructive/10 transition-colors"
                      title="İptal et"
                    >
                      <TrashIcon className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={stopVoiceRecordingAndSend}
                      disabled={isUploadingMedia}
                      className="p-2 rounded-full bg-primary text-white hover:bg-primary-hover shadow active:scale-95 transition-all"
                      title="Gönder"
                    >
                      <SendIcon className="size-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <form
                  onSubmit={activeDirectSession ? handleSendDirectMessage : handleSendRoomMessage}
                  className="flex items-center gap-1.5 sm:gap-2"
                >
                  {/* Photo Attachment Button */}
                  <button
                    type="button"
                    onClick={() => {
                      if (!isAuthenticated) {
                        setGateActionLabel('Görsel göndermek için giriş yapın')
                        setGateModalOpen(true)
                        return
                      }
                      imageInputRef.current?.click()
                    }}
                    disabled={isUploadingMedia}
                    className="p-2 sm:p-2.5 rounded-lg text-muted hover:text-primary hover:bg-secondary active:scale-95 transition-all shrink-0"
                    title="Görsel ekle"
                  >
                    <PhotoIcon className="size-5" />
                  </button>

                  {/* Input field */}
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
                    className="flex-1 rounded-md border border-border bg-card px-3.5 py-2 sm:py-2.5 text-xs sm:text-sm text-text placeholder:text-muted focus:border-primary focus:outline-none"
                  />

                  {/* If input is empty and no image selected, show Mic button */}
                  {!messageInput.trim() && !selectedImage && !uploadedMediaItem ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (!isAuthenticated) {
                          setGateActionLabel('Sesli mesaj göndermek için giriş yapın')
                          setGateModalOpen(true)
                          return
                        }
                        startVoiceRecording()
                      }}
                      className="p-2 sm:p-2.5 rounded-lg text-muted hover:text-primary hover:bg-secondary active:scale-95 transition-all shrink-0"
                      title="Sesli mesaj kaydet"
                    >
                      <MicrophoneIcon className="size-5" />
                    </button>
                  ) : (
                    /* Mobile: Send button is icon-only. Desktop: Send button has icon + text */
                    <button
                      type="submit"
                      disabled={
                        isUploadingMedia ||
                        (!messageInput.trim() && !uploadedMediaItem)
                      }
                      className="rounded-full sm:rounded-md bg-primary p-2.5 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-bold !text-white shadow hover:bg-primary-hover active:scale-95 disabled:opacity-40 transition-all flex items-center justify-center gap-1.5 shrink-0"
                      title={
                        isUploadingMedia
                          ? 'Görsel işleniyor...'
                          : t('lounge.messages.send', { defaultValue: 'Gönder' })
                      }
                    >
                      {isUploadingMedia ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <SendIcon className="size-4" />
                      )}
                      <span className="hidden sm:inline-block">
                        {isUploadingMedia
                          ? 'İşleniyor...'
                          : t('lounge.messages.send', { defaultValue: 'Gönder' })}
                      </span>
                    </button>
                  )}
                </form>
              )}
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
                {t('lounge.disclaimer.title', { defaultValue: 'Gizli Profile Hoş Geldiniz!' })}
              </h3>

              <p className="mt-2.5 text-xs sm:text-sm leading-relaxed text-muted">
                {t('lounge.disclaimer.desc', {
                  defaultValue: 'Günün stresini atmak ve kafa dağıtmak için tasarlanmış anonim sohbet alanındasınız.',
                })}
              </p>

              <div className="mt-4 rounded-md border border-border bg-secondary/70 p-3.5 text-left text-xs text-text space-y-2">
                <div className="flex items-start gap-2.5">
                  <span className="text-base shrink-0">🤫</span>
                  <p>
                    <strong>{t('lounge.disclaimer.rule1Title', { defaultValue: 'Tam Gizlilik:' })}</strong>{' '}
                    {t('lounge.disclaimer.rule1Desc', {
                      defaultValue: 'Rastgele rumuz ve avatarlarla kimliğiniz tamamen saklı kalır.',
                    })}
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="text-base shrink-0">⚠️</span>
                  <p>
                    <strong>{t('lounge.disclaimer.rule2Title', { defaultValue: 'Güvenlik Uyarısı:' })}</strong>{' '}
                    {t('lounge.disclaimer.rule2Desc', {
                      defaultValue: 'Kişisel, finansal veya hassas bilgilerinizi kesinlikle paylaşmayın.',
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

      {/* Hidden audio element for receiving WebRTC remote audio stream */}
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      {/* WebRTC Anonymous Voice Calling: Incoming Call Modal */}
      {anonCallState === 'incoming' && anonCallInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-primary/40 bg-card p-6 text-text shadow-2xl text-center animate-in zoom-in-95 duration-200">
            <div className="relative mx-auto mb-4 size-20">
              <div
                className="size-20 rounded-2xl flex items-center justify-center text-4xl shadow-xl ring-4 ring-primary/30 animate-pulse"
                style={{
                  background: getAvatarByKey(anonCallInfo.partnerAvatar).bgStyle,
                }}
              >
                {getAvatarByKey(anonCallInfo.partnerAvatar).emoji}
              </div>
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-2">
              <span className="size-2 rounded-full bg-primary animate-ping" />
              <span>Gölge Modu Sesli Arama</span>
            </div>

            <h3 className="text-xl font-black text-text">
              {anonCallInfo.partnerAlias || 'Gizli Profil'}
            </h3>
            <p className="mt-1 text-xs text-muted">
              Size anonim sesli arama yapıyor...
            </p>

            <div className="mt-6 flex items-center justify-center gap-8">
              {/* Reject Call */}
              <button
                type="button"
                onClick={rejectAnonymousCall}
                className="flex flex-col items-center gap-1.5 group"
              >
                <div className="size-14 rounded-full bg-destructive text-white flex items-center justify-center shadow-lg group-hover:bg-destructive/90 active:scale-95 transition-all">
                  <CloseIcon className="size-6" />
                </div>
                <span className="text-xs font-medium text-muted group-hover:text-text">Reddet</span>
              </button>

              {/* Accept Call */}
              <button
                type="button"
                onClick={acceptAnonymousCall}
                className="flex flex-col items-center gap-1.5 group"
              >
                <div className="size-14 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-lg group-hover:bg-emerald-500 active:scale-95 transition-all animate-bounce">
                  <PhoneIcon className="size-6" />
                </div>
                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 font-semibold">Cevapla</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WebRTC Anonymous Voice Calling: Active / Calling Call Modal */}
      {(anonCallState === 'calling' || anonCallState === 'connected') && anonCallInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-300">
          <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-card p-6 text-text shadow-2xl text-center animate-in zoom-in-95 duration-200">
            <div className="relative mx-auto mb-4 size-20">
              <div
                className={`size-20 rounded-2xl flex items-center justify-center text-4xl shadow-xl ${
                  anonCallState === 'connected'
                    ? 'ring-4 ring-emerald-500/40'
                    : 'ring-4 ring-primary/30 animate-pulse'
                }`}
                style={{
                  background: getAvatarByKey(anonCallInfo.partnerAvatar).bgStyle,
                }}
              >
                {getAvatarByKey(anonCallInfo.partnerAvatar).emoji}
              </div>
            </div>

            <h3 className="text-xl font-bold text-text">
              {anonCallInfo.partnerAlias || 'Gizli Profil'}
            </h3>

            <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary text-xs font-mono font-medium">
              {anonCallState === 'connected' ? (
                <>
                  <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-emerald-500 font-bold">
                    {Math.floor(callDuration / 60)}:{(callDuration % 60).toString().padStart(2, '0')}
                  </span>
                </>
              ) : (
                <>
                  <span className="size-2 rounded-full bg-amber-500 animate-ping" />
                  <span className="text-muted">Aranıyor...</span>
                </>
              )}
            </div>

            <div className="mt-8 flex items-center justify-center gap-8">
              {/* Mute / Unmute Button */}
              <button
                type="button"
                onClick={toggleCallMute}
                className="flex flex-col items-center gap-1.5 group"
              >
                <div
                  className={`size-12 rounded-full flex items-center justify-center shadow transition-all ${
                    isCallMuted
                      ? 'bg-amber-500/20 text-amber-500 border border-amber-500/40'
                      : 'bg-secondary text-text hover:bg-secondary-hover'
                  }`}
                >
                  <MicrophoneIcon className="size-5" />
                </div>
                <span className="text-xs text-muted">
                  {isCallMuted ? 'Sessiz' : 'Sesi Kapat'}
                </span>
              </button>

              {/* End Call Button */}
              <button
                type="button"
                onClick={() => endAnonymousCall(true)}
                className="flex flex-col items-center gap-1.5 group"
              >
                <div className="size-14 rounded-full bg-destructive text-white flex items-center justify-center shadow-lg hover:bg-destructive/90 active:scale-95 transition-all">
                  <PhoneIcon className="size-6 rotate-[135deg]" />
                </div>
                <span className="text-xs font-medium text-destructive">Sonlandır</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Özel Profesyonel Pop-Up Uyarı Modalı (Tarayıcı alert'leri yerine) */}
      {alertModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setAlertModal(null)}
        >
          <div
            className="relative w-full max-w-sm overflow-hidden rounded-xl border border-border bg-card p-6 text-text shadow-2xl text-center animate-in zoom-in-95 duration-150"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={`mx-auto mb-3.5 flex size-14 items-center justify-center rounded-2xl text-2xl shadow-md ${
                alertModal.tone === 'error'
                  ? 'bg-destructive/15 text-destructive border border-destructive/20'
                  : alertModal.tone === 'success'
                  ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/20'
                  : 'bg-primary/15 text-primary border border-primary/20'
              }`}
            >
              {alertModal.tone === 'error' ? '⚠️' : alertModal.tone === 'success' ? '✅' : 'ℹ️'}
            </div>

            <h3 className="text-base sm:text-lg font-bold text-text">
              {alertModal.title}
            </h3>

            <p className="mt-2 text-xs sm:text-sm leading-relaxed text-muted whitespace-pre-line">
              {alertModal.message}
            </p>

            <div className="mt-5">
              <button
                type="button"
                onClick={() => setAlertModal(null)}
                className="w-full rounded-md bg-primary py-2.5 text-xs sm:text-sm font-bold !text-white shadow hover:bg-primary-hover active:scale-95 transition-all"
              >
                {t('common.ok', { defaultValue: 'Tamam' })}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
