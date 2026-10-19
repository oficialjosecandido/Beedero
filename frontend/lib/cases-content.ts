export type CaseStudy = {
  slug: string;
  org: string;
  role: string;
  headline: string;
  result: string;
  metric: string;
  metricLabel: string;
  summary: string;
};

/**
 * Early-access result stories — concrete outcomes from using Beedero’s
 * verified professional record, not invented testimonials.
 */
export const CASE_STUDIES: CaseStudy[] = [
  {
    slug: "founder-record",
    org: "Early-stage founders",
    role: "Founders",
    headline: "A profile that organisations can confirm",
    result:
      "Founders turn free-text CVs into a professional record where roles confirmed by organisations show as verified facts — on their private profile and on the public /p page.",
    metric: "Verified",
    metricLabel: "by organisation",
    summary: "Self-declared rows stop competing with roster-confirmed memberships.",
  },
  {
    slug: "hiring-signal",
    org: "Hiring teams",
    role: "Companies",
    headline: "Open roles that carry company context",
    result:
      "Public job pages sit next to the organisation’s credibility signals, so applicants see who is hiring before they apply — and crawlers get structured JobPosting markup.",
    metric: "7-day",
    metricLabel: "live role windows",
    summary: "Roles expire cleanly instead of lingering as dead listings.",
  },
  {
    slug: "network-discovery",
    org: "Operators & advisors",
    role: "Professionals",
    headline: "Discovery that starts from skill and proof",
    result:
      "People surface through skills anchored to real engagements, not keyword stuffing — so introductions start from work that already exists on the record.",
    metric: "Skill years",
    metricLabel: "tied to real roles",
    summary: "Overlapping gigs count calendar time once, not twice.",
  },
];
