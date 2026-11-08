import Link from "next/link";
import { ArrowRight, Megaphone, UsersRound } from "lucide-react";

import { JobsTab } from "@/components/jobs/JobsTab";
import type { JobSummary } from "@/lib/types";

import { OrgCard, OrgCardHeading, orgEyebrowClass, orgInkButtonClass } from "./ui";

/**
 * A startup's Co-founders section (startups only — lib/org-kinds.ts). Two
 * ways to find someone, both of which already exist on Beedero: post a
 * co-founder role (it goes on the jobs board, and people apply), or meet
 * builders one by one in co-founder matching, which is personal — it runs on
 * each founder's own profile, so the link opens it for whoever is signed in.
 */
export function CofoundersTab({
  slug,
  name,
  roles,
  canManage,
}: {
  slug: string;
  name: string;
  roles: JobSummary[];
  canManage: boolean;
}) {
  const open = roles.filter((role) => role.status === "open").length;
  return (
    <div className="flex flex-col gap-5">
      <OrgCard tone="yellow">
        <OrgCardHeading eyebrow="Co-founders" title={`Who's missing at ${name}?`} />
        <p className="mt-2 max-w-2xl text-sm leading-6 text-black/70">
          Two ways to find them. A role tells everyone what you need; matching lets you meet people who are
          looking for a co-founder too.
        </p>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <div className="flex min-w-0 flex-col border-2 border-org-ink bg-white p-4">
            <Megaphone size={18} aria-hidden />
            <p className={`${orgEyebrowClass} mt-3 text-black/55`}>Post a role</p>
            <p className="mt-1 text-sm font-bold">
              {open > 0
                ? `${open} co-founder ${open === 1 ? "role is" : "roles are"} open.`
                : "No co-founder role open yet."}
            </p>
            <p className="mt-1 text-xs leading-5 text-black/60">
              It goes on the jobs board with {name}&apos;s page behind it. People apply, and you answer from
              here.
            </p>
          </div>
          <div className="flex min-w-0 flex-col border-2 border-org-ink bg-white p-4">
            <UsersRound size={18} aria-hidden />
            <p className={`${orgEyebrowClass} mt-3 text-black/55`}>Co-founder matching</p>
            <p className="mt-1 text-sm font-bold">Meet builders, one at a time.</p>
            <p className="mt-1 text-xs leading-5 text-black/60">
              It runs on your own profile: say what you bring and what you need, then say yes or pass.
            </p>
            <Link href="/cofounder" className={`${orgInkButtonClass} mt-4 self-start`}>
              Open matching <ArrowRight size={14} aria-hidden />
            </Link>
          </div>
        </div>
      </OrgCard>

      <JobsTab slug={slug} jobs={roles} canManage={canManage} kind="startup" mode="cofounders" />
    </div>
  );
}
