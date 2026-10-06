"use client";

import Link from "next/link";
import { BadgeCheck, ChevronRight, CircleUserRound } from "lucide-react";

import { ORG_NAV, type OrgNavCounts, type OrgTabId } from "./tabs";
import { OrgMark } from "./ui";

/**
 * Figma organisation sidebar: identity, nav, record score, and the way back to
 * the personal profile. Below `lg` it stacks above the content instead of
 * disappearing, so the nav stays reachable on a phone.
 */
export function OrgWorkspaceNav({
  name,
  logo,
  slug,
  isVerified,
  myRole,
  completeness,
  verifiedSignals,
  counts,
  active,
  onSelect,
}: {
  name: string;
  logo: string | null;
  slug: string;
  isVerified: boolean;
  myRole: string;
  completeness: number;
  verifiedSignals: number;
  counts: OrgNavCounts;
  active: OrgTabId;
  onSelect: (tab: OrgTabId) => void;
}) {
  return (
    <aside className="border-b border-black/30 bg-org-ground lg:min-h-[calc(100vh-70px)] lg:border-b-0 lg:border-r">
      <div className="sticky top-[70px] flex max-h-[calc(100vh-70px)] flex-col overflow-y-auto p-4 sm:p-5">
        <div className="flex items-center gap-3 border-b border-black/10 pb-5">
          <OrgMark name={name} logo={logo} className="size-11 text-lg" />
          <div className="min-w-0">
            <b className="block truncate text-sm">{name}</b>
            {isVerified && (
              <span className="mt-1 flex items-center gap-1 text-[10px] font-bold text-org-gold">
                <BadgeCheck size={12} aria-hidden /> Verified organisation
              </span>
            )}
            <p className="mt-1 text-[10px] text-black/50">
              Your role: <b className="text-black/75">{myRole}</b>
            </p>
          </div>
        </div>

        <nav className="mt-5 grid gap-1" aria-label="Organisation workspace">
          {ORG_NAV.map(({ id, label, Icon, ...item }) => {
            const countKey = "countKey" in item ? item.countKey : undefined;
            const count = countKey ? counts[countKey] : undefined;
            const current = active === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onSelect(id)}
                aria-current={current ? "page" : undefined}
                className={`flex items-center gap-3 px-3 py-3 text-left text-sm transition ${
                  current
                    ? "bg-org-ink font-bold text-white"
                    : "text-black/60 hover:bg-black/[0.05] hover:text-black"
                }`}
              >
                <Icon size={16} aria-hidden />
                <span className="flex-1">{label}</span>
                {typeof count === "number" && count > 0 && (
                  <span
                    className={`grid h-5 min-w-5 place-items-center rounded-full px-1 text-[10px] font-black ${
                      current ? "bg-white text-black" : "bg-org-chip text-black"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="mt-6 border-t border-black/10 pt-5">
          <p className="px-3 text-[9px] font-black uppercase tracking-[0.17em] text-black/40">
            Organisation health
          </p>
          <div className="mt-3 px-3">
            <div className="flex items-end justify-between">
              <b className="text-3xl font-black">{completeness}</b>
              <span className="text-[10px] font-bold text-org-gold">Record score</span>
            </div>
            <div className="mt-2 h-1.5 bg-black/10">
              <div className="h-full bg-beedero-yellow" style={{ width: `${completeness}%` }} />
            </div>
            <p className="mt-2 text-[10px] leading-4 text-black/45">
              {verifiedSignals} verified {verifiedSignals === 1 ? "signal" : "signals"} ·{" "}
              {100 - completeness}% to go
            </p>
          </div>
        </div>

        <Link
          href={`/o/${slug}`}
          className="mt-5 flex items-center gap-3 border border-black/15 px-3 py-3 text-sm font-bold text-black/70 transition hover:border-beedero-yellow hover:bg-org-chip hover:text-black"
        >
          <BadgeCheck size={17} aria-hidden />
          <span className="flex-1">View public profile</span>
          <ChevronRight size={15} aria-hidden />
        </Link>

        <Link
          href="/dashboard"
          className="mt-2 flex items-center gap-3 border border-black/15 px-3 py-3 text-sm font-bold text-black/70 transition hover:border-beedero-yellow hover:bg-org-chip hover:text-black"
        >
          <CircleUserRound size={17} aria-hidden />
          <span className="flex-1">Switch to personal profile</span>
          <ChevronRight size={15} aria-hidden />
        </Link>
      </div>
    </aside>
  );
}
