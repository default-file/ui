"use client"

import * as React from "react"
import { ChevronDown, CircleHelp, X } from "lucide-react"

import { Label, type LabelInsetAlign } from "./df-label"
import type { ListItemChromeProps, ListItemLayout } from "./df-list-item"
import {
  OptionList,
  OptionListContent,
  OptionListGroup,
  OptionListItem,
  OptionListLabel,
  OptionListScrollDownButton,
  OptionListScrollUpButton,
  OptionListSeparator,
  useOptionListContext,
  type OptionListItemProps,
  type OptionListWidth,
} from "./df-option-list"
import {
  dfHoverBorderAttr,
  dfHoverBorderColorStyle,
} from "../lib/hover-border"
import {
  dfPaddingChromeStyle,
  resolvePaddingSides,
} from "../lib/padding-chrome"
import { useDfStrings } from "../lib/df-intl"
import { cn, composeEventHandlers } from "../lib/utils"

type SelectSize = "sm" | "md" | "lg"
type SelectVariant = "primary" | "secondary"
type SelectLabelPosition = "outside" | "overlap" | "inset"

type SelectTriggerProps = Omit<React.HTMLAttributes<HTMLDivElement>, "disabled"> & {
  size?: SelectSize | "default"
  variant?: SelectVariant
  disabled?: boolean
  invalid?: boolean
  leadingIcon?: React.ReactNode
  background?: string
  borderColor?: string
  hoverBorder?: boolean
  hoverBorderColor?: string
  errorBorderColor?: string
  padding?: string
  paddingX?: string
  paddingY?: string
  paddingTop?: string
  paddingRight?: string
  paddingBottom?: string
  paddingLeft?: string
}

type SelectFieldProps = React.HTMLAttributes<HTMLDivElement> & {
  label?: React.ReactNode
  labelPosition?: SelectLabelPosition
  subtext?: React.ReactNode
  required?: boolean
  help?: React.ReactNode
  hint?: React.ReactNode
  hintColor?: string
  hintClassName?: string
  htmlFor?: string
  hintId?: string
  labelColor?: string
  labelClassName?: string
  labelInsetAlign?: LabelInsetAlign
  labelInsetSize?: string
  invalidLabel?: boolean
  errorLabelColor?: string
  overlapLabelBackground?: string
  overlapInset?: string
  overlapLabelPadding?: string
  overlapLabelSize?: string
  insetLabelSize?: string
  insetGap?: string
}

type SelectValueRenderContext = {
  selectionMode: "single" | "multiple"
  value: string | null
  values: string[]
  labelFor: (value: string | null) => React.ReactNode
  secondaryFor: (value: string | null) => React.ReactNode | null
  layoutFor: (value: string | null) => ListItemLayout
  toggleValue: (value: string) => void
}

type SelectExtrasContextValue = {
  disabled: boolean
  invalid: boolean
}

type SelectInsetLabelContextValue = {
  label: React.ReactNode | null
  required: boolean
  help: React.ReactNode | null
  labelClassName?: string | undefined
  htmlFor?: string | undefined
}

const SelectExtrasContext = React.createContext<SelectExtrasContextValue>({
  disabled: false,
  invalid: false,
})

const SelectInsetLabelContext =
  React.createContext<SelectInsetLabelContextValue>({
    label: null,
    required: false,
    help: null,
  })

function useSelectExtras() {
  return React.useContext(SelectExtrasContext)
}

function useSelectInsetLabel() {
  return React.useContext(SelectInsetLabelContext)
}

function resolveSelectSize(size: SelectSize | "default"): SelectSize {
  return size === "default" ? "md" : size
}

function focusSelectTriggerFromLabel(
  event: React.MouseEvent<HTMLElement>,
  htmlFor?: string
) {
  if (event.defaultPrevented || !htmlFor) return
  const control = document.getElementById(htmlFor)
  if (control?.getAttribute("data-df") !== "select-trigger") return
  event.preventDefault()
  control.focus()
}

