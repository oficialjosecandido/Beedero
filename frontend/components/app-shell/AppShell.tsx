"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useState, type ReactNode } from "react";
import {
  Bell,
  BellDot,
  BriefcaseBusiness,
  Building2,
  ChevronRight,
  CircleUserRound,
  Home,
  MessageCircle,
  Search,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";

import { ProfileSwitcher } from "@/components/ProfileSwitcher";
import { CreateOrgButton } from "@/components/CreateOrgButton";
import { useMessaging } from "@/lib/messaging-context";
import { useNotifications } from "@/lib/notifications-context";

import { RightSidebarProvider } from "./RightSidebar";

export type ShellOrg = { slug: string; name: string; logo?: string | null };

type Props = {
  children: ReactNode;
  showCofounder?: boolean;
  orgs?: ShellOrg[];
};

type NavItem = {
  label: string;
  shortLabel: string;
  href: string;
  match: (path: string) => boolean;
  Icon: LucideIcon;
  mobile?: boolean;
  badgeKey?: "notifications" | "messages";
};

const DESKTOP_NAV: NavItem[] = [
  { label: "Home", shortLabel: "Home", href: "/feed", match: (p) => p.startsWith("/feed"), Icon: Home, mobile: true },
  { label: "Discover", shortLabel: "Discover", href: "/discovery", match: (p) => p.startsWith("/discovery"), Icon: Search, mobile: true },
  {
    label: "My network",
    shortLabel: "Network",
    href: "/network",
    match: (p) => p.startsWith("/network") || p.startsWith("/connections"),
    Icon: UsersRound,
  },
  {
    label: "Notifications",
    shortLabel: "Alerts",
    href: "/notifications",
    match: (p) => p.startsWith("/notifications"),
    Icon: BellDot,
    mobile: true,
    badgeKey: "notifications",
  },
  {
    label: "Messages",
    shortLabel: "Messages",
    href: "/messages",
    match: (p) => p.startsWith("/messages"),
    Icon: MessageCircle,
    mobile: true,
    badgeKey: "messages",
  },
  { label: "Opportunities", shortLabel: "Jobs", href: "/jobs", match: (p) => p.startsWith("/jobs"), Icon: BriefcaseBusiness },
  // Investor pipeline — hidden until the feature is ready to ship.
  {
    label: "My profile",
    shortLabel: "Profile",
    href: "/profile",
    match: (p) => p.startsWith("/profile"),
    Icon: CircleUserRound,
    mobile: true,
  },
];

function navClass(active: boolean) {
  return active
    ? "flex min-h-[46px] items-center gap-3 bg-beedero-yellow px-3 py-3 text-sm font-extrabold text-beedero-black"
    : "flex min-h-[46px] items-center gap-3 px-3 py-3 text-sm text-white/65 transition hover:bg-white/5 hover:text-white";
}

/** The design's header count pill — sits on the icon's top-right corner. */
function CountPill({ count }: { count: number }) {
  return (
    <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-beedero-yellow px-1 text-[9px] font-black text-beedero-black">
      {count > 9 ? "9+" : count}
    </span>
  );
}

/** Messages get a header shortcut of their own, next to the bell. */
function HeaderMessagesLink() {
  const { unreadTotal } = useMessaging();

  return (
    <Link
      href="/messages"
      className="relative grid size-10 place-items-center border border-white/10 text-white/75 transition hover:border-beedero-yellow"
      aria-label={
        unreadTotal > 0 ? `Open messages, ${unreadTotal} unread` : "Open messages"
      }
    >
      <MessageCircle size={18} strokeWidth={1.8} aria-hidden />
      {unreadTotal > 0 && <CountPill count={unreadTotal} />}
    </Link>
  );
}

function HeaderNotificationButton() {
  const [open, setOpen] = useState(false);
  const { unread, items } = useNotifications();

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative grid size-10 place-items-center border border-white/10 text-white/75 transition hover:border-beedero-yellow"
        aria-label={unread > 0 ? `Open notifications, ${unread} unread` : "Open notifications"}
        aria-expanded={open}
      >
        <Bell size={18} strokeWidth={1.8} aria-hidden />
        {unread > 0 && <CountPill count={unread} />}
      </button>
      {open && (
        <section className="fixed right-4 top-[78px] z-40 w-[330px] border border-white/15 bg-[#171a20] p-4 shadow-2xl">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black">Notifications</h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-white/50 hover:text-white"
              aria-label="Close notifications"
            >
              <X size={18} aria-hidden />
            </button>
          </div>
          {(items.length > 0 ? items.slice(0, 3) : []).map((note) => (
            <div key={note.id} className="flex gap-3 border-t border-white/10 py-4 text-sm text-white/80">
              <BellDot size={16} className="mt-0.5 shrink-0 text-white/50" aria-hidden />
              <span>{note.title || note.body}</span>
            </div>
          ))}
          {items.length === 0 && (
            <p className="border-t border-white/10 py-4 text-sm text-white/45">No notifications yet.</p>
          )}
          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="block pt-2 text-xs font-bold text-beedero-yellow"
          >
            View all notifications →
          </Link>
        </section>
      )}
    </div>
  );
}

