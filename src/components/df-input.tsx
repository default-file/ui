"use client"

import * as React from "react"
import { ChevronDown, ChevronUp, X } from "lucide-react"

import { useControllableState, useIsomorphicLayoutEffect } from "../hooks"
import {
  dfCornerShapeStyle,
  type DfCornerShape,
} from "../lib/corner-shape"
import {
  dfHoverBorderAttr,
  dfHoverBorderColorStyle,
} from "../lib/hover-border"
import {
  dfPaddingChromeStyle,
  hasResolvedPadding,
  resolvePaddingSides,
} from "../lib/padding-chrome"
import { useDfStrings } from "../lib/df-intl"
import { cn, composeEventHandlers } from "../lib/utils"
import { Label, type LabelInsetAlign } from "./df-label"

type InputVariant = "primary" | "secondary"
type InputLabelPosition = "outside" | "inside"
type InputFocusVariant = "ring" | "border"
type InputSize = "sm" | "md" | "lg" | "xl"
type InputBorderWidth = "hairline" | "thin" | "thick"
type InputCommitMode = "change" | "blur"
type InputRadius =
  | "none"
  | "xxs"
  | "xs"
  | "sm"
  | "md"
  | "lg"
  | "xl"
  | "2xl"
  | "3xl"
  | "4xl"
  | "full"

type InputProps = Omit<
  React.ComponentProps<"input">,
  "prefix" | "size" | "height"
> & {
  variant?: InputVariant
  size?: InputSize
  height?: string
  padding?: string
  paddingX?: string
  paddingY?: string
  paddingTop?: string
  paddingRight?: string
  paddingBottom?: string
  paddingLeft?: string
  label?: React.ReactNode
  labelPosition?: InputLabelPosition
  labelTrailing?: React.ReactNode
  labelInsetAlign?: LabelInsetAlign
  labelInsetSize?: string
  labelColor?: string | undefined
  background?: string | undefined
  borderColor?: string | undefined
  borderWidth?: InputBorderWidth | undefined
  hoverBorder?: boolean | undefined
  hoverBorderColor?: string | undefined
  foreground?: string | undefined
  placeholderColor?: string | undefined
  hint?: React.ReactNode | undefined
  hintColor?: string | undefined
  focusVariant?: InputFocusVariant | undefined
  focusBorderColor?: string | undefined
  invalid?: boolean | undefined
  invalidLabel?: boolean | undefined
  errorBorderColor?: string | undefined
  errorLabelColor?: string | undefined
  radius?: InputRadius | undefined
  cornerShape?: DfCornerShape | undefined
  leadingIcon?: React.ReactNode | undefined
  trailingIcon?: React.ReactNode | undefined
  clearable?: boolean | undefined
  onClear?: () => void
  prefix?: React.ReactNode
  suffix?: React.ReactNode
  addonColor?: string
  action?: React.ReactNode
  stepper?: boolean
  incrementIcon?: React.ReactNode
  decrementIcon?: React.ReactNode
  commitMode?: InputCommitMode
}

function parseFiniteNumber(value: string): number | null {
  if (value.trim() === "") return null
  const next = Number(value)
  return Number.isFinite(next) ? next : null
}

function resolveStep(step: React.ComponentProps<"input">["step"]): number {
  if (step == null || step === "any") return 1
  const next = Number(step)
  return Number.isFinite(next) && next > 0 ? next : 1
}

function resolveBound(
  value: React.ComponentProps<"input">["min"] | React.ComponentProps<"input">["max"]
): number | null {
  if (value == null || value === "") return null
  const next = Number(value)
  return Number.isFinite(next) ? next : null
}

function formatSteppedValue(value: number, step: number): string {
  const decimals = (() => {
    const text = String(step)
    if (!text.includes("e") && !text.includes("E")) {
      const fraction = text.split(".")[1]
      return fraction ? fraction.length : 0
    }
    const match = /^(\d+)(?:\.(\d+))?e([+-]?\d+)$/i.exec(text)
    if (!match) return 0
    const fractionLength = match[2]?.length ?? 0
    const exponent = Number(match[3])
    return Math.max(0, fractionLength - exponent)
  })()
  return decimals > 0 ? value.toFixed(decimals) : String(Math.round(value))
}

function nextSteppedValue(
  current: string,
  direction: 1 | -1,
  stepAttr: React.ComponentProps<"input">["step"],
  minAttr: React.ComponentProps<"input">["min"],
  maxAttr: React.ComponentProps<"input">["max"]
): string {
  const step = resolveStep(stepAttr)
  const min = resolveBound(minAttr)
  const max = resolveBound(maxAttr)
  const parsed = parseFiniteNumber(current)
  const base =
    parsed ??
    (direction > 0 ? (min ?? 0) : (max ?? min ?? 0))
  let next = base + direction * step
  if (min != null) next = Math.max(min, next)
  if (max != null) next = Math.min(max, next)
  return formatSteppedValue(next, step)
}

