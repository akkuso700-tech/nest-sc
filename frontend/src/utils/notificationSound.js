let audioCtx = null

export function playMessageNotificationSound() {
  try {
    if (typeof window === 'undefined') {
      return
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) {
      return
    }

    if (!audioCtx) {
      audioCtx = new AudioContextClass()
    }

    if (audioCtx.state === 'suspended') {
      void audioCtx.resume()
    }

    const now = audioCtx.currentTime

    const osc1 = audioCtx.createOscillator()
    const gain1 = audioCtx.createGain()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(880, now)
    osc1.frequency.exponentialRampToValueAtTime(1320, now + 0.08)

    gain1.gain.setValueAtTime(0, now)
    gain1.gain.linearRampToValueAtTime(0.18, now + 0.02)
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.16)

    osc1.connect(gain1)
    gain1.connect(audioCtx.destination)

    osc1.start(now)
    osc1.stop(now + 0.16)

    const osc2 = audioCtx.createOscillator()
    const gain2 = audioCtx.createGain()
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(1320, now + 0.04)
    osc2.frequency.exponentialRampToValueAtTime(1760, now + 0.12)

    gain2.gain.setValueAtTime(0, now + 0.04)
    gain2.gain.linearRampToValueAtTime(0.1, now + 0.06)
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.22)

    osc2.connect(gain2)
    gain2.connect(audioCtx.destination)

    osc2.start(now + 0.04)
    osc2.stop(now + 0.22)
  } catch {
    // Silent
  }
}
