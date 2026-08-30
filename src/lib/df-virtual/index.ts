"use client"

import { useMemo } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"

export type VirtualRowItem = {
  index: number
  key: string | number | bigint
  start: number
  end: number
  size: number
}

export type UseVirtualRowsOptions = {
  count: number
  estimateSize: number | ((index: number) => number)
  getScrollElement: () => Element | null
  overscan?: number | undefined
}

export type UseVirtualRowsResult = {
  items: VirtualRowItem[]
  totalSize: number
  measureElement: (node: Element | null | undefined) => void
}

/** Normalize a fixed or per index size into the estimator shape the windowing engine expects. */
export function resolveEstimateSize(
  estimateSize: UseVirtualRowsOptions["estimateSize"]
): (index: number) => number {
  if (typeof estimateSize === "number") {
    const size = estimateSize
    return () => size
  }
  return estimateSize
}

/**
 * Owned row windowing hook. Kit consumers import this module instead of the
 * underlying windowing package.
 */
export function useVirtualRows(
  options: UseVirtualRowsOptions
): UseVirtualRowsResult {
  const estimateSize = useMemo(
    () => resolveEstimateSize(options.estimateSize),
    [options.estimateSize]
  )

  // Consumers pass measureElement as a ref callback and do not feed windowing
  // callbacks into memoized props, so the unsafe-memoization caveat does not apply.
  // eslint-disable-next-line react-hooks/incompatible-library -- see above
  const virtualizer = useVirtualizer({
    count: options.count,
    estimateSize,
    getScrollElement: options.getScrollElement,
    ...(options.overscan !== undefined ? { overscan: options.overscan } : {}),
  })

  return {
    items: virtualizer.getVirtualItems(),
    totalSize: virtualizer.getTotalSize(),
    measureElement: (node) => virtualizer.measureElement(node ?? null),
  }
}