type SelectProps = {
  selectionMode?: "single" | "multiple"
  value?: string | null
  defaultValue?: string | null
  onValueChange?: (value: string | null) => void
  values?: string[]
  defaultValues?: string[]
  onValuesChange?: (values: string[]) => void
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  closeOnSelect?: boolean
  width?: OptionListWidth
  disabled?: boolean
  invalid?: boolean
  /** Default List Item chrome for every SelectItem. Per item props win. */
  itemChrome?: ListItemChromeProps
  children: React.ReactNode
}

function Select({
  selectionMode = "single",
  value,
  defaultValue = null,
  onValueChange,
  values,
  defaultValues,
  onValuesChange,
  open,
  defaultOpen,
  onOpenChange,
  closeOnSelect,
  width = "hug",
  disabled = false,
  invalid = false,
  itemChrome,
  children,
}: SelectProps) {
  return (
    <OptionList
      selectionMode={selectionMode}
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
      values={values}
      defaultValues={defaultValues}
      onValuesChange={onValuesChange}
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
      closeOnSelect={closeOnSelect}
      width={width}
      itemChrome={itemChrome}
    >
      <SelectExtrasContext.Provider value={{ disabled, invalid }}>
        <SelectDisabledSync disabled={disabled} />
        {children}
      </SelectExtrasContext.Provider>
    </OptionList>
  )
}

function SelectDisabledSync({ disabled }: { disabled: boolean }) {
  const { open, setOpen } = useOptionListContext()
  React.useEffect(() => {
    if (disabled && open) setOpen(false)
  }, [disabled, open, setOpen])
  return null
}

function SelectField({
  className,
  style,
  children,
  label,
  labelPosition = "outside",
  subtext,
  required,
  help,
  hint,
  hintColor,
  hintClassName,
  htmlFor,
  hintId,
  labelColor,
  labelClassName,
  labelInsetAlign,
  labelInsetSize,
  invalidLabel = true,
  errorLabelColor,
  overlapLabelBackground,
  overlapInset,
  overlapLabelPadding,
  overlapLabelSize,
  insetLabelSize,
  insetGap,
  ...props
}: SelectFieldProps) {
  const { disabled, invalid } = useSelectExtras()
  const showInvalidLabel = invalid && invalidLabel && !disabled
  const isOverlap = labelPosition === "overlap" && label != null
  const isInset = labelPosition === "inset" && label != null
  const showOutsideLabel = !isOverlap && !isInset && (label != null || subtext != null)
  const labelHtmlFor = disabled ? undefined : htmlFor
  const labelPositionAttr = isOverlap
    ? "overlap"
    : isInset
      ? "inset"
      : undefined

  const insetLabelValue: SelectInsetLabelContextValue = isInset
    ? {
        label,
        required: Boolean(required),
        help: help ?? null,
        labelClassName,
        htmlFor: labelHtmlFor,
      }
    : {
        label: null,
        required: false,
        help: null,
      }

  const control = isOverlap ? (
    <div data-df="select-overlap">
      <span data-df="select-overlap-label">
        <Label
          htmlFor={labelHtmlFor}
          required={required}
          className={cn(labelClassName)}
          onClick={(event) => focusSelectTriggerFromLabel(event, labelHtmlFor)}
        >
          {label}
        </Label>
        {help != null ? (
          <span data-df="select-field-help">{help}</span>
        ) : null}
      </span>
      {children}
    </div>
  ) : (
    children
  )

  return (
    <SelectInsetLabelContext.Provider value={insetLabelValue}>
      <div
        data-df="select-field"
        data-label-position={labelPositionAttr}
        data-disabled={disabled ? "" : undefined}
        data-invalid={invalid ? "" : undefined}
        data-invalid-label={showInvalidLabel ? "" : undefined}
        className={cn(className)}
        style={{
          ...(labelColor != null
            ? ({ "--df-select-label": labelColor } as React.CSSProperties)
            : null),
          ...(errorLabelColor != null
            ? ({
                "--df-select-error-label": errorLabelColor,
              } as React.CSSProperties)
            : null),
          ...(hintColor != null
            ? ({ "--df-select-hint": hintColor } as React.CSSProperties)
            : null),
          ...(overlapLabelBackground != null
            ? ({
                "--df-select-overlap-label-bg": overlapLabelBackground,
              } as React.CSSProperties)
            : null),
          ...(overlapInset != null
            ? ({
                "--df-select-overlap-inset": overlapInset,
              } as React.CSSProperties)
            : null),
          ...(overlapLabelPadding != null
            ? ({
                "--df-select-overlap-label-pad": overlapLabelPadding,
              } as React.CSSProperties)
            : null),
          ...(overlapLabelSize != null
            ? ({
                "--df-select-overlap-label-size": overlapLabelSize,
              } as React.CSSProperties)
            : null),
          ...(insetLabelSize != null
            ? ({
                "--df-select-inset-label-size": insetLabelSize,
              } as React.CSSProperties)
            : null),
          ...(insetGap != null
            ? ({ "--df-select-inset-gap": insetGap } as React.CSSProperties)
            : null),
          ...style,
        }}
        {...props}
      >
        {showOutsideLabel ? (
          <SelectFieldLabel
            htmlFor={labelHtmlFor}
            required={required}
            help={help}
            subtext={subtext}
            className={labelClassName}
            insetAlign={labelInsetAlign}
            insetSize={labelInsetSize}
          >
            {label}
          </SelectFieldLabel>
        ) : null}
        {(isOverlap || isInset) && subtext != null ? (
          <p data-df="select-field-aside-subtext">{subtext}</p>
        ) : null}
        {control}
        {hint != null ? (
          <SelectFieldHint id={hintId} className={hintClassName}>
            {hint}
          </SelectFieldHint>
        ) : null}
      </div>
    </SelectInsetLabelContext.Provider>
  )
}

