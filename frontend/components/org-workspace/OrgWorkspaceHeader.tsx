"use client";

import Link from "next/link";
import { Bell, MessageCircle } from "lucide-react";

import { useMessaging } from "@/lib/messaging-context";
import { useNotifications } from "@/lib/notifications-context";

import { personInitials } from "./ui";

/** The workspace's own count pill — ink on yellow, the light-context twin of
 *  the one in `AppShell`. */
function CountPill({ count }: { count: number }) {
  return (
    <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-beedero-yellow px-1 text-[9px] font-black text-org-ink ring-1 ring-org-ink">
      {count > 9 ? "9+" : count}
    </span>
  );
}

const iconButtonClass =
  "relative grid size-9 place-items-center border border-black/15 text-black/65 transition hover:border-org-ink hover:bg-org-chip hover:text-org-ink";

/**
 * Figma organisation-workspace header: the wordmark, the workspace label, and
 * shortcuts back into the personal app. It replaces `AppShell`'s dark header
 * for `/(org)` routes.
 */
export function OrgWorkspaceHeader({ personName }: { personName: string }) {
  const { unreadTotal } = useMessaging();
  const { unread } = useNotifications();

  return (
    <header className="sticky top-0 z-30 border-b border-black/30 bg-org-ground/95 backdrop-blur">
      <div className="mx-auto flex h-[70px] max-w-[1500px] items-center gap-4 px-4 sm:px-6">
        <Link href="/feed" className="text-xl font-black uppercase tracking-[-0.055em]">
          beedero<span className="text-org-ink">.</span>
        </Link>
        <span className="hidden h-5 w-px bg-black/15 sm:block" aria-hidden />
        <span className="hidden text-[10px] font-black uppercase tracking-[0.18em] text-black/45 sm:block">
          Organisation workspace
        </span>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/messages"
            className={iconButtonClass}
            aria-label={unreadTotal > 0 ? `Open messages, ${unreadTotal} unread` : "Open messages"}
          >
            <MessageCircle size={17} strokeWidth={1.8} aria-hidden />
            {unreadTotal > 0 && <CountPill count={unreadTotal} />}
          </Link>
          <Link
            href="/notifications"
            className={iconButtonClass}
            aria-label={unread > 0 ? `Open notifications, ${unread} unread` : "Open notifications"}
          >
            <Bell size={17} strokeWidth={1.8} aria-hidden />
            {unread > 0 && <CountPill count={unread} />}
          </Link>
          <Link
            href="/dashboard"
            className="ml-1 grid size-9 place-items-center rounded-full bg-org-ink text-[10px] font-black text-white"
            aria-label="Open personal profile"
          >
            {personInitials(personName)}
          </Link>
        </div>
      </div>
    </header>
  );
}
