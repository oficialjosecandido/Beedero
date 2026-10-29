"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  Building2,
  CreditCard,
  Flag,
  Gauge,
  Mail,
  Newspaper,
  ScrollText,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

import type { NexusMe } from "@/lib/nexus";

const NAV: { href: string; label: string; Icon: LucideIcon; capability: string; exact?: boolean }[] = [
  { href: "/beedero-nexus", label: "Home", Icon: Gauge, capability: "home", exact: true },
  { href: "/beedero-nexus/users", label: "Users", Icon: UsersRound, capability: "users" },
  { href: "/beedero-nexus/orgs", label: "Organisations", Icon: Building2, capability: "orgs" },
  { href: "/beedero-nexus/posts", label: "Posts", Icon: Newspaper, capability: "posts" },
  { href: "/beedero-nexus/reports", label: "Reports", Icon: Flag, capability: "reports" },
  { href: "/beedero-nexus/newsletter", label: "Newsletter", Icon: Mail, capability: "newsletter" },
  { href: "/beedero-nexus/billing", label: "Billing", Icon: CreditCard, capability: "billing" },
  { href: "/beedero-nexus/audit", label: "Audit log", Icon: ScrollText, capability: "audit" },
];

export function NexusShell({ me, children }: { me: NexusMe; children: ReactNode }) {
  const pathname = usePathname();
  const items = NAV.filter((item) => me.capabilities.includes(item.capability));

  return (
    <div className="min-h-screen bg-app-bg text-white lg:grid lg:grid-cols-[232px_minmax(0,1fr)]">
      <aside className="border-b border-app-border bg-[#0c0e13] lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-3 px-4 py-4 lg:block lg:px-5 lg:py-6">
          <Link href="/beedero-nexus" className="block">
            <span className="text-lg font-black uppercase tracking-[-0.06em]">
              beedero<span className="text-beedero-yellow">.</span>
            </span>
            <span className="block text-[10px] font-black uppercase tracking-[0.28em] text-beedero-yellow">Nexus</span>
          </Link>
          <Link href="/feed" className="text-[11px] font-bold text-white/45 hover:text-white lg:hidden">
            Back to Beedero
          </Link>
        </div>
        <nav
          aria-label="Nexus"
          className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible lg:px-3 lg:pb-0"
        >
          {items.map(({ href, label, Icon, exact }) => {
            const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex shrink-0 items-center gap-2.5 px-3 py-2 text-sm font-bold transition ${
                  active ? "bg-beedero-yellow text-beedero-black" : "text-white/60 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon size={16} strokeWidth={1.9} aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="hidden px-5 lg:absolute lg:bottom-0 lg:block lg:w-full lg:border-t lg:border-app-border lg:py-4">
          <p className="truncate text-xs font-bold text-white">{me.name}</p>
          <p className="mt-0.5 text-[10px] font-black uppercase tracking-[0.16em] text-beedero-yellow">{me.role}</p>
          <Link href="/feed" className="mt-3 block text-[11px] font-bold text-white/45 hover:text-white">
            ← Back to Beedero
          </Link>
        </div>
      </aside>
      <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
    </div>
  );
}
