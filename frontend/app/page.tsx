import Link from "next/link";

import { WebsiteJsonLd } from "@/components/WebsiteJsonLd";
import { CREDIBILITY_LEVEL_LABELS } from "@/lib/credibility";
import { getAccessToken, getRefreshToken } from "@/lib/session";
import { pageMetadata } from "@/lib/site-metadata";

export const metadata = pageMetadata({
  title: "The trusted network for founders, experts and investors",
  description:
    "Beedero brings founders, experts, investors and organisations into one professional network. Build your profile, create an organisation, find people, hire, raise investment — with verification underneath when trust matters.",
  path: "/",
  keywords: [
    "professional network",
    "startup network",
    "founders",
    "investors",
    "advisors",
    "startup discovery",
    "verified company profile",
  ],
});

/** The four roles the product actually models: a personal profile
 *  (accounts.InvestorProfile), org membership (orgs.OrgMembership),
 *  advisory availability (advisory.AdvisorProfile) and investor focus
 *  fields. Nothing here describes a feature that doesn't exist yet. */
const ROLES = [
  {
    title: "Founders",
    line: "Building a company and looking for people, talent and capital.",
  },
  {
    title: "Experts",
    line: "Available for advisory, board or fractional work.",
  },
  {
    title: "Investors",
    line: "Looking for companies worth a first conversation.",
  },
  {
    title: "Organisations",
    line: "Teams that want a presence, a following and a way to be found.",
  },
] as const;

/** Each of these maps to a shipped capability — profiles, connections,
 *  messaging, jobs, org activity feeds, advisory availability, fundraising
 *  sections. Kept as claims about what you can do, not what you'll get. */
const OPPORTUNITIES = [
  {
    title: "Find people",
    text: "Search founders, experts and investors, then connect and message them directly.",
  },
  {
    title: "Build an organisation",
    text: "Create one, invite your team, give people roles, and publish what you're doing.",
  },
  {
    title: "Hire",
    text: "Post roles — full-time, contract, co-founder or advisor — and take applications.",
  },
  {
    title: "Get advisory work",
    text: "Mark yourself available for advisory, board or fractional roles, with your sectors and stages.",
  },
  {
    title: "Raise investment",
    text: "Signal that you're fundraising and open the round detail to the investors you choose.",
  },
  {
    title: "Build a following",
    text: "Publish news, milestones, events and awards to the people already following you.",
  },
];

const STEPS = [
  {
    n: 1,
    title: "Create your profile",
    text: "Your headline, skills, links and experience, on your own handle. Takes a few minutes.",
  },
  {
    n: 2,
    title: "Create or join an organisation",
    text: "Start one and invite your team, or get added to one that already exists.",
  },
  {
    n: 3,
    title: "Connect",
    text: "Follow organisations, connect with people, and message the ones worth talking to.",
  },
  {
    n: 4,
    title: "Grow",
    text: "Publish what you're doing, get discovered, hire, and raise when the time comes.",
  },
] as const;

/** The `checks` line names the exact evidence, per the product rule in
 *  credibility/models.py: badge copy states what was verified, never vague
 *  trust language. Labels come from lib/credibility so marketing can't
 *  drift from what the product awards. */
const LADDER = [
  {
    level: 1,
    checks: "Company registry certificate, and your role as founder confirmed against the register.",
  },
  {
    level: 2,
    checks: "Tax authority and social-security standing, both confirmed clear.",
  },
  {
    level: 3,
    checks: "Annual accounts exactly as filed — not a number typed into a form.",
  },
  {
    level: 4,
    checks: "A live revenue signal from Stripe, open banking, or e-invoicing.",
  },
] as const;

const CONTROL = [
  {
    title: "Field by field",
    text: "Every field is public, restricted, or private on its own. Your headcount can be open while your runway stays shut.",
  },
  {
    title: "Grants that expire",
    text: "Open a restricted field to one person, one firm, or a whole role — verified investors, say — and set the date it closes again.",
  },
  {
    title: "You see who looked",
    text: "Every view of a restricted field is logged. Opening your numbers to someone is never the same as losing track of them.",
  },
];

