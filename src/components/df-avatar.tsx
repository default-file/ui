"use client"

import * as React from "react"

import { avatarToneVar, initialsFromName } from "../lib/df-avatar"
import {
  dfAvatarPresenceLabel,
  useDfStrings,
} from "../lib/df-intl"
import { sanitizeSrc } from "../lib/df-url"
import { cn } from "../lib/utils"

type AvatarSize = "xs" | "sm" | "md" | "lg"
type AvatarShape = "circle" | "square"
type AvatarPresence = "online" | "away" | "busy" | "offline"

type AvatarProps = Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> & {
  name: string
  src?: string | null | undefined
  alt?: string | undefined
  size?: AvatarSize | undefined
  shape?: AvatarShape | undefined
  /** Presence indicator tone. Omit to hide the dot. */
  presence?: AvatarPresence | undefined
}

function cssUrl(value: string): string {
  return `url(${JSON.stringify(value)})`
}

function Avatar({
  className,
  name,
  src,
  alt,
  size = "md",
  shape = "circle",
  presence,
  style,
  "aria-label": ariaLabel,
  ...props
}: AvatarProps) {
  const s = useDfStrings()
  const [imageReady, setImageReady] = React.useState(false)
  const [loadedSrc, setLoadedSrc] = React.useState<string | null>(null)
  const [trackedSrc, setTrackedSrc] = React.useState(src)

  if (src !== trackedSrc) {
    setTrackedSrc(src)
    setLoadedSrc(null)
    setImageReady(false)
  }

  React.useEffect(() => {
    if (src == null || src === "") return
    const safeSrc = sanitizeSrc(src)
    if (safeSrc == null) return

    let cancelled = false
    const probe = new window.Image()
    probe.onload = () => {
      if (cancelled) return
      setLoadedSrc(safeSrc)
      setImageReady(true)
    }
    probe.onerror = () => {
      if (cancelled) return
      setLoadedSrc(null)
      setImageReady(false)
    }
    probe.src = safeSrc

    return () => {
      cancelled = true
      probe.onload = null
      probe.onerror = null
    }
  }, [src])

  const showImage = imageReady && loadedSrc != null
  const safeLoadedSrc =
    loadedSrc != null ? sanitizeSrc(loadedSrc) : null
  const initials = initialsFromName(name)
  const tone = avatarToneVar(name)

  return (
    <span
      data-df="avatar"
      data-size={size}
      data-shape={shape}
      data-presence={presence}
      className={cn(className)}
      style={
        {
          "--df-avatar-tone": tone,
          ...style,
        } as React.CSSProperties
      }
      title={props.title ?? name}
      aria-label={ariaLabel ?? alt ?? name}
      {...props}
    >
      {showImage && safeLoadedSrc != null ? (
        <span
          data-df="avatar-image"
          aria-hidden
          style={{ backgroundImage: cssUrl(safeLoadedSrc) }}
        />
      ) : (
        <span data-df="avatar-fallback" aria-hidden>
          {initials}
        </span>
      )}
      {presence != null ? (
        <span
          data-df="avatar-presence"
          data-tone={presence}
          aria-label={dfAvatarPresenceLabel(s, presence)}
        />
      ) : null}
    </span>
  )
}

type AvatarStackItem = {
  id: string
  name: string
  src?: string | null
  presence?: AvatarPresence
}

type AvatarStackProps = Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "children"
> & {
  items: AvatarStackItem[]
  max?: number
  size?: AvatarSize
  shape?: AvatarShape
}

function AvatarStack({
  className,
  items,
  max = 3,
  size = "md",
  shape = "circle",
  ...props
}: AvatarStackProps) {
  const s = useDfStrings()
  const visible = items.slice(0, Math.max(0, max))
  const overflow = Math.max(0, items.length - visible.length)

  return (
    <div
      data-df="avatar-stack"
      data-size={size}
      className={cn(className)}
      {...props}
    >
      {visible.map((item) => (
        <Avatar
          key={item.id}
          name={item.name}
          src={item.src}
          presence={item.presence}
          size={size}
          shape={shape}
        />
      ))}
      {overflow > 0 ? (
        <span
          data-df="avatar-overflow"
          data-size={size}
          data-shape={shape}
          aria-label={s.avatarOverflowMore(overflow)}
        >
          {s.avatarOverflowVisible(overflow)}
        </span>
      ) : null}
    </div>
  )
}

export { Avatar, AvatarStack }
export type {
  AvatarPresence,
  AvatarProps,
  AvatarShape,
  AvatarSize,
  AvatarStackItem,
  AvatarStackProps,
}
