"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";

import {
  MONTH_FORMATTER,
  addDays,
  addMonths,
  dateKey,
  isSameDay,
  startOfMonth,
  startOfWeek,
  useEventsByDay,
  type CalendarEvent,
  type EventRoleFilter,
  type RoleCounts,
} from "@/components/calendar/shared";
import { formatDateTime } from "@/lib/format";

export type { CalendarEvent, EventRoleFilter } from "@/components/calendar/shared";

// The sidebar calendar (ProfileColumn) is on screen from the first paint of
// every app page, while the full month/week/day calendar only ever appears on
// the organisation workspace's Calendar tab. They used to be one module, so
// the feed paid for both — this way each page loads only its own renderer.
const FullCalendar = dynamic(() => import("@/components/calendar/FullCalendar"));

const WEEKDAY_SHORT = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

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
