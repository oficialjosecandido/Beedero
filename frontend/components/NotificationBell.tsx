"use client";

import Link from "next/link";
import { useState } from "react";

import { type NotificationItem, useNotifications } from "@/lib/notifications-context";

function notificationHref(item: NotificationItem): string {
  const base = item.link || "/feed";
  const suggestionTitle = item.payload?.suggestion_title;
  const suggestionBody = item.payload?.suggestion_body;
  if (!suggestionTitle && !suggestionBody) return base;
  const params = new URLSearchParams();
  if (suggestionTitle) params.set("suggested_title", suggestionTitle);
  if (suggestionBody) params.set("suggested_body", suggestionBody);
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}${params.toString()}`;
}

export function NotificationBell() {
  const { unread, items, prefs, refresh, markAllRead, loadPreferences, updatePreference } =
    useNotifications();
  const [open, setOpen] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value);
          if (!open) {
            void refresh();
            if (!prefs) void loadPreferences();
          }
        }}
        className="relative rounded-full p-2.5 text-beedero-black/65 hover:bg-beedero-yellow hover:text-beedero-black"
        aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ""}`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-5"
          aria-hidden="true"
        >
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex size-5 items-center justify-center rounded-full bg-beedero-yellow text-[10px] font-bold text-beedero-black">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-80 rounded-2xl border-2 border-beedero-border bg-beedero-white p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-bold text-beedero-black">Notifications</p>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="text-xs font-semibold text-beedero-black/60 hover:text-beedero-black"
                >
                  Mark all read
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowPrefs((value) => !value)}
                className="text-xs font-semibold text-beedero-black/60 hover:text-beedero-black"
                aria-label="Notification preferences"
              >
                Preferences
              </button>
            </div>
          </div>
          {showPrefs && (
            <div className="mb-2 flex flex-col gap-1.5 rounded-xl bg-beedero-yellow/10 p-2.5 text-xs text-beedero-black">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={prefs?.inapp_engagement ?? true}
                  onChange={(e) => updatePreference("inapp_engagement", e.target.checked)}
                />
                In-app engagement notifications
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={prefs?.digest_email ?? true}
                  onChange={(e) => updatePreference("digest_email", e.target.checked)}
                />
                Weekly digest email
              </label>
            </div>
          )}
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 && (
              <p className="px-2 py-4 text-sm text-zinc-500">No notifications yet.</p>
            )}
            {items.map((item) => (
              <Link
                key={item.id}
                href={notificationHref(item)}
                onClick={() => setOpen(false)}
                className={`block rounded-xl px-3 py-2 text-sm hover:bg-beedero-yellow/20 ${
                  item.read ? "text-zinc-600" : "font-semibold text-beedero-black"
                }`}
              >
                <p>{item.title}</p>
                <p className="mt-0.5 text-xs text-zinc-500">{item.body}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
