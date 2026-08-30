import {
  getUiAudioContext,
  resumeUiAudio,
  uiAudioAllowed,
} from "../df-ui-audio"

type TickSoundOptions = {
  volume?: number
}

export function resumeUiTickAudio(): void {
  resumeUiAudio()
}

export function playUiTick(options?: TickSoundOptions): void {
  if (!uiAudioAllowed()) return

  const ctx = getUiAudioContext()
  if (!ctx) return
  if (ctx.state === "suspended") {
    void ctx.resume()
  }

  const volume = Math.min(1, Math.max(0, options?.volume ?? 0.14))
  const t0 = ctx.currentTime
  const duration = 0.03
  const sampleCount = Math.max(1, Math.floor(ctx.sampleRate * duration))
  const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < sampleCount; i++) {
    const env = 1 - i / sampleCount
    data[i] = (Math.random() * 2 - 1) * env * env
  }

  const noise = ctx.createBufferSource()
  noise.buffer = buffer

  const bandpass = ctx.createBiquadFilter()
  bandpass.type = "bandpass"
  bandpass.frequency.value = 2450
  bandpass.Q.value = 1.35

  const noiseGain = ctx.createGain()
  noiseGain.gain.setValueAtTime(volume * 0.5, t0)
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)

  noise.connect(bandpass)
  bandpass.connect(noiseGain)
  noiseGain.connect(ctx.destination)

  const osc = ctx.createOscillator()
  osc.type = "triangle"
  osc.frequency.setValueAtTime(1720, t0)
  osc.frequency.exponentialRampToValueAtTime(680, t0 + 0.034)

  const oscGain = ctx.createGain()
  oscGain.gain.setValueAtTime(volume * 0.32, t0)
  oscGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.038)

  osc.connect(oscGain)
  oscGain.connect(ctx.destination)

  noise.start(t0)
  osc.start(t0)
  osc.stop(t0 + 0.045)
}
