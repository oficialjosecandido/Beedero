"use client";

import { useEffect } from "react";

import { useMessaging } from "@/lib/messaging-context";

export function MessageBell() {
  const { toggleInboxFromHeader, unreadTotal, setUnreadTotal } = useMessaging();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/messaging/conversations", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { items: { unread_count: number }[] };
        const total = data.items.reduce((sum, item) => sum + item.unread_count, 0);
        setUnreadTotal(total);
      } catch {
        // ignore polling errors
      }
    }

    void load();
    const timer = window.setInterval(() => void load(), 20_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [setUnreadTotal]);

  return (
    <button
      type="button"
      onClick={toggleInboxFromHeader}
      className="relative rounded-full p-2.5 text-beedero-black/65 hover:bg-beedero-yellow hover:text-beedero-black"
      aria-label={`Messages${unreadTotal > 0 ? `, ${unreadTotal} unread` : ""}`}
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
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
      {unreadTotal > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex size-5 items-center justify-center rounded-full bg-beedero-black text-[10px] font-bold text-beedero-yellow">
          {unreadTotal > 9 ? "9+" : unreadTotal}
        </span>
      )}
    </button>
  );
}
