"use client";

import { useMemo, type ComponentProps } from "react";

import {
  DATE_INPUT_MIN,
  DATE_YEAR_MIN,
  DATETIME_LOCAL_MIN,
  todayDateInputValue,
  todayDateTimeLocalValue,
} from "@/lib/date-bounds";

type BaseProps = Omit<ComponentProps<"input">, "type" | "min" | "max"> & {
  /** When false, only the 1950 floor applies (e.g. scheduling future events). */
  maxToday?: boolean;
};

type DateProps = BaseProps & { type?: "date" };
type DateTimeProps = BaseProps & { type: "datetime-local" };

export type DateInputProps = DateProps | DateTimeProps;

function applyRangeMessage(input: HTMLInputElement, maxToday: boolean) {
  if (input.validity.rangeUnderflow || input.validity.rangeOverflow) {
    input.setCustomValidity(
      maxToday
        ? `Choose a date between ${DATE_YEAR_MIN} and today.`
        : `Choose a date on or after 1 January ${DATE_YEAR_MIN}.`
    );
  } else {
    input.setCustomValidity("");
  }
}

/**
 * `<input type="date|datetime-local">` with platform-wide min/max.
 * Min is always 1950-01-01; max defaults to today.
 */
export function DateInput({
  type = "date",
  maxToday = true,
  onInvalid,
  onInput,
  ...props
}: DateInputProps) {
  const bounds = useMemo(() => {
    if (type === "datetime-local") {
      return {
        min: DATETIME_LOCAL_MIN,
        max: maxToday ? todayDateTimeLocalValue() : undefined,
      };
    }
    return {
      min: DATE_INPUT_MIN,
      max: maxToday ? todayDateInputValue() : undefined,
    };
  }, [type, maxToday]);

  return (
    <input
      {...props}
      type={type}
      min={bounds.min}
      max={bounds.max}
      onInvalid={(event) => {
        applyRangeMessage(event.currentTarget, maxToday);
        onInvalid?.(event);
      }}
      onInput={(event) => {
        event.currentTarget.setCustomValidity("");
        onInput?.(event);
      }}
    />
  );
}