function SelectFieldLabel({
  className,
  children,
  required,
  help,
  htmlFor,
  onClick,
  ...props
}: React.ComponentProps<typeof Label> & {
  help?: React.ReactNode
}) {
  return (
    <div data-df="select-field-label">
      <Label
        htmlFor={htmlFor}
        required={required}
        className={cn(className)}
        {...props}
        onClick={composeEventHandlers(onClick, (event) => {
          focusSelectTriggerFromLabel(event, htmlFor)
        })}
      >
        {children}
      </Label>
      {help != null ? (
        <span data-df="select-field-help">{help}</span>
      ) : null}
    </div>
  )
}

function SelectFieldHelp({
  className,
  label,
  onClick,
  onPointerDown,
  ...props
}: Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  label?: string
}) {
  const s = useDfStrings()
  const resolvedLabel = label ?? s.selectMoreInformation
  return (
    <button
      type="button"
      data-df="select-field-help-button"
      aria-label={resolvedLabel}
      className={cn(className)}
      {...props}
      onClick={(event) => {
        event.stopPropagation()
        onClick?.(event)
      }}
      onPointerDown={(event) => {
        event.stopPropagation()
        onPointerDown?.(event)
      }}
    >
      <CircleHelp aria-hidden />
    </button>
  )
}

function SelectFieldHint({
  className,
  style,
  children,
  id,
  color,
  ...props
}: Omit<React.HTMLAttributes<HTMLParagraphElement>, "color"> & {
  color?: string
}) {
  return (
    <p
      data-df="select-field-hint"
      id={id}
      className={cn(className)}
      style={{
        ...(color != null
          ? ({ "--df-select-hint": color } as React.CSSProperties)
          : null),
        ...style,
      }}
      {...props}
    >
      {children}
    </p>
  )
}

