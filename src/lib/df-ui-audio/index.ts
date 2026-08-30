type AudioContextConstructor = typeof AudioContext

let sharedContext: AudioContext | null = null

function getAudioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === "undefined") return null
  const fromWindow = window.AudioContext
  if (fromWindow) return fromWindow
  const legacy = (
    window as Window & { webkitAudioContext?: AudioContextConstructor }
  ).webkitAudioContext
  return legacy ?? null
}

export function getUiAudioContext(): AudioContext | null {
  const Constructor = getAudioContextConstructor()
  if (!Constructor) return null
  if (!sharedContext || sharedContext.state === "closed") {
    sharedContext = new Constructor()
  }
  return sharedContext
}

export function resumeUiAudio(): void {
  const ctx = getUiAudioContext()
  if (!ctx || ctx.state !== "suspended") return
  void ctx.resume()
}

export function uiAudioAllowed(): boolean {
  if (typeof document !== "undefined" && document.hidden) return false
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return true
  }
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches
}
