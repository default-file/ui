"use client"

import * as React from "react"

import { Label } from "./df-label"
import { Slider, type SliderThickness, type SliderVariant } from "./df-slider"

export type NumberSliderProps = {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
  /** Track and thumb thickness. Matches Slider. Default md. */
  thickness?: SliderThickness
  /** Visual recipe. Matches Slider. Default bar. */
  variant?: SliderVariant
}

function NumberSlider({
  label,
  value,
  min,
  max,
  step = 0.01,
  onChange,
  thickness = "md",
  variant = "bar",
}: NumberSliderProps) {
  const labelId = React.useId()
  const digits = step >= 1 ? 0 : step >= 0.1 ? 1 : 2
  const bounded = Math.min(max, Math.max(min, value))

  return (
    <div className="flex flex-col gap-2">
      <Label
        id={labelId}
        as="div"
        className="text-xs text-muted-foreground"
        trailing={
          <span className="font-mono text-11">{bounded.toFixed(digits)}</span>
        }
      >
        {label}
      </Label>
      <Slider
        min={min}
        max={max}
        step={step}
        thickness={thickness}
        variant={variant}
        value={[bounded]}
        aria-labelledby={labelId}
        onValueChange={(next) => {
          const v = Array.isArray(next) ? next[0] : next
          if (typeof v === "number") onChange(v)
        }}
      />
    </div>
  )
}

export { NumberSlider }
