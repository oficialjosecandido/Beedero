import { CREDIBILITY_LEVEL_LABELS, credibilityLevelHeading } from "@/lib/credibility";

export function CredibilityBadge({ level }: { level: number }) {
  if (!level) return null;
  return (
    <span
      title={CREDIBILITY_LEVEL_LABELS[level] ?? ""}
      className="rounded-full bg-beedero-black px-2.5 py-0.5 text-xs font-bold text-beedero-yellow"
    >
      {credibilityLevelHeading(level)}
    </span>
  );
}
