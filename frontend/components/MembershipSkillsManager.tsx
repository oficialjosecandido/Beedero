"use client";

import { useActionState } from "react";

import {
  declareMembershipSkillAction,
  retractMembershipSkillAction,
} from "@/app/(app)/dashboard/membership-skills-actions";
import { btnPrimary, inputDark } from "@/components/app-shell/ui";
import { useActionToast } from "@/lib/use-action-toast";

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
      <input
        name="skill"
        aria-label="A skill you used here"
        placeholder="A skill you used here"
        className={`${inputDark} placeholder:text-white/35`}
      />
      <button type="submit" disabled={pending} className={`${btnPrimary} shrink-0`}>
        {pending ? "Adding..." : "Add"}
      </button>
    </form>
  );
}

function MembershipCard({ membership }: { membership: PersonMembershipWithSkills }) {
  return (
    <div className="border-b border-white/[0.08] pb-4 last:border-0 last:pb-0">
      <p className="text-sm font-bold">{membership.orgName}</p>
      <p className="text-xs text-white/45">{membership.role}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {membership.skills.map((skill) => (
          <span
            key={skill.id}
            className="inline-flex items-center gap-1.5 border border-white/15 px-2.5 py-1 text-xs text-white/75"
          >
            {skill.skill}
            {skill.status === "org_confirmed" && (
              <span className="text-[10px] font-black uppercase text-emerald-400">confirmed</span>
            )}
            <form action={retractMembershipSkillAction}>
              <input type="hidden" name="slug" value={membership.org} />
              <input type="hidden" name="member_id" value={membership.id} />
              <input type="hidden" name="skill_id" value={skill.id} />
              <button
                type="submit"
                className="-m-1.5 p-1.5 text-white/40 hover:text-white"
                aria-label={`Remove ${skill.skill}`}
              >
                ×
              </button>
            </form>
          </span>
        ))}
        {membership.skills.length === 0 && <p className="text-xs text-white/40">No skills declared yet.</p>}
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
    <div className="mt-6 border-t border-white/10 pt-5">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/35">
        Skills at your Beedero organisations
      </p>
      <p className="mt-1 text-xs leading-5 text-white/45">
        An admin of the organisation can confirm these — confirmed ones show on your timeline.
      </p>
      <div className="mt-4 flex flex-col gap-4">
        {memberships.map((membership) => (
          <MembershipCard key={membership.id} membership={membership} />
        ))}
      </div>
    </div>
  );
}
