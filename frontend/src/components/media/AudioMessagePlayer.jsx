import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { resolveMediaUrl } from '../../utils/media.js'

let currentPlayingAudio = null

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '0:00'
  }
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`
}

function generatePseudoWaveform(seed, count = 28) {
  let hash = 0
  const str = String(seed || 'voice')
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }

  const bars = []
  for (let i = 0; i < count; i += 1) {
    const pseudoRandom = Math.abs(Math.sin(hash + i * 1.7) * 100) % 1
    // Bar heights between 20% and 100%
    const height = Math.round(20 + pseudoRandom * 80)
    bars.push(height)
  }
  return bars
}

export default function AudioMessagePlayer({
  src,
  duration = 0,
  isMine = false,
  variant = 'message',
  className = '',
}) {
  const audioRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [audioDuration, setAudioDuration] = useState(duration || 0)
  const [playbackRate, setPlaybackRate] = useState(1)

  const resolvedUrl = useMemo(() => resolveMediaUrl(src), [src])
  const waveformBars = useMemo(() => generatePseudoWaveform(src), [src])

  const effectiveDuration = audioDuration > 0 ? audioDuration : duration || 0
  const progressPercent =
    effectiveDuration > 0
      ? Math.min(100, Math.max(0, (currentTime / effectiveDuration) * 100))
      : 0

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    function onLoadedMetadata() {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setAudioDuration(audio.duration)
      }
    }

    function onTimeUpdate() {
      setCurrentTime(audio.currentTime)
    }

    function onEnded() {
      setIsPlaying(false)
      setCurrentTime(0)
      if (currentPlayingAudio === audio) {
        currentPlayingAudio = null
      }
    }

    function onPause() {
      setIsPlaying(false)
    }

    function onPlay() {
      setIsPlaying(true)
    }

    audio.addEventListener('loadedmetadata', onLoadedMetadata)
    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('play', onPlay)

    return () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata)
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('play', onPlay)
      if (currentPlayingAudio === audio) {
        audio.pause()
        currentPlayingAudio = null
      }
    }
  }, [])

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
    } else {
      if (currentPlayingAudio && currentPlayingAudio !== audio) {
        currentPlayingAudio.pause()
      }
      currentPlayingAudio = audio
      audio.play().catch(() => {
        setIsPlaying(false)
      })
    }
  }, [isPlaying])

  const handleSeek = (event) => {
    const audio = audioRef.current
    if (!audio || !effectiveDuration) return

    const rect = event.currentTarget.getBoundingClientRect()
    const clickX = Math.max(0, Math.min(event.clientX - rect.left, rect.width))
    const nextPercent = clickX / rect.width
    const nextTime = nextPercent * effectiveDuration

    setCurrentTime(nextTime)
    audio.currentTime = nextTime
  }

  const cycleSpeed = (event) => {
    event.stopPropagation()
    const speeds = [1, 1.5, 2]
    const nextIndex = (speeds.indexOf(playbackRate) + 1) % speeds.length
    const nextSpeed = speeds[nextIndex]
    setPlaybackRate(nextSpeed)
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed
    }
  }

  const isAdmin = variant === 'admin'

  // Dynamic theme colors
  const buttonBgClass = isAdmin
    ? 'bg-blue-600 hover:bg-blue-700 text-white'
    : isMine
      ? 'bg-white text-primary shadow-sm hover:bg-white/90'
      : 'bg-primary text-inverse shadow-sm hover:bg-primary/90'

  const activeBarClass = isAdmin
    ? 'bg-blue-600'
    : isMine
      ? 'bg-white'
      : 'bg-primary'

  const inactiveBarClass = isAdmin
    ? 'bg-slate-200 dark:bg-slate-700'
    : isMine
      ? 'bg-white/35'
      : 'bg-border-strong dark:bg-zinc-700'

  const timeTextClass = isAdmin
    ? 'text-slate-500'
    : isMine
      ? 'text-white/80'
      : 'text-muted'

  const speedButtonClass = isAdmin
    ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
    : isMine
      ? 'bg-white/20 text-white hover:bg-white/30'
      : 'bg-secondary text-text hover:bg-secondary-hover'

  return (
    <div
      className={`flex items-center gap-3 select-none py-1 min-w-[220px] max-w-[320px] sm:min-w-[260px] ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      <audio ref={audioRef} src={resolvedUrl} preload="metadata" />

      {/* Play / Pause button */}
      <button
        type="button"
        onClick={togglePlay}
        className={`grid size-10 shrink-0 place-items-center rounded-full transition-transform active:scale-95 cursor-pointer ${buttonBgClass}`}
        aria-label={isPlaying ? 'Duraklat' : 'Oynat'}
      >
        {isPlaying ? (
          <svg viewBox="0 0 24 24" fill="currentColor" className="size-5">
            <path d="M6 5h4v14H6V5Zm8 0h4v14h-4V5Z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="currentColor" className="size-5 translate-x-0.5">
            <path d="M7 4v16l13-8L7 4Z" />
          </svg>
        )}
      </button>

      {/* Waveform & Scrubber track */}
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-1.5">
        <div
          onClick={handleSeek}
          className="relative flex items-center gap-[2.5px] h-6 cursor-pointer py-1 group"
          title="Kaydır"
        >
          {waveformBars.map((heightPercent, index) => {
            const barPercent = (index / waveformBars.length) * 100
            const isFilled = progressPercent >= barPercent
            return (
              <span
                key={index}
                style={{ height: `${Math.max(16, heightPercent)}%` }}
                className={`w-[3px] rounded-full transition-colors duration-150 ${
                  isFilled ? activeBarClass : inactiveBarClass
                }`}
              />
            )
          })}
        </div>

        {/* Time and Speed */}
        <div className={`flex items-center justify-between text-[11px] font-medium leading-none ${timeTextClass}`}>
          <span>
            {isPlaying || currentTime > 0
              ? `${formatTime(currentTime)} / ${formatTime(effectiveDuration)}`
              : formatTime(effectiveDuration)}
          </span>

          <button
            type="button"
            onClick={cycleSpeed}
            className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tracking-tight transition cursor-pointer ${speedButtonClass}`}
            title="Oynatma Hızı"
          >
            {playbackRate}x
          </button>
        </div>
      </div>
    </div>
  )
}
