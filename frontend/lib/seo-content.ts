/**
 * Canonical SEO copy — titles, descriptions, keywords and persona landing
 * content. Kept in one place so meta tags, JSON-LD and crawlable pages stay
 * aligned with the product value props.
 */

export const SITE_NAME = "Beedero";

export const DEFAULT_TITLE =
  "Verified professional network for founders, talent and companies";

export const DEFAULT_DESCRIPTION =
  "Beedero is the verified network for founders, professionals, startups and companies. Free personal profiles, organisation-confirmed roles, registry-backed founder status, co-founder matching and private fundraising — without cold spam.";

export const SITE_KEYWORDS = [
  "Beedero",
  "verified professional network",
  "startup network",
  "founder verification",
  "certidão permanente",
  "co-founder matching",
  "verified startups",
  "startup jobs",
  "company verification",
  "fundraising platform",
  "professional profile",
  "startup discovery",
  "verified investors",
  "EARLYADOPTER",
] as const;

export type SeoPersona = {
  slug: "for-founders" | "for-professionals" | "for-startups" | "for-companies";
  path: string;
  navLabel: string;
  eyebrow: string;
  /** Page <title> (site name appended by pageMetadata). */
  title: string;
  /** Meta description ≤ ~160 chars for SERP snippets. */
  description: string;
  keywords: string[];
  h1: string;
  lead: string;
  ctaLabel: string;
  ctaHref: string;
  points: { title: string; body: string }[];
  faqs: { question: string; answer: string }[];
};

