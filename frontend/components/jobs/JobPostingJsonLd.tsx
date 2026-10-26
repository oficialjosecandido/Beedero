import { jsonLdHtml } from "@/lib/json-ld";
import { SITE_URL } from "@/lib/site-metadata";
import type { PublicJob } from "@/lib/types";

/**
 * `JobPosting` structured data — doc §3.3, the free channel: Google shows these
 * roles in its job search at no cost, which for a board this size is the
 * difference between being found and not.
 *
 * Two deliberate omissions:
 *
 * - **No `baseSalary`.** `salary_text` is free text ("40–50k + equity", "TBD"),
 *   and Google wants a currency, a value and a unit. Guessing at the parse
 *   would publish a number nobody wrote.
 * - **No application count, no applicant anything.** Same rule as the endpoint
 *   it is rendered from (§3.1).
 *
 * Expired jobs never reach this component: the API 404s them, so the page does
 * too, which is the one answer that stops Google re-serving a filled role.
 */

/**
 * Google accepts a closed set here: FULL_TIME, PART_TIME, CONTRACTOR,
 * TEMPORARY, INTERN, VOLUNTEER, PER_DIEM, OTHER. Beedero's co-founder and
 * advisor engagements have no counterpart in it, and OTHER is the honest answer
 * — inventing CONTRACTOR for a co-founder search would mis-sort the role.
 */
const EMPLOYMENT_TYPES: Record<string, string> = {
  full_time: "FULL_TIME",
  part_time: "PART_TIME",
  contract: "CONTRACTOR",
  internship: "INTERN",
  volunteer: "VOLUNTEER",
  cofounder: "OTHER",
  advisor: "OTHER",
};

export function JobPostingJsonLd({ job }: { job: PublicJob }) {
  const orgUrl = `${SITE_URL}/o/${job.org.slug}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: job.description,
    datePosted: job.created_at,
    ...(job.expires_at ? { validThrough: job.expires_at } : {}),
    employmentType: EMPLOYMENT_TYPES[job.engagement_type] ?? "OTHER",
    hiringOrganization: {
      "@type": "Organization",
      name: job.org.name,
      sameAs: orgUrl,
      ...(job.org.logo ? { logo: job.org.logo } : {}),
    },
    ...(job.role_area ? { occupationalCategory: job.role_area } : {}),
    ...(job.skills.length ? { skills: job.skills.join(", ") } : {}),
    ...(job.location_type === "remote"
      ? {
          jobLocationType: "TELECOMMUTE",
          applicantLocationRequirements: { "@type": "Country", name: "Portugal" },
        }
      : {
          jobLocation: {
            "@type": "Place",
            address: {
              "@type": "PostalAddress",
              ...(job.location_city ? { addressLocality: job.location_city } : {}),
              addressCountry: "PT",
            },
          },
        }),
  };

  return (
    <script
      type="application/ld+json"
      // Escaping "<" keeps a description that happens to contain markup from
      // ending the script element early.
      dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLd) }}
    />
  );
}