function SelectValue({
  className,
  placeholder,
  children,
  ...props
}: Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> & {
  placeholder?: string
  children?:
    | React.ReactNode
    | ((ctx: SelectValueRenderContext) => React.ReactNode)
}) {
  const {
    value,
    values,
    selectionMode,
    labelFor,
    secondaryFor,
    layoutFor,
    toggleValue,
  } = useOptionListContext()

  const empty =
    selectionMode === "multiple" ? values.length === 0 : value == null
  const selectedSecondary =
    selectionMode === "single" && !empty ? secondaryFor(value) : null
  const stackedValue =
    selectionMode === "single" &&
    !empty &&
    layoutFor(value) === "stacked" &&
    selectedSecondary != null

  const defaultSingleValue = stackedValue ? (
    <span data-df="select-value-stack">
      <span data-df="select-value-title">{labelFor(value)}</span>
      <span data-df="select-value-secondary">{selectedSecondary}</span>
    </span>
  ) : (
    (labelFor(value) ?? placeholder)
  )

  const content =
    typeof children === "function"
      ? children({
          selectionMode,
          value,
          values,
          labelFor,
          secondaryFor,
          layoutFor,
          toggleValue,
        })
      : (children ??
        (selectionMode === "multiple"
          ? empty
            ? placeholder
            : values.map((v) => labelFor(v)).join(", ")
          : defaultSingleValue))

  return (
    <span
      data-df="select-value"
      data-empty={empty ? "" : undefined}
      data-layout={stackedValue ? "stacked" : undefined}
      className={cn(className)}
      {...props}
    >
      {content}
    </span>
  )
}

function SelectValueSummary({
  className,
  count,
  supportingText,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  count: number
  supportingText?: React.ReactNode
}) {
  const s = useDfStrings()
  return (
    <span
      data-df="select-value-summary"
      className={cn(className)}
      {...props}
    >
      <span data-df="select-value-summary-count">
        {s.selectCountSelected(count)}
      </span>
      {supportingText != null && supportingText !== "" ? (
        <span data-df="select-value-summary-support">{supportingText}</span>
      ) : null}
    </span>
  )
}

function SelectValueBadge({
  className,
  value,
  children,
  onRemove,
  ...props
}: Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> & {
  value: string
  children?: React.ReactNode
  onRemove?: (value: string) => void
}) {
  const s = useDfStrings()
  const { labelFor, toggleValue } = useOptionListContext()
  const { disabled } = useSelectExtras()

  const handleRemove = (event: React.MouseEvent | React.PointerEvent) => {
    event.preventDefault()
    event.stopPropagation()
    if (disabled) return
    if (onRemove) {
      onRemove(value)
      return
    }
    toggleValue(value)
  }

  return (
    <span
      data-df="select-value-badge"
      className={cn(className)}
      {...props}
    >
      <span data-df="select-value-badge-label">
        {children ?? labelFor(value)}
      </span>
      <button
        type="button"
        data-df="select-value-badge-remove"
        aria-label={s.selectRemove}
        disabled={disabled}
        onClick={handleRemove}
        onPointerDown={(event) => {
          event.preventDefault()
          event.stopPropagation()
        }}
      >
        <X aria-hidden />
      </button>
    </span>
  )
}