export const SEO_PERSONAS: SeoPersona[] = [
  {
    slug: "for-founders",
    path: "/for-founders",
    navLabel: "Founders",
    eyebrow: "For founders",
    title: "Verified founder profiles — proven, not claimed",
    description:
      "Prove founder status with certidão permanente verification. Free Beedero profile, verification ladder, LinkedIn import, co-founder matching and no cold spam.",
    keywords: [
      "verified founder profile",
      "founder verification",
      "certidão permanente founder",
      "co-founder matching",
      "LinkedIn import profile",
      "startup founder network",
      "Beedero founders",
    ],
    h1: "Your founder status is proven, not claimed.",
    lead: "Verified against the company’s certidão permanente — not self-declared. Build credibility on a free profile, find a co-founder you can trust, and get reached only through real connections.",
    ctaLabel: "Build my founder profile",
    ctaHref: "/register",
    points: [
      {
        title: "Verified against the registry",
        body: "Founder status is checked against the company’s certidão permanente, not typed in by you.",
      },
      {
        title: "A free profile that builds credibility",
        body: "A verification ladder shows what’s confirmed about you. From 50% you appear in Discover and can send connection requests.",
      },
      {
        title: "Set up in minutes",
        body: "Import your profile from LinkedIn instead of starting from scratch.",
      },
      {
        title: "Find a co-founder",
        body: "Co-founder matching with people who are who they say they are.",
      },
      {
        title: "No cold spam",
        body: "People reach you only through real connections.",
      },
    ],
    faqs: [
      {
        question: "How does Beedero verify founders?",
        answer:
          "Founder status is verified against the company’s certidão permanente from the commercial registry — not a self-declared checkbox.",
      },
      {
        question: "When do I appear in Discover?",
        answer:
          "When your verification ladder reaches 50%, you appear in Discover and can send connection requests.",
      },
      {
        question: "Can I import my LinkedIn profile?",
        answer:
          "Yes. Import from LinkedIn to set up your Beedero profile in minutes instead of starting from scratch.",
      },
    ],
  },
  {
    slug: "for-professionals",
    path: "/for-professionals",
    navLabel: "Talent & advisors",
    eyebrow: "For everyone on Beedero",
    title: "Free verified professional profiles — roles confirmed by organisations",
    description:
      "Free Beedero accounts with organisation-confirmed roles, verified startups to explore, better jobs including co-founder roles, and credibility without vanity metrics.",
    keywords: [
      "free professional network",
      "verified professional profile",
      "organisation confirmed roles",
      "startup jobs",
      "co-founder roles",
      "advisor network",
      "investor network",
      "Beedero professionals",
    ],
    h1: "A profile that means something.",
    lead: "Personal accounts are free, always. Your roles are confirmed by the organisations you work with. Trust every startup and company you find — and apply to roles worth your time.",
    ctaLabel: "Create my free profile",
    ctaHref: "/register",
    points: [
      {
        title: "Free, always",
        body: "Personal accounts cost nothing.",
      },
      {
        title: "Roles confirmed by organisations",
        body: "Your experience is confirmed by the organisations you work with, not typed in only by you.",
      },
      {
        title: "Trust what you see",
        body: "Every startup and company you find has been through a verification ladder.",
      },
      {
        title: "Better jobs",
        body: "Apply to roles at verified startups and companies, including co-founder roles.",
      },
      {
        title: "Credibility over vanity",
        body: "No public likes, no inbox noise, and your data is easy to export.",
      },
    ],
    faqs: [
      {
        question: "Is a Beedero personal account free?",
        answer:
          "Yes. Personal accounts are free and stay free. Organisations pay a separate subscription.",
      },
      {
        question: "How are roles verified?",
        answer:
          "Organisations on Beedero confirm your roles. That confirmation is what turns self-declared experience into attested credibility.",
      },
      {
        question: "Can I apply to jobs without paying?",
        answer:
          "Yes. Browse and apply to roles at verified startups and companies — including co-founder roles — from a free personal account.",
      },
    ],
  },
  {
    slug: "for-startups",
    path: "/for-startups",
    navLabel: "Startups",
    eyebrow: "For startups not yet incorporated",
    title: "Startup profiles from €33/year — verified without paperwork",
    description:
      "Launch a Beedero startup workspace from €33/year or €3/month (VAT included). Hand verification without incorporation, co-founder roles, private pre-seed asks and weekly momentum. First year free with EARLYADOPTER.",
    keywords: [
      "startup profile",
      "pre-seed fundraising",
      "co-founder roles",
      "startup verification",
      "startup workspace",
      "EARLYADOPTER",
      "€33 year startup",
      "Beedero startups",
    ],
    h1: "Verified without paperwork.",
    lead: "Beedero confirms your startup by hand, so you don’t need a company to be credible. Post co-founder roles, raise pre-seed in private, show momentum early — then grow into a company without starting over.",
    ctaLabel: "Create my startup",
    ctaHref: "/register",
    points: [
      {
        title: "Priced for the beginning",
        body: "€33/year or €3/month, VAT included. With the code EARLYADOPTER, the first year is free.",
      },
      {
        title: "Verified without paperwork",
        body: "Beedero confirms your startup by hand, so you don’t need a company to be credible.",
      },
      {
        title: "A Co-founders section",
        body: "Post co-founder roles and use co-founder matching, both from your workspace.",
      },
      {
        title: "Raise pre-seed in private",
        body: "Your ask and use of funds are seen only by verified investors.",
      },
      {
        title: "Show momentum early",
        body: "Weekly updates, events and jobs build a record investors can follow.",
      },
      {
        title: "Grow into a company without starting over",
        body: "When you incorporate, confirm your certidão permanente and keep all your history.",
      },
    ],
    faqs: [
      {
        question: "How much does a startup workspace cost on Beedero?",
        answer:
          "€33 per year or €3 per month, VAT included. With the promotional code EARLYADOPTER, the first year is free and no card is required.",
      },
      {
        question: "Can I be verified before incorporation?",
        answer:
          "Yes. Beedero verifies pre-incorporation startups by hand, so you can build credibility before you have a company.",
      },
      {
        question: "Who can see my fundraising ask?",
        answer:
          "Your ask and use of funds are visible only to verified investors — not to the public network.",
      },
    ],
  },
  {
    slug: "for-companies",
    path: "/for-companies",
    navLabel: "Companies",
    eyebrow: "For incorporated companies",
    title: "Registry-confirmed company pages — fundraising, hiring and trust",
    description:
      "Beedero company pages confirmed via certidão permanente. Full fundraising rounds, investor-confirmed track records, hiring with stock options and Insights. €99/year or €9/month; first year free with EARLYADOPTER.",
    keywords: [
      "company verification",
      "certidão permanente",
      "startup fundraising",
      "data room investors",
      "cap table",
      "hire with stock options",
      "verified company page",
      "Beedero companies",
      "€99 year company",
    ],
    h1: "Registry-confirmed. One link that does the work.",
    lead: "Your certidão permanente is checked against the commercial registry — no PDF uploads. Run full fundraising rounds, hire with stock options, and share a verified page investors, partners and candidates can trust.",
    ctaLabel: "Create my company page",
    ctaHref: "/register",
    points: [
      {
        title: "Registry-confirmed",
        body: "Your certidão permanente is checked against the commercial registry, with no PDF uploads.",
      },
      {
        title: "Full fundraising rounds",
        body: "Pre-seed, seed and Series A, with valuation, financials, data room and cap table shared only with verified investors.",
      },
      {
        title: "A track record no one can fake",
        body: "Investments count only when the investor confirms them.",
      },
      {
        title: "Hire with stock options",
        body: "Post every kind of role on a page candidates can trust.",
      },
      {
        title: "One link that does the work",
        body: "A verified page for investors, partners and candidates, with Insights on who’s paying attention.",
      },
      {
        title: "Simple pricing",
        body: "€99/year or €9/month, VAT included. With the code EARLYADOPTER, the first year is free.",
      },
    ],
    faqs: [
      {
        question: "How are companies verified on Beedero?",
        answer:
          "Incorporated companies are confirmed against the commercial registry via certidão permanente. There are no PDF uploads to fake.",
      },
      {
        question: "Who sees valuation, financials and the data room?",
        answer:
          "Fundraising materials — valuation, financials, data room and cap table — are shared only with verified investors.",
      },
      {
        question: "How much does a company workspace cost?",
        answer:
          "€99 per year or €9 per month, VAT included. With EARLYADOPTER, the first year is free.",
      },
    ],
  },
];

export function personaBySlug(slug: string): SeoPersona | undefined {
  return SEO_PERSONAS.find((persona) => persona.slug === slug);
}
