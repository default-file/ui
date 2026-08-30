import type * as React from "react"

type ClassValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | ClassValue[]
  | { [key: string]: boolean | null | undefined }

function toClass(value: ClassValue): string {
  if (!value) return ""
  if (typeof value === "string" || typeof value === "number") return String(value)
  if (Array.isArray(value)) return value.map(toClass).filter(Boolean).join(" ")
  if (typeof value === "object") {
    return Object.entries(value)
      .filter(([, on]) => Boolean(on))
      .map(([key]) => key)
      .join(" ")
  }
  return ""
}

export function cn(...inputs: ClassValue[]) {
  return inputs.map(toClass).filter(Boolean).join(" ").replace(/\s+/g, " ").trim()
}

/** Run the consumer handler first; skip ours when they call preventDefault(). */
export function composeEventHandlers<E extends { defaultPrevented: boolean }>(
  theirs: ((event: E) => void) | undefined,
  ours: (event: E) => void
) {
  return (event: E) => {
    theirs?.(event)
    if (!event.defaultPrevented) ours(event)
  }
}

/** Assign a node to multiple refs (callback and object refs). */
export function composeRefs<T>(
  ...refs: Array<React.Ref<T> | undefined | null>
): React.RefCallback<T> {
  return (node) => {
    for (const ref of refs) {
      if (ref == null) continue
      if (typeof ref === "function") {
        ref(node)
      } else {
        ;(ref as React.MutableRefObject<T | null>).current = node
      }
    }
  }
}
