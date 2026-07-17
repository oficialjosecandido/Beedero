"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type InvestorProfile = {
  full_name?: string;
  profile_picture?: string | null;
};

type Me = {
  email: string;
  investor_profile: InvestorProfile | null;
};

type OrgMembership = {
  slug: string;
  name: string;
  role: string;
  logo?: string | null;
};

function AvatarCircle({
  name,
  image,
  className = "size-9",
}: {
  name: string;
  image?: string | null;
  className?: string;
}) {
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={image} alt="" className={`${className} shrink-0 rounded-full object-cover`} />
    );
  }
  return (
    <span
      className={`${className} flex shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-500`}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

export function ProfileSwitcher() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [menuPath, setMenuPath] = useState(pathname);
  const [data, setData] = useState<{ me: Me; orgs: OrgMembership[] } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  if (pathname !== menuPath) {
    setMenuPath(pathname);
    setOpen(false);
  }

  const activeSlug = pathname.match(/^\/dashboard\/([^/]+)/)?.[1] ?? null;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/profile-switcher", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        setData((await res.json()) as { me: Me; orgs: OrgMembership[] });
      } catch {
        // ignore load errors
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const personalName = data?.me.investor_profile?.full_name || data?.me.email || "You";
  const personalImage = data?.me.investor_profile?.profile_picture;
  const activeOrg = activeSlug ? data?.orgs.find((org) => org.slug === activeSlug) : null;

  const triggerName = activeOrg?.name ?? personalName;
  const triggerImage = activeOrg?.logo ?? personalImage;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-1.5 rounded-full p-1 pr-2 text-beedero-black/65 hover:bg-beedero-yellow hover:text-beedero-black"
        aria-label="Manage profile"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <AvatarCircle name={triggerName} image={triggerImage} />
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`size-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && data && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-72 rounded-2xl border-2 border-beedero-border bg-beedero-white p-2 shadow-lg"
        >
          <p className="px-2 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-beedero-black/50">
            Manage profile
          </p>

          <Link
            href="/dashboard"
            role="menuitem"
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 rounded-xl px-2 py-2 text-sm hover:bg-beedero-yellow/25 ${
              !activeSlug ? "bg-beedero-yellow/15" : ""
            }`}
          >
            <AvatarCircle name={personalName} image={personalImage} className="size-10" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-beedero-black">{personalName}</p>
              <p className="truncate text-xs text-zinc-500">Personal profile</p>
            </div>
            {!activeSlug && (
              <span className="text-xs font-bold text-beedero-black" aria-hidden="true">
                ✓
              </span>
            )}
          </Link>

          {data.orgs.length > 0 && (
            <div className="mt-1 border-t border-beedero-border pt-1">
              {data.orgs.map((org) => {
                const isActive = activeSlug === org.slug;
                return (
                  <Link
                    key={org.slug}
                    href={`/dashboard/${org.slug}`}
                    role="menuitem"
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 rounded-xl px-2 py-2 text-sm hover:bg-beedero-yellow/25 ${
                      isActive ? "bg-beedero-yellow/15" : ""
                    }`}
                  >
                    <AvatarCircle name={org.name} image={org.logo} className="size-10" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-beedero-black">{org.name}</p>
                      <p className="truncate text-xs capitalize text-zinc-500">{org.role}</p>
                    </div>
                    {isActive && (
                      <span className="text-xs font-bold text-beedero-black" aria-hidden="true">
                        ✓
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