const FAQ = [
  {
    q: "Who is Beedero for?",
    a: "Founders, experts, investors and the organisations they build. You join as a person first — the organisation comes after, if you have one.",
  },
  {
    q: "Do I need to have a startup?",
    a: "No. A personal profile stands on its own. Any signed-in member can create an organisation, and you don't have to be fundraising to have one.",
  },
  {
    q: "Can I get found for advisory work?",
    a: "Yes. Mark yourself available for advisory, board or fractional engagements and add your expertise, sectors and stages so founders can find you.",
  },
  {
    q: "Can startups raise investment here?",
    a: "Yes. Flag that you're fundraising, then share round detail — valuation, the ask, use of funds, financials, data room — with the investors you choose, and close it again afterwards.",
  },
  {
    q: "Do I have to get verified?",
    a: "No. Verification is optional. It adds a signal others can check, and it sits under the network rather than being the price of entry.",
  },
  {
    q: "Who can see my information?",
    a: "You decide per field: public, restricted, or private. Restricted access is granted to specific people or roles, expires on a date you set, and every view is logged for you to read.",
  },
  {
    q: "What does it cost?",
    a: "Everything described on this page is free today — profiles, organisations, publishing, verification, messaging and search.",
  },
];

export default async function Home() {
  // Reading cookies() here (via getAccessToken/getRefreshToken) opts this
  // page into per-request dynamic rendering — needed since the nav CTA
  // depends on the visitor's session rather than being the same for everyone.
  const authed = Boolean((await getAccessToken()) || (await getRefreshToken()));

  const primaryCta = authed
    ? { href: "/feed", label: "Enter Beedero" }
    : { href: "/register", label: "Join Beedero" };

  const NAV_LINKS = [
    { href: "#who-its-for", label: "Who it's for" },
    { href: "#how-it-works", label: "How it works" },
    { href: "#trust", label: "Trust" },
    { href: "/startups", label: "Discover" },
  ];

  return (
    <main className="min-h-screen bg-beedero-black text-beedero-white">
      <WebsiteJsonLd />
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/" className="text-lg font-black uppercase tracking-[-0.04em]">
          Beedero
        </Link>

        <div className="hidden items-center gap-6 text-sm font-semibold uppercase tracking-[-0.02em] text-beedero-white/70 lg:flex">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-beedero-white">
              {link.label}
            </Link>
          ))}
          {authed ? (
            <Link
              href="/feed"
              className="rounded-full bg-beedero-yellow px-5 py-2 text-beedero-black hover:bg-beedero-white"
            >
              Enter Beedero
            </Link>
          ) : (
            <>
              <Link href="/login" className="hover:text-beedero-white">
                Login
              </Link>
              <Link
                href="/register"
                className="rounded-full bg-beedero-yellow px-5 py-2 text-beedero-black hover:bg-beedero-white"
              >
                Join
              </Link>
            </>
          )}
        </div>

        <details className="group relative lg:hidden">
          <summary className="list-none rounded-full border border-beedero-white/25 px-4 py-2 text-sm font-bold uppercase tracking-[-0.02em] text-beedero-white marker:hidden hover:bg-beedero-yellow hover:text-beedero-black">
            Menu
          </summary>
          <div className="absolute right-0 z-20 mt-3 flex w-56 flex-col rounded-2xl border border-beedero-white/10 bg-beedero-white p-2 text-beedero-black shadow-2xl">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-xl px-3 py-2 text-sm font-bold hover:bg-beedero-yellow"
              >
                {link.label}
              </Link>
            ))}
            {authed ? (
              <Link
                href="/feed"
                className="rounded-xl bg-beedero-yellow px-3 py-2 text-sm font-black hover:bg-beedero-black hover:text-beedero-white"
              >
                Enter Beedero
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-xl px-3 py-2 text-sm font-bold hover:bg-beedero-yellow"
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  className="rounded-xl bg-beedero-yellow px-3 py-2 text-sm font-black hover:bg-beedero-black hover:text-beedero-white"
                >
                  Join
                </Link>
              </>
            )}
          </div>
        </details>
      </nav>

      {/* ---------------------------------------------------------------- Hero */}
      <section className="relative isolate overflow-hidden px-5 pb-20 pt-12 sm:px-8 sm:pb-28 lg:pt-20">
        <div className="absolute left-1/2 top-12 -z-10 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-beedero-yellow/20 blur-3xl" />
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-center">
          {/* min-w-0 guards against grid's default min-width:auto, which would
              stop this column shrinking below its min-content width if the
              display type ever grows past the viewport. */}
          <div className="min-w-0">
            <p className="mb-5 inline-flex rounded-full border border-beedero-white/15 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-beedero-yellow">
              A network built on trust
            </p>
            {/* Fluid rather than stepped: at display sizes a fixed mobile step
                overflows before the next breakpoint catches it. */}
            {/* Max capped at 5.25rem rather than the old 8.5rem: this headline is
                twice as long as the one it replaced, and at display size it ran to
                four lines and pushed the CTAs under the fold on a laptop. The
                2.9rem floor is what mobile actually renders, so phones are
                unaffected by the cap. */}
            <h1 className="max-w-4xl text-[clamp(2.9rem,7vw,5.25rem)] font-black uppercase leading-[0.85] tracking-[-0.07em]">
              Build your network. Grow your business.
            </h1>
            <p className="mt-8 max-w-2xl text-lg font-medium leading-8 text-beedero-white/70 sm:text-xl">
              Founders, experts, investors and organisations in one professional network. Find
              people, build a company, take on advisory work, hire, and raise — with verification
              underneath for the moments trust actually has to hold.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Link
                href={primaryCta.href}
                className="rounded-full bg-beedero-yellow px-8 py-4 text-center text-sm font-black uppercase tracking-[-0.02em] text-beedero-black hover:bg-beedero-white"
              >
                {primaryCta.label}
              </Link>
              <Link
                href="/startups"
                className="rounded-full border border-beedero-white/25 px-8 py-4 text-center text-sm font-black uppercase tracking-[-0.02em] text-beedero-white hover:border-beedero-white hover:bg-beedero-white hover:text-beedero-black"
              >
                Explore the network
              </Link>
            </div>
            <p className="mt-5 text-sm font-medium text-beedero-white/50">
              Free to join. Browse organisations without an account.
            </p>
          </div>

          {/* The roles card, rather than the credibility ladder: the first thing
              a visitor should learn is who is here, not how auditing works. */}
          <div className="rounded-[2rem] border border-beedero-white/10 bg-beedero-white p-3 text-beedero-black shadow-2xl shadow-beedero-yellow/10">
            <div className="rounded-[1.5rem] bg-beedero-yellow px-6 py-7">
              <p className="text-xs font-black uppercase tracking-[0.2em]">Who you&apos;ll meet</p>
              <ul className="mt-5 flex flex-col gap-2">
                {ROLES.map((role) => (
                  <li
                    key={role.title}
                    className="rounded-2xl bg-beedero-black px-5 py-4 text-beedero-white"
                  >
                    <p className="text-sm font-black uppercase tracking-[-0.02em] text-beedero-yellow">
                      {role.title}
                    </p>
                    <p className="mt-1 text-sm font-medium leading-6 text-beedero-white/70">
                      {role.line}
                    </p>
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-xs font-bold uppercase leading-5 tracking-[0.08em] text-beedero-black/60">
                One profile. However many of these you happen to be.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- Who it's for */}
      <section
        id="who-its-for"
        className="scroll-mt-8 bg-beedero-white px-5 py-16 text-beedero-black sm:px-8 sm:py-24"
      >
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-end">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-beedero-black/50">
                One network. Many goals.
              </p>
              <h2 className="mt-4 text-[clamp(2.1rem,7vw,4.5rem)] font-black uppercase leading-[0.9] tracking-[-0.07em]">
                Everyone joins for a different reason.
              </h2>
            </div>
            <div className="flex flex-col gap-5 text-lg font-medium leading-8 text-beedero-black/70">
              <p>
                A founder is looking for a first investor. An investor is looking for the next
                company. An expert is looking for the board seat. Someone else just wants their
                organisation to exist somewhere credible.
              </p>
              <p className="font-bold text-beedero-black">
                Beedero puts all of them in the same place, and gives you the controls to decide who
                sees what.
              </p>
            </div>
          </div>

          <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {ROLES.map((role) => (
              <article
                key={role.title}
                className="rounded-[1.5rem] border border-beedero-border bg-beedero-yellow/20 p-6"
              >
                <h3 className="text-2xl font-black uppercase tracking-[-0.06em]">{role.title}</h3>
                <p className="mt-4 text-sm font-medium leading-6 text-beedero-black/70">
                  {role.line}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------- Opportunities */}
      <section className="px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-beedero-yellow">
            What you can do here
          </p>
          <h2 className="mt-4 max-w-4xl text-[clamp(2.1rem,7vw,4.5rem)] font-black uppercase leading-[0.9] tracking-[-0.07em]">
            A profile is the start, not the point.
          </h2>

          <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {OPPORTUNITIES.map((item) => (
              <article
                key={item.title}
                className="rounded-[1.5rem] border border-beedero-white/10 bg-beedero-white/[0.04] p-7"
              >
                <h3 className="text-2xl font-black uppercase tracking-[-0.06em] text-beedero-yellow">
                  {item.title}
                </h3>
                <p className="mt-4 text-sm font-medium leading-6 text-beedero-white/65">
                  {item.text}
                </p>
              </article>
            ))}
          </div>

          <p className="mt-8 max-w-3xl text-base font-medium leading-7 text-beedero-white/60">
            You don&apos;t have to be a startup, and you don&apos;t have to be raising. Anyone with a
            profile can create an organisation and bring their team into it.
          </p>
        </div>
      </section>

      {/* --------------------------------------------------------- How it works */}
      <section
        id="how-it-works"
        className="scroll-mt-8 bg-beedero-white px-5 py-16 text-beedero-black sm:px-8 sm:py-24"
      >
        <div className="mx-auto max-w-7xl">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-beedero-black/50">
            How Beedero works
          </p>
          <h2 className="mt-4 max-w-4xl text-[clamp(2.1rem,7vw,4.5rem)] font-black uppercase leading-[0.9] tracking-[-0.07em]">
            Build your presence. Find your people.
          </h2>

          <ol className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step) => (
              <li
                key={step.n}
                className="flex flex-col rounded-[1.5rem] border border-beedero-border bg-beedero-yellow/20 p-7"
              >
                <span
                  aria-hidden="true"
                  className="text-5xl font-black tabular-nums leading-none tracking-[-0.08em] text-beedero-black/30"
                >
                  {step.n}
                </span>
                <h3 className="mt-4 text-xl font-black uppercase leading-6 tracking-[-0.05em]">
                  <span className="sr-only">Step {step.n}: </span>
                  {step.title}
                </h3>
                <p className="mt-3 text-sm font-medium leading-6 text-beedero-black/70">
                  {step.text}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ------------------------------------------------------------ Discovery */}
      <section className="px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-beedero-yellow">
                Discover
              </p>
              <h2 className="mt-4 text-[clamp(1.9rem,6vw,3.75rem)] font-black uppercase leading-[0.9] tracking-[-0.07em]">
                Find people and organisations worth knowing.
              </h2>
              <p className="mt-6 max-w-xl text-lg font-medium leading-8 text-beedero-white/70">
                Browse organisations by sector, stage and location without an account at all. People
                search, filters and your own feed open up the moment you join.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/startups"
                  className="rounded-full border border-beedero-white/25 px-8 py-4 text-center text-sm font-black uppercase tracking-[-0.02em] text-beedero-white hover:border-beedero-white hover:bg-beedero-white hover:text-beedero-black"
                >
                  Explore organisations
                </Link>
                <Link
                  href={primaryCta.href}
                  className="rounded-full bg-beedero-yellow px-8 py-4 text-center text-sm font-black uppercase tracking-[-0.02em] text-beedero-black hover:bg-beedero-white"
                >
                  {primaryCta.label}
                </Link>
              </div>
            </div>
            <div className="rounded-[2rem] border border-beedero-white/10 bg-beedero-white/[0.04] p-8">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-beedero-white/50">
                Search by
              </p>
              <ul className="mt-5 flex flex-wrap gap-2">
                {["Sector", "Stage", "Location", "Expertise", "Skills", "Fundraising", "Role"].map(
                  (facet) => (
                    <li
                      key={facet}
                      className="rounded-full border border-beedero-yellow/30 bg-beedero-yellow/10 px-4 py-2 text-sm font-bold uppercase tracking-[-0.02em] text-beedero-yellow"
                    >
                      {facet}
                    </li>
                  ),
                )}
              </ul>
              <p className="mt-6 text-sm font-medium leading-6 text-beedero-white/60">
                Follow an organisation and its news, milestones and events land in your feed as they
                happen — not in a quarterly update nobody reads.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- Trust layer */}
      <section
        id="trust"
        className="scroll-mt-8 bg-beedero-white px-5 py-16 text-beedero-black sm:px-8 sm:py-24"
      >
        <div className="mx-auto max-w-7xl">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-beedero-black/50">
            Trust layer
          </p>
          <h2 className="mt-4 max-w-4xl text-[clamp(2.1rem,7vw,4.5rem)] font-black uppercase leading-[0.9] tracking-[-0.07em]">
            Know who you&apos;re dealing with.
          </h2>
          <p className="mt-6 max-w-2xl text-lg font-medium leading-8 text-beedero-black/70">
            Optional, and entirely yours to start. An organisation can add verified signals — each
            one checked against an official record rather than typed into a form — for the moments
            where a claim isn&apos;t enough.
          </p>

          <ol className="mt-12 grid gap-3 sm:grid-cols-2">
            {LADDER.map(({ level, checks }) => (
              <li
                key={level}
                className="flex flex-col rounded-[1.5rem] border border-beedero-border bg-beedero-yellow/20 p-7"
              >
                <div className="flex items-baseline gap-3">
                  <span
                    aria-hidden="true"
                    className="text-5xl font-black tabular-nums leading-none tracking-[-0.08em] text-beedero-black/30"
                  >
                    {level}
                  </span>
                  <h3 className="text-2xl font-black uppercase tracking-[-0.06em]">
                    <span className="sr-only">Level {level}: </span>
                    {CREDIBILITY_LEVEL_LABELS[level]}
                  </h3>
                </div>
                <p className="mt-4 text-sm font-medium leading-6 text-beedero-black/70">{checks}</p>
              </li>
            ))}
          </ol>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <p className="rounded-[1.5rem] border-2 border-beedero-black bg-beedero-black p-7 text-sm font-medium leading-6 text-beedero-white/75">
              <strong className="font-black uppercase tracking-[-0.02em] text-beedero-yellow">
                The rungs are in order.
              </strong>{" "}
              Filed accounts don&apos;t count for anything until identity and compliance are done.
              Nobody skips to the top.
            </p>
            <p className="rounded-[1.5rem] border-2 border-beedero-black bg-beedero-black p-7 text-sm font-medium leading-6 text-beedero-white/75">
              <strong className="font-black uppercase tracking-[-0.02em] text-beedero-yellow">
                Nothing is verified forever.
              </strong>{" "}
              Levels are recalculated from live certificates. Let one expire and you drop back
              automatically — which is what makes the badge worth reading.
            </p>
          </div>

          <p className="mt-8 text-lg font-black uppercase tracking-[-0.04em] text-beedero-black">
            Verification strengthens the network. It isn&apos;t the network.
          </p>
        </div>
      </section>

      {/* --------------------------------------------------------------- Control */}
      <section className="px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-beedero-yellow">
                You control your information
              </p>
              <h2 className="mt-4 text-[clamp(2.1rem,7vw,4.5rem)] font-black uppercase leading-[0.9] tracking-[-0.07em]">
                Trust doesn&apos;t require oversharing.
              </h2>
              <p className="mt-6 max-w-md text-lg font-medium leading-8 text-beedero-white/70">
                Choose what&apos;s public, what&apos;s private, and what you open to specific people
                — for a limited time.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {CONTROL.map((item) => (
                <article
                  key={item.title}
                  className="rounded-[1.5rem] border border-beedero-white/10 bg-beedero-white/[0.04] p-6"
                >
                  <h3 className="text-2xl font-black uppercase tracking-[-0.06em] text-beedero-yellow">
                    {item.title}
                  </h3>
                  <p className="mt-4 text-sm font-medium leading-6 text-beedero-white/65">
                    {item.text}
                  </p>
                </article>
              ))}
              <article className="rounded-[1.5rem] border-2 border-beedero-yellow bg-beedero-yellow p-6 text-beedero-black">
                <h3 className="text-2xl font-black uppercase tracking-[-0.06em]">
                  Proof you can embed
                </h3>
                <p className="mt-4 text-sm font-medium leading-6 text-beedero-black/70">
                  Put your badge on your own site and link to a public verification page anyone can
                  check. It mirrors your live level — so it can never quietly overstate you.
                </p>
              </article>
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------- Fundraising / work */}
      <section className="bg-beedero-white px-5 py-16 text-beedero-black sm:px-8 sm:py-24">
        <div className="mx-auto grid max-w-7xl gap-3 lg:grid-cols-2">
          <article className="rounded-[2rem] border border-beedero-border bg-beedero-yellow/20 p-8 sm:p-10">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-beedero-black/50">
              Fundraising
            </p>
            <h2 className="mt-4 text-[clamp(1.9rem,5vw,3rem)] font-black uppercase leading-[0.9] tracking-[-0.07em]">
              Raise with context, not just a deck.
            </h2>
            <p className="mt-6 text-base font-medium leading-7 text-beedero-black/70">
              Build the profile over months, gather followers, publish milestones as you hit them —
              then flag that you&apos;re raising. Investors meet a company with a history, not a PDF
              that appeared last Tuesday. Round detail stays restricted until you open it.
            </p>
          </article>

          <article className="rounded-[2rem] border-2 border-beedero-black bg-beedero-black p-8 text-beedero-white sm:p-10">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-beedero-white/50">
              For experts
            </p>
            <h2 className="mt-4 text-[clamp(1.9rem,5vw,3rem)] font-black uppercase leading-[0.9] tracking-[-0.07em] text-beedero-yellow">
              Turn experience into opportunities.
            </h2>
            <p className="mt-6 text-base font-medium leading-7 text-beedero-white/70">
              Set yourself available for advisory, board or fractional work and say which sectors and
              stages you know. Founders searching for someone with exactly your background can find
              you and message you directly.
            </p>
          </article>
        </div>
      </section>

      {/* ------------------------------------------------------------------ FAQ */}
      <section className="px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-[clamp(1.9rem,6vw,3.75rem)] font-black uppercase leading-[0.9] tracking-[-0.07em]">
            Before you sign up
          </h2>
          <div className="mt-10 flex flex-col gap-3">
            {FAQ.map((item) => (
              <details
                key={item.q}
                className="group rounded-[1.25rem] border border-beedero-white/10 bg-beedero-white/[0.04] px-6 py-5"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-black uppercase tracking-[-0.03em] marker:hidden">
                  {item.q}
                  <span
                    aria-hidden="true"
                    className="text-2xl font-black leading-none text-beedero-white/40 transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-4 text-base font-medium leading-7 text-beedero-white/65">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ Final CTA */}
      <section className="px-5 pb-16 sm:px-8 sm:pb-24">
        <div className="mx-auto max-w-7xl rounded-[2rem] border-2 border-beedero-yellow bg-beedero-yellow p-8 text-beedero-black sm:p-12">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-beedero-black/50">
                Start now
              </p>
              <h2 className="mt-4 max-w-4xl text-[clamp(1.9rem,6vw,3.75rem)] font-black uppercase leading-[0.9] tracking-[-0.07em]">
                Who will you meet on Beedero?
              </h2>
              <p className="mt-5 max-w-xl text-base font-medium leading-7 text-beedero-black/70">
                Build your profile, join the network, and start creating opportunities. Free, and it
                takes a few minutes.
              </p>
            </div>
            <Link
              href={primaryCta.href}
              className="rounded-full bg-beedero-black px-8 py-4 text-center text-sm font-black uppercase tracking-[-0.02em] text-beedero-white hover:bg-beedero-white hover:text-beedero-black"
            >
              {primaryCta.label}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
