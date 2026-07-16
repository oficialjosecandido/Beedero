import Link from "next/link";

import { MessagingShell } from "@/components/MessagingShell";
import { MessageBell } from "@/components/MessageBell";
import { NotificationBell } from "@/components/NotificationBell";
import { logoutAction } from "@/lib/auth-actions";
import { noIndexMetadata } from "@/lib/site-metadata";

export const metadata = noIndexMetadata;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <MessagingShell>
      <div className="flex flex-1 flex-col bg-beedero-white text-beedero-black">
        <header className="sticky top-0 z-10 border-b-2 border-beedero-border bg-beedero-white/95 px-4 backdrop-blur sm:px-6">
          <nav className="mx-auto flex max-w-6xl items-center justify-between py-4">
            <Link href="/feed" className="text-lg font-black uppercase tracking-[-0.04em]">
              Beedero
            </Link>

            <div className="hidden items-center gap-2 md:flex">
              <NotificationBell />
              <MessageBell />
              <Link
                href="/feed"
                className="rounded-full px-4 py-2 text-sm font-semibold text-beedero-black/65 hover:bg-beedero-yellow hover:text-beedero-black"
              >
                Feed
              </Link>
              <Link
                href="/discovery"
                className="rounded-full px-4 py-2 text-sm font-semibold text-beedero-black/65 hover:bg-beedero-yellow hover:text-beedero-black"
              >
                Discover
              </Link>
              <Link
                href="/dashboard"
                className="rounded-full px-4 py-2 text-sm font-semibold text-beedero-black/65 hover:bg-beedero-yellow hover:text-beedero-black"
              >
                Dashboard
              </Link>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="rounded-full p-2.5 text-beedero-black/65 hover:bg-beedero-black hover:text-beedero-white"
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

            <details className="group relative md:hidden">
              <summary className="list-none rounded-full border border-beedero-border px-4 py-2 text-sm font-semibold text-beedero-black marker:hidden hover:bg-beedero-yellow">
                Menu
              </summary>
              <div className="absolute right-0 mt-3 flex w-48 flex-col rounded-2xl border-2 border-beedero-border bg-beedero-white p-2 shadow-lg">
                <div className="flex items-center gap-1 px-1 py-1">
                  <NotificationBell />
                  <MessageBell />
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
          </nav>
        </header>
        <div className="flex flex-1 flex-col">
          <div className="flex flex-1 flex-col bg-beedero-white pb-14 sm:pb-0">{children}</div>
        </div>
      </div>
    </MessagingShell>
  );
}
