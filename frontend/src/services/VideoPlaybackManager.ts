/**
 * Singleton Video Playback Manager
 *
 * Ensures only ONE video is actively decoding and playing at any time in the feed.
 * Prevents mobile GPU and hardware decoder saturation, eliminating browser freeze and stutter.
 */

export interface VideoPlaybackHandlers {
  play?: () => void
  pause?: () => void
}

export type MuteListener = (muted: boolean) => void

class VideoPlaybackManager {
  private activeVideoKey: string | null = null
  private subscribers: Map<string, VideoPlaybackHandlers> = new Map()
  private isMuted: boolean = true
  private muteListeners: Set<MuteListener> = new Set()

  getMuted(): boolean {
    return this.isMuted
  }

  setMuted(muted: boolean): void {
    this.isMuted = Boolean(muted)
    this.muteListeners.forEach((listener) => {
      try {
        listener(this.isMuted)
      } catch {
        // ignore listener callback errors
      }
    })
  }

  toggleMuted(): boolean {
    this.setMuted(!this.isMuted)
    return this.isMuted
  }

  onMuteChange(listener: MuteListener): () => void {
    if (typeof listener !== 'function') return () => {}
    this.muteListeners.add(listener)
    return () => {
      this.muteListeners.delete(listener)
    }
  }

  register(key: string, handlers: VideoPlaybackHandlers): void {
    if (!key) return
    this.subscribers.set(key, handlers)
  }

  unregister(key: string): void {
    if (!key) return
    if (this.activeVideoKey === key) {
      this.activeVideoKey = null
    }
    this.subscribers.delete(key)
  }

  play(key: string): void {
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

  pause(key: string): void {
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

  getActiveKey(): string | null {
    return this.activeVideoKey
  }

  isActive(key: string): boolean {
    return this.activeVideoKey === key
  }
}

export const videoPlaybackManager = new VideoPlaybackManager()