function SelectTrigger({
  className,
  style,
  size = "md",
  variant = "primary",
  children,
  disabled: disabledProp,
  invalid: invalidProp,
  onClick,
  onKeyDown,
  leadingIcon,
  background,
  borderColor,
  hoverBorder,
  hoverBorderColor,
  errorBorderColor,
  padding,
  paddingX,
  paddingY,
  paddingTop,
  paddingRight,
  paddingBottom,
  paddingLeft,
  "aria-invalid": ariaInvalidProp,
  ...props
}: SelectTriggerProps) {
  const {
    open,
    setOpen,
    triggerRef,
    listboxId,
    value,
    values,
    selectionMode,
    layoutFor,
    secondaryFor,
  } = useOptionListContext()
  const {
    disabled: disabledFromSelect,
    invalid: invalidFromSelect,
  } = useSelectExtras()
  const insetLabel = useSelectInsetLabel()
  const disabled = disabledProp ?? disabledFromSelect
  const invalid =
    (invalidProp ?? invalidFromSelect) ||
    ariaInvalidProp === true ||
    ariaInvalidProp === "true"
  const hasInsetLabel = insetLabel.label != null
  const resolvedSize = resolveSelectSize(size)

  const empty =
    selectionMode === "multiple" ? values.length === 0 : value == null
  const valueLayout =
    selectionMode === "single" &&
    !empty &&
    layoutFor(value) === "stacked" &&
    secondaryFor(value) != null
      ? "stacked"
      : undefined

  const hoverBorderAttr = dfHoverBorderAttr(hoverBorder)
  const chromeStyle = {
    ...(background != null ? { "--df-select-bg": background } : null),
    ...(borderColor != null ? { "--df-select-border": borderColor } : null),
    ...dfHoverBorderColorStyle(
      "--df-select-hover-border",
      hoverBorder,
      hoverBorderColor
    ),
    ...(errorBorderColor != null
      ? { "--df-select-error-border": errorBorderColor }
      : null),
    ...dfPaddingChromeStyle(
      "--df-select-padding",
      resolvePaddingSides({
        padding,
        paddingX,
        paddingY,
        paddingTop,
        paddingRight,
        paddingBottom,
        paddingLeft,
      })
    ),
  } as React.CSSProperties

  const toggleOpen = () => {
    if (disabled) return
    setOpen(!open)
  }

  const valueContent = hasInsetLabel ? (
    <span data-df="select-trigger-stack">
      <span data-df="select-inset-label">
        <Label
          htmlFor={insetLabel.htmlFor}
          required={insetLabel.required}
          className={cn(insetLabel.labelClassName)}
          onClick={(event) =>
            focusSelectTriggerFromLabel(event, insetLabel.htmlFor)
          }
        >
          {insetLabel.label}
        </Label>
        {insetLabel.help != null ? (
          <span data-df="select-field-help">{insetLabel.help}</span>
        ) : null}
      </span>
      {children}
    </span>
  ) : (
    children
  )

  return (
    <div
      ref={triggerRef as React.RefObject<HTMLDivElement>}
      data-df="select-trigger"
      data-size={resolvedSize}
      data-variant={variant}
      data-selection-mode={selectionMode}
      data-value-layout={valueLayout}
      data-label-position={hasInsetLabel ? "inset" : undefined}
      data-placeholder={empty ? "" : undefined}
      data-disabled={disabled ? "" : undefined}
      data-invalid={invalid ? "" : undefined}
      data-hover-border={hoverBorderAttr}
      className={cn(className)}
      style={{ ...chromeStyle, ...style }}
      {...props}
      role="combobox"
      tabIndex={disabled ? -1 : 0}
      aria-expanded={open}
      aria-haspopup="listbox"
      aria-controls={open ? listboxId : undefined}
      aria-disabled={disabled || undefined}
      aria-invalid={invalid || undefined}
      onClick={composeEventHandlers(onClick, () => {
        if (disabled) return
        toggleOpen()
      })}
      onKeyDown={composeEventHandlers(onKeyDown, (event) => {
        if (disabled) return
        if (event.target !== event.currentTarget) return

        switch (event.key) {
          case "Enter":
          case " ":
            event.preventDefault()
            toggleOpen()
            break
          case "ArrowDown":
            event.preventDefault()
            if (!open) setOpen(true)
            break
          case "Escape":
            if (open) {
              event.preventDefault()
              setOpen(false)
            }
            break
          default:
            break
        }
      })}
    >
      {leadingIcon != null ? (
        <span data-df="select-trigger-icon" aria-hidden>
          {leadingIcon}
        </span>
      ) : null}
      {valueContent}
      <ChevronDown data-df="select-trigger-chevron" aria-hidden />
    </div>
  )
}

const SelectContent = OptionListContent
const SelectItem = OptionListItem
const SelectGroup = OptionListGroup
const SelectLabel = OptionListLabel
const SelectSeparator = OptionListSeparator
const SelectScrollUpButton = OptionListScrollUpButton
const SelectScrollDownButton = OptionListScrollDownButton

type SelectItemProps = OptionListItemProps

export {
  Select,
  SelectContent,
  SelectField,
  SelectFieldHelp,
  SelectFieldHint,
  SelectFieldLabel,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
  SelectValueBadge,
  SelectValueSummary,
}
export type {
  SelectFieldProps,
  SelectItemProps,
  SelectLabelPosition,
  SelectProps,
  SelectSize,
  SelectTriggerProps,
  SelectVariant,
  SelectValueRenderContext,
}
