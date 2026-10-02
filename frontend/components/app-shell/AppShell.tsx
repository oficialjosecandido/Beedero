"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  FaBriefcase,
  FaBuilding,
  FaChevronRight,
  FaComment,
  FaHandshake,
  FaHome,
  FaSearch,
  FaUserCircle,
  FaUsers,
} from "react-icons/fa";

import { MessageBell } from "@/components/MessageBell";
import { NetworkBell } from "@/components/NetworkBell";
import { NotificationBell } from "@/components/NotificationBell";
import { ProfileSwitcher } from "@/components/ProfileSwitcher";
import { logoutAction } from "@/lib/auth-actions";

export type ShellOrg = { slug: string; name: string; logo?: string | null };

type Props = {
  children: ReactNode;
  showCofounder?: boolean;
  orgs?: ShellOrg[];
};

const DESKTOP_NAV: {
  label: string;
  shortLabel: string;
  href: string;
  match: (path: string) => boolean;
  Icon: typeof FaHome;
  cofounderOnly?: boolean;
  mobile?: boolean;
}[] = [
  { label: "Home", shortLabel: "Home", href: "/feed", match: (p) => p.startsWith("/feed"), Icon: FaHome, mobile: true },
  { label: "Discover", shortLabel: "Discover", href: "/discovery", match: (p) => p.startsWith("/discovery"), Icon: FaSearch, mobile: true },
  {
    label: "My network",
    shortLabel: "Network",
    href: "/network",
    match: (p) => p.startsWith("/network") || p.startsWith("/connections"),
    Icon: FaUsers,
    mobile: true,
  },
  { label: "Messages", shortLabel: "Messages", href: "/messages", match: (p) => p.startsWith("/messages"), Icon: FaComment, mobile: true },
  { label: "Opportunities", shortLabel: "Jobs", href: "/jobs", match: (p) => p.startsWith("/jobs"), Icon: FaBriefcase },
  {
    label: "Find a co-founder",
    shortLabel: "Co-founder",
    href: "/cofounder",
    match: (p) => p.startsWith("/cofounder"),
    Icon: FaHandshake,
    cofounderOnly: true,
  },
  { label: "My profile", shortLabel: "Profile", href: "/dashboard", match: (p) => p.startsWith("/dashboard"), Icon: FaUserCircle, mobile: true },
];

function navClass(active: boolean) {
  return active
    ? "flex items-center gap-3 bg-beedero-yellow px-3 py-3 text-sm font-extrabold text-beedero-black"
    : "flex items-center gap-3 px-3 py-3 text-sm text-white/65 transition hover:bg-white/5 hover:text-white";
}

export function AppShell({ children, showCofounder = false, orgs = [] }: Props) {
  const pathname = usePathname();
  const items = DESKTOP_NAV.filter((item) => !item.cofounderOnly || showCofounder);

  return (
    <div className="flex min-h-full w-full min-w-0 flex-1 flex-col overflow-x-hidden bg-app-bg text-[#f4f4f1]">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-app-bg/95 px-4 backdrop-blur sm:px-6">
        <div className="mx-auto flex h-[70px] w-full max-w-[1440px] items-center gap-5">
          <Link href="/feed" className="text-lg font-black uppercase tracking-[-0.055em] sm:text-xl">
            beedero<span className="text-beedero-yellow">.</span>
          </Link>

          <label className="hidden max-w-[390px] flex-1 items-center gap-3 border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white/40 md:flex">
            <FaSearch className="shrink-0 text-sm" aria-hidden />
            <input
              className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-white/40"
              placeholder="Search people, organisations, skills…"
              disabled
              aria-label="Search (coming soon)"
            />
          </label>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-1 sm:gap-2 [&_button]:text-white/75 [&_a]:text-white/75">
              <NotificationBell />
              <MessageBell />
              <NetworkBell />
            </div>
            <ProfileSwitcher />
            <form action={logoutAction} className="hidden md:block">
              <button
                type="submit"
                className="grid h-10 w-10 place-items-center border border-white/10 text-white/60 transition hover:border-beedero-yellow hover:text-white"
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
                  aria-hidden
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <path d="M16 17l5-5-5-5" />
                  <path d="M21 12H9" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[1440px] flex-1 gap-6 px-4 py-6 pb-24 sm:px-6 lg:grid-cols-[222px_minmax(0,1fr)] lg:pb-8">
        <aside className="hidden lg:block">
          <div className="sticky top-[94px]">
            <nav className="grid gap-1" aria-label="Primary">
              {items.map(({ label, href, match, Icon }) => {
                const active = match(pathname);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={navClass(active)}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon className="size-[17px] shrink-0" aria-hidden />
                    {label}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-7 border-t border-white/10 pt-5">
              <p className="px-3 text-[10px] font-black uppercase tracking-[0.18em] text-white/35">
                Your organisations
              </p>
              <ul className="mt-3">
                {orgs.slice(0, 4).map((org) => (
                  <li key={org.slug}>
                    <Link
                      href={`/dashboard/${org.slug}`}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-white/5"
                    >
                      {org.logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={org.logo}
                          alt=""
                          className="size-4 shrink-0 rounded-sm object-cover"
                        />
                      ) : (
                        <FaBuilding className="size-4 shrink-0 text-beedero-yellow" aria-hidden />
                      )}
                      <span className="flex-1 truncate text-sm font-bold">{org.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link
                href="/dashboard"
                className="mt-2 flex items-center gap-2 px-3 text-xs font-bold text-beedero-yellow"
              >
                Manage organisations <FaChevronRight className="size-3" aria-hidden />
              </Link>
            </div>
          </div>
        </aside>

        <div className="min-w-0">{children}</div>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-white/10 bg-app-bg/95 px-2 py-2 backdrop-blur lg:hidden"
        aria-label="Mobile"
      >
        {items
          .filter((item) => item.mobile)
          .map(({ shortLabel, href, match, Icon }) => {
            const active = match(pathname);
            return (
              <Link
                key={href}
                href={href}
                className={`grid min-h-12 place-items-center gap-1 px-2 text-[10px] ${
                  active ? "text-beedero-yellow" : "text-white/55"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="size-[18px]" aria-hidden />
                {shortLabel}
              </Link>
            );
          })}
      </nav>
    </div>
  );
}
