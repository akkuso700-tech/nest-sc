import { useCallback, useEffect, useRef, useState } from 'react'
import { getSocketClient } from '../services/socketClient.js'
import { apiRequest } from '../lib/apiClient.js'
import {
  playCallConnectSound,
  playCallEndSound,
  startIncomingRingtone,
  startOutgoingRingtone,
} from '../utils/callSounds.js'

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
]

const DEFAULT_AUDIO_CONSTRAINTS = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
}

export function parseMediaError(err, callType) {
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return {
      code: 'NOT_SECURE_CONTEXT',
      message: 'Kamera ve mikrofon için güvenli bağlantı (localhost veya HTTPS) gereklidir. IP adresi yerine http://localhost kullanın.',
    }
  }

  const name = err?.name || ''
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return {
      code: 'PERMISSION_DENIED',
      message: callType === 'video'
        ? 'Kamera veya mikrofon izni engellendi. Adres çubuğundaki kilit/ayar simgesine tıklayıp kamera ve mikrofona izin verin.'
        : 'Mikrofon izni engellendi. Adres çubuğundaki kilit/ayar simgesine tıklayıp mikrofona izin verin.',
    }
  }

  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return {
      code: 'DEVICE_NOT_FOUND',
      message: callType === 'video'
        ? 'Kamera veya mikrofon donanımı bulunamadı. Cihazınızda takılı bir kamera/mikrofon olduğundan emin olun.'
        : 'Mikrofon donanımı bulunamadı. Lütfen bir mikrofon takılı olduğundan emin olun.',
    }
  }

  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return {
      code: 'DEVICE_IN_USE',
      message: 'Kamera veya mikrofon başka bir uygulama (Zoom, Teams vb.) veya başka bir sekme tarafından kullanılıyor.',
    }
  }

  return {
    code: 'MEDIA_ERROR',
    message: err?.message || 'Kamera veya mikrofona erişilemedi.',
  }
}

function createCallRecorder({ callId, callType, localStream, remoteStream }) {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') return null

  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    let audioCtx = null
    let mixedAudioTrack = null

    if (AudioContextClass) {
      audioCtx = new AudioContextClass()
      const dest = audioCtx.createMediaStreamDestination()

      if (localStream?.getAudioTracks()?.length) {
        try {
          const localSrc = audioCtx.createMediaStreamSource(localStream)
          localSrc.connect(dest)
        } catch {
          // Ignore
        }
      }

      if (remoteStream?.getAudioTracks()?.length) {
        try {
          const remoteSrc = audioCtx.createMediaStreamSource(remoteStream)
          remoteSrc.connect(dest)
        } catch {
          // Ignore
        }
      }

      mixedAudioTrack = dest.stream.getAudioTracks()[0]
    }

    const recordingStream = new MediaStream()
    if (mixedAudioTrack) {
      recordingStream.addTrack(mixedAudioTrack)
    } else {
      const fallbackAudio = remoteStream?.getAudioTracks()[0] || localStream?.getAudioTracks()[0]
      if (fallbackAudio) recordingStream.addTrack(fallbackAudio)
    }

    let mimeType = 'audio/webm;codecs=opus'
    let recorderOptions = { audioBitsPerSecond: 32000 }

    if (callType === 'video') {
      const videoTrack = remoteStream?.getVideoTracks()[0] || localStream?.getVideoTracks()[0]
      if (videoTrack) {
        recordingStream.addTrack(videoTrack)
      }

      if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
        mimeType = 'video/webm;codecs=vp8,opus'
      } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
        mimeType = 'video/webm;codecs=vp9,opus'
      } else if (MediaRecorder.isTypeSupported('video/webm')) {
        mimeType = 'video/webm'
      } else if (MediaRecorder.isTypeSupported('video/mp4')) {
        mimeType = 'video/mp4'
      }

      // 720p compressed stream: 800 kbps video + 32 kbps audio
      recorderOptions = {
        mimeType,
        videoBitsPerSecond: 800000,
        audioBitsPerSecond: 32000,
      }
    } else {
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus'
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        mimeType = 'audio/webm'
      } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
        mimeType = 'audio/ogg'
      }
      recorderOptions = {
        mimeType,
        audioBitsPerSecond: 32000,
      }
    }

    const chunks = []
    const recorder = new MediaRecorder(recordingStream, recorderOptions)

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        chunks.push(event.data)
      }
    }

    recorder.start(1000)

    return {
      recorder,
      audioCtx,
      stopAndUpload: async (durationSec) => {
        return new Promise((resolve) => {
          recorder.onstop = async () => {
            try {
              const blob = new Blob(chunks, { type: mimeType })
              if (blob.size > 2000) {
                const ext = callType === 'video' ? 'webm' : 'webm'
                const formData = new FormData()
                formData.append('recording', blob, `call-${callId}.${ext}`)
                formData.append('durationSec', String(durationSec || 0))

                await apiRequest(`/calls/${encodeURIComponent(callId)}/recording`, {
                  method: 'POST',
                  body: formData,
                })
              }
            } catch (err) {
              console.warn('Call recording upload background error:', err)
            } finally {
              if (audioCtx) {
                try {
                  audioCtx.close()
                } catch {
                  // Ignore
                }
              }
              resolve()
            }
          }

          try {
            if (recorder.state !== 'inactive') {
              recorder.stop()
            } else {
              resolve()
            }
          } catch {
            resolve()
          }
        })
      },
    }
  } catch (err) {
    console.warn('Could not initialize MediaRecorder for call:', err)
    return null
  }
}

