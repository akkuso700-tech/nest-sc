let audioCtx = null

function getAudioContext() {
  if (typeof window === 'undefined') return null
  const AudioContextClass = window.AudioContext || window.webkitAudioContext
  if (!AudioContextClass) return null
  if (!audioCtx) {
    audioCtx = new AudioContextClass()
  }
  if (audioCtx.state === 'suspended') {
    void audioCtx.resume()
  }
  return audioCtx
}

export function startOutgoingRingtone() {
  const ctx = getAudioContext()
  if (!ctx) return () => {}

  let isActive = true
  let timeoutId = null

  function playPulse() {
    if (!isActive) return

    try {
      const now = ctx.currentTime
      const osc1 = ctx.createOscillator()
      const osc2 = ctx.createOscillator()
      const gain = ctx.createGain()

      osc1.type = 'sine'
      osc1.frequency.setValueAtTime(425, now)

      osc2.type = 'sine'
      osc2.frequency.setValueAtTime(475, now)

      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(0.08, now + 0.05)
      gain.gain.setValueAtTime(0.08, now + 1.2)
      gain.gain.linearRampToValueAtTime(0, now + 1.3)

      osc1.connect(gain)
      osc2.connect(gain)
      gain.connect(ctx.destination)

      osc1.start(now)
      osc2.start(now)
      osc1.stop(now + 1.3)
      osc2.stop(now + 1.3)

      timeoutId = window.setTimeout(playPulse, 4000)
    } catch {
      // Ignore audio error
    }
  }

  playPulse()

  return () => {
    isActive = false
    if (timeoutId) {
      window.clearTimeout(timeoutId)
    }
  }
}

export function startIncomingRingtone() {
  const ctx = getAudioContext()
  if (!ctx) return () => {}

  let isActive = true
  let timeoutId = null

  function playChime() {
    if (!isActive) return

    try {
      const now = ctx.currentTime
      const notes = [587.33, 659.25, 880.0, 783.99] // D5, E5, A5, G5

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        const noteStart = now + idx * 0.16

        osc.type = 'triangle'
        osc.frequency.setValueAtTime(freq, noteStart)

        gain.gain.setValueAtTime(0, noteStart)
        gain.gain.linearRampToValueAtTime(0.12, noteStart + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.001, noteStart + 0.28)

        osc.connect(gain)
        gain.connect(ctx.destination)

        osc.start(noteStart)
        osc.stop(noteStart + 0.3)
      })

      timeoutId = window.setTimeout(playChime, 2400)
    } catch {
      // Ignore
    }
  }

  playChime()

  return () => {
    isActive = false
    if (timeoutId) {
      window.clearTimeout(timeoutId)
    }
  }
}

export function playCallEndSound() {
  const ctx = getAudioContext()
  if (!ctx) return

  try {
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(440, now)
    osc.frequency.linearRampToValueAtTime(220, now + 0.25)

    gain.gain.setValueAtTime(0.12, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(now)
    osc.stop(now + 0.25)
  } catch {
    // Ignore
  }
}

export function playCallConnectSound() {
  const ctx = getAudioContext()
  if (!ctx) return

  try {
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(440, now)
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.12)

    gain.gain.setValueAtTime(0.1, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(now)
    osc.stop(now + 0.2)
  } catch {
    // Ignore
  }
}
