"use client";

import { useActionState } from "react";

import {
  declareMembershipSkillAction,
  retractMembershipSkillAction,
} from "@/app/(app)/dashboard/membership-skills-actions";
import { useActionToast } from "@/lib/use-action-toast";

const fieldClass =
  "w-full rounded-xl border border-beedero-border bg-white px-3 py-2.5 text-sm text-beedero-black outline-none transition-colors focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60";

export type PersonMembershipWithSkills = {
  id: number;
  org: string;
  orgName: string;
  role: string;
  skills: { id: number; skill: string; status: string }[];
};

function MembershipSkillRow({ slug, memberId }: { slug: string; memberId: number }) {
  const [error, formAction, pending] = useActionState(declareMembershipSkillAction, null);
  useActionToast(error, pending, { successMessage: "Skill declared." });

  return (
    <form action={formAction} className="flex gap-2">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="member_id" value={memberId} />
      <input name="skill" placeholder="A skill you used here" className={fieldClass} />
      <button
        type="submit"
        disabled={pending}
        className="shrink-0 rounded-lg bg-beedero-yellow px-3 py-1.5 text-xs font-bold text-beedero-black hover:bg-beedero-black hover:text-beedero-white disabled:opacity-50"
      >
        {pending ? "Adding..." : "Add"}
      </button>
    </form>
  );
}

function MembershipCard({ membership }: { membership: PersonMembershipWithSkills }) {
  return (
    <div className="rounded-2xl border border-beedero-border bg-zinc-50/50 p-4">
      <p className="text-sm font-semibold text-zinc-800">{membership.orgName}</p>
      <p className="text-xs text-zinc-400">{membership.role}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {membership.skills.map((skill) => (
          <span
            key={skill.id}
            className="inline-flex items-center gap-1.5 rounded-full border border-beedero-border bg-white px-2.5 py-1 text-xs font-medium text-zinc-700"
          >
            {skill.skill}
            {skill.status === "org_confirmed" && (
              <span className="text-[10px] font-bold text-emerald-600">confirmed</span>
            )}
            <form action={retractMembershipSkillAction}>
              <input type="hidden" name="slug" value={membership.org} />
              <input type="hidden" name="member_id" value={membership.id} />
              <input type="hidden" name="skill_id" value={skill.id} />
              <button type="submit" className="text-zinc-400 hover:text-beedero-black" aria-label={`Remove ${skill.skill}`}>
                ×
              </button>
            </form>
          </span>
        ))}
        {membership.skills.length === 0 && <p className="text-xs text-zinc-400">No skills declared yet.</p>}
      </div>
      <div className="mt-2">
        <MembershipSkillRow slug={membership.org} memberId={membership.id} />
      </div>
    </div>
  );
}

export function MembershipSkillsManager({ memberships }: { memberships: PersonMembershipWithSkills[] }) {
  if (memberships.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-3xl border-2 border-beedero-border bg-beedero-white shadow-sm">
      <div className="border-b border-beedero-border bg-beedero-yellow px-6 py-5">
        <h2 className="text-xl font-extrabold tracking-tight text-zinc-900">Skills by organization</h2>
        <p className="mt-1 max-w-xl text-sm leading-6 text-zinc-600">
          Anchor a skill to a specific membership — an org admin can confirm it, which shows on your
          public timeline.
        </p>
      </div>
      <div className="flex flex-col gap-4 px-6 py-6">
        {memberships.map((membership) => (
          <MembershipCard key={membership.id} membership={membership} />
        ))}
      </div>
    </div>
  );
}