function resolveInputType(
  type: React.ComponentProps<"input">["type"],
  stepper: boolean,
  commitMode: InputCommitMode
): React.ComponentProps<"input">["type"] {
  if (!stepper) return type
  if (commitMode === "blur") return type
  return "number"
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  function Input(
    {
      className,
      style,
      type = "text",
      id: idProp,
      variant = "primary",
      size = "md",
      height,
      padding,
      paddingX,
      paddingY,
      paddingTop,
      paddingRight,
      paddingBottom,
      paddingLeft,
      label,
      labelPosition = "outside",
      labelTrailing,
      labelInsetAlign,
      labelInsetSize,
      labelColor,
      background,
      borderColor,
      borderWidth = "hairline",
      hoverBorder,
      hoverBorderColor,
      foreground,
      placeholderColor,
      hint,
      hintColor,
      focusVariant = "ring",
      focusBorderColor,
      invalid = false,
      invalidLabel = true,
      errorBorderColor,
      errorLabelColor,
      radius = "4xl",
      cornerShape,
      leadingIcon,
      trailingIcon,
      clearable = false,
      onClear,
      prefix,
      suffix,
      addonColor,
      action,
      stepper = false,
      incrementIcon,
      decrementIcon,
      commitMode = "change",
      placeholder,
      value,
      defaultValue,
      onChange,
      onFocus,
      onBlur,
      onKeyDown,
      disabled,
      readOnly,
      min,
      max,
      step,
      "aria-describedby": ariaDescribedBy,
      "aria-invalid": ariaInvalidProp,
      ...props
    },
    ref
  ) {
    const s = useDfStrings()
    const reactId = React.useId()
    const inputId = idProp ?? `df-input-${reactId}`
    const hintId = hint != null ? `df-input-hint-${reactId}` : undefined
    const inputRef = React.useRef<HTMLInputElement | null>(null)
    const commitOnBlur = commitMode === "blur"
    const [draft, setDraft] = React.useState<string | null>(null)
    const draftRef = React.useRef<string | null>(null)
    const pendingCommitRef = React.useRef<string | null>(null)

    const [current, setCurrent] = useControllableState<string>({
      value: value === undefined ? undefined : String(value),
      defaultValue:
        defaultValue === undefined || defaultValue === null
          ? ""
          : String(defaultValue),
    })

    const displayValue = commitOnBlur && draft !== null ? draft : current
    const isInvalid =
      invalid || ariaInvalidProp === true || ariaInvalidProp === "true"
    const showInvalidLabel = isInvalid && invalidLabel
    const isEmpty = String(displayValue).length === 0
    const showClear =
      clearable && !isEmpty && !disabled && !readOnly
    const showStepper = stepper && !disabled && !readOnly
    const hasLeading = leadingIcon != null
    const hasTrailing = trailingIcon != null
    const hasPrefix = prefix != null
    const hasSuffix = suffix != null
    const hasAction = action != null
    const hasInsideLabel = label != null && labelPosition === "inside"
    const hasOutsideLabel = label != null && labelPosition === "outside"
    const shellOwnsChrome =
      hasInsideLabel ||
      hasPrefix ||
      hasSuffix ||
      hasAction ||
      hasLeading ||
      hasTrailing ||
      clearable ||
      stepper
    const needsField =
      hasLeading ||
      hasTrailing ||
      hasPrefix ||
      hasSuffix ||
      hasAction ||
      hasInsideLabel ||
      clearable ||
      stepper
    const needsRoot = hasOutsideLabel || hint != null || needsField
    const resolvedType = resolveInputType(type, stepper, commitMode)
    const minBound = resolveBound(min)
    const maxBound = resolveBound(max)
    const numericValue = parseFiniteNumber(String(displayValue))
    const canIncrement =
      showStepper && (maxBound == null || numericValue == null || numericValue < maxBound)
    const canDecrement =
      showStepper && (minBound == null || numericValue == null || numericValue > minBound)

    function writeDraft(next: string | null) {
      draftRef.current = next
      setDraft(next)
    }

    useIsomorphicLayoutEffect(() => {
      if (!commitOnBlur) return
      const pending = pendingCommitRef.current
      if (pending == null) return
      pendingCommitRef.current = null
      if (draftRef.current === null) return
      if (String(current) === pending) return
      writeDraft(String(current))
    }, [current, commitOnBlur])

    const describedBy =
      [ariaDescribedBy, hintId].filter(Boolean).join(" ") || undefined

    const resolvedPadding = resolvePaddingSides({
      padding,
      paddingX,
      paddingY,
      paddingTop,
      paddingRight,
      paddingBottom,
      paddingLeft,
    })
    const hasPaddingStyle = hasResolvedPadding(resolvedPadding)
    const paddingStyle = dfPaddingChromeStyle(
      "--df-input-padding",
      resolvedPadding
    )

    const surfaceStyle = {
      ...(background != null ? { "--df-input-bg": background } : null),
      ...(borderColor != null ? { "--df-input-border": borderColor } : null),
      ...(foreground != null ? { "--df-input-fg": foreground } : null),
      ...(placeholderColor != null
        ? { "--df-input-placeholder": placeholderColor }
        : null),
      ...dfHoverBorderColorStyle(
        "--df-input-hover-border",
        hoverBorder,
        hoverBorderColor
      ),
      ...(focusBorderColor != null
        ? { "--df-input-focus-border": focusBorderColor }
        : null),
      ...(errorBorderColor != null
        ? { "--df-input-error-border": errorBorderColor }
        : null),
      ...(addonColor != null ? { "--df-input-addon": addonColor } : null),
      ...(height != null ? { "--df-input-height": height } : null),
      ...paddingStyle,
      ...(hasInsideLabel && labelColor != null
        ? { "--df-input-label": labelColor }
        : null),
      ...(hasInsideLabel && errorLabelColor != null
        ? { "--df-input-error-label": errorLabelColor }
        : null),
      ...dfCornerShapeStyle(cornerShape),
      ...style,
    } as React.CSSProperties

    const rootToneStyle = {
      ...(labelColor != null ? { "--df-input-label": labelColor } : null),
      ...(errorLabelColor != null
        ? { "--df-input-error-label": errorLabelColor }
        : null),
      ...(hintColor != null ? { "--df-input-hint": hintColor } : null),
      ...(hasOutsideLabel
        ? {
            "--df-label-inset-content":
              resolvedPadding.left ??
              "var(--df-control-content-inset-inline)",
          }
        : null),
    } as React.CSSProperties

    const hasRootTone =
      labelColor != null ||
      errorLabelColor != null ||
      hintColor != null ||
      hasOutsideLabel
    const hoverBorderAttr = dfHoverBorderAttr(hoverBorder)

    const fieldStyle = shellOwnsChrome
      ? surfaceStyle
      : hasPaddingStyle
        ? paddingStyle
        : undefined

    function setRefs(node: HTMLInputElement | null) {
      inputRef.current = node
      if (typeof ref === "function") {
        ref(node)
      } else if (ref) {
        ref.current = node
      }
    }

    function emitChange(next: string) {
      onChange?.({
        target: { value: next },
        currentTarget: { value: next },
      } as React.ChangeEvent<HTMLInputElement>)
    }

    function commitValue(next: string) {
      if (commitOnBlur) {
        writeDraft(next)
        pendingCommitRef.current = next
      }
      setCurrent(next)
      emitChange(next)
    }

    function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
      if (commitOnBlur) {
        writeDraft(event.target.value)
        return
      }
      setCurrent(event.target.value)
      onChange?.(event)
    }

    function handleFocus(event: React.FocusEvent<HTMLInputElement>) {
      if (commitOnBlur && draftRef.current === null) {
        writeDraft(String(current))
      }
      onFocus?.(event)
    }

    function handleBlur(event: React.FocusEvent<HTMLInputElement>) {
      if (commitOnBlur) {
        const next = draftRef.current ?? String(current)
        writeDraft(null)
        pendingCommitRef.current = null
        if (next !== String(current)) {
          setCurrent(next)
          emitChange(next)
        }
      }
      onBlur?.(event)
    }

    function handleClear() {
      if (commitOnBlur) {
        writeDraft("")
        pendingCommitRef.current = ""
      }
      setCurrent("")
      onClear?.()
      emitChange("")
    }

    function applyStep(direction: 1 | -1) {
      if (!showStepper) return
      const base = draftRef.current ?? String(current)
      commitValue(nextSteppedValue(base, direction, step, min, max))
      inputRef.current?.focus()
    }

    function handleKeyDownOurs(event: React.KeyboardEvent<HTMLInputElement>) {
      if (commitOnBlur && event.key === "Enter") {
        event.preventDefault()
        event.currentTarget.blur()
        return
      }
      if (!showStepper) return
      if (event.key === "ArrowUp") {
        event.preventDefault()
        applyStep(1)
        return
      }
      if (event.key === "ArrowDown") {
        event.preventDefault()
        applyStep(-1)
      }
    }

    const inputEl = (
      <input
        ref={setRefs}
        id={inputId}
        type={resolvedType}
        data-df="input"
        data-variant={variant}
        data-size={size}
        data-border-width={borderWidth}
        data-radius={radius}
        data-focus-variant={focusVariant}
        data-corner-shape={cornerShape}
        data-hover-border={hoverBorderAttr}
        data-stepper={stepper ? "" : undefined}
        data-commit-mode={commitOnBlur ? "blur" : undefined}
        data-invalid={isInvalid ? "" : undefined}
        aria-invalid={isInvalid || undefined}
        aria-describedby={describedBy}
        placeholder={hasInsideLabel ? undefined : placeholder}
        value={displayValue}
        disabled={disabled}
        readOnly={readOnly}
        min={min}
        max={max}
        step={step}
        className={cn("df-input", !needsRoot && !needsField && className)}
        style={shellOwnsChrome ? undefined : surfaceStyle}
        {...props}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={(event) => {
          composeEventHandlers(onKeyDown, handleKeyDownOurs)(event)
        }}
      />
    )

    const field = needsField ? (
      <div
        data-df="input-field"
        data-variant={variant}
        data-size={size}
        data-border-width={borderWidth}
        data-radius={radius}
        data-focus-variant={focusVariant}
        data-corner-shape={cornerShape}
        data-hover-border={hoverBorderAttr}
        data-label-position={hasInsideLabel ? "inside" : undefined}
        data-empty={hasInsideLabel && isEmpty ? "" : undefined}
        data-has-leading={hasLeading ? "" : undefined}
        data-has-trailing={hasTrailing ? "" : undefined}
        data-has-clear={showClear ? "" : undefined}
        data-clearable={clearable ? "" : undefined}
        data-has-prefix={hasPrefix ? "" : undefined}
        data-has-suffix={hasSuffix ? "" : undefined}
        data-has-action={hasAction ? "" : undefined}
        data-has-stepper={showStepper ? "" : undefined}
        data-chrome={shellOwnsChrome ? "shell" : undefined}
        data-invalid={isInvalid ? "" : undefined}
        data-invalid-label={showInvalidLabel ? "" : undefined}
        className={cn(!hasOutsideLabel && !hint && className)}
        style={fieldStyle}
      >
        {hasLeading ? (
          <span data-df="input-icon" data-side="start" aria-hidden>
            {leadingIcon}
          </span>
        ) : null}

        {hasPrefix ? (
          <span data-df="input-prefix" aria-hidden>
            {prefix}
          </span>
        ) : null}

        {inputEl}

        {hasInsideLabel ? (
          <label data-df="input-label" htmlFor={inputId}>
            {label}
          </label>
        ) : null}

        {hasInsideLabel && labelTrailing != null ? (
          <span data-df="input-label-trailing">{labelTrailing}</span>
        ) : null}

        {hasSuffix ? (
          <span data-df="input-suffix" aria-hidden>
            {suffix}
          </span>
        ) : null}

        {hasTrailing ? (
          <span data-df="input-icon" data-side="end">
            {trailingIcon}
          </span>
        ) : null}

        {showClear ? (
          <button
            type="button"
            data-df="input-clear"
            aria-label={s.inputClear}
            onMouseDown={(event) => {
              event.preventDefault()
            }}
            onClick={handleClear}
          >
            <X aria-hidden />
          </button>
        ) : null}

        {showStepper ? (
          <div data-df="input-stepper">
            <button
              type="button"
              data-df="input-stepper-button"
              data-direction="up"
              aria-label={s.inputIncrement}
              disabled={!canIncrement}
              onMouseDown={(event) => {
                event.preventDefault()
              }}
              onClick={() => applyStep(1)}
            >
              {incrementIcon ?? <ChevronUp aria-hidden />}
            </button>
            <button
              type="button"
              data-df="input-stepper-button"
              data-direction="down"
              aria-label={s.inputDecrement}
              disabled={!canDecrement}
              onMouseDown={(event) => {
                event.preventDefault()
              }}
              onClick={() => applyStep(-1)}
            >
              {decrementIcon ?? <ChevronDown aria-hidden />}
            </button>
          </div>
        ) : null}

        {hasAction ? <div data-df="input-action">{action}</div> : null}
      </div>
    ) : (
      inputEl
    )

    if (!needsRoot) {
      return field
    }

    return (
      <div
        data-df="input-root"
        data-invalid={isInvalid ? "" : undefined}
        data-invalid-label={showInvalidLabel ? "" : undefined}
        className={cn(className)}
        style={hasRootTone ? rootToneStyle : undefined}
      >
        {hasOutsideLabel ? (
          <Label
            htmlFor={inputId}
            trailing={labelTrailing}
            insetAlign={labelInsetAlign}
            insetSize={labelInsetSize}
          >
            {label}
          </Label>
        ) : null}

        {field}

        {hint != null ? (
          <span data-df="input-hint" id={hintId}>
            {hint}
          </span>
        ) : null}
      </div>
    )
  }
)

export { Input }
export type {
  InputProps,
  InputVariant,
  InputSize,
  InputBorderWidth,
  InputCommitMode,
  InputLabelPosition,
  InputFocusVariant,
  InputRadius,
}
