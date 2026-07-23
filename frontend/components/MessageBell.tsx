"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useMessaging } from "@/lib/messaging-context";

export function MessageBell() {
  const pathname = usePathname();
  const { unreadTotal } = useMessaging();
  const active = pathname.startsWith("/messages");

  return (
    <Link
      href="/messages"
      className={`relative rounded-full p-2.5 hover:bg-beedero-black/10 ${
        active ? "bg-beedero-black/10 text-beedero-black" : "text-beedero-black/65 hover:text-beedero-black"
      }`}
      aria-label={`Messages${unreadTotal > 0 ? `, ${unreadTotal} unread` : ""}`}
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
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
      {unreadTotal > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex size-5 items-center justify-center rounded-full bg-beedero-black text-[10px] font-bold text-beedero-yellow">
          {unreadTotal > 9 ? "9+" : unreadTotal}
        </span>
      )}
    </Link>
  );
}
