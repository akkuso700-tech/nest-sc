import { useEffect, useMemo, useState } from 'react'

function supportsNativeHls() {
  if (typeof document === 'undefined') return false
  const video = document.createElement('video')
  return Boolean(video.canPlayType?.('application/vnd.apple.mpegurl'))
}

export function useAdaptiveVideoSource({ videoRef, hlsUrl, fallbackUrl, enabled = true }) {
  const nativeHls = useMemo(supportsNativeHls, [])
  const [directSource, setDirectSource] = useState(() => {
    if (!enabled || !hlsUrl) return fallbackUrl
    return nativeHls ? hlsUrl : ''
  })

  useEffect(() => {
    const video = videoRef?.current
    if (!video || !enabled || !hlsUrl) {
      setDirectSource(fallbackUrl)
      return undefined
    }

    if (nativeHls) {
      setDirectSource(hlsUrl)
      return undefined
    }

    let cancelled = false
    let hls = null
    setDirectSource('')

    import('hls.js/light')
      .then(({ default: Hls }) => {
        if (cancelled) return
        if (!Hls.isSupported()) {
          setDirectSource(fallbackUrl)
          return
        }

        hls = new Hls({
          enableWorker: true,
          startLevel: -1,
          capLevelToPlayerSize: true,
          backBufferLength: 30,
          maxBufferLength: 20,
        })
        hls.loadSource(hlsUrl)
        hls.attachMedia(video)
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (!data?.fatal) return
          hls?.destroy()
          hls = null
          setDirectSource(fallbackUrl)
        })
      })
      .catch(() => setDirectSource(fallbackUrl))

    return () => {
      cancelled = true
      hls?.destroy()
    }
  }, [enabled, fallbackUrl, hlsUrl, nativeHls, videoRef])

  return directSource
}
