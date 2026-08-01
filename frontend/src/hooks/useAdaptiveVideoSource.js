import { useEffect, useMemo, useState } from 'react'

function supportsNativeHls() {
  if (typeof document === 'undefined') return false
  const video = document.createElement('video')
  return Boolean(video.canPlayType?.('application/vnd.apple.mpegurl'))
}

export function supportsManagedHlsSource(hlsUrl) {
  const normalizedUrl = String(hlsUrl || '').toLowerCase()
  return /(?:^|[-/])master-ts-remote\.m3u8(?:$|[?#])/.test(normalizedUrl) ||
    /(?:^|\/)master\.m3u8(?:$|[?#])/.test(normalizedUrl)
}

export function useAdaptiveVideoSource({ videoRef, hlsUrl, fallbackUrl, enabled = true }) {
  const nativeHls = useMemo(supportsNativeHls, [])
  const managedHls = useMemo(() => supportsManagedHlsSource(hlsUrl), [hlsUrl])
  const [directSource, setDirectSource] = useState(() => {
    if (!enabled || !hlsUrl) return fallbackUrl
    if (nativeHls) return hlsUrl
    return managedHls ? '' : fallbackUrl
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

    // Legacy remote fMP4 HLS manifests can stall on Hostinger even though the
    // progressive MP4 is healthy. Use that MP4 immediately for existing posts.
    if (!managedHls) {
      setDirectSource(fallbackUrl)
      return undefined
    }

    let cancelled = false
    let hls = null
    let fallbackTimer = null
    setDirectSource('')

    const clearFallbackTimer = () => {
      if (!fallbackTimer) return
      window.clearTimeout(fallbackTimer)
      fallbackTimer = null
    }

    const useFallback = () => {
      clearFallbackTimer()
      hls?.destroy()
      hls = null
      if (!cancelled) setDirectSource(fallbackUrl)
    }

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
        fallbackTimer = window.setTimeout(() => {
          if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) useFallback()
        }, 8000)
        video.addEventListener('loadeddata', clearFallbackTimer, { once: true })
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (!data?.fatal) return
          useFallback()
        })
      })
      .catch(useFallback)

    return () => {
      cancelled = true
      clearFallbackTimer()
      video.removeEventListener('loadeddata', clearFallbackTimer)
      hls?.destroy()
    }
  }, [enabled, fallbackUrl, hlsUrl, managedHls, nativeHls, videoRef])

  return directSource
}
