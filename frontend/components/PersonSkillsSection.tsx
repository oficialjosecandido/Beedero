import { profileSectionHeadingClass, profileSkillPillClass } from "@/components/PersonTimeline";
import { formatYears } from "@/lib/skill-duration";

export type AggregatedSkill = { skill: string; org_count: number; years: number; confirmed: boolean };

export function PersonSkillsSection({
  free,
  aggregated,
}: {
  free: string[];
  aggregated: AggregatedSkill[];
}) {
  if (free.length === 0 && aggregated.length === 0) return null;

  return (
    <section className="border-t border-white/10 pt-8">
      <h2 className={profileSectionHeadingClass}>Skills &amp; time in practice</h2>
      <p className="mt-2 text-sm text-white/45">
        Time is taken from the records each skill is anchored to. Roles held at the same time count
        once.
      </p>

      {aggregated.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {aggregated.map((skill) => (
            <span
              key={skill.skill}
              className="inline-flex items-center gap-2 border border-white/15 bg-white/[0.04] py-1 pl-3 pr-2 text-xs font-medium text-white/85"
              title={`Used at ${skill.org_count} ${skill.org_count === 1 ? "org" : "orgs"}${
                skill.confirmed ? " · org-confirmed" : ""
              }`}
            >
              {skill.skill}
              {skill.confirmed && (
                <span className="text-[10px] font-black text-emerald-400" aria-label="Org-confirmed">
                  ✓
                </span>
              )}
              {skill.years > 0 && (
                <span className="border-l border-white/15 pl-2 text-[10px] font-black uppercase tracking-[0.08em] tabular-nums text-beedero-yellow">
                  {formatYears(skill.years)}
                </span>
              )}
            </span>
          ))}
        </div>
      )}

      {free.length > 0 && (
        <div className="mt-4">
          {aggregated.length > 0 && (
            <p className="text-[11px] font-black uppercase tracking-[0.12em] text-white/40">
              Also declared
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            {free.map((skill) => (
              <span key={skill} className={profileSkillPillClass}>
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
