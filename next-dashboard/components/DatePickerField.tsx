'use client';

import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { CSSProperties, KeyboardEvent, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';

type DatePickerFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

const weekdays = [
  { short: '一', long: '星期一' },
  { short: '二', long: '星期二' },
  { short: '三', long: '星期三' },
  { short: '四', long: '星期四' },
  { short: '五', long: '星期五' },
  { short: '六', long: '星期六' },
  { short: '日', long: '星期日' }
];

export default function DatePickerField({ label, value, onChange, placeholder = '选择日期' }: DatePickerFieldProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const labelId = useId();
  const dialogId = useId();
  const monthId = useId();
  const selectedDate = useMemo(() => parseDate(value), [value]);
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(selectedDate ?? new Date()));
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties>({ visibility: 'hidden' });

  useEffect(() => {
    if (selectedDate) setViewMonth(startOfMonth(selectedDate));
  }, [selectedDate]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const updatePosition = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const viewportPadding = 8;
    const gap = 8;
    const width = Math.min(320, window.innerWidth - viewportPadding * 2);
    const measuredHeight = popoverRef.current?.offsetHeight ?? 356;
    const maxHeight = Math.max(220, window.innerHeight - viewportPadding * 2);
    const height = Math.min(measuredHeight, maxHeight);
    const left = clamp(rect.right - width, viewportPadding, window.innerWidth - width - viewportPadding);
    const fitsBelow = rect.bottom + gap + height <= window.innerHeight - viewportPadding;
    const top = fitsBelow
      ? rect.bottom + gap
      : clamp(rect.top - gap - height, viewportPadding, window.innerHeight - height - viewportPadding);

    setPopoverStyle({
      left,
      top,
      width,
      maxHeight,
      visibility: 'visible'
    });
  };

  useLayoutEffect(() => {
    if (!open) return;

    updatePosition();
    const frame = window.requestAnimationFrame(() => {
      updatePosition();
      const preferredDate = selectedDate && isSameMonth(selectedDate, viewMonth) ? selectedDate : new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
      popoverRef.current?.querySelector<HTMLButtonElement>(`[data-date="${formatDate(preferredDate)}"]`)?.focus();
    });
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
    // Positioning should rerun whenever the visible calendar month changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, viewMonth]);

  const days = useMemo(() => getCalendarDays(viewMonth), [viewMonth]);
  const todayKey = formatDate(new Date());
  const selectedKey = selectedDate ? formatDate(selectedDate) : '';

  const closeAndFocusTrigger = () => {
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const chooseDate = (date: Date) => {
    onChange(formatDate(date));
    closeAndFocusTrigger();
  };

  const moveMonth = (amount: number) => {
    setViewMonth((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1));
  };

  const handleDayKeyDown = (event: KeyboardEvent<HTMLButtonElement>, date: Date) => {
    const offsets: Partial<Record<string, number>> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7
    };
    const offset = offsets[event.key];
    if (!offset) return;

    event.preventDefault();
    const target = new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset);
    if (!isSameMonth(target, viewMonth)) setViewMonth(startOfMonth(target));
    window.requestAnimationFrame(() => {
      popoverRef.current?.querySelector<HTMLButtonElement>(`[data-date="${formatDate(target)}"]`)?.focus();
    });
  };

  return (
    <div ref={rootRef} className="relative grid min-w-0 gap-2">
      <span id={labelId} className="text-sm font-semibold text-muted">
        {label}
      </span>
      <button
        ref={triggerRef}
        type="button"
        aria-labelledby={labelId}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
        onClick={() => {
          if (!open) setViewMonth(startOfMonth(selectedDate ?? new Date()));
          setOpen((current) => !current);
        }}
        className="theme-input flex h-11 w-full min-w-0 items-center justify-between gap-3 rounded-lg border border-[#DDE4E0] bg-[#F7F9F8] px-3 text-left text-sm font-semibold text-ink outline-none transition hover:border-[var(--border-strong)] focus:ring-4 focus:ring-[var(--primary-ring)]"
      >
        <span className={`min-w-0 flex-1 truncate ${value ? 'text-ink' : 'text-muted opacity-70'}`}>{value || placeholder}</span>
        <CalendarDays aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" />
      </button>

      {open ? (
        <div
          ref={popoverRef}
          id={dialogId}
          role="dialog"
          aria-modal="false"
          aria-labelledby={monthId}
          style={popoverStyle}
          className="theme-popover fixed z-[80] overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-ink shadow-[var(--lift-shadow)]"
        >
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              aria-label="上一个月"
              onClick={() => moveMonth(-1)}
              className="theme-icon-button grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-muted outline-none transition hover:text-primary focus:ring-4 focus:ring-[var(--primary-ring)]"
            >
              <ChevronLeft aria-hidden="true" className="h-4 w-4" />
            </button>
            <div id={monthId} aria-live="polite" className="min-w-0 text-center text-sm font-bold text-ink">
              {viewMonth.getFullYear()} 年 {viewMonth.getMonth() + 1} 月
            </div>
            <button
              type="button"
              aria-label="下一个月"
              onClick={() => moveMonth(1)}
              className="theme-icon-button grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-muted outline-none transition hover:text-primary focus:ring-4 focus:ring-[var(--primary-ring)]"
            >
              <ChevronRight aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>

          <div role="grid" aria-labelledby={monthId} className="mt-3 grid grid-cols-7 gap-1">
            {weekdays.map((weekday) => (
              <div key={weekday.long} role="columnheader" aria-label={weekday.long} className="grid h-7 place-items-center text-[11px] font-semibold text-muted">
                {weekday.short}
              </div>
            ))}
            {days.map((date) => {
              const dateKey = formatDate(date);
              const selected = dateKey === selectedKey;
              const today = dateKey === todayKey;
              const outsideMonth = !isSameMonth(date, viewMonth);
              const accessibleLabel = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日${today ? '，今天' : ''}${selected ? '，已选中' : ''}`;

              return (
                <button
                  key={dateKey}
                  type="button"
                  role="gridcell"
                  data-date={dateKey}
                  aria-label={accessibleLabel}
                  aria-selected={selected}
                  aria-current={today ? 'date' : undefined}
                  tabIndex={selected || (!selectedKey && date.getDate() === 1 && !outsideMonth) ? 0 : -1}
                  onClick={() => chooseDate(date)}
                  onKeyDown={(event) => handleDayKeyDown(event, date)}
                  className={`grid aspect-square min-h-8 min-w-0 place-items-center rounded-lg border text-xs font-semibold outline-none transition focus:ring-2 focus:ring-[var(--primary-ring)] ${
                    selected
                      ? 'theme-active-tab border-[var(--primary)] bg-[var(--primary-soft)] text-primary'
                      : today
                        ? 'border-[var(--primary)] bg-[var(--surface)] text-primary hover:bg-[var(--surface-hover)]'
                        : `border-transparent bg-transparent text-ink hover:bg-[var(--surface-hover)] ${outsideMonth ? 'opacity-40' : ''}`
                  }`}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 border-t border-[var(--border)] pt-3">
            <button
              type="button"
              disabled={!value}
              onClick={() => {
                onChange('');
                closeAndFocusTrigger();
              }}
              className="theme-button h-9 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-semibold text-muted outline-none transition hover:text-ink focus:ring-4 focus:ring-[var(--primary-ring)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              清除
            </button>
            <button type="button" onClick={() => chooseDate(new Date())} className="theme-primary-action h-9 rounded-lg px-3 text-xs font-semibold outline-none transition focus:ring-4 focus:ring-[var(--primary-ring)]">
              回到今天
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function parseDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function isSameMonth(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();
}

function getCalendarDays(month: Date) {
  const firstDay = startOfMonth(month);
  const mondayOffset = (firstDay.getDay() + 6) % 7;
  const gridStart = new Date(firstDay.getFullYear(), firstDay.getMonth(), 1 - mondayOffset);

  return Array.from({ length: 42 }, (_, index) => new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index));
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}
