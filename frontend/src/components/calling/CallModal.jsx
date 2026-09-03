import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import UserAvatar from '../common/UserAvatar.jsx'
import VerifiedBadge from '../common/VerifiedBadge.jsx'
import { getFullName } from '../../utils/social.js'

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

export default function CallModal({
  activeCall,
  callState,
  callDuration,
  isMuted,
  isVideoOff,
  isPeerMuted,
  isPeerVideoOff,
  isMinimized,
  isSpeakerOn = true,
  localStream,
  remoteStream,
  onToggleMute,
  onToggleVideo,
  onToggleMinimize,
  onToggleSpeaker,
  onSwitchCamera,
  onEndCall,
}) {
  const { t } = useTranslation()
  const modalContainerRef = useRef(null)
  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const remoteAudioRef = useRef(null)

  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isPiPSwapped, setIsPiPSwapped] = useState(false)

  const isVideo = activeCall?.callType === 'video'
  const isConnected = callState === 'connected'
  const peer = activeCall?.peer

  // Sync streams with video and audio elements
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream
    }
  }, [localStream, isPiPSwapped])

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream
    }
  }, [remoteStream, isPiPSwapped])

  useEffect(() => {
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream
    }
  }, [remoteStream])

  // Track Fullscreen state changes (e.g. user pressing ESC or browser events)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement))
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [])

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      if (modalContainerRef.current?.requestFullscreen) {
        modalContainerRef.current.requestFullscreen().catch(() => {})
      }
    } else if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {})
    }
  }

  const handleSpeakerClick = () => {
    if (onToggleSpeaker) {
      const activeElement = remoteVideoRef.current || remoteAudioRef.current
      onToggleSpeaker(activeElement)
    }
  }

  if (!activeCall) return null

  // Floating Minimized Widget
  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-full border border-border bg-card/95 px-4 py-2.5 shadow-2xl backdrop-blur-md transition-all animate-fade-in dark:shadow-black/70">
        <UserAvatar
          user={peer}
          className="size-10 shrink-0 ring-2 ring-primary/40"
          textClassName="text-xs font-semibold"
        />

        <div className="min-w-0 pr-1">
          <p className="truncate text-xs font-semibold text-text">
            {getFullName(peer)}
          </p>
          <p className="text-[11px] font-medium text-muted">
            {isConnected ? formatDuration(callDuration) : t('calling.calling', { defaultValue: 'Aranıyor...' })}
          </p>
        </div>

        <div className="flex items-center gap-1.5 pl-1">
          {/* Mute toggle */}
          <button
            type="button"
            onClick={onToggleMute}
            className={`grid size-8 place-items-center rounded-full transition cursor-pointer ${
              isMuted ? 'bg-rose-500/20 text-rose-600' : 'bg-secondary text-text hover:bg-zinc-200 dark:hover:bg-zinc-700'
            }`}
            title={isMuted ? t('calling.unmuteMic', { defaultValue: 'Sesi Aç' }) : t('calling.muteMic', { defaultValue: 'Sessize Al' })}
          >
            {isMuted ? (
              <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="2" x2="22" y1="2" y2="22" />
                <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" />
                <path d="M5 10v2a7 7 0 0 0 12 5" />
                <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" />
                <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
                <line x1="12" x2="12" y1="19" y2="22" />
              </svg>
            ) : (
              <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" x2="12" y1="19" y2="22" />
              </svg>
            )}
          </button>

          {/* Maximize */}
          <button
            type="button"
            onClick={onToggleMinimize}
            className="grid size-8 place-items-center rounded-full bg-secondary text-text hover:bg-zinc-200 dark:hover:bg-zinc-700 transition cursor-pointer"
            title={t('calling.maximize', { defaultValue: 'Büyüt' })}
          >
            <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 3 21 3 21 9" />
              <polyline points="9 21 3 21 3 15" />
              <line x1="21" x2="14" y1="3" y2="10" />
              <line x1="3" x2="10" y1="21" y2="14" />
            </svg>
          </button>

          {/* End Call */}
          <button
            type="button"
            onClick={onEndCall}
            className="grid size-8 place-items-center rounded-full bg-rose-600 text-white hover:bg-rose-700 transition cursor-pointer"
            title={t('calling.endCall', { defaultValue: 'Görüşmeyi Sonlandır' })}
          >
            <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="m18 6-12 12M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    )
  }

  // Voice Call Hidden Audio Element for reliable playback
  const voiceAudioElement = !isVideo && remoteStream ? (
    <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
  ) : null

  return (
    <div
      ref={modalContainerRef}
      className={`fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-md animate-fade-in transition-all ${
        isVideo
          ? isFullscreen
            ? 'p-0 size-full'
            : 'p-0 md:p-6'
          : 'p-4'
      }`}
    >
      {voiceAudioElement}

      <div
        className={`relative overflow-hidden bg-zinc-950 shadow-2xl transition-all ${
          isVideo
            ? isFullscreen
              ? 'size-full rounded-none border-none'
              : 'size-full md:size-auto md:w-full md:max-w-4xl md:aspect-[16/10] md:max-h-[85vh] rounded-none md:rounded-[32px] md:border md:border-border/40'
            : 'w-full max-w-md p-8 rounded-[32px] border border-border bg-card'
        }`}
      >
        {/* Top bar controls */}
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
          {/* Fullscreen Toggle (Desktop) */}
          {isVideo && (
            <button
              type="button"
              onClick={handleToggleFullscreen}
              className="hidden md:grid size-9 place-items-center rounded-full bg-black/40 text-white backdrop-blur-md hover:bg-black/60 transition cursor-pointer"
              title={isFullscreen ? t('calling.exitFullscreen', { defaultValue: 'Tam Ekrandan Çık' }) : t('calling.fullscreen', { defaultValue: 'Tam Ekran' })}
            >
              {isFullscreen ? (
                <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="4 14 10 14 10 20" />
                  <polyline points="20 10 14 10 14 4" />
                  <line x1="14" x2="21" y1="10" y2="3" />
                  <line x1="3" x2="10" y1="21" y2="14" />
                </svg>
              ) : (
                <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="15 3 21 3 21 9" />
                  <polyline points="9 21 3 21 3 15" />
                  <line x1="21" x2="14" y1="3" y2="10" />
                  <line x1="3" x2="10" y1="21" y2="14" />
                </svg>
              )}
            </button>
          )}

          {/* Minimize */}
          <button
            type="button"
            onClick={onToggleMinimize}
            className="grid size-9 place-items-center rounded-full bg-black/40 text-white backdrop-blur-md hover:bg-black/60 transition cursor-pointer"
            title={t('calling.minimize', { defaultValue: 'Küçült' })}
          >
            <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="5" x2="19" y1="12" y2="12" />
            </svg>
          </button>
        </div>

        {/* Video Mode Body */}
        {isVideo ? (
          <div className="relative size-full bg-zinc-950 flex items-center justify-center">
            {/* Main Primary Stream (Swappable between Remote & Local) */}
            {(!isPiPSwapped && remoteStream && !isPeerVideoOff) ? (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="size-full object-cover"
              />
            ) : (isPiPSwapped && localStream && !isVideoOff) ? (
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="size-full object-cover [transform:rotateY(180deg)]"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-center p-6">
                <UserAvatar
                  user={peer}
                  className="size-24 mb-4 ring-4 ring-white/10"
                  textClassName="text-2xl font-bold"
                />
                <div className="inline-flex items-center gap-1.5 text-lg font-semibold text-white">
                  <span>{getFullName(peer)}</span>
                  <VerifiedBadge user={peer} size="xs" />
                </div>
                <p className="text-xs text-zinc-400 mt-1">
                  {!isConnected
                    ? t('calling.calling', { defaultValue: 'Aranıyor...' })
                    : isPeerVideoOff
                      ? t('calling.cameraOff', { defaultValue: 'Kamera kapalı' })
                      : t('calling.connecting', { defaultValue: 'Bağlanıyor...' })}
                </p>
                {isPeerMuted ? (
                  <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-rose-500/20 px-3 py-1 text-xs text-rose-300">
                    <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="2" x2="22" y1="2" y2="22" />
                      <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" />
                      <path d="M5 10v2a7 7 0 0 0 12 5" />
                    </svg>
                    {t('calling.micMuted', { defaultValue: 'Sessize alındı' })}
                  </span>
                ) : null}
              </div>
            )}

            {/* Secondary Picture-in-Picture (PiP) Stream - Tap to Swap */}
            <div
              onClick={() => setIsPiPSwapped((prev) => !prev)}
              className="absolute top-4 left-4 z-10 w-24 md:w-36 aspect-[3/4] overflow-hidden rounded-2xl border-2 border-white/25 bg-zinc-900 shadow-2xl cursor-pointer transition hover:scale-105 active:scale-95"
              title={t('calling.swapView', { defaultValue: 'Görünümü değiştir' })}
            >
              {(!isPiPSwapped && !isVideoOff && localStream) ? (
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="size-full object-cover [transform:rotateY(180deg)]"
                />
              ) : (isPiPSwapped && remoteStream && !isPeerVideoOff) ? (
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="size-full object-cover"
                />
              ) : (
                <div className="grid size-full place-items-center bg-zinc-800 text-zinc-400 text-xs text-center p-2">
                  <svg className="size-5 mb-1 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="2" x2="22" y1="2" y2="22" />
                    <path d="m16 16-3.5-2" />
                    <path d="m15 10 4.553-2.276A1 1 0 0 1 21 8.618v6.764a1 1 0 0 1-1.447.894L15 14v-4z" />
                    <rect width="14" height="12" x="1" y="6" rx="2" />
                  </svg>
                  <span className="text-[10px]">{t('calling.turnOffCamera', { defaultValue: 'Kamera kapalı' })}</span>
                </div>
              )}
            </div>

            {/* Bottom Floating Controls Bar */}
            <div className="absolute bottom-6 inset-x-0 z-20 flex items-center justify-center gap-3 md:gap-4 px-4">
              {/* Toggle Mic */}
              <button
                type="button"
                onClick={onToggleMute}
                className={`grid size-11 md:size-12 place-items-center rounded-full backdrop-blur-md transition cursor-pointer ${
                  isMuted ? 'bg-rose-600 text-white' : 'bg-black/50 text-white hover:bg-black/70'
                }`}
                title={isMuted ? t('calling.unmuteMic', { defaultValue: 'Sesi Aç' }) : t('calling.muteMic', { defaultValue: 'Sessize Al' })}
              >
                {isMuted ? (
                  <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="2" x2="22" y1="2" y2="22" />
                    <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" />
                    <path d="M5 10v2a7 7 0 0 0 12 5" />
                    <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" />
                    <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
                    <line x1="12" x2="12" y1="19" y2="22" />
                  </svg>
                ) : (
                  <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" x2="12" y1="19" y2="22" />
                  </svg>
                )}
              </button>

              {/* Flip Camera (Front / Back) */}
              {onSwitchCamera && (
                <button
                  type="button"
                  onClick={onSwitchCamera}
                  className="grid size-11 md:size-12 place-items-center rounded-full bg-black/50 text-white hover:bg-black/70 backdrop-blur-md transition cursor-pointer"
                  title={t('calling.flipCamera', { defaultValue: 'Kamerayı Çevir' })}
                >
                  <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 19H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5" />
                    <path d="M13 5h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-5" />
                    <circle cx="12" cy="12" r="3" />
                    <path d="m18 22-3-3 3-3" />
                    <path d="m6 2 3 3-3 3" />
                  </svg>
                </button>
              )}

              {/* End Call */}
              <button
                type="button"
                onClick={onEndCall}
                className="grid size-13 md:size-14 place-items-center rounded-full bg-rose-600 text-white shadow-lg shadow-rose-600/40 hover:bg-rose-700 transition-transform active:scale-95 cursor-pointer"
                title={t('calling.endCall', { defaultValue: 'Görüşmeyi Sonlandır' })}
              >
                <svg className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="m18 6-12 12M6 6l12 12" />
                </svg>
              </button>

              {/* Toggle Camera */}
              <button
                type="button"
                onClick={onToggleVideo}
                className={`grid size-11 md:size-12 place-items-center rounded-full backdrop-blur-md transition cursor-pointer ${
                  isVideoOff ? 'bg-rose-600 text-white' : 'bg-black/50 text-white hover:bg-black/70'
                }`}
                title={isVideoOff ? t('calling.turnOnCamera', { defaultValue: 'Kamerayı Aç' }) : t('calling.turnOffCamera', { defaultValue: 'Kamerayı Kapat' })}
              >
                {isVideoOff ? (
                  <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="2" x2="22" y1="2" y2="22" />
                    <path d="m16 16-3.5-2" />
                    <path d="m15 10 4.553-2.276A1 1 0 0 1 21 8.618v6.764a1 1 0 0 1-1.447.894L15 14v-4z" />
                    <rect width="14" height="12" x="1" y="6" rx="2" />
                  </svg>
                ) : (
                  <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="m15 10 4.553-2.276A1 1 0 0 1 21 8.618v6.764a1 1 0 0 1-1.447.894L15 14v-4z" />
                    <rect width="14" height="12" x="1" y="6" rx="2" />
                  </svg>
                )}
              </button>

              {/* Speaker Output Toggle */}
              <button
                type="button"
                onClick={handleSpeakerClick}
                className={`grid size-11 md:size-12 place-items-center rounded-full backdrop-blur-md transition cursor-pointer ${
                  isSpeakerOn ? 'bg-primary/90 text-white' : 'bg-black/50 text-zinc-300 hover:bg-black/70'
                }`}
                title={isSpeakerOn ? t('calling.speakerOn', { defaultValue: 'Hoparlör Açık' }) : t('calling.speakerOff', { defaultValue: 'Hoparlör Kapalı' })}
              >
                {isSpeakerOn ? (
                  <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                  </svg>
                ) : (
                  <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <line x1="22" x2="16" y1="9" y2="15" />
                    <line x1="16" x2="22" y1="9" y2="15" />
                  </svg>
                )}
              </button>
            </div>

            {/* Duration Time Badge */}
            {isConnected ? (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 rounded-full bg-black/50 px-3.5 py-1 text-xs font-medium text-white backdrop-blur-md shadow-md">
                {formatDuration(callDuration)}
              </div>
            ) : null}
          </div>
        ) : (
          /* Voice Mode Body */
          <div className="flex flex-col items-center text-center">
            {/* Pulsing Avatar */}
            <div className="relative my-6 flex size-32 items-center justify-center">
              {isConnected ? (
                <>
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/15 opacity-75 duration-1000" />
                  <span className="absolute inline-flex size-28 animate-pulse rounded-full bg-primary/25 duration-700" />
                </>
              ) : (
                <span className="absolute inline-flex size-full animate-pulse rounded-full bg-primary/20 duration-1000" />
              )}
              <UserAvatar
                user={peer}
                className="size-24 shrink-0 shadow-xl ring-4 ring-card"
                textClassName="text-2xl font-bold"
              />
            </div>

            {/* Peer info */}
            <div className="inline-flex items-center gap-1.5 text-lg font-semibold text-text">
              <span>{getFullName(peer)}</span>
              <VerifiedBadge user={peer} size="xs" />
            </div>
            <p className="text-xs text-muted">@{peer.username}</p>

            {/* Status or duration */}
            <div className="mt-3">
              {isConnected ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3.5 py-1 text-xs font-semibold text-primary">
                  <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                  {formatDuration(callDuration)}
                </span>
              ) : (
                <span className="text-xs font-medium text-muted animate-pulse">
                  {t('calling.calling', { defaultValue: 'Aranıyor...' })}
                </span>
              )}
            </div>

            {isPeerMuted ? (
              <span className="mt-2 inline-flex items-center gap-1 text-xs text-rose-500">
                <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="2" x2="22" y1="2" y2="22" />
                  <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" />
                  <path d="M5 10v2a7 7 0 0 0 12 5" />
                </svg>
                {t('calling.micMuted', { defaultValue: 'Karşı tarafın mikrofonu kapalı' })}
              </span>
            ) : null}

            {/* Controls */}
            <div className="mt-8 flex items-center justify-center gap-5">
              {/* Mute Mic */}
              <button
                type="button"
                onClick={onToggleMute}
                className="group flex flex-col items-center gap-1.5 focus:outline-none cursor-pointer"
              >
                <span
                  className={`grid size-12 place-items-center rounded-full transition-transform group-hover:scale-105 active:scale-95 ${
                    isMuted ? 'bg-rose-600 text-white' : 'bg-secondary text-text hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  {isMuted ? (
                    <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="2" x2="22" y1="2" y2="22" />
                      <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" />
                      <path d="M5 10v2a7 7 0 0 0 12 5" />
                      <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" />
                      <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
                      <line x1="12" x2="12" y1="19" y2="22" />
                    </svg>
                  ) : (
                    <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" x2="12" y1="19" y2="22" />
                    </svg>
                  )}
                </span>
                <span className="text-xs text-muted">
                  {isMuted ? t('calling.unmuteMic', { defaultValue: 'Sesi Aç' }) : t('calling.muteMic', { defaultValue: 'Sessize Al' })}
                </span>
              </button>

              {/* End Call */}
              <button
                type="button"
                onClick={onEndCall}
                className="group flex flex-col items-center gap-1.5 focus:outline-none cursor-pointer"
              >
                <span className="grid size-14 place-items-center rounded-full bg-rose-600 text-white shadow-lg shadow-rose-600/30 transition-transform group-hover:scale-105 active:scale-95">
                  <svg className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="m18 6-12 12M6 6l12 12" />
                  </svg>
                </span>
                <span className="text-xs text-muted group-hover:text-rose-600">
                  {t('calling.endCall', { defaultValue: 'Kapat' })}
                </span>
              </button>

              {/* Speakerphone Toggle */}
              <button
                type="button"
                onClick={handleSpeakerClick}
                className="group flex flex-col items-center gap-1.5 focus:outline-none cursor-pointer"
              >
                <span
                  className={`grid size-12 place-items-center rounded-full transition-transform group-hover:scale-105 active:scale-95 ${
                    isSpeakerOn ? 'bg-primary text-white shadow-md' : 'bg-secondary text-text hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  {isSpeakerOn ? (
                    <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                    </svg>
                  ) : (
                    <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                      <line x1="22" x2="16" y1="9" y2="15" />
                      <line x1="16" x2="22" y1="9" y2="15" />
                    </svg>
                  )}
                </span>
                <span className="text-xs text-muted">
                  {isSpeakerOn ? t('calling.speakerOn', { defaultValue: 'Hoparlör Açık' }) : t('calling.speakerOff', { defaultValue: 'Hoparlör Kapalı' })}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