export function AppShell({ children, orgs = [] }: Props) {
  const pathname = usePathname();
  const { unread: notifUnread } = useNotifications();
  const { unreadTotal: messagesUnread } = useMessaging();
  const [rightSidebar, setRightSidebar] = useState<ReactNode | null>(null);
  const onRightSidebarChange = useCallback((node: ReactNode | null) => {
    setRightSidebar(node);
  }, []);

  const badges: Record<"notifications" | "messages", number> = {
    notifications: notifUnread,
    messages: messagesUnread,
  };

  return (
    <div className="min-h-screen bg-app-bg text-[#f4f4f1]">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-app-bg/95 px-4 backdrop-blur sm:px-6">
        <div className="mx-auto flex h-[70px] w-full max-w-[1440px] items-center gap-5">
          <Link href="/feed" className="text-xl font-black uppercase tracking-[-0.055em]">
            beedero<span className="text-beedero-yellow">.</span>
          </Link>

          <label className="hidden max-w-[520px] flex-1 items-center gap-3 border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white/40 md:flex">
            <Search size={15} strokeWidth={1.8} aria-hidden />
            <input
              className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-white/40"
              placeholder="Search people, organisations, skills…"
              disabled
              aria-label="Search (coming soon)"
            />
          </label>

          <div className="ml-auto flex items-center gap-3">
            <HeaderMessagesLink />
            <HeaderNotificationButton />
            <div className="[&_button]:size-10 [&_button]:rounded-full [&_button]:bg-transparent [&_button]:p-0 [&_button]:pr-0 [&_button]:text-white [&_button]:hover:bg-transparent [&_button>svg]:hidden [&_img]:size-10 [&_button>span]:size-10 [&_button>span]:bg-[#68738a] [&_button>span]:text-xs [&_button>span]:font-black [&_button>span]:text-white">
              <ProfileSwitcher />
            </div>
          </div>
        </div>
      </header>

      <div
        className={`mx-auto grid w-full max-w-[1440px] gap-6 px-4 py-6 pb-24 sm:px-6 lg:pb-8 ${
          rightSidebar
            ? "lg:grid-cols-[222px_minmax(0,1fr)_minmax(280px,340px)]"
            : "lg:grid-cols-[222px_1fr]"
        }`}
      >
        <aside className="hidden lg:block">
          <div className="sticky top-[94px]">
            <nav className="grid gap-1" aria-label="Primary">
              {DESKTOP_NAV.map(({ label, href, match, Icon, badgeKey }) => {
                const active = match(pathname);
                const badge = badgeKey ? badges[badgeKey] : 0;
                return (
                  <Link
                    key={href}
                    href={href}
                    className={navClass(active)}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon size={17} strokeWidth={1.8} aria-hidden />
                    {label}
                    {badge > 0 && (
                      <span
                        className={`ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-black ${
                          active
                            ? "bg-beedero-black text-beedero-yellow"
                            : "bg-beedero-yellow text-beedero-black"
                        }`}
                      >
                        {badge > 9 ? "9+" : badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-7 border-t border-white/10 pt-5">
              {orgs.length === 0 ? (
                <CreateOrgButton
                  variant="sidebar"
                  label="Join or Create Organization"
                  className="mt-0"
                />
              ) : (
                <>
                  <p className="px-3 text-[10px] font-black uppercase tracking-[0.18em] text-white/35">
                    Your organisations
                  </p>
                  <ul className="mt-3">
                    {orgs.slice(0, 4).map((org, index) => (
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
                            <Building2
                              size={16}
                              className={
                                index === 0
                                  ? "shrink-0 text-beedero-yellow"
                                  : "shrink-0 text-white/40"
                              }
                              aria-hidden
                            />
                          )}
                          <span
                            className={`flex-1 truncate text-sm ${index === 0 ? "font-bold" : ""}`}
                          >
                            {org.name}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/profile"
                    className="mt-2 flex items-center gap-2 px-3 text-xs font-bold text-beedero-yellow"
                  >
                    Manage organisations <ChevronRight size={14} aria-hidden />
                  </Link>
                </>
              )}
            </div>
          </div>
        </aside>

        <RightSidebarProvider onChange={onRightSidebarChange}>
          <section className="min-w-0">{children}</section>
        </RightSidebarProvider>

        {rightSidebar && (
          <aside className="hidden lg:block">
            <div className="sticky top-[94px] space-y-4">{rightSidebar}</div>
          </aside>
        )}
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-white/10 bg-app-bg/95 px-2 py-2 backdrop-blur lg:hidden"
        aria-label="Mobile"
      >
        {DESKTOP_NAV.filter((item) => item.mobile).map(({ shortLabel, href, match, Icon, badgeKey }) => {
          const active = match(pathname);
          const badge = badgeKey ? badges[badgeKey] : 0;
          return (
            <Link
              key={href}
              href={href}
              className={`relative grid min-h-12 place-items-center gap-1 px-2 text-[10px] ${
                active ? "text-beedero-yellow" : "text-white/55"
              }`}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={18} strokeWidth={1.8} aria-hidden />
              {badge > 0 && (
                <span className="absolute right-2 top-0 grid h-4 min-w-4 place-items-center rounded-full bg-beedero-yellow px-0.5 text-[9px] font-black text-beedero-black">
                  {badge > 9 ? "9+" : badge}
                </span>
              )}
              {shortLabel}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
