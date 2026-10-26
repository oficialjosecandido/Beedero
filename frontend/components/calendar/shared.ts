"use client";

import { useMemo } from "react";

/** Types and date arithmetic shared by the two calendar renderers — the
 * compact month grid in EventsCalendar and the full-page FullCalendar, which
 * lives in its own chunk. Keeping this module small is the point: it is the
 * only code both of them pay for. */

export type CalendarEvent = {
  id: number | string;
  title: string;
  occurred_at: string;
  ends_at?: string | null;
  body?: string;
  role?: "created" | "attending";
  host?: { type: "org" | "person"; name: string; slug?: string; id?: number };
};

export type EventRoleFilter = "all" | "created" | "attending";

export type RoleCounts = { created: number; attending: number };

export const LOCALE = "en-GB";
export const MONTH_FORMATTER = new Intl.DateTimeFormat(LOCALE, {
  month: "long",
  year: "numeric",
});

export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function startOfWeek(date: Date): Date {
  const day = startOfDay(date);
  const weekday = (day.getDay() + 6) % 7;
  day.setDate(day.getDate() - weekday);
  return day;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function useEventsByDay(events: CalendarEvent[]) {
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
