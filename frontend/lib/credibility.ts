export const CREDIBILITY_LEVEL_LABELS: Record<number, string> = {
  1: "Identity",
  2: "Compliance",
  3: "Certified financials",
  4: "Real-time traction",
};

export function credibilityLevelHeading(level: number): string {
  return `Level ${level} · ${CREDIBILITY_LEVEL_LABELS[level] ?? ""}`;
}
