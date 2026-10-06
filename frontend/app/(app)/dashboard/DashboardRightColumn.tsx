"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  Building2,
  Check,
  Eye,
  Newspaper,
  ShieldCheck,
  UsersRound,
} from "lucide-react";

import { CreateOrgButton } from "@/components/CreateOrgButton";
import { InvitePeopleButton } from "@/components/InvitePeopleButton";
import type { RecentOrgUpdateItem } from "@/components/RecentOrgUpdatesPanel";
import { useRightSidebar } from "@/components/app-shell/RightSidebar";
import { formatRelativeTime } from "@/lib/format";
import { VISIBILITY_SECTIONS, visibilityLabel } from "@/lib/profile-visibility";
import { SECTION_LABELS } from "@/lib/types";

type ChecklistItem = { key: string; done: boolean; hint: string };
type Membership = { slug: string; name: string; role: string; logo?: string | null };
type NetworkCounts = { connections: number; pending: number; following: number };

/** `profile_checklist` keys (accounts/completeness.py) in display form. */
const LADDER_LABELS: Record<string, string> = {
  full_name: "Full name",
  headline: "Headline",
  country: "Country",
  org_link: "Organisation link",
  first_post: "First post",
};

const panelClass = "border border-white/10 bg-white/[0.025] p-5";

/**
 * The design's "Verification ladder", fed by the private profile checklist
 * from `/investors/me/vitality/` — completeness steps, not verification
 * states, so the copy says so.
 */
function ProfileLadder({
  checklist,
  doneCount,
  totalCount,
}: {
  checklist: ChecklistItem[];
  doneCount: number;
  totalCount: number;
}) {
  return (
    <section className={panelClass}>
      <div className="flex items-center gap-2">
        <ShieldCheck size={16} className="text-beedero-yellow" aria-hidden />
        <h2 className="text-xl font-black tracking-[-0.03em]">Profile ladder</h2>
      </div>
      <p className="mt-2 text-xs leading-5 text-white/45">
        A trusted profile is built step by step. Private to you.
      </p>
      <div className="mt-5 space-y-4">
        {checklist.map((item) => (
          <div key={item.key} className="flex gap-3">
            <span
              aria-hidden
              className={`grid size-5 shrink-0 place-items-center [clip-path:polygon(25%_6%,75%_6%,100%_50%,75%_94%,25%_94%,0_50%)] ${
                item.done
                  ? "bg-beedero-yellow text-beedero-black"
                  : "border border-white/25 text-white/35"
              }`}
            >
              {item.done && <Check size={11} />}
            </span>
            <div className="min-w-0 flex-1">
              <b className="block text-xs">{LADDER_LABELS[item.key] ?? item.key}</b>
              {!item.done && (
                <small className="mt-0.5 block text-[10px] leading-4 text-white/40">
                  {item.hint}
                </small>
              )}
            </div>
            <span
              className={`text-[10px] font-bold ${
                item.done ? "text-emerald-400" : "text-beedero-yellow"
              }`}
            >
              {item.done ? "Done" : "Add"}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-6 border-t border-white/10 pt-4 text-[10px] font-black uppercase tracking-[0.15em] text-beedero-yellow">
        {doneCount} / {totalCount} complete
      </p>
    </section>
  );
}

function NetworkPanel({ network }: { network: NetworkCounts }) {
  const rows = [
    { label: "Connections", value: network.connections },
    { label: "Pending requests", value: network.pending },
    { label: "Following", value: network.following },
  ];

  return (
    <section className={panelClass}>
      <div className="flex items-center gap-2">
        <UsersRound size={16} className="text-beedero-yellow" aria-hidden />
        <h2 className="text-xl font-black tracking-[-0.03em]">Your network</h2>
      </div>
      <dl className="mt-4 space-y-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-3 text-xs">
            <dt className="text-white/45">{row.label}</dt>
            <dd className="font-black tabular-nums">{row.value}</dd>
          </div>
        ))}
      </dl>
      <Link
        href="/network"
        className="mt-4 block border-t border-white/10 pt-4 text-[10px] font-bold uppercase tracking-[0.12em] text-beedero-yellow"
      >
        Open my network →
      </Link>
      <InvitePeopleButton className="mt-4" variant="dark" />
    </section>
  );
}

