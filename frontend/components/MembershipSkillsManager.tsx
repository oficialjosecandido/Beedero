export type PersonMembershipWithSkills = {
  id: number;
  org: string;
  orgName: string;
  role: string;
  skills: { id: number; skill: string; status: string }[];
};

/**
 * Placeholder for org-confirmed skills on the profile. Declare/retract actions
 * stay in the codebase; this UI is Coming Soon until that flow ships again.
 */
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
      <div className="mt-4 border border-dashed border-white/15 bg-white/[0.02] px-4 py-6 text-center">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-beedero-yellow">Coming soon</p>
        <p className="mt-2 text-sm leading-5 text-white/50">
          Skills confirmed by organisation admins will appear here.
        </p>
      </div>
    </div>
  );
}
