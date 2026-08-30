"use client"

import * as React from "react"
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react"

import { useControllableState } from "../hooks"
import {
  buildMonthGrid,
  rotateWeekdayLabels,
  weekStartsOnForLocale,
} from "../lib/df-calendar-grid"
import {
  applyBoundedRangeClick,
  classifyDay,
  draftFromValue,
  formatUtcMonthLabel,
  isDayDisabled,
  moveCalendarFocus,
  resolveNearestEnabledDay,
  shiftUtcMonth,
  startOfUtcMonthIso,
  todayIsoDay,
  type DateRangeValue,
  type DayBounds,
  type RangeDraft,
} from "../lib/df-date-picker"
import {
  dfDatePickerWeekdays,
  useDfStrings,
  type DfStrings,
} from "../lib/df-intl"
import { cn } from "../lib/utils"
import { Input } from "./df-input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./df-popover"

type SharedPickerProps = {
  min?: string | null
  max?: string | null
  disabledDates?: (dayIso: string) => boolean
  placeholder?: string
  /** BCP 47 locale for month title and first day of week. */
  locale?: string
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  disabled?: boolean
  id?: string
  className?: string
  "aria-label"?: string
}

type DatePickerProps = SharedPickerProps & {
  value?: string | null
  defaultValue?: string | null
  onChange?: (value: string | null) => void
}

type DateRangePickerProps = SharedPickerProps & {
  value?: DateRangeValue | null
  defaultValue?: DateRangeValue | null
  onChange?: (value: DateRangeValue | null) => void
}

type CalendarPanelProps = {
  mode: "single" | "range"
  visibleMonth: string
  onVisibleMonthChange: (monthIso: string) => void
  focusIso: string
  onFocusIsoChange: (iso: string) => void
  value?: string | null | undefined
  draft?: RangeDraft | undefined
  hoverIso: string | null
  onHoverIsoChange: (iso: string | null) => void
  onSelectDay: (iso: string) => void
  min?: string | null | undefined
  max?: string | null | undefined
  disabledDates?: ((dayIso: string) => boolean) | undefined
  onRequestClose: () => void
  labelledBy?: string | undefined
  locale: string
  weekStartsOn: number
  weekdayLabels: readonly string[]
  strings: DfStrings
}

/** Format a closed range trigger value with catalogue word order. */
function formatRangeDisplay(
  value: DateRangeValue | null | undefined,
  strings: DfStrings
): string {
  if (value == null) return ""
  if (value.start === value.end) return value.start
  return strings.dateRangeDisplay({ start: value.start, end: value.end })
}