function OrganisationsPanel({ orgs }: { orgs: Membership[] }) {
  return (
    <section className={panelClass}>
      <div className="flex items-center gap-2">
        <Building2 size={16} className="text-beedero-yellow" aria-hidden />
        <h2 className="text-xl font-black tracking-[-0.03em]">Organisations</h2>
      </div>
      {orgs.length === 0 ? (
        <p className="mt-3 text-xs leading-5 text-white/45">
          You don&apos;t belong to any organisation yet.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {orgs.map((org) => (
            <li key={org.slug}>
              <Link
                href={`/dashboard/${org.slug}`}
                className="flex items-center gap-3 border border-white/10 p-3 transition hover:border-white/25"
              >
                {org.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={org.logo} alt="" className="size-7 shrink-0 object-cover" />
                ) : (
                  <span
                    aria-hidden
                    className="grid size-7 shrink-0 place-items-center bg-white/10 text-[10px] font-black"
                  >
                    {org.name.charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-xs">{org.name}</b>
                  <small className="block text-[10px] uppercase tracking-[0.1em] text-white/40">
                    {org.role}
                  </small>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <CreateOrgButton className="mt-4" variant="dark" />
    </section>
  );
}

/**
 * Stands in for the design's "Restricted groups" card: this platform scopes
 * each profile section to an audience instead of to named groups.
 */
function VisibilityPanel({ visibility }: { visibility: Record<string, string> | undefined }) {
  return (
    <section className={panelClass}>
      <div className="flex items-center gap-2">
        <Eye size={16} className="text-sky-300" aria-hidden />
        <h2 className="text-xl font-black tracking-[-0.03em]">Who sees what</h2>
      </div>
      <p className="mt-2 text-xs leading-5 text-white/45">
        Each part of your profile has its own audience.
      </p>
      <dl className="mt-4 space-y-2">
        {VISIBILITY_SECTIONS.map((section) => {
          const label = visibilityLabel(visibility?.[section.key]);
          return (
            <div key={section.key} className="flex items-baseline justify-between gap-3 text-xs">
              <dt className="truncate text-white/45">{section.label}</dt>
              <dd
                className={`shrink-0 font-bold ${
                  label === "Public" ? "text-emerald-400" : "text-sky-300"
                }`}
              >
                {label}
              </dd>
            </div>
          );
        })}
      </dl>
      <Link
        href="/dashboard?tab=settings"
        className="mt-4 block border-t border-white/10 pt-4 text-[10px] font-bold uppercase tracking-[0.12em] text-sky-300"
      >
        Change visibility →
      </Link>
    </section>
  );
}

function OrgNewsPanel({ items }: { items: RecentOrgUpdateItem[] }) {
  return (
    <section className="border border-white/10 bg-white/[0.025]">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <Newspaper size={15} className="text-beedero-yellow" aria-hidden />
        <h2 className="text-base font-black tracking-[-0.03em]">News</h2>
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-5 text-xs leading-5 text-white/40">
          No organisation updates yet.
        </p>
      ) : (
        <ul className="divide-y divide-white/[0.07]">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={`/org/${item.org.slug}`}
                className="flex gap-3 px-4 py-3 transition hover:bg-white/[0.04]"
              >
                {item.org.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.org.logo} alt="" className="mt-0.5 size-8 shrink-0 object-cover" />
                ) : (
                  <span
                    aria-hidden
                    className="mt-0.5 grid size-8 shrink-0 place-items-center bg-white/10 text-[10px] font-black"
                  >
                    {item.org.name.charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <b className="line-clamp-2 text-xs font-bold leading-snug">{item.title}</b>
                  <small className="mt-1 block text-[10px] text-white/40">
                    {item.org.name} · {SECTION_LABELS[item.kind] ?? item.kind} ·{" "}
                    {formatRelativeTime(item.created_at)}
                  </small>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Mounts the profile page's right column into the AppShell grid. */
export function DashboardRightColumn({
  checklist,
  doneCount,
  totalCount,
  network,
  orgs,
  visibility,
  updates,
}: {
  checklist: ChecklistItem[] | null;
  doneCount: number;
  totalCount: number;
  network: NetworkCounts | null;
  orgs: Membership[];
  visibility: Record<string, string> | undefined;
  updates: RecentOrgUpdateItem[];
}) {
  const panels = useMemo(
    () => (
      <>
        {checklist && checklist.length > 0 && (
          <ProfileLadder checklist={checklist} doneCount={doneCount} totalCount={totalCount} />
        )}
        {network && <NetworkPanel network={network} />}
        <OrganisationsPanel orgs={orgs} />
        <VisibilityPanel visibility={visibility} />
        <OrgNewsPanel items={updates} />
      </>
    ),
    [checklist, doneCount, totalCount, network, orgs, visibility, updates]
  );

  useRightSidebar(panels);
  return null;
}
