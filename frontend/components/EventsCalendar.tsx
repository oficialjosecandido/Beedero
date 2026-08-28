"use client";

import { useMemo, useState, type ReactNode } from "react";

import { formatDateTime } from "@/lib/format";

export type CalendarEvent = {
  id: number | string;
  title: string;
  occurred_at: string;
  ends_at?: string | null;
  body?: string;
  role?: "created" | "attending";
  host?: { type: "org" | "person"; name: string; slug?: string; id?: number };
};

type ViewMode = "month" | "week" | "day";
export type EventRoleFilter = "all" | "created" | "attending";

type RoleCounts = { created: number; attending: number };

const LOCALE = "en-GB";
const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKDAY_SHORT = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTH_FORMATTER = new Intl.DateTimeFormat(LOCALE, { month: "long", year: "numeric" });
const DAY_HEADER_FORMATTER = new Intl.DateTimeFormat(LOCALE, {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const WEEK_RANGE_FORMATTER = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short" });

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfWeek(date: Date): Date {
  const day = startOfDay(date);
  const weekday = (day.getDay() + 6) % 7;
  day.setDate(day.getDate() - weekday);
  return day;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function eventOverlapsDay(event: CalendarEvent, day: Date): boolean {
  const start = new Date(event.occurred_at);
  const end = event.ends_at ? new Date(event.ends_at) : start;
  const dayStart = startOfDay(day);
  const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999);
  return start <= dayEnd && end >= dayStart;
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit" });
}

function eventsForDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
  return events
    .filter((event) => eventOverlapsDay(event, day))
    .sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime());
}

function eventOverlapsRange(event: CalendarEvent, rangeStart: Date, rangeEnd: Date): boolean {
  const start = new Date(event.occurred_at);
  const end = event.ends_at ? new Date(event.ends_at) : start;
  return start <= rangeEnd && end >= rangeStart;
}

function eventsInRange(events: CalendarEvent[], rangeStart: Date, rangeEnd: Date): CalendarEvent[] {
  return events
    .filter((event) => eventOverlapsRange(event, rangeStart, rangeEnd))
    .sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime());
}

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function useEventsByDay(events: CalendarEvent[]) {
  return useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const start = startOfDay(new Date(event.occurred_at));
      const end = event.ends_at ? startOfDay(new Date(event.ends_at)) : start;
      for (let cursor = new Date(start); cursor <= end; cursor = addDays(cursor, 1)) {
        const key = dateKey(cursor);
        const bucket = map.get(key) ?? [];
        bucket.push(event);
        map.set(key, bucket);
      }
    }
    for (const bucket of map.values()) {
      bucket.sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime());
    }
    return map;
  }, [events]);
}

function eventRoleStyles(role: CalendarEvent["role"], compact = false) {
  if (role === "attending") {
    return compact
      ? "border-2 border-success-strong bg-success-surface text-emerald-950"
      : "border-2 border-success-strong bg-success-surface text-emerald-950";
  }
  return compact
    ? "border border-beedero-black/10 bg-beedero-black text-beedero-yellow"
    : "border-2 border-beedero-black bg-beedero-black text-beedero-yellow";
}

function EventChip({ event, compact = false }: { event: CalendarEvent; compact?: boolean }) {
  return (
    <div
      className={`rounded-lg px-2 py-1 shadow-sm ${eventRoleStyles(event.role, compact)} ${
        compact ? "text-[10px] leading-tight" : "text-xs"
      }`}
    >
      <p className="truncate font-bold">{event.title}</p>
      {!compact && event.role === "attending" && event.host && (
        <p className="mt-0.5 truncate text-[10px] font-medium opacity-80">by {event.host.name}</p>
      )}
      {!compact && (
        <p
          className={`mt-0.5 text-[10px] font-medium ${
            event.role === "attending" ? "text-emerald-800/80" : "text-beedero-yellow/80"
          }`}
        >
          {formatTime(event.occurred_at)}
          {event.ends_at ? ` – ${formatTime(event.ends_at)}` : ""}
        </p>
      )}
    </div>
  );
}

