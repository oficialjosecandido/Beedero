const skillPillClass =
  "rounded-full border border-beedero-border bg-white px-2.5 py-0.5 text-xs font-medium text-zinc-700";

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
    <section className="mt-8">
      <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-500">Skills</h2>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {aggregated.map((skill) => {
          const detail = [
            `Used at ${skill.org_count} ${skill.org_count === 1 ? "org" : "orgs"}`,
            skill.years > 0 ? `over ${skill.years}y` : null,
            skill.confirmed ? "org-confirmed" : null,
          ]
            .filter(Boolean)
            .join(" · ");

          return (
            <span key={skill.skill} className={skillPillClass} title={detail}>
              {skill.skill}
            </span>
          );
        })}
        {free.map((skill) => (
          <span key={skill} className={skillPillClass}>
            {skill}
          </span>
        ))}
      </div>
    </section>
  );
}
