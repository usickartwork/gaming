/**
 * Web Audio API synthesizer for instant 0ms latency sound effects.
 * No external files to download, works offline and instantly on mobile.
 */

let audioCtx: AudioContext | null = null

export function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!audioCtx) {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (AudioCtx) {
      audioCtx = new AudioCtx()
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {})
  }
  return audioCtx
}

/**
 * Prime and unlock AudioContext on first user interaction (click, touch, key).
 * Essential for Host device to play buzzer sound arriving via WebSocket.
 */
export function unlockAudio() {
  const ctx = getAudioContext()
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {})
  }
}

if (typeof window !== 'undefined') {
  const handleFirstInteraction = () => {
    unlockAudio()
    window.removeEventListener('pointerdown', handleFirstInteraction)
    window.removeEventListener('keydown', handleFirstInteraction)
    window.removeEventListener('click', handleFirstInteraction)
  }
  window.addEventListener('pointerdown', handleFirstInteraction, { once: true, passive: true })
  window.addEventListener('keydown', handleFirstInteraction, { once: true, passive: true })
  window.addEventListener('click', handleFirstInteraction, { once: true, passive: true })
}

/**
 * Crisp, punchy game-show buzzer sound for Host when an incoming buzz arrives.
 * High clarity double chime bell (E5 -> A5 + overtones).
 */
export function playHostBuzzAlert() {
  try {
    const ctx = getAudioContext()
    if (!ctx) return
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {})
    }

    const now = ctx.currentTime

    // Oscillator 1: Fundamental bell tone
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(659.25, now) // E5
    osc1.frequency.setValueAtTime(880, now + 0.08) // A5

    gain1.gain.setValueAtTime(0.5, now)
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5)

    osc1.connect(gain1)
    gain1.connect(ctx.destination)

    // Oscillator 2: Arcade chime overtone for punchy presence
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = 'triangle'
    osc2.frequency.setValueAtTime(1318.5, now) // E6
    osc2.frequency.setValueAtTime(1760, now + 0.08) // A6

    gain2.gain.setValueAtTime(0.3, now)
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.5)

    osc2.connect(gain2)
    gain2.connect(ctx.destination)

    osc1.start(now)
    osc2.start(now)
    osc1.stop(now + 0.5)
    osc2.stop(now + 0.5)
  } catch (e) {
    console.error('Audio play error:', e)
  }
}

/**
 * Classic game show buzzer sound (instant 0ms)
 */
export function playBuzzSound() {
  try {
    const ctx = getAudioContext()
    if (!ctx) return

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(180, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.3)

    gain.gain.setValueAtTime(0.4, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start()
    osc.stop(ctx.currentTime + 0.3)
  } catch (e) {
    console.error('Audio play error:', e)
  }
}

/**
 * Winner ding chime (0ms)
 */
export function playDingSound() {
  try {
    const ctx = getAudioContext()
    if (!ctx) return

    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(587.33, now) // D5
    osc.frequency.setValueAtTime(880, now + 0.1) // A5

    gain.gain.setValueAtTime(0.3, now)
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(now)
    osc.stop(now + 0.5)
  } catch (e) {
    console.error('Audio play error:', e)
  }
}

/**
 * Triumphant fanfare sound for correct answers (0ms Web Audio synthesizer)
 */
export function playCorrectFanfareSound() {
  try {
    const ctx = getAudioContext()
    if (!ctx) return

    const now = ctx.currentTime
    const notes = [
      { freq: 523.25, time: 0, dur: 0.12 },     // C5
      { freq: 659.25, time: 0.1, dur: 0.12 },   // E5
      { freq: 783.99, time: 0.2, dur: 0.14 },   // G5
      { freq: 1046.50, time: 0.32, dur: 0.55 }, // C6 (long sustained)
    ]

    notes.forEach(({ freq, time, dur }) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(freq, now + time)

      gain.gain.setValueAtTime(0.35, now + time)
      gain.gain.exponentialRampToValueAtTime(0.005, now + time + dur)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now + time)
      osc.stop(now + time + dur)
    })
  } catch (e) {
    console.error('Audio play error:', e)
  }
}

/**
 * Classic game-show buzzer sound for wrong answers (0ms Web Audio synthesizer)
 */
export function playWrongSound() {
  try {
    const ctx = getAudioContext()
    if (!ctx) return

    const now = ctx.currentTime
    // Two rapid descending harsh buzz tones
    const tones = [
      { freqStart: 160, freqEnd: 120, time: 0, dur: 0.18 },
      { freqStart: 130, freqEnd: 85, time: 0.2, dur: 0.35 },
    ]

    tones.forEach(({ freqStart, freqEnd, time, dur }) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(freqStart, now + time)
      osc.frequency.exponentialRampToValueAtTime(freqEnd, now + time + dur)

      gain.gain.setValueAtTime(0.4, now + time)
      gain.gain.exponentialRampToValueAtTime(0.01, now + time + dur)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now + time)
      osc.stop(now + time + dur)
    })
  } catch (e) {
    console.error('Audio play error:', e)
  }
}

/**
 * 3-2-1 Countdown beeps synthesizer
 * 3, 2, 1: 440Hz short beep
 * GO/START: 880Hz triumphant energetic tone
 */
export function playCountdownBeep(isFinal = false) {
  try {
    const ctx = getAudioContext()
    if (!ctx) return

    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    if (isFinal) {
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(880, now) // A5
      osc.frequency.exponentialRampToValueAtTime(1046.5, now + 0.15) // C6

      gain.gain.setValueAtTime(0.4, now)
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now)
      osc.stop(now + 0.4)
    } else {
      osc.type = 'sine'
      osc.frequency.setValueAtTime(440, now) // A4

      gain.gain.setValueAtTime(0.3, now)
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now)
      osc.stop(now + 0.15)
    }
  } catch (e) {
    console.error('Audio countdown beep error:', e)
  }
}

