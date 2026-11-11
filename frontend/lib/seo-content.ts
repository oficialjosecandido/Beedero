/**
 * Canonical public copy — the one-line description, titles, descriptions,
 * keywords and the four audience pages.
 *
 * Two rules, because the site lost them once and read as filler:
 *  1. `ONE_LINER` is the only sentence that says what Beedero is. Every place
 *     that needs that sentence imports it instead of writing its own.
 *  2. Nothing here claims something the product does not do today. The
 *     registry check covers Portugal, investors are verified by hand, and
 *     there is no data export — so none of those are promised otherwise.
 */

export const SITE_NAME = "Beedero";

/** The description of Beedero. Used verbatim everywhere one is needed. */
export const ONE_LINER =
  "Beedero is a network for startups where companies, teams and investors are verified.";

/** Where the registry check works today. Said once per page that sells it. */
export const REGISTRY_SCOPE =
  "Company verification currently works for companies registered in Portugal.";

export const DEFAULT_TITLE =
  "A network for startups where companies, teams and investors are verified";

export const DEFAULT_DESCRIPTION = `${ONE_LINER} Personal accounts are free. Startups pay €33 a year, companies €99 a year, VAT included. ${REGISTRY_SCOPE}`;

/**
 * Where Beedero actually is. The home page and both empty directories read
 * this, so someone who lands on an empty Discover gets the real reason
 * instead of "check back soon".
 *
 * No counts on purpose: publishing "4 startups" would be worse than saying
 * beta. If you want real numbers, or the month Beedero opened, this sentence
 * is the only place that changes.
 */
export const BETA_STATUS =
  "Beedero is in beta. The first startups are setting up their pages now, so there is not much here yet — that is the honest state of it rather than a soft launch.";

export const SITE_KEYWORDS = [
  "Beedero",
  "verified startup network",
  "startup network",
  "company verification",
  "certidão permanente",
  "co-founder matching",
  "startup jobs",
  "pre-seed fundraising",
  "verified investors",
  "EARLYADOPTER",
] as const;

export type SeoPersona = {
  slug: "for-founders" | "for-professionals" | "for-startups" | "for-companies";
  path: string;
  navLabel: string;
  /** Page <title> (site name appended by pageMetadata). */
  title: string;
  /** Meta description ≤ ~160 chars for SERP snippets. */
  description: string;
  keywords: string[];
  h1: string;
  lead: string;
  ctaLabel: string;
  ctaHref: string;
  /** Three at most. Each one says a different thing. */
  points: { title: string; body: string }[];
  /** Questions people actually ask — not the points asked back. */
  faqs: { question: string; answer: string }[];
};

