"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useNotifications } from "@/lib/notifications-context";

export function NotificationBell() {
  const pathname = usePathname();
  const { unread } = useNotifications();
  const active = pathname.startsWith("/notifications");

  return (
    <Link
      href="/notifications"
      className={`relative rounded-full p-2.5 hover:bg-beedero-black/10 ${
        active ? "bg-beedero-black/10 text-beedero-black" : "text-beedero-black/65 hover:text-beedero-black"
      }`}
      aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ""}`}
      aria-current={active ? "page" : undefined}
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
        <span className="absolute -right-0.5 -top-0.5 flex size-5 items-center justify-center rounded-full bg-beedero-black text-[10px] font-bold text-beedero-yellow">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
