const BLOCKED_SCHEMES = /^(javascript|data|vbscript):/i

function hasControlCharacter(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i)
    if (code <= 0x1f || code === 0x7f) return true
  }
  return false
}

/**
 * Validate a link href for the editor model.
 * Allows http, https, mailto, and relative paths. Rejects javascript and data schemes.
 */
export function isSafeHref(href: string): boolean {
  const value = href.trim()
  if (!value) return false
  if (BLOCKED_SCHEMES.test(value)) return false
  if (hasControlCharacter(value)) return false

  const schemeMatch = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(value)
  if (!schemeMatch) {
    // Relative, hash, or protocol relative looking without scheme token.
    if (value.startsWith("//")) return false
    return true
  }

  const scheme = schemeMatch[1]!.toLowerCase()
  return scheme === "http" || scheme === "https" || scheme === "mailto"
}

/** Return a safe href, or null when the value must not be stored or rendered as a link. */
export function sanitizeHref(href: string): string | null {
  const trimmed = href.trim()
  if (!isSafeHref(trimmed)) return null
  return trimmed
}

const DATA_IMAGE_MIME = /^data:(image\/[a-z0-9.+-]+)(;|,)/i

/**
 * Validate an image src for avatar and uploader previews.
 * Allows http, https, blob, data:image except svg+xml, and same-origin relative paths.
 */
export function sanitizeSrc(src: string): string | null {
  const value = src.trim()
  if (!value) return null
  if (hasControlCharacter(value)) return null
  if (value.startsWith("//")) return null

  const schemeMatch = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(value)
  if (!schemeMatch) {
    return value
  }

  const scheme = schemeMatch[1]!.toLowerCase()
  if (scheme === "http" || scheme === "https" || scheme === "blob") {
    return value
  }

  if (scheme === "data") {
    const mimeMatch = DATA_IMAGE_MIME.exec(value)
    if (!mimeMatch) return null
    const mime = mimeMatch[1]!.toLowerCase()
    if (mime === "image/svg+xml") return null
    return value
  }

  return null
}
