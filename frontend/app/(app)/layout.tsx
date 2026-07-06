import Link from "next/link";

import { logoutAction } from "@/lib/auth-actions";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col bg-beedero-white text-beedero-black">
      <header className="sticky top-0 z-10 border-b border-beedero-black/10 bg-beedero-white/95 px-4 backdrop-blur sm:px-6">
        <nav className="mx-auto flex max-w-6xl items-center justify-between py-4">
          <Link href="/dashboard" className="text-lg font-black uppercase tracking-[-0.04em]">
            Beedero
          </Link>

          <div className="hidden items-center gap-2 md:flex">
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
              Discovery
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
                className="rounded-full px-4 py-2 text-sm font-semibold text-beedero-black/65 hover:bg-beedero-black hover:text-beedero-white"
              >
                Log out
              </button>
            </form>
          </div>

          <details className="group relative md:hidden">
            <summary className="list-none rounded-full border border-beedero-black/20 px-4 py-2 text-sm font-semibold text-beedero-black marker:hidden hover:bg-beedero-yellow">
              Menu
            </summary>
            <div className="absolute right-0 mt-3 flex w-48 flex-col rounded-2xl border border-beedero-black/10 bg-beedero-white p-2 shadow-lg">
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
                Discovery
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
                  className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-beedero-black/70 hover:bg-beedero-black hover:text-beedero-white"
                >
                  Log out
                </button>
              </form>
            </div>
          </details>
        </nav>
      </header>
      <div className="flex flex-1 flex-col">
        <div className="flex flex-1 flex-col bg-beedero-white">{children}</div>
      </div>
    </div>
  );
}
