import { profileSectionHeadingClass, profileSkillPillClass } from "@/components/PersonTimeline";

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
      <h2 className={profileSectionHeadingClass}>Skills</h2>
      <div className="mt-4 flex flex-wrap gap-2">
        {aggregated.map((skill) => {
          const detail = [
            `Used at ${skill.org_count} ${skill.org_count === 1 ? "org" : "orgs"}`,
            skill.years > 0 ? `over ${skill.years}y` : null,
            skill.confirmed ? "org-confirmed" : null,
          ]
            .filter(Boolean)
            .join(" · ");

          return (
            <span key={skill.skill} className={profileSkillPillClass} title={detail}>
              {skill.skill}
            </span>
          );
        })}
        {free.map((skill) => (
          <span key={skill} className={profileSkillPillClass}>
            {skill}
          </span>
        ))}
      </div>
    </section>
  );
}
