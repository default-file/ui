"use client"

import { useSyncExternalStore } from "react"

const REDUCE_MOTION_QUERY = "(prefers-reduced-motion: reduce)"

/** Imperative read of the reduced-motion preference. Safe on the server (false). */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false
  }
  return window.matchMedia(REDUCE_MOTION_QUERY).matches
}

function subscribeReducedMotion(onStoreChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {}
  }
  const media = window.matchMedia(REDUCE_MOTION_QUERY)
  media.addEventListener("change", onStoreChange)
  return () => media.removeEventListener("change", onStoreChange)
}

/** Reactive reduced-motion preference. Re-renders when the user changes it. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    prefersReducedMotion,
    () => false
  )
}
