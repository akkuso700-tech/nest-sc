/**
 * Singleton Video Playback Manager
 *
 * Ensures only ONE video is actively decoding and playing at any time in the feed.
 * Prevents mobile GPU and hardware decoder saturation, eliminating browser freeze and stutter.
 */

class VideoPlaybackManager {
  constructor() {
    this.activeVideoKey = null
    this.subscribers = new Map()
    this.isMuted = true
    this.muteListeners = new Set()
  }

  getMuted() {
    return this.isMuted
  }

  setMuted(muted) {
    this.isMuted = Boolean(muted)
    this.muteListeners.forEach((listener) => {
      try {
        listener(this.isMuted)
      } catch {
        // ignore listener callback errors
      }
    })
  }

  toggleMuted() {
    this.setMuted(!this.isMuted)
    return this.isMuted
  }

  onMuteChange(listener) {
    if (typeof listener !== 'function') return () => {}
    this.muteListeners.add(listener)
    return () => {
      this.muteListeners.delete(listener)
    }
  }

  register(key, handlers) {
    if (!key) return
    this.subscribers.set(key, handlers)
  }

  unregister(key) {
    if (!key) return
    if (this.activeVideoKey === key) {
      this.activeVideoKey = null
    }
    this.subscribers.delete(key)
  }

  play(key) {
    if (!key) return

    if (this.activeVideoKey && this.activeVideoKey !== key) {
      const prev = this.subscribers.get(this.activeVideoKey)
      if (prev && typeof prev.pause === 'function') {
        try {
          prev.pause()
        } catch {
          // ignore playback control error
        }
      }
    }

    this.activeVideoKey = key
    const current = this.subscribers.get(key)
    if (current && typeof current.play === 'function') {
      try {
        current.play()
      } catch {
        // ignore playback control error
      }
    }
  }

  pause(key) {
    if (!key) return
    if (this.activeVideoKey === key) {
      const current = this.subscribers.get(key)
      if (current && typeof current.pause === 'function') {
        try {
          current.pause()
        } catch {
          // ignore playback control error
        }
      }
      this.activeVideoKey = null
    }
  }

  getActiveKey() {
    return this.activeVideoKey
  }

  isActive(key) {
    return this.activeVideoKey === key
  }
}

export const videoPlaybackManager = new VideoPlaybackManager()
