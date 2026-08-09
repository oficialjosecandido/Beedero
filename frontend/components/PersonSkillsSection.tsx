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
      {aggregated.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {aggregated.map((skill) => (
            <span
              key={skill.skill}
              className="inline-flex items-center gap-1.5 rounded-full border border-beedero-border bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-700"
            >
              {skill.skill}
              <span className="font-normal text-zinc-400">
                · used at {skill.org_count} {skill.org_count === 1 ? "org" : "orgs"}
                {skill.years > 0 ? ` over ${skill.years}y` : ""}
              </span>
              {skill.confirmed && <span className="text-[10px] font-bold text-emerald-600">confirmed</span>}
            </span>
          ))}
        </div>
      )}
      {free.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {free.map((skill) => (
            <span
              key={skill}
              className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-zinc-500 ring-1 ring-beedero-border/60"
            >
              {skill}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
