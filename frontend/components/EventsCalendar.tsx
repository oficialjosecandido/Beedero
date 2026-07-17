"use client";

import { useMemo, useState, type ReactNode } from "react";

import { formatDate, formatDateTime } from "@/lib/format";

export type CalendarEvent = {
  id: number | string;
  title: string;
  occurred_at: string;
  ends_at?: string | null;
  body?: string;
};

type ViewMode = "month" | "week" | "day";

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

function EventChip({ event, compact = false }: { event: CalendarEvent; compact?: boolean }) {
  return (
    <div
      className={`rounded-lg border border-beedero-black/10 bg-beedero-black px-2 py-1 text-beedero-yellow shadow-sm ${
        compact ? "text-[10px] leading-tight" : "text-xs"
      }`}
    >
      <p className="truncate font-bold">{event.title}</p>
      {!compact && (
        <p className="mt-0.5 text-[10px] font-medium text-beedero-yellow/80">
          {formatTime(event.occurred_at)}
          {event.ends_at ? ` – ${formatTime(event.ends_at)}` : ""}
        </p>
      )}
    </div>
  );
}

function EventCard({ event }: { event: CalendarEvent }) {
  return (
    <article className="rounded-2xl border-2 border-beedero-border border-l-4 border-l-beedero-black bg-gradient-to-br from-beedero-yellow/25 to-beedero-white p-5 shadow-sm">
      <p className="font-extrabold text-beedero-black">{event.title}</p>
      <p className="mt-1 text-sm font-medium text-beedero-black/70">
        {formatDateTime(event.occurred_at)}
        {event.ends_at ? ` – ${formatDateTime(event.ends_at)}` : ""}
      </p>
      {event.body && <p className="mt-3 text-sm leading-6 text-zinc-700">{event.body}</p>}
    </article>
  );
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

function EmbeddedMonthCalendar({
  events,
  today,
}: {
  events: CalendarEvent[];
  today: Date;
}) {
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(today));
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const eventsByDay = useEventsByDay(events);

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

  const selectedEvents = selectedKey ? eventsByDay.get(selectedKey) ?? [] : [];

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

      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
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
          const isSelected = key === selectedKey;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedKey((cur) => (cur === key ? null : key))}
              className={`flex flex-col items-center gap-0.5 rounded-lg py-1 text-xs ${
                isSelected
                  ? "bg-beedero-black font-bold text-beedero-yellow"
                  : isToday
                    ? "bg-beedero-yellow/30 font-bold text-beedero-black"
                    : hasEvents
                      ? "font-semibold text-beedero-black hover:bg-beedero-yellow/20"
                      : "text-zinc-400 hover:bg-zinc-50"
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

      {selectedEvents.length > 0 && (
        <div className="mt-4 flex flex-col gap-2 border-t border-beedero-border pt-3">
          {selectedEvents.map((event) => (
            <div key={event.id}>
              <p className="text-sm font-semibold text-beedero-black">{event.title}</p>
              <p className="text-xs text-zinc-500">
                {formatDateTime(event.occurred_at)}
                {event.ends_at ? ` – ${formatDateTime(event.ends_at)}` : ""}
              </p>
            </div>
          ))}
        </div>
      )}

      {events.length === 0 && (
        <p className="mt-4 text-xs text-zinc-400">No events yet. Post an event from Activity.</p>
      )}
    </>
  );
}

function FullCalendar({ events, today }: { events: CalendarEvent[]; today: Date }) {
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
                Post an event from the Activity tab to see it here.
              </p>
            </div>
          ) : (
            dayEvents.map((event) => <EventCard key={event.id} event={event} />)
          )}
        </div>
      )}

      {events.length === 0 && viewMode === "month" && (
        <div className="border-t-2 border-beedero-border bg-beedero-yellow/15 px-5 py-4 text-sm font-medium text-beedero-black/70">
          No events yet. Share an event from the Activity tab and it will appear on this calendar.
        </div>
      )}
    </div>
  );
}

export function EventsCalendar({
  events,
  embedded = false,
  full = false,
}: {
  events: CalendarEvent[];
  embedded?: boolean;
  full?: boolean;
}) {
  const today = useMemo(() => new Date(), []);

  if (full) {
    return <FullCalendar events={events} today={today} />;
  }

  const calendar = <EmbeddedMonthCalendar events={events} today={today} />;

  if (embedded) return calendar;

  return (
    <div className="rounded-3xl border-2 border-beedero-border bg-beedero-white p-5 shadow-sm">
      {calendar}
    </div>
  );
}
