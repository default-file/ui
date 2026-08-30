"use client"

import * as React from "react"

import {
  CHART_HEIGHT_TOKENS,
  type ChartFrameSize,
} from "../lib/df-chart"
import { sanitizeCssColor } from "../lib/df-css-value"
import { useDfStrings } from "../lib/df-intl"
import { cn } from "../lib/utils"

export type { ChartFrameSize }

export type ChartFrameProps = Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "title"
> & {
  title?: React.ReactNode
  description?: React.ReactNode
  toolbar?: React.ReactNode
  size?: ChartFrameSize
  loading?: boolean
  empty?: boolean
  emptyContent?: React.ReactNode
  children?: React.ReactNode
  /**
   * Accessible name for the plot when it is shown. Prefer a short summary of
   * the data. When omitted, a string `title` is used; otherwise provide this
   * or a string title so the graphic is not unnamed.
   */
  plotLabel?: string
}

function ChartFrame({
  className,
  title,
  description,
  toolbar,
  size = "md",
  loading = false,
  empty = false,
  emptyContent,
  children,
  style,
  plotLabel,
  ...props
}: ChartFrameProps) {
  const s = useDfStrings()
  const heightToken = CHART_HEIGHT_TOKENS[size]
  const showHeader =
    title != null || description != null || toolbar != null
  const titleId = React.useId()
  const descriptionId = React.useId()
  const titleIsString = typeof title === "string" && title.trim() !== ""
  const plotName =
    plotLabel?.trim() ||
    (titleIsString ? title.trim() : undefined) ||
    undefined
  const labelledByTitle =
    plotName == null && title != null ? titleId : undefined
  const plotHasName = plotName != null || labelledByTitle != null

  return (
    <div
      data-df="chart-frame"
      data-size={size}
      className={cn(className)}
      style={style}
      {...props}
    >
      {showHeader ? (
        <div data-df="chart-frame-header">
          <div data-df="chart-frame-copy">
            {title != null ? (
              <div data-df="chart-frame-title" id={titleId}>
                {title}
              </div>
            ) : null}
            {description != null ? (
              <div data-df="chart-frame-description" id={descriptionId}>
                {description}
              </div>
            ) : null}
          </div>
          {toolbar != null ? (
            <div data-df="chart-frame-toolbar">{toolbar}</div>
          ) : null}
        </div>
      ) : null}

      {loading ? (
        <div
          data-df="chart-frame-loading"
          role="status"
          aria-busy="true"
          style={{ height: `var(${heightToken})` }}
        >
          <span className="df-chart-skeleton" />
        </div>
      ) : empty ? (
        <div
          data-df="chart-frame-empty"
          role="status"
          style={{ minHeight: `var(${heightToken})` }}
        >
          {emptyContent ?? s.chartEmpty}
        </div>
      ) : (
        <div
          data-df="chart-frame-plot"
          role={plotHasName ? "img" : undefined}
          aria-label={plotName}
          aria-labelledby={labelledByTitle}
          aria-describedby={
            plotHasName && description != null ? descriptionId : undefined
          }
          style={{ height: `var(${heightToken})`, width: "100%" }}
        >
          {children}
        </div>
      )}
    </div>
  )
}

export type ChartTooltipPayloadItem = {
  name?: string
  value?: number | string | Array<number | string>
  color?: string
  dataKey?: string | number
  payload?: unknown
}

export type ChartTooltipProps = {
  active?: boolean
  label?: React.ReactNode
  payload?: readonly ChartTooltipPayloadItem[]
  className?: string
  formatValue?: (
    value: ChartTooltipPayloadItem["value"],
    item: ChartTooltipPayloadItem
  ) => React.ReactNode
}

function ChartTooltip({
  active,
  label,
  payload,
  className,
  formatValue,
}: ChartTooltipProps) {
  const s = useDfStrings()
  if (!active || payload == null || payload.length === 0) return null

  return (
    <div data-df="chart-tooltip" className={cn(className)}>
      {label != null && label !== "" ? (
        <div data-df="chart-tooltip-label">{label}</div>
      ) : null}
      <ul data-df="chart-tooltip-rows">
        {payload.map((item, index) => {
          const key = String(item.dataKey ?? item.name ?? index)
          const displayValue =
            formatValue != null
              ? formatValue(item.value, item)
              : item.value == null
                ? ""
                : Array.isArray(item.value)
                  ? s.chartValuesJoin(item.value.map(String))
                  : item.value
          const swatchColor =
            item.color != null ? sanitizeCssColor(item.color) : null
          return (
            <li key={key} data-df="chart-tooltip-row">
              <span
                data-df="chart-tooltip-swatch"
                aria-hidden
                style={
                  swatchColor != null
                    ? { backgroundColor: swatchColor }
                    : undefined
                }
              />
              <span data-df="chart-tooltip-name">{item.name ?? key}</span>
              <span data-df="chart-tooltip-value">{displayValue}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export type ChartLegendItem = {
  id: string
  label: React.ReactNode
  color: string
}

export type ChartLegendProps = Omit<
  React.HTMLAttributes<HTMLUListElement>,
  "children"
> & {
  items: readonly ChartLegendItem[]
}

function ChartLegend({ items, className, ...props }: ChartLegendProps) {
  if (items.length === 0) return null

  return (
    <ul data-df="chart-legend" className={cn(className)} {...props}>
      {items.map((item) => {
        const color = sanitizeCssColor(item.color)
        return (
          <li key={item.id} data-df="chart-legend-item">
            <span
              data-df="chart-legend-swatch"
              aria-hidden
              style={
                color != null ? { backgroundColor: color } : undefined
              }
            />
            <span data-df="chart-legend-label">{item.label}</span>
          </li>
        )
      })}
    </ul>
  )
}

export { ChartFrame, ChartLegend, ChartTooltip }
