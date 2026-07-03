import Link from "next/link";

import { logoutAction } from "@/lib/auth-actions";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col bg-white text-zinc-950">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/95 px-4 backdrop-blur sm:px-6">
        <nav className="mx-auto flex max-w-6xl items-center justify-between py-4">
          <Link href="/dashboard" className="text-lg font-semibold tracking-tight">
            Beedero
          </Link>

          <div className="hidden items-center gap-2 md:flex">
            <Link
              href="/feed"
              className="rounded-full px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
            >
              Feed
            </Link>
            <Link
              href="/discovery"
              className="rounded-full px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
            >
              Discovery
            </Link>
            <Link
              href="/dashboard"
              className="rounded-full px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
            >
              Dashboard
            </Link>
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-full px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
              >
                Log out
              </button>
            </form>
          </div>

          <details className="group relative md:hidden">
            <summary className="list-none rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 marker:hidden hover:bg-zinc-50">
              Menu
            </summary>
            <div className="absolute right-0 mt-3 flex w-48 flex-col rounded-2xl border border-zinc-200 bg-white p-2 shadow-lg">
              <Link
                href="/feed"
                className="rounded-xl px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950"
              >
                Feed
              </Link>
              <Link
                href="/discovery"
                className="rounded-xl px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950"
              >
                Discovery
              </Link>
              <Link
                href="/dashboard"
                className="rounded-xl px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950"
              >
                Dashboard
              </Link>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950"
                >
                  Log out
                </button>
              </form>
            </div>
          </details>
        </nav>
      </header>
      <div className="flex flex-1 flex-col">
        <div className="flex flex-1 flex-col bg-zinc-50/70">{children}</div>
      </div>
    </div>
  );
}