export const SEO_PERSONAS: SeoPersona[] = [
  {
    slug: "for-founders",
    path: "/for-founders",
    navLabel: "Founders",
    title: "Verified founder profiles",
    description:
      "Beedero checks founder status against the company's certidão permanente — nothing to upload. Free profile, LinkedIn import and co-founder matching. Currently for companies registered in Portugal.",
    keywords: [
      "verified founder profile",
      "founder verification",
      "certidão permanente founder",
      "co-founder matching",
      "LinkedIn import profile",
      "startup founder network",
    ],
    h1: "Verified founder profiles",
    // The one place on the site where the registry check is explained at
    // length, because this is the page about it.
    lead: "Beedero checks your founder status against your company's certidão permanente — the certificate the Portuguese commercial registry issues for every company. We read it ourselves, so there is nothing for you to upload and nothing for anyone to fake. For a startup with no company yet, we verify by hand instead.",
    ctaLabel: "Join",
    ctaHref: "/register",
    points: [
      {
        title: "Checked against the registry",
        body: "We read your company's certidão permanente from the commercial registry.",
      },
      {
        title: "Set up in minutes",
        body: "Import your profile from LinkedIn instead of typing it again.",
      },
      {
        title: "Find a co-founder",
        body: "Matching with people whose profiles went through the same checks as yours.",
      },
    ],
    faqs: [
      {
        question: "Do I need a Portuguese company?",
        answer: `${REGISTRY_SCOPE} If your company is registered elsewhere, you can still have a profile and a page — tell us and we will verify it by hand while we add your country.`,
      },
      {
        question: "What if I haven't incorporated yet?",
        answer:
          "Create a startup instead of a company. We verify it by hand, and when you do incorporate you confirm the certidão permanente and keep the page you already built.",
      },
      {
        question: "Can I import my LinkedIn profile?",
        answer: "Yes. Import from LinkedIn instead of typing everything again.",
      },
    ],
  },
  {
    slug: "for-professionals",
    path: "/for-professionals",
    navLabel: "Professionals",
    title: "Free profiles with roles your employer confirmed",
    description:
      "Personal accounts on Beedero are free and stay free. The organisations you work with confirm your roles, and you can apply to roles at startups and companies, co-founder roles included.",
    keywords: [
      "free professional network",
      "verified professional profile",
      "organisation confirmed roles",
      "startup jobs",
      "co-founder roles",
      "advisor network",
    ],
    h1: "Roles your employer confirmed",
    lead: "Personal accounts are free and stay free. The organisations you work with confirm your roles on Beedero, so a role on your profile carries their name as well as yours. Until one of them confirms it, the profile says so.",
    ctaLabel: "Join",
    ctaHref: "/register",
    points: [
      {
        title: "Free, always",
        body: "Personal accounts cost nothing. Only organisations pay.",
      },
      {
        title: "Roles confirmed by the organisation",
        body: "The company or startup you worked with confirms the role, and the profile shows which ones are confirmed.",
      },
      {
        title: "Roles worth applying to",
        body: "Apply to jobs at startups and companies on Beedero, co-founder roles included.",
      },
    ],
    faqs: [
      {
        question: "Is a personal account really free?",
        answer:
          "Yes, and it stays free. Organisations pay a subscription; people never do.",
      },
      {
        question: "What happens if an organisation doesn't confirm my role?",
        answer:
          "The role stays on your profile as your own statement, marked as unconfirmed. Nothing is deleted and nothing pretends to be verified.",
      },
      {
        question: "Can I apply to jobs without paying?",
        answer:
          "Yes. Browsing and applying are free, including co-founder roles.",
      },
    ],
  },
  {
    slug: "for-startups",
    path: "/for-startups",
    navLabel: "Startups",
    title: "Startup pages from €33 a year",
    description:
      "A verified startup page before you incorporate: €33 a year or €3 a month, VAT included, first year free with EARLYADOPTER. Co-founder roles and a pre-seed ask only verified investors see.",
    keywords: [
      "startup profile",
      "pre-seed fundraising",
      "co-founder roles",
      "startup verification",
      "startup workspace",
      "EARLYADOPTER",
    ],
    h1: "A verified page before you incorporate",
    lead: "A startup has no company for anyone to look up, so we verify it by hand: we read the page and check whether a company of that name already exists. €33 a year or €3 a month, VAT included — and with the code EARLYADOPTER the first year is free, with no card.",
    ctaLabel: "Create a startup",
    ctaHref: "/orgs/new?kind=startup",
    points: [
      {
        title: "Verified before there is a company",
        body: "We confirm the startup by hand, so the page can be credible before the paperwork exists.",
      },
      {
        title: "Co-founder roles",
        body: "Post the role you need a co-founder for, and use co-founder matching from the same workspace.",
      },
      {
        title: "A pre-seed ask that stays private",
        body: "Your ask and use of funds are visible only to investors Beedero has verified by hand.",
      },
    ],
    faqs: [
      {
        question: "How much does it cost?",
        answer:
          "€33 a year or €3 a month, VAT included. With the code EARLYADOPTER the first year is free and no card is required.",
      },
      {
        question: "What happens when I incorporate?",
        answer:
          "Confirm the certidão permanente from your workspace and the page becomes a company page, keeping everything you built. The company price applies from a renewal at least 30 days after we tell you.",
      },
      {
        question: "Who can see my fundraising ask?",
        answer:
          "Only investors Beedero has verified. Investor verification is done by hand, one person at a time.",
      },
    ],
  },
  {
    slug: "for-companies",
    path: "/for-companies",
    navLabel: "Companies",
    title: "Company pages confirmed against the commercial registry",
    description:
      "Beedero confirms your company against its certidão permanente. Fundraising rounds and a cap table only verified investors see, hiring with stock options, €99 a year or €9 a month.",
    keywords: [
      "company verification",
      "certidão permanente",
      "startup fundraising",
      "data room investors",
      "cap table",
      "hire with stock options",
      "verified company page",
    ],
    h1: "Confirmed against the commercial registry",
    lead: `We check your company against its certidão permanente, so the page says what the registry says. Run a fundraising round, hire, and share one page investors, partners and candidates can look up. €99 a year or €9 a month, VAT included. ${REGISTRY_SCOPE}`,
    ctaLabel: "Create a company",
    ctaHref: "/orgs/new?kind=company",
    points: [
      {
        title: "Confirmed against the registry",
        body: "We read your certidão permanente ourselves. There is nothing to upload.",
      },
      {
        title: "A round only verified investors see",
        body: "Valuation, financials, data room and cap table go to investors Beedero has verified, not to the network.",
      },
      {
        title: "Hiring, stock options included",
        body: "Job posts can state the equity on offer, on a page a candidate can look up before replying.",
      },
    ],
    faqs: [
      {
        question: "How are companies verified?",
        answer: `We check the company against its certidão permanente from the commercial registry. ${REGISTRY_SCOPE}`,
      },
      {
        question: "Who sees valuation, financials and the data room?",
        answer:
          "Only investors Beedero has verified by hand. Nothing in the fundraising section is public.",
      },
      {
        question: "How much does it cost?",
        answer:
          "€99 a year or €9 a month, VAT included. With EARLYADOPTER the first year is free.",
      },
    ],
  },
];

export function personaBySlug(slug: string): SeoPersona | undefined {
  return SEO_PERSONAS.find((persona) => persona.slug === slug);
}