function CalendarPanel({
  mode,
  visibleMonth,
  onVisibleMonthChange,
  focusIso,
  onFocusIsoChange,
  value,
  draft,
  hoverIso,
  onHoverIsoChange,
  onSelectDay,
  min,
  max,
  disabledDates,
  onRequestClose,
  labelledBy,
  locale,
  weekStartsOn,
  weekdayLabels,
  strings,
}: CalendarPanelProps) {
  const gridId = React.useId()
  const today = todayIsoDay()
  const bounds = React.useMemo<DayBounds>(
    () => ({ min, max, disabledDates }),
    [disabledDates, max, min]
  )
  const cells = React.useMemo(
    () => buildMonthGrid(visibleMonth, weekStartsOn),
    [visibleMonth, weekStartsOn]
  )
  const monthLabel = formatUtcMonthLabel(visibleMonth, locale)

  React.useEffect(() => {
    const active = document.getElementById(`${gridId}-${focusIso}`)
    if (active == null || active.hasAttribute("disabled")) return
    active.focus()
  }, [focusIso, gridId, visibleMonth])

  function goMonth(delta: number) {
    onVisibleMonthChange(
      startOfUtcMonthIso(shiftUtcMonth(visibleMonth, delta))
    )
    const move = moveCalendarFocus(
      focusIso,
      delta < 0 ? "PageUp" : "PageDown",
      visibleMonth,
      weekStartsOn,
      bounds
    )
    if (move != null) onFocusIsoChange(move.focusIso)
  }

  function handleToday() {
    onVisibleMonthChange(startOfUtcMonthIso(today))
    const enabledToday = !isDayDisabled(today, bounds)
    if (enabledToday) {
      onFocusIsoChange(today)
      onSelectDay(today)
      return
    }
    onFocusIsoChange(
      resolveNearestEnabledDay(today, 1, bounds, {
        fallbackIso: resolveNearestEnabledDay(today, -1, bounds, {
          fallbackIso: focusIso,
        }),
      })
    )
  }

  function handleGridKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault()
      onRequestClose()
      return
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      if (!isDayDisabled(focusIso, bounds)) {
        onSelectDay(focusIso)
      }
      return
    }
    const move = moveCalendarFocus(
      focusIso,
      event.key,
      visibleMonth,
      weekStartsOn,
      bounds
    )
    if (move == null) return
    event.preventDefault()
    if (move.monthChanged) {
      onVisibleMonthChange(move.monthIso)
    }
    onFocusIsoChange(move.focusIso)
  }

  return (
    <div data-df="date-picker-panel">
      <div data-df="date-picker-header">
        <button
          type="button"
          data-df="date-picker-nav"
          aria-label={strings.datePickerPreviousMonth}
          onClick={() => goMonth(-1)}
        >
          <ChevronLeft aria-hidden />
        </button>
        <div data-df="date-picker-title" id={labelledBy}>
          {monthLabel}
        </div>
        <button
          type="button"
          data-df="date-picker-nav"
          aria-label={strings.datePickerNextMonth}
          onClick={() => goMonth(1)}
        >
          <ChevronRight aria-hidden />
        </button>
        <button
          type="button"
          data-df="date-picker-today"
          onClick={handleToday}
        >
          {strings.datePickerToday}
        </button>
      </div>

      <div
        role="grid"
        data-df="date-picker-grid"
        aria-labelledby={labelledBy}
        onKeyDown={handleGridKeyDown}
      >
        <div role="row" data-df="date-picker-weekdays">
          {weekdayLabels.map((label, index) => (
            <div
              key={`${label}-${index}`}
              role="columnheader"
              data-df="date-picker-weekday"
            >
              {label}
            </div>
          ))}
        </div>
        {Array.from({ length: 6 }, (_, week) => (
          <div key={week} role="row" data-df="date-picker-week">
            {cells.slice(week * 7, week * 7 + 7).map((cell) => {
              const state = classifyDay({
                iso: cell.date,
                inMonth: cell.inMonth,
                mode,
                value,
                draft,
                hover: hoverIso,
                min,
                max,
                disabledDates,
                today,
              })
              const isFocused = focusIso === cell.date
              return (
                <button
                  key={cell.date}
                  id={`${gridId}-${cell.date}`}
                  type="button"
                  role="gridcell"
                  data-df="date-picker-day"
                  data-outside={state.inMonth ? undefined : ""}
                  data-today={state.isToday ? "" : undefined}
                  data-selected={state.isSelected ? "" : undefined}
                  data-range-start={state.isRangeStart ? "" : undefined}
                  data-range-end={state.isRangeEnd ? "" : undefined}
                  data-in-range={state.isInRange ? "" : undefined}
                  data-preview={state.isPreview ? "" : undefined}
                  data-disabled={state.isDisabled ? "" : undefined}
                  aria-selected={state.isSelected || undefined}
                  aria-current={state.isToday ? "date" : undefined}
                  aria-disabled={state.isDisabled || undefined}
                  tabIndex={isFocused && !state.isDisabled ? 0 : -1}
                  disabled={state.isDisabled}
                  onMouseEnter={() => onHoverIsoChange(cell.date)}
                  onMouseLeave={() => onHoverIsoChange(null)}
                  onFocus={() => {
                    if (state.isDisabled) return
                    onFocusIsoChange(cell.date)
                  }}
                  onClick={() => {
                    if (state.isDisabled) return
                    onSelectDay(cell.date)
                  }}
                >
                  {Number.parseInt(cell.date.slice(8), 10)}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

function DatePicker({
  value: valueProp,
  defaultValue = null,
  onChange,
  min,
  max,
  disabledDates,
  placeholder,
  locale = "en-US",
  open,
  defaultOpen = false,
  onOpenChange,
  disabled,
  id,
  className,
  "aria-label": ariaLabel,
}: DatePickerProps) {
  const s = useDfStrings()
  const weekStartsOn = weekStartsOnForLocale(locale)
  const weekdayLabels = rotateWeekdayLabels(
    dfDatePickerWeekdays(s),
    weekStartsOn
  )
  const titleId = React.useId()
  const [isOpen, setOpen] = useControllableState({
    value: open,
    defaultValue: defaultOpen,
    onChange: onOpenChange,
  })
  const [value, setValue] = useControllableState<string | null>({
    value: valueProp,
    defaultValue,
    onChange,
  })
  const [visibleMonth, setVisibleMonth] = React.useState(() =>
    startOfUtcMonthIso(value ?? todayIsoDay())
  )
  const [focusIso, setFocusIso] = React.useState(
    () => value ?? todayIsoDay()
  )
  const [hoverIso, setHoverIso] = React.useState<string | null>(null)
  const [panelActive, setPanelActive] = React.useState(false)
  const bounds = React.useMemo<DayBounds>(
    () => ({ min, max, disabledDates }),
    [disabledDates, max, min]
  )

  if (isOpen && !panelActive) {
    setPanelActive(true)
    const seed = value ?? todayIsoDay()
    const focus = resolveNearestEnabledDay(seed, 1, bounds, {
      fallbackIso: resolveNearestEnabledDay(seed, -1, bounds, {
        fallbackIso: seed,
      }),
    })
    setVisibleMonth(startOfUtcMonthIso(focus))
    setFocusIso(focus)
    setHoverIso(null)
  } else if (!isOpen && panelActive) {
    setPanelActive(false)
  }

  function selectDay(iso: string) {
    if (isDayDisabled(iso, bounds)) return
    setValue(iso)
    setOpen(false)
  }

  return (
    <Popover open={isOpen} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Input
            id={id}
            readOnly
            disabled={disabled}
            value={value ?? ""}
            placeholder={placeholder ?? s.datePickerPlaceholder}
            trailingIcon={<CalendarIcon aria-hidden />}
            role="combobox"
            aria-haspopup="grid"
            aria-label={ariaLabel ?? s.datePickerAriaLabel}
            className={cn(className)}
          />
        }
      />
      <PopoverContent
        align="start"
        sideOffset={8}
        size="sm"
        className="df-date-picker-content"
      >
        <CalendarPanel
          mode="single"
          visibleMonth={visibleMonth}
          onVisibleMonthChange={setVisibleMonth}
          focusIso={focusIso}
          onFocusIsoChange={setFocusIso}
          value={value}
          hoverIso={hoverIso}
          onHoverIsoChange={setHoverIso}
          onSelectDay={selectDay}
          min={min}
          max={max}
          disabledDates={disabledDates}
          onRequestClose={() => setOpen(false)}
          labelledBy={titleId}
          locale={locale}
          weekStartsOn={weekStartsOn}
          weekdayLabels={weekdayLabels}
          strings={s}
        />
      </PopoverContent>
    </Popover>
  )
}

function DateRangePicker({
  value: valueProp,
  defaultValue = null,
  onChange,
  min,
  max,
  disabledDates,
  placeholder,
  locale = "en-US",
  open,
  defaultOpen = false,
  onOpenChange,
  disabled,
  id,
  className,
  "aria-label": ariaLabel,
}: DateRangePickerProps) {
  const s = useDfStrings()
  const weekStartsOn = weekStartsOnForLocale(locale)
  const weekdayLabels = rotateWeekdayLabels(
    dfDatePickerWeekdays(s),
    weekStartsOn
  )
  const titleId = React.useId()
  const [isOpen, setOpen] = useControllableState({
    value: open,
    defaultValue: defaultOpen,
    onChange: onOpenChange,
  })
  const [value, setValue] = useControllableState<DateRangeValue | null>({
    value: valueProp,
    defaultValue,
    onChange,
  })
  const [draft, setDraft] = React.useState<RangeDraft>(() =>
    draftFromValue(value)
  )
  const [visibleMonth, setVisibleMonth] = React.useState(() =>
    startOfUtcMonthIso(value?.start ?? todayIsoDay())
  )
  const [focusIso, setFocusIso] = React.useState(
    () => value?.start ?? todayIsoDay()
  )
  const [hoverIso, setHoverIso] = React.useState<string | null>(null)
  const [panelActive, setPanelActive] = React.useState(false)
  const bounds = React.useMemo<DayBounds>(
    () => ({ min, max, disabledDates }),
    [disabledDates, max, min]
  )

  if (isOpen && !panelActive) {
    setPanelActive(true)
    const seed = value?.start ?? todayIsoDay()
    const focus = resolveNearestEnabledDay(seed, 1, bounds, {
      fallbackIso: resolveNearestEnabledDay(seed, -1, bounds, {
        fallbackIso: seed,
      }),
    })
    setDraft(draftFromValue(value))
    setVisibleMonth(startOfUtcMonthIso(focus))
    setFocusIso(focus)
    setHoverIso(null)
  } else if (!isOpen && panelActive) {
    setPanelActive(false)
  }

  function selectDay(iso: string) {
    const next = applyBoundedRangeClick(draft, iso, bounds)
    if (next === draft) return
    setDraft(next)
    if (next.start != null && next.end != null) {
      setValue({ start: next.start, end: next.end })
      setOpen(false)
    }
  }

  return (
    <Popover open={isOpen} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Input
            id={id}
            readOnly
            disabled={disabled}
            value={formatRangeDisplay(value, s)}
            placeholder={placeholder ?? s.dateRangePickerPlaceholder}
            trailingIcon={<CalendarIcon aria-hidden />}
            role="combobox"
            aria-haspopup="grid"
            aria-label={ariaLabel ?? s.dateRangePickerAriaLabel}
            className={cn(className)}
          />
        }
      />
      <PopoverContent
        align="start"
        sideOffset={8}
        size="sm"
        className="df-date-picker-content"
      >
        <CalendarPanel
          mode="range"
          visibleMonth={visibleMonth}
          onVisibleMonthChange={setVisibleMonth}
          focusIso={focusIso}
          onFocusIsoChange={setFocusIso}
          draft={draft}
          hoverIso={hoverIso}
          onHoverIsoChange={setHoverIso}
          onSelectDay={selectDay}
          min={min}
          max={max}
          disabledDates={disabledDates}
          onRequestClose={() => setOpen(false)}
          labelledBy={titleId}
          locale={locale}
          weekStartsOn={weekStartsOn}
          weekdayLabels={weekdayLabels}
          strings={s}
        />
      </PopoverContent>
    </Popover>
  )
}

export { DatePicker, DateRangePicker }
export type { DatePickerProps, DateRangePickerProps, DateRangeValue }