function EventCard({ event }: { event: CalendarEvent }) {
  const isAttending = event.role === "attending";
  return (
    <article
      className={`rounded-2xl border-2 p-5 shadow-sm ${
        isAttending
          ? "border-success-strong border-l-4 border-l-emerald-600 bg-gradient-to-br from-emerald-50 to-beedero-white"
          : "border-beedero-border border-l-4 border-l-beedero-black bg-gradient-to-br from-beedero-yellow/25 to-beedero-white"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
            isAttending ? "bg-emerald-700 text-white" : "bg-beedero-black text-beedero-yellow"
          }`}
        >
          {isAttending ? "Participating" : "Organized by you"}
        </span>
        {isAttending && event.host && (
          <span className="text-xs font-medium text-emerald-900/70">by {event.host.name}</span>
        )}
      </div>
      <p className="mt-2 font-extrabold text-beedero-black">{event.title}</p>
      <p className="mt-1 text-sm font-medium text-beedero-black/70">
        {formatDateTime(event.occurred_at)}
        {event.ends_at ? ` – ${formatDateTime(event.ends_at)}` : ""}
      </p>
      {event.body && <p className="mt-3 text-sm leading-6 text-zinc-700">{event.body}</p>}
    </article>
  );
}

function EventRoleFilterBar({
  value,
  onChange,
  counts,
}: {
  value: EventRoleFilter;
  onChange: (value: EventRoleFilter) => void;
  counts: RoleCounts;
}) {
  const total = counts.created + counts.attending;
  const options: {
    id: EventRoleFilter;
    label: string;
    count: number;
    activeClass: string;
    idleClass: string;
    dotClass: string;
  }[] = [
    {
      id: "all",
      label: "All",
      count: total,
      activeClass: "bg-beedero-black text-beedero-yellow shadow-sm",
      idleClass: "text-beedero-black/70 hover:bg-beedero-white",
      dotClass: "bg-gradient-to-r from-beedero-black to-emerald-600",
    },
    {
      id: "created",
      label: "Organized by you",
      count: counts.created,
      activeClass: "bg-beedero-black text-beedero-yellow shadow-sm",
      idleClass: "text-beedero-black/70 hover:bg-beedero-white",
      dotClass: "bg-beedero-black",
    },
    {
      id: "attending",
      label: "Participating",
      count: counts.attending,
      activeClass: "bg-emerald-700 text-white shadow-sm",
      idleClass: "text-emerald-900/80 hover:bg-success-surface",
      dotClass: "border-2 border-success-strong bg-success-surface",
    },
  ];

  return (
    <div
      className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      role="group"
      aria-label="Filter events by role"
    >
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-beedero-black/45">Show</p>
      <div className="flex flex-col gap-1 rounded-2xl border-2 border-beedero-border bg-beedero-yellow/10 p-1 sm:inline-flex sm:flex-row">
        {options.map((option) => {
          const active = value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(option.id)}
              className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold transition-colors sm:justify-center sm:px-4 ${
                active ? option.activeClass : option.idleClass
              }`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className={`size-2.5 shrink-0 rounded-full ${option.dotClass}`} />
                <span className="truncate">{option.label}</span>
              </span>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-extrabold tabular-nums ${
                  active
                    ? option.id === "attending"
                      ? "bg-white/20 text-white"
                      : "bg-beedero-yellow/25 text-inherit"
                    : "bg-beedero-black/5 text-beedero-black/55"
                }`}
              >
                {option.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function emptyCalendarMessage(roleFilter: EventRoleFilter | undefined): string {
  if (roleFilter === "created") {
    return "No events organized by you yet. Use “Create event” to publish one on this calendar.";
  }
  if (roleFilter === "attending") {
    return "No participating events yet. Accept events from your feed and they will appear here in green.";
  }
  return "No events yet. Create one above, or accept events from your feed to see them here.";
}

function ViewModeToggle({
  viewMode,
  onChange,
}: {
  viewMode: ViewMode;
  onChange: (mode: ViewMode) => void;
}) {
  const modes: { id: ViewMode; label: string }[] = [
    { id: "month", label: "Month" },
    { id: "week", label: "Week" },
    { id: "day", label: "Day" },
  ];

  return (
    <div className="flex rounded-xl border-2 border-beedero-border bg-beedero-white p-1 shadow-sm">
      {modes.map((mode) => (
        <button
          key={mode.id}
          type="button"
          onClick={() => onChange(mode.id)}
          className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors sm:px-4 sm:text-sm ${
            viewMode === mode.id
              ? "bg-beedero-black text-beedero-yellow shadow-sm"
              : "text-beedero-black/70 hover:bg-beedero-yellow hover:text-beedero-black"
          }`}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}

function NavButton({
  onClick,
  children,
  label,
  primary = false,
}: {
  onClick: () => void;
  children: ReactNode;
  label?: string;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`rounded-xl px-3 py-1.5 text-sm font-bold transition-colors ${
        primary
          ? "bg-beedero-yellow text-beedero-black hover:bg-beedero-black hover:text-beedero-yellow"
          : "border-2 border-beedero-border text-beedero-black hover:border-beedero-black hover:bg-beedero-black hover:text-beedero-yellow"
      }`}
    >
      {children}
    </button>
  );
}

type QuickView = { type: "day"; key: string } | { type: "week" } | { type: "month" };

function QuickViewBar({
  quickView,
  todayKey,
  onToday,
  onWeek,
  onMonth,
}: {
  quickView: QuickView | null;
  todayKey: string;
  onToday: () => void;
  onWeek: () => void;
  onMonth: () => void;
}) {
  const options: { id: string; label: string; active: boolean; onClick: () => void }[] = [
    { id: "today", label: "Today", active: quickView?.type === "day" && quickView.key === todayKey, onClick: onToday },
    { id: "week", label: "This week", active: quickView?.type === "week", onClick: onWeek },
    { id: "month", label: "This month", active: quickView?.type === "month", onClick: onMonth },
  ];

  return (
    <div className="mt-3 flex gap-1 rounded-lg bg-zinc-100 p-1">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={option.onClick}
          className={`flex-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${
            option.active
              ? "bg-beedero-black text-beedero-yellow"
              : "text-zinc-500 hover:bg-beedero-yellow/20 hover:text-beedero-black"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function EmbeddedMonthCalendar({
  events,
  today,
}: {
  events: CalendarEvent[];
  today: Date;
}) {
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(today));
  const [quickView, setQuickView] = useState<QuickView | null>(null);
  const eventsByDay = useEventsByDay(events);
  const todayKey = dateKey(today);

  const gridDays = useMemo(() => {
    const first = startOfMonth(monthCursor);
    const firstWeekday = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0).getDate();
    const days: (Date | null)[] = Array(firstWeekday).fill(null);
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(monthCursor.getFullYear(), monthCursor.getMonth(), day));
    }
    return days;
  }, [monthCursor]);

  function selectDay(key: string) {
    setQuickView((cur) => (cur?.type === "day" && cur.key === key ? null : { type: "day", key }));
  }

  function goToday() {
    setMonthCursor(startOfMonth(today));
    setQuickView({ type: "day", key: todayKey });
  }

  function goThisWeek() {
    setMonthCursor(startOfMonth(today));
    setQuickView((cur) => (cur?.type === "week" ? null : { type: "week" }));
  }

  function goThisMonth() {
    setMonthCursor(startOfMonth(today));
    setQuickView((cur) => (cur?.type === "month" ? null : { type: "month" }));
  }

  const listedEvents = useMemo(() => {
    if (!quickView) return [];
    if (quickView.type === "day") return eventsByDay.get(quickView.key) ?? [];
    if (quickView.type === "week") {
      const weekStart = startOfWeek(today);
      return eventsInRange(events, weekStart, endOfDay(addDays(weekStart, 6)));
    }
    const monthStart = startOfMonth(monthCursor);
    const monthEnd = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0);
    return eventsInRange(events, monthStart, endOfDay(monthEnd));
  }, [quickView, eventsByDay, events, monthCursor, today]);

  const listedEmptyMessage =
    quickView?.type === "week"
      ? "No events this week."
      : quickView?.type === "month"
        ? "No events this month."
        : "No events on this day.";

  return (
    <>
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => setMonthCursor((cur) => addMonths(cur, -1))}
          className="rounded-lg px-2 py-1 text-sm font-bold text-zinc-500 hover:bg-beedero-yellow/20 hover:text-beedero-black"
        >
          ‹
        </button>
        <p className="text-sm font-bold text-beedero-black">{MONTH_FORMATTER.format(monthCursor)}</p>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => setMonthCursor((cur) => addMonths(cur, 1))}
          className="rounded-lg px-2 py-1 text-sm font-bold text-zinc-500 hover:bg-beedero-yellow/20 hover:text-beedero-black"
        >
          ›
        </button>
      </div>

      <QuickViewBar
        quickView={quickView}
        todayKey={todayKey}
        onToday={goToday}
        onWeek={goThisWeek}
        onMonth={goThisMonth}
      />

      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wide text-subtle">
        {WEEKDAY_SHORT.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {gridDays.map((day, index) => {
          if (!day) return <span key={`empty-${index}`} />;
          const key = dateKey(day);
          const dayEvents = eventsByDay.get(key) ?? [];
          const hasEvents = dayEvents.length > 0;
          const isToday = isSameDay(day, today);
          const isSelected = quickView?.type === "day" && quickView.key === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => selectDay(key)}
              className={`flex flex-col items-center gap-0.5 rounded-lg py-1 text-xs ${
                isSelected
                  ? "bg-beedero-black font-bold text-beedero-yellow"
                  : isToday
                    ? "bg-beedero-yellow/30 font-bold text-beedero-black"
                    : hasEvents
                      ? "font-semibold text-beedero-black hover:bg-beedero-yellow/20"
                      : "text-subtle hover:bg-zinc-50"
              }`}
            >
              {day.getDate()}
              {hasEvents && (
                <span
                  className={`size-1 rounded-full ${isSelected ? "bg-beedero-yellow" : "bg-beedero-black"}`}
                />
              )}
            </button>
          );
        })}
      </div>

      {quickView && (
        <div className="mt-4 flex flex-col gap-2 border-t border-beedero-border pt-3">
          {listedEvents.length === 0 && <p className="text-xs text-subtle">{listedEmptyMessage}</p>}
          {listedEvents.map((event) => (
            <div key={event.id}>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-beedero-black">{event.title}</p>
                {event.role === "attending" && (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                    Participating
                  </span>
                )}
              </div>
              {event.host && event.role === "attending" && (
                <p className="text-xs text-emerald-800/70">by {event.host.name}</p>
              )}
              <p className="text-xs text-zinc-500">
                {formatDateTime(event.occurred_at)}
                {event.ends_at ? ` – ${formatDateTime(event.ends_at)}` : ""}
              </p>
            </div>
          ))}
        </div>
      )}

      {events.length === 0 && (
        <p className="mt-4 text-xs text-subtle">No events yet. Create one from the calendar tab.</p>
      )}
    </>
  );
}

function FullCalendar({
  events,
  today,
  roleFilter,
  onRoleFilterChange,
  roleCounts,
}: {
  events: CalendarEvent[];
  today: Date;
  roleFilter?: EventRoleFilter;
  onRoleFilterChange?: (value: EventRoleFilter) => void;
  roleCounts?: RoleCounts;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [cursor, setCursor] = useState(() => startOfDay(today));
  const eventsByDay = useEventsByDay(events);

  function goBack() {
    if (viewMode === "month") setCursor((cur) => addMonths(cur, -1));
    else if (viewMode === "week") setCursor((cur) => addDays(cur, -7));
    else setCursor((cur) => addDays(cur, -1));
  }

  function goForward() {
    if (viewMode === "month") setCursor((cur) => addMonths(cur, 1));
    else if (viewMode === "week") setCursor((cur) => addDays(cur, 7));
    else setCursor((cur) => addDays(cur, 1));
  }

  function goToday() {
    setCursor(startOfDay(today));
  }

  const headerLabel = useMemo(() => {
    if (viewMode === "month") return MONTH_FORMATTER.format(cursor);
    if (viewMode === "day") return DAY_HEADER_FORMATTER.format(cursor);
    const weekStart = startOfWeek(cursor);
    const weekEnd = addDays(weekStart, 6);
    return `${WEEK_RANGE_FORMATTER.format(weekStart)} – ${WEEK_RANGE_FORMATTER.format(weekEnd)}, ${weekStart.getFullYear()}`;
  }, [cursor, viewMode]);

  const monthWeeks = useMemo(() => {
    const first = startOfMonth(cursor);
    const gridStart = startOfWeek(first);
    const weeks: Date[][] = [];
    let day = gridStart;
    for (let week = 0; week < 6; week++) {
      const row: Date[] = [];
      for (let i = 0; i < 7; i++) {
        row.push(new Date(day));
        day = addDays(day, 1);
      }
      weeks.push(row);
    }
    return weeks;
  }, [cursor]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(cursor);
    return Array.from({ length: 7 }, (_, index) => addDays(start, index));
  }, [cursor]);

  const dayEvents = useMemo(() => eventsForDay(events, cursor), [events, cursor]);

  return (
    <div className="flex min-h-[calc(100vh-14rem)] flex-col overflow-hidden rounded-3xl border-2 border-beedero-border bg-beedero-white shadow-sm">
      <div className="flex flex-col gap-3 border-b-2 border-beedero-border bg-gradient-to-r from-beedero-yellow/35 via-beedero-yellow/15 to-beedero-white p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <NavButton onClick={goBack} label="Previous">
            ‹
          </NavButton>
          <NavButton onClick={goToday} primary>
            Today
          </NavButton>
          <NavButton onClick={goForward} label="Next">
            ›
          </NavButton>
          <h2 className="text-base font-extrabold text-beedero-black sm:text-lg">{headerLabel}</h2>
        </div>
        <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
      </div>
      <div className="border-b border-beedero-border bg-beedero-white px-4 py-3 sm:px-5">
        {roleCounts && onRoleFilterChange && roleFilter ? (
          <EventRoleFilterBar
            value={roleFilter}
            onChange={onRoleFilterChange}
            counts={roleCounts}
          />
        ) : (
          <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-beedero-black/70">
            <span className="flex items-center gap-2">
              <span className="size-3 rounded bg-beedero-black" />
              Organized by you
            </span>
            <span className="flex items-center gap-2">
              <span className="size-3 rounded border-2 border-success-strong bg-success-surface" />
              You&apos;re participating
            </span>
          </div>
        )}
      </div>

      {viewMode === "month" && (
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="grid grid-cols-7 border-b-2 border-beedero-border bg-beedero-black">
            {WEEKDAY_LABELS.map((label) => (
              <div
                key={label}
                className="border-r border-beedero-yellow/20 px-2 py-2.5 text-center text-xs font-extrabold uppercase tracking-wide text-beedero-yellow last:border-r-0"
              >
                {label}
              </div>
            ))}
          </div>
          <div className="grid flex-1 auto-rows-fr grid-cols-7 bg-beedero-yellow/5">
            {monthWeeks.flat().map((day) => {
              const key = dateKey(day);
              const dayEventsList = eventsByDay.get(key) ?? [];
              const inCurrentMonth = day.getMonth() === cursor.getMonth();
              const isToday = isSameDay(day, today);
              return (
                <div
                  key={key}
                  className={`min-h-[7rem] border-b border-r border-beedero-border p-1.5 transition-colors sm:min-h-[8.5rem] sm:p-2 ${
                    inCurrentMonth ? "bg-beedero-white" : "bg-beedero-yellow/10"
                  } ${isToday ? "bg-beedero-yellow/20" : ""}`}
                >
                  <p
                    className={`mb-1 flex size-7 items-center justify-center rounded-full text-xs font-extrabold sm:text-sm ${
                      isToday
                        ? "bg-beedero-black text-beedero-yellow shadow-sm"
                        : inCurrentMonth
                          ? "text-beedero-black"
                          : "text-beedero-black/35"
                    }`}
                  >
                    {day.getDate()}
                  </p>
                  <div className="flex flex-col gap-1">
                    {dayEventsList.slice(0, 3).map((event) => (
                      <EventChip key={`${key}-${event.id}`} event={event} compact />
                    ))}
                    {dayEventsList.length > 3 && (
                      <p className="px-1 text-[10px] font-extrabold text-beedero-black">
                        +{dayEventsList.length - 3} more
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {viewMode === "week" && (
        <div className="grid flex-1 grid-cols-1 divide-y-2 divide-beedero-border sm:grid-cols-7 sm:divide-x-2 sm:divide-y-0">
          {weekDays.map((day) => {
            const dayEventsList = eventsForDay(events, day);
            const isToday = isSameDay(day, today);
            return (
              <div
                key={dateKey(day)}
                className={`flex min-h-[12rem] flex-col sm:min-h-[calc(100vh-18rem)] ${
                  isToday ? "bg-beedero-yellow/10" : "bg-beedero-white"
                }`}
              >
                <div
                  className={`border-b-2 border-beedero-border px-3 py-3 text-center ${
                    isToday ? "bg-beedero-black text-beedero-yellow" : "bg-beedero-yellow/25"
                  }`}
                >
                  <p
                    className={`text-xs font-extrabold uppercase tracking-wide ${
                      isToday ? "text-beedero-yellow/80" : "text-beedero-black/60"
                    }`}
                  >
                    {WEEKDAY_LABELS[(day.getDay() + 6) % 7]}
                  </p>
                  <p className="mt-1 text-lg font-extrabold">{day.getDate()}</p>
                </div>
                <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2">
                  {dayEventsList.length === 0 && (
                    <p className="px-1 py-4 text-center text-xs font-medium text-beedero-black/40">
                      No events
                    </p>
                  )}
                  {dayEventsList.map((event) => (
                    <EventChip key={event.id} event={event} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {viewMode === "day" && (
        <div className="flex flex-1 flex-col gap-4 bg-gradient-to-b from-beedero-yellow/10 to-beedero-white p-4 sm:p-6">
          {dayEvents.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-beedero-border bg-beedero-yellow/15 p-8 text-center">
              <p className="text-sm font-extrabold text-beedero-black">No events on this day</p>
              <p className="mt-1 text-sm text-beedero-black/60">
                Create an event above or accept an invitation from your feed.
              </p>
            </div>
          ) : (
            dayEvents.map((event) => <EventCard key={event.id} event={event} />)
          )}
        </div>
      )}

      {events.length === 0 && viewMode === "month" && (
        <div className="border-t-2 border-beedero-border bg-beedero-yellow/15 px-5 py-4 text-sm font-medium text-beedero-black/70">
          {emptyCalendarMessage(roleFilter)}
        </div>
      )}
    </div>
  );
}

export function EventsCalendar({
  events,
  embedded = false,
  full = false,
  roleFilter,
  onRoleFilterChange,
  roleCounts,
}: {
  events: CalendarEvent[];
  embedded?: boolean;
  full?: boolean;
  roleFilter?: EventRoleFilter;
  onRoleFilterChange?: (value: EventRoleFilter) => void;
  roleCounts?: RoleCounts;
}) {
  const today = useMemo(() => new Date(), []);

  if (full) {
    return (
      <FullCalendar
        events={events}
        today={today}
        roleFilter={roleFilter}
        onRoleFilterChange={onRoleFilterChange}
        roleCounts={roleCounts}
      />
    );
  }

  const calendar = <EmbeddedMonthCalendar events={events} today={today} />;

  if (embedded) return calendar;

  return (
    <div className="rounded-3xl border-2 border-beedero-border bg-beedero-white p-5 shadow-sm">
      {calendar}
    </div>
  );
}
