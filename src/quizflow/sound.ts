/* ================================================================
   QuizFlow — Web Audio Engine (Muse Spark Edition)
   100% procedural synthesized audio using Web Audio API.
   Zero external asset downloads, 0ms latency, pure browser audio.
   ================================================================ */

let ctx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
    if (AudioCtx) {
      ctx = new AudioCtx()
    }
  }
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {})
  }
  return ctx
}

/**
 * Tap / Click sound — crisp snappy click
 */
export function playClickSound() {
  const ac = getAudioContext()
  if (!ac) return
  try {
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(800, ac.currentTime)
    osc.frequency.exponentialRampToValueAtTime(120, ac.currentTime + 0.04)

    gain.gain.setValueAtTime(0.25, ac.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.04)

    osc.connect(gain)
    gain.connect(ac.destination)

    osc.start()
    osc.stop(ac.currentTime + 0.04)
  } catch {}
}

/**
 * Answer Lock-in sound — resonant double-thud
 */
export function playLockInSound() {
  const ac = getAudioContext()
  if (!ac) return
  try {
    const now = ac.currentTime
    const osc = ac.createOscillator()
    const gain = ac.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(320, now)
    osc.frequency.exponentialRampToValueAtTime(640, now + 0.08)

    gain.gain.setValueAtTime(0.35, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12)

    osc.connect(gain)
    gain.connect(ac.destination)

    osc.start(now)
    osc.stop(now + 0.12)
  } catch {}
}

/**
 * Correct Answer Chime — Major 3rd arpeggio (C5 -> E5 -> G5)
 */
export function playCorrectChime() {
  const ac = getAudioContext()
  if (!ac) return
  try {
    const notes = [523.25, 659.25, 783.99] // C5, E5, G5 major 3rd arpeggio
    const now = ac.currentTime

    notes.forEach((freq, idx) => {
      const osc = ac.createOscillator()
      const gain = ac.createGain()
      const startTime = now + idx * 0.08

      osc.type = 'triangle'
      osc.frequency.setValueAtTime(freq, startTime)

      gain.gain.setValueAtTime(0, startTime)
      gain.gain.linearRampToValueAtTime(0.3, startTime + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3)

      osc.connect(gain)
      gain.connect(ac.destination)

      osc.start(startTime)
      osc.stop(startTime + 0.3)
    })
  } catch {}
}

/**
 * Correct Answer Sound — alias for playCorrectChime + C6 resolution extension
 */
export function playCorrectSound() {
  playCorrectChime()
}

/**
 * Wrong Answer Buzzer — Pitch drop (280Hz -> 90Hz sawtooth)
 */
export function playWrongBuzzer() {
  const ac = getAudioContext()
  if (!ac) return
  try {
    const now = ac.currentTime
    const osc = ac.createOscillator()
    const gain = ac.createGain()

    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(280, now)
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.3)

    gain.gain.setValueAtTime(0.3, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3)

    osc.connect(gain)
    gain.connect(ac.destination)

    osc.start(now)
    osc.stop(now + 0.3)
  } catch {}
}

/**
 * Wrong Answer Sound — alias for playWrongBuzzer
 */
export function playWrongSound() {
  playWrongBuzzer()
}

/**
 * Coin Pop sound — 987Hz -> 1318Hz square pulse sweep
 */
export function playCoinPop() {
  const ac = getAudioContext()
  if (!ac) return
  try {
    const now = ac.currentTime
    const osc = ac.createOscillator()
    const gain = ac.createGain()

    osc.type = 'square'
    osc.frequency.setValueAtTime(987, now) // B5
    osc.frequency.exponentialRampToValueAtTime(1318, now + 0.08) // E6

    gain.gain.setValueAtTime(0.2, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09)

    osc.connect(gain)
    gain.connect(ac.destination)

    osc.start(now)
    osc.stop(now + 0.09)
  } catch {}
}