export function useWebRTCCall({ onCallEnded } = {}) {
  const [callState, setCallState] = useState('idle') // 'idle' | 'calling' | 'incoming' | 'connected'
  const [activeCall, setActiveCall] = useState(null) // { callId, callType, peer, isCaller }
  const [incomingCall, setIncomingCall] = useState(null) // { callId, callType, caller, conversationId }
  const [callDuration, setCallDuration] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOff, setIsVideoOff] = useState(false)
  const [isPeerMuted, setIsPeerMuted] = useState(false)
  const [isPeerVideoOff, setIsPeerVideoOff] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [facingMode, setFacingMode] = useState('user') // 'user' | 'environment'
  const [isSpeakerOn, setIsSpeakerOn] = useState(true)
  const [errorMessage, setErrorMessage] = useState(null)
  const [localStream, setLocalStream] = useState(null)
  const [remoteStream, setRemoteStream] = useState(null)

  const pcRef = useRef(null)
  const localStreamRef = useRef(null)
  const remoteStreamRef = useRef(null)
  const ringtoneStopRef = useRef(null)
  const durationIntervalRef = useRef(null)
  const pendingCandidatesRef = useRef([])
  const activeCallRef = useRef(null)
  const recorderSessionRef = useRef(null)
  const callDurationRef = useRef(0)

  useEffect(() => {
    activeCallRef.current = activeCall
  }, [activeCall])

  useEffect(() => {
    callDurationRef.current = callDuration
  }, [callDuration])

  const tryStartRecording = useCallback((callId, callType, remoteStreamTrack) => {
    if (recorderSessionRef.current) return
    const rec = createCallRecorder({
      callId,
      callType,
      localStream: localStreamRef.current,
      remoteStream: remoteStreamTrack || remoteStreamRef.current,
    })
    if (rec) {
      recorderSessionRef.current = rec
    }
  }, [])

  const cleanupMediaAndPeer = useCallback(() => {
    if (recorderSessionRef.current) {
      const rec = recorderSessionRef.current
      recorderSessionRef.current = null
      rec.stopAndUpload(callDurationRef.current).catch(() => {})
    }

    if (ringtoneStopRef.current) {
      ringtoneStopRef.current()
      ringtoneStopRef.current = null
    }

    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current)
      durationIntervalRef.current = null
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop())
      localStreamRef.current = null
    }

    if (pcRef.current) {
      try {
        pcRef.current.close()
      } catch {
        // Ignore
      }
      pcRef.current = null
    }

    remoteStreamRef.current = null
    pendingCandidatesRef.current = []
    setLocalStream(null)
    setRemoteStream(null)
    setCallDuration(0)
    setIsMuted(false)
    setIsVideoOff(false)
    setIsPeerMuted(false)
    setIsPeerVideoOff(false)
    setIsSpeakerOn(true)
    setFacingMode('user')
  }, [])

  const handleEndCallInternal = useCallback(
    (showSound = true) => {
      cleanupMediaAndPeer()
      setCallState('idle')
      setActiveCall(null)
      setIncomingCall(null)
      if (showSound) {
        playCallEndSound()
      }
      if (onCallEnded) {
        onCallEnded()
      }
    },
    [cleanupMediaAndPeer, onCallEnded],
  )

  const setupPeerConnection = useCallback(
    (callId, targetPeerId, onRemoteStreamUpdate) => {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
      pcRef.current = pc

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          const socket = getSocketClient()
          socket.emit('call:signal', {
            callId,
            to: targetPeerId,
            data: { candidate: event.candidate },
          })
        }
      }

      pc.ontrack = (event) => {
        const stream = (event.streams && event.streams[0]) || new MediaStream([event.track])
        remoteStreamRef.current = stream
        setRemoteStream(stream)
        if (onRemoteStreamUpdate) {
          onRemoteStreamUpdate(stream)
        }

        if (activeCallRef.current?.callId) {
          tryStartRecording(activeCallRef.current.callId, activeCallRef.current.callType, stream)
        }
      }

      return pc
    },
    [tryStartRecording],
  )

  const startCall = useCallback(
    async (recipient, callType = 'voice', conversationId = null) => {
      if (!recipient || !recipient.id && !recipient._id) {
        return { ok: false, message: 'Invalid recipient' }
      }

      setErrorMessage(null)
      const recipientId = recipient.id || recipient._id

      // Check media devices support
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        const error = typeof window !== 'undefined' && !window.isSecureContext
          ? 'Kamera ve mikrofon için güvenli bağlantı (localhost veya HTTPS) gereklidir. IP adresi yerine http://localhost kullanın.'
          : 'Bu tarayıcı kamera veya mikrofon desteği sunmuyor.'
        setErrorMessage(error)
        return { ok: false, code: 'NOT_SUPPORTED', message: error }
      }

      let stream = null
      try {
        const videoConstraints = callType === 'video'
          ? {
              width: { ideal: 1280, min: 640 },
              height: { ideal: 720, min: 480 },
              frameRate: { ideal: 24, max: 30 },
            }
          : false

        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: DEFAULT_AUDIO_CONSTRAINTS,
            video: videoConstraints,
          })
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: videoConstraints,
          })
        }
        localStreamRef.current = stream
        setLocalStream(stream)
      } catch (err) {
        const parsed = parseMediaError(err, callType)
        setErrorMessage(parsed.message)
        return { ok: false, code: parsed.code, message: parsed.message }
      }

      const socket = getSocketClient()
      if (!socket.connected) {
        stream.getTracks().forEach((t) => t.stop())
        localStreamRef.current = null
        setLocalStream(null)
        const error = 'Chat connection not active. Please reconnect.'
        setErrorMessage(error)
        return { ok: false, code: 'SOCKET_DISCONNECTED', message: error }
      }

      return new Promise((resolve) => {
        socket.emit(
          'call:initiate',
          {
            recipientId: recipientId.toString(),
            conversationId,
            callType,
          },
          (response) => {
            if (!response?.ok) {
              if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach((t) => t.stop())
                localStreamRef.current = null
                setLocalStream(null)
              }
              const code = response?.code || 'CALL_FAILED'
              const message = response?.message || 'Call could not be started.'
              setErrorMessage(message)
              resolve({ ok: false, code, message })
              return
            }

            const { callId } = response
            setActiveCall({
              callId,
              callType,
              peer: recipient,
              isCaller: true,
              conversationId,
            })
            setCallState('calling')

            ringtoneStopRef.current = startOutgoingRingtone()

            resolve({ ok: true, callId })
          },
        )
      })
    },
    [],
  )

  const acceptIncomingCall = useCallback(async () => {
    if (!incomingCall) return

    if (ringtoneStopRef.current) {
      ringtoneStopRef.current()
      ringtoneStopRef.current = null
    }

    const { callId, callType, caller, conversationId } = incomingCall

    let stream = null
    try {
      const videoConstraints = callType === 'video'
        ? {
            width: { ideal: 1280, min: 640 },
            height: { ideal: 720, min: 480 },
            frameRate: { ideal: 24, max: 30 },
          }
        : false

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: DEFAULT_AUDIO_CONSTRAINTS,
          video: videoConstraints,
        })
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: videoConstraints,
        })
      }
      localStreamRef.current = stream
      setLocalStream(stream)
    } catch (err) {
      handleEndCallInternal(true)
      const parsed = parseMediaError(err, callType)
      setErrorMessage(parsed.message)
      return
    }

    const callerId = caller.id || caller._id
    const pc = setupPeerConnection(callId, callerId.toString())

    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream)
    })

    const socket = getSocketClient()
    socket.emit('call:accept', { callId }, (res) => {
      if (!res?.ok) {
        handleEndCallInternal(false)
        return
      }

      playCallConnectSound()
      setActiveCall({
        callId,
        callType,
        peer: caller,
        isCaller: false,
        conversationId,
      })
      setCallState('connected')
      setIncomingCall(null)
      tryStartRecording(callId, callType, remoteStreamRef.current)

      durationIntervalRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1)
      }, 1000)
    })
  }, [handleEndCallInternal, incomingCall, setupPeerConnection, tryStartRecording])

  const rejectIncomingCall = useCallback(
    (reason = 'declined') => {
      if (!incomingCall) return

      if (ringtoneStopRef.current) {
        ringtoneStopRef.current()
        ringtoneStopRef.current = null
      }

      const { callId } = incomingCall
      const socket = getSocketClient()
      socket.emit('call:reject', { callId, reason })

      setIncomingCall(null)
      setCallState('idle')
    },
    [incomingCall],
  )

  const endCall = useCallback(() => {
    const current = activeCallRef.current
    if (current?.callId) {
      const socket = getSocketClient()
      socket.emit('call:end', { callId: current.callId })
    }
    handleEndCallInternal(true)
  }, [handleEndCallInternal])

  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return
    const audioTrack = localStreamRef.current.getAudioTracks()[0]
    if (!audioTrack) return

    const nextMuted = !isMuted
    audioTrack.enabled = !nextMuted
    setIsMuted(nextMuted)

    const current = activeCallRef.current
    if (current?.callId) {
      const socket = getSocketClient()
      socket.emit('call:toggle_media', {
        callId: current.callId,
        isMuted: nextMuted,
        isVideoOff,
      })
    }
  }, [isMuted, isVideoOff])

  const toggleVideo = useCallback(() => {
    if (!localStreamRef.current) return
    const videoTrack = localStreamRef.current.getVideoTracks()[0]
    if (!videoTrack) return

    const nextVideoOff = !isVideoOff
    videoTrack.enabled = !nextVideoOff
    setIsVideoOff(nextVideoOff)

    const current = activeCallRef.current
    if (current?.callId) {
      const socket = getSocketClient()
      socket.emit('call:toggle_media', {
        callId: current.callId,
        isMuted,
        isVideoOff: nextVideoOff,
      })
    }
  }, [isMuted, isVideoOff])

  const toggleMinimize = useCallback(() => {
    setIsMinimized((prev) => !prev)
  }, [])

  const toggleSpeaker = useCallback((remoteElement) => {
    setIsSpeakerOn((prev) => {
      const next = !prev
      if (remoteElement) {
        if (typeof remoteElement.setSinkId === 'function') {
          navigator.mediaDevices?.enumerateDevices?.().then((devices) => {
            const outputs = devices.filter((d) => d.kind === 'audiooutput')
            if (outputs.length > 1) {
              const target = next ? outputs[0]?.deviceId : (outputs[1]?.deviceId || outputs[0]?.deviceId)
              remoteElement.setSinkId(target).catch(() => {})
            }
          }).catch(() => {})
        }
        remoteElement.volume = next ? 1.0 : 0.25
      }
      return next
    })
  }, [])

  const switchCamera = useCallback(async () => {
    if (!localStreamRef.current || !activeCallRef.current || activeCallRef.current.callType !== 'video') return

    const nextFacing = facingMode === 'user' ? 'environment' : 'user'

    try {
      let newStream = null
      try {
        newStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { exact: nextFacing },
            width: { ideal: 1280, min: 640 },
            height: { ideal: 720, min: 480 },
            frameRate: { ideal: 24, max: 30 },
          },
        })
      } catch {
        newStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: nextFacing },
            width: { ideal: 1280, min: 640 },
            height: { ideal: 720, min: 480 },
            frameRate: { ideal: 24, max: 30 },
          },
        })
      }

      const newVideoTrack = newStream?.getVideoTracks?.()[0]
      if (!newVideoTrack) return

      // Replace track on WebRTC PeerConnection
      if (pcRef.current) {
        const sender = pcRef.current.getSenders().find((s) => s.track && s.track.kind === 'video')
        if (sender) {
          await sender.replaceTrack(newVideoTrack)
        }
      }

      // Stop old video track
      const oldVideoTrack = localStreamRef.current.getVideoTracks()[0]
      if (oldVideoTrack) {
        oldVideoTrack.stop()
      }

      // Rebuild local MediaStream
      const currentAudioTrack = localStreamRef.current.getAudioTracks()[0]
      const updatedStream = new MediaStream()
      if (currentAudioTrack) updatedStream.addTrack(currentAudioTrack)
      updatedStream.addTrack(newVideoTrack)

      localStreamRef.current = updatedStream
      setLocalStream(updatedStream)
      setFacingMode(nextFacing)
    } catch (err) {
      console.warn('Could not switch camera:', err)
    }
  }, [facingMode])

  // Setup socket event listeners
  useEffect(() => {
    const socket = getSocketClient()

    const onIncomingCall = (payload) => {
      if (activeCallRef.current) {
        // Already on call: auto-reject as busy
        socket.emit('call:reject', { callId: payload.callId, reason: 'busy' })
        return
      }

      setIncomingCall(payload)
      setCallState('incoming')
      ringtoneStopRef.current = startIncomingRingtone()
    }

    const onCallAccepted = async (payload) => {
      const current = activeCallRef.current
      if (!current || current.callId !== payload.callId) return

      if (ringtoneStopRef.current) {
        ringtoneStopRef.current()
        ringtoneStopRef.current = null
      }

      playCallConnectSound()
      setCallState('connected')
      tryStartRecording(current.callId, current.callType, remoteStreamRef.current)

      durationIntervalRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1)
      }, 1000)

      // Caller creates WebRTC offer
      if (current.isCaller) {
        const peerId = (current.peer.id || current.peer._id).toString()
        const pc = setupPeerConnection(current.callId, peerId)

        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach((track) => {
            pc.addTrack(track, localStreamRef.current)
          })
        }

        try {
          const offer = await pc.createOffer()
          await pc.setLocalDescription(offer)
          socket.emit('call:signal', {
            callId: current.callId,
            to: peerId,
            data: { sdp: offer },
          })
        } catch {
          // Ignore
        }
      }
    }

    const onCallRejected = (payload) => {
      const current = activeCallRef.current
      if (current && current.callId === payload.callId) {
        const reason = payload.reason === 'busy' ? 'Kullanıcı meşgul.' : 'Arama reddedildi.'
        setErrorMessage(reason)
        handleEndCallInternal(true)
      }
    }

    const onCallEnded = (payload) => {
      const current = activeCallRef.current
      if (current && current.callId === payload.callId) {
        handleEndCallInternal(true)
      } else if (incomingCall?.callId === payload.callId) {
        handleEndCallInternal(false)
      }
    }

    const onCallSignal = async (payload) => {
      const current = activeCallRef.current
      if (!current || current.callId !== payload.callId) return

      const pc = pcRef.current
      if (!pc) return

      const { data, from } = payload

      try {
        if (data.sdp) {
          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp))

          // Flush any buffered ICE candidates
          while (pendingCandidatesRef.current.length > 0) {
            const candidate = pendingCandidatesRef.current.shift()
            await pc.addIceCandidate(candidate)
          }

          if (data.sdp.type === 'offer') {
            const answer = await pc.createAnswer()
            await pc.setLocalDescription(answer)
            socket.emit('call:signal', {
              callId: current.callId,
              to: from,
              data: { sdp: answer },
            })
          }
        } else if (data.candidate) {
          const candidate = new RTCIceCandidate(data.candidate)
          if (pc.remoteDescription && pc.remoteDescription.type) {
            await pc.addIceCandidate(candidate)
          } else {
            pendingCandidatesRef.current.push(candidate)
          }
        }
      } catch {
        // Ignore signaling decode error
      }
    }

    const onMediaToggled = (payload) => {
      const current = activeCallRef.current
      if (!current || current.callId !== payload.callId) return

      if (typeof payload.isMuted === 'boolean') {
        setIsPeerMuted(payload.isMuted)
      }
      if (typeof payload.isVideoOff === 'boolean') {
        setIsPeerVideoOff(payload.isVideoOff)
      }
    }

    socket.on('call:incoming', onIncomingCall)
    socket.on('call:accepted', onCallAccepted)
    socket.on('call:rejected', onCallRejected)
    socket.on('call:ended', onCallEnded)
    socket.on('call:signal', onCallSignal)
    socket.on('call:media_toggled', onMediaToggled)

    return () => {
      socket.off('call:incoming', onIncomingCall)
      socket.off('call:accepted', onCallAccepted)
      socket.off('call:rejected', onCallRejected)
      socket.off('call:ended', onCallEnded)
      socket.off('call:signal', onCallSignal)
      socket.off('call:media_toggled', onMediaToggled)
    }
  }, [handleEndCallInternal, incomingCall, setupPeerConnection, tryStartRecording])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupMediaAndPeer()
    }
  }, [cleanupMediaAndPeer])

  return {
    callState,
    activeCall,
    incomingCall,
    callDuration,
    isMuted,
    isVideoOff,
    isPeerMuted,
    isPeerVideoOff,
    isMinimized,
    errorMessage,
    setErrorMessage,
    localStream,
    remoteStream,
    startCall,
    acceptIncomingCall,
    rejectIncomingCall,
    endCall,
    toggleMute,
    toggleVideo,
    toggleMinimize,
    facingMode,
    isSpeakerOn,
    toggleSpeaker,
    switchCamera,
  }
}
