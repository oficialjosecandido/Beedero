"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useNetwork } from "@/lib/network-context";

export function NetworkBell() {
  const pathname = usePathname();
  const { counts } = useNetwork();
  const active = pathname.startsWith("/network") || pathname.startsWith("/connections");

  return (
    <Link
      href="/network"
      className={`relative rounded-full p-2.5 hover:bg-beedero-black/10 ${
        active ? "bg-beedero-black/10 text-beedero-black" : "text-beedero-black/65 hover:text-beedero-black"
      }`}
      aria-label={`Network${counts.pending > 0 ? `, ${counts.pending} pending requests` : ""}`}
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
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <path d="M8.6 10.6l6.8-3.2" />
        <path d="M8.6 13.4l6.8 3.2" />
      </svg>
      {counts.pending > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex size-5 items-center justify-center rounded-full bg-beedero-black text-[10px] font-bold text-beedero-yellow">
          {counts.pending > 9 ? "9+" : counts.pending}
        </span>
      )}
    </Link>
  );
}