/**
 * Escalating pitch & tempo countdown tick based on urgencyRatio (0.0 to 1.0)
 */
export function playCountdownTick(urgencyRatio: number) {
  const ac = getAudioContext()
  if (!ac) return
  try {
    const clampRatio = Math.max(0, Math.min(1, urgencyRatio))
    const now = ac.currentTime
    const osc = ac.createOscillator()
    const gain = ac.createGain()

    const baseFreq = 600 + clampRatio * 800 // Scales from 600Hz to 1400Hz
    const vol = 0.15 + clampRatio * 0.25   // Scales volume with urgency

    osc.type = 'sine'
    osc.frequency.setValueAtTime(baseFreq, now)
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.5, now + 0.03)

    gain.gain.setValueAtTime(vol, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03)

    osc.connect(gain)
    gain.connect(ac.destination)

    osc.start(now)
    osc.stop(now + 0.03)
  } catch {}
}

/**
 * Countdown timer tick helper (legacy interface)
 */
export function playTickSound(secondsLeft: number, totalSeconds: number = 20) {
  const ratio = 1 - Math.max(0, secondsLeft) / Math.max(1, totalSeconds)
  playCountdownTick(ratio)
}

/**
 * Level Up Fanfare — Major triad chord cascade
 */
export function playLevelUpFanfare() {
  const ac = getAudioContext()
  if (!ac) return
  try {
    const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98, 2093.00] // C5, E5, G5, C6, E6, G6, C7
    const now = ac.currentTime

    notes.forEach((freq, idx) => {
      const osc = ac.createOscillator()
      const gain = ac.createGain()
      const startTime = now + idx * 0.06
      const duration = idx === notes.length - 1 ? 0.6 : 0.25

      osc.type = idx % 2 === 0 ? 'triangle' : 'sine'
      osc.frequency.setValueAtTime(freq, startTime)

      gain.gain.setValueAtTime(0, startTime)
      gain.gain.linearRampToValueAtTime(0.28, startTime + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration)

      osc.connect(gain)
      gain.connect(ac.destination)

      osc.start(startTime)
      osc.stop(startTime + duration)
    })
  } catch {}
}

/**
 * Power-Up Activation SFX
 */
export function playPowerUpSound(type: '5050' | 'freeze' | 'double') {
  const ac = getAudioContext()
  if (!ac) return
  try {
    const now = ac.currentTime
    if (type === '5050') {
      // Laser sweep
      const osc = ac.createOscillator()
      const gain = ac.createGain()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(1200, now)
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.15)

      gain.gain.setValueAtTime(0.25, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15)

      osc.connect(gain)
      gain.connect(ac.destination)
      osc.start(now)
      osc.stop(now + 0.15)
    } else if (type === 'freeze') {
      // Shimmering ice bell
      const freqs = [1200, 1600, 2400]
      freqs.forEach((f, i) => {
        const osc = ac.createOscillator()
        const gain = ac.createGain()
        const t = now + i * 0.04
        osc.type = 'sine'
        osc.frequency.setValueAtTime(f, t)
        gain.gain.setValueAtTime(0.2, t)
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3)
        osc.connect(gain)
        gain.connect(ac.destination)
        osc.start(t)
        osc.stop(t + 0.3)
      })
    } else if (type === 'double') {
      // Golden power-up chord
      const freqs = [440, 554.37, 659.25, 880]
      freqs.forEach((f, i) => {
        const osc = ac.createOscillator()
        const gain = ac.createGain()
        const t = now + i * 0.05
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(f, t)
        gain.gain.setValueAtTime(0.25, t)
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3)
        osc.connect(gain)
        gain.connect(ac.destination)
        osc.start(t)
        osc.stop(t + 0.3)
      })
    }
  } catch {}
}

/**
 * Streak Fanfare — trigger when player hits a combo streak
 */
export function playStreakSound() {
  playLevelUpFanfare()
}
