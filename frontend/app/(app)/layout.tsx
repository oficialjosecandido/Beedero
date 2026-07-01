import Link from "next/link";

import { logoutAction } from "@/lib/auth-actions";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <nav className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="font-semibold">
            Beedero
          </Link>
          <Link href="/discovery" className="text-sm text-zinc-600 hover:text-black">
            Discovery
          </Link>
          <Link href="/dashboard" className="text-sm text-zinc-600 hover:text-black">
            Dashboard
          </Link>
        </div>
        <form action={logoutAction}>
          <button type="submit" className="text-sm text-zinc-600 hover:text-black">
            Sair
          </button>
        </form>
      </nav>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
