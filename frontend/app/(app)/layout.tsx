import Link from "next/link";

import { MessagingShell } from "@/components/MessagingShell";
import { MessageBell } from "@/components/MessageBell";
import { NetworkBell } from "@/components/NetworkBell";
import { NotificationBell } from "@/components/NotificationBell";
import { ProfileSwitcher } from "@/components/ProfileSwitcher";
import { logoutAction } from "@/lib/auth-actions";
import { NetworkProvider } from "@/lib/network-context";
import { NotificationsProvider } from "@/lib/notifications-context";
import { noIndexMetadata } from "@/lib/site-metadata";

export const metadata = noIndexMetadata;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <NotificationsProvider>
    <NetworkProvider>
    <MessagingShell>
      <div className="flex w-full min-w-0 flex-1 flex-col overflow-x-hidden bg-beedero-white text-beedero-black">
        <header className="sticky top-0 z-20 w-full bg-beedero-yellow text-beedero-black">
          <nav className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6">
            <Link href="/feed" className="text-lg font-black uppercase tracking-[-0.04em]">
              Beedero
            </Link>

            <div className="flex items-center gap-2">
              <div className="hidden items-center gap-2 md:flex">
                <NotificationBell />
                <MessageBell />
                <NetworkBell />
                <Link
                  href="/feed"
                  className="rounded-full px-4 py-2 text-sm font-semibold text-beedero-black/80 hover:bg-beedero-black/10 hover:text-beedero-black"
                >
                  Feed
                </Link>
                <Link
                  href="/discovery"
                  className="rounded-full px-4 py-2 text-sm font-semibold text-beedero-black/80 hover:bg-beedero-black/10 hover:text-beedero-black"
                >
                  Discover
                </Link>
                <Link
                  href="/network"
                  className="rounded-full px-4 py-2 text-sm font-semibold text-beedero-black/80 hover:bg-beedero-black/10 hover:text-beedero-black"
                >
                  Network
                </Link>
                <Link
                  href="/dashboard"
                  className="rounded-full px-4 py-2 text-sm font-semibold text-beedero-black/80 hover:bg-beedero-black/10 hover:text-beedero-black"
                >
                  Dashboard
                </Link>
              </div>
              <ProfileSwitcher />
              <form action={logoutAction} className="hidden md:block">
                <button
                  type="submit"
                  className="rounded-full p-2.5 text-beedero-black/80 hover:bg-beedero-black hover:text-beedero-white"
                  aria-label="Log out"
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
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <path d="M16 17l5-5-5-5" />
                    <path d="M21 12H9" />
                  </svg>
                </button>
              </form>

              <details className="group relative md:hidden">
              <summary className="list-none rounded-full border border-beedero-black/20 px-4 py-2 text-sm font-semibold text-beedero-black marker:hidden hover:bg-beedero-black/10">
                Menu
              </summary>
              <div className="absolute right-0 mt-3 flex w-48 flex-col rounded-2xl border-2 border-beedero-border bg-beedero-white p-2 shadow-lg">
                <div className="flex items-center gap-1 px-1 py-1">
                  <NotificationBell />
                  <MessageBell />
                  <NetworkBell />
                </div>
                <Link
                  href="/feed"
                  className="rounded-xl px-3 py-2 text-sm font-semibold text-beedero-black/70 hover:bg-beedero-yellow hover:text-beedero-black"
                >
                  Feed
                </Link>
                <Link
                  href="/discovery"
                  className="rounded-xl px-3 py-2 text-sm font-semibold text-beedero-black/70 hover:bg-beedero-yellow hover:text-beedero-black"
                >
                  Discover
                </Link>
                <Link
                  href="/network"
                  className="rounded-xl px-3 py-2 text-sm font-semibold text-beedero-black/70 hover:bg-beedero-yellow hover:text-beedero-black"
                >
                  Network
                </Link>
                <Link
                  href="/dashboard"
                  className="rounded-xl px-3 py-2 text-sm font-semibold text-beedero-black/70 hover:bg-beedero-yellow hover:text-beedero-black"
                >
                  Dashboard
                </Link>
                <form action={logoutAction}>
                  <button
                    type="submit"
                    className="flex w-full items-center rounded-xl px-3 py-2 text-beedero-black/70 hover:bg-beedero-black hover:text-beedero-white"
                    aria-label="Log out"
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
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <path d="M16 17l5-5-5-5" />
                      <path d="M21 12H9" />
                    </svg>
                  </button>
                </form>
              </div>
              </details>
            </div>
          </nav>
        </header>
        <div className="flex flex-1 flex-col">
          <div className="flex flex-1 flex-col bg-beedero-white pb-14 sm:pb-0">{children}</div>
        </div>
      </div>
    </MessagingShell>
    </NetworkProvider>
    </NotificationsProvider>
  );
}
