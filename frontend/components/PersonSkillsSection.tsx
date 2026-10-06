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
    <section className="border-t border-zinc-100 pt-8">
      <h2 className={profileSectionHeadingClass}>Skills &amp; time in practice</h2>
      <p className="mt-2 text-sm text-zinc-500">
        Time is taken from the records each skill is anchored to.
      </p>

      {aggregated.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {aggregated.map((skill) => (
            <span
              key={skill.skill}
              className="inline-flex items-center gap-2 rounded-full border border-beedero-border bg-white py-1 pl-3 pr-2 text-xs font-medium text-zinc-800"
              title={`Used at ${skill.org_count} ${skill.org_count === 1 ? "org" : "orgs"}${
                skill.confirmed ? " · org-confirmed" : ""
              }`}
            >
              {skill.skill}
              {skill.confirmed && (
                <span className="text-[10px] font-bold text-emerald-600" aria-label="Org-confirmed">
                  ✓
                </span>
              )}
              {skill.years > 0 && (
                <span className="border-l border-beedero-border pl-2 text-[10px] font-bold uppercase tracking-[0.08em] tabular-nums text-zinc-500">
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
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-400">
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
