import Link from "next/link";

import { WebsiteJsonLd } from "@/components/WebsiteJsonLd";
import { CREDIBILITY_LEVEL_LABELS } from "@/lib/credibility";
import { getAccessToken, getRefreshToken } from "@/lib/session";
import { pageMetadata } from "@/lib/site-metadata";

export const metadata = pageMetadata({
  title: "Verified company profiles, checked against official records",
  description:
    "Beedero verifies your company against the company registry, tax and social-security standing, filed accounts, and live revenue — then keeps that proof current. Share one link instead of re-sending the same documents.",
  path: "/",
  keywords: [
    "verified company profile",
    "startup verification",
    "company registry verification",
    "due diligence",
    "startup discovery",
    "founders",
    "investors",
  ],
});

/** The four rungs of the credibility ladder. Labels come from the same
 *  source the badge and dashboard use, so marketing copy can't drift from
 *  what the product actually awards. The `checks` line describes exactly
 *  what is verified — the product rule is to name the evidence, never to
 *  fall back on vague trust language. */
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

const FOUNDER_POINTS = [
  "Verify once, then reuse it for a bank, a client, a public tender, or an investor.",
  "Publish updates, milestones, roles, and fundraising to people already following you.",
  "Keep sensitive numbers restricted, and see exactly who opened them.",
];

const INVESTOR_POINTS = [
  "Search companies whose identity and compliance are already checked.",
  "Start diligence from filed accounts and live revenue instead of a pitch deck.",
  "Follow companies and get their milestones as they happen.",
];

const FAQ = [
  {
    q: "What does it cost?",
    a: "Creating your profile, getting verified, publishing updates, and searching companies are all free today.",
  },
  {
    q: "What do I need to get started?",
    a: "Level 1 needs your company registry details and confirmation of your role. You can create a profile first and climb the ladder whenever you're ready — there's no requirement to finish everything at once.",
  },
  {
    q: "Who can see my documents?",
    a: "Nobody. Documents are checked and then held in private storage — the profile shows the verified outcome and the date, never the file itself.",
  },
  {
    q: "What happens when a certificate expires?",
    a: "Your level drops automatically until you renew it. That is the point: a badge that can quietly go stale is worth nothing to the person reading it.",
  },
  {
    q: "Do I have to be a startup?",
    a: "No. Companies of any kind can be verified, and individual professionals can add credentials confirmed with their professional body.",
  },
];

export default async function Home() {
  // Reading cookies() here (via getAccessToken/getRefreshToken) opts this
  // page into per-request dynamic rendering — needed since the nav CTA
  // depends on the visitor's session rather than being the same for everyone.
  const authed = Boolean((await getAccessToken()) || (await getRefreshToken()));

  const primaryCta = authed
    ? { href: "/feed", label: "Enter Beedero" }
    : { href: "/register", label: "Create your profile" };

  return (
    <main className="min-h-screen bg-beedero-black text-beedero-white">
      <WebsiteJsonLd />
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/" className="text-lg font-black uppercase tracking-[-0.04em]">
          Beedero
        </Link>

        <div className="hidden items-center gap-6 text-sm font-semibold uppercase tracking-[-0.02em] text-beedero-white/70 sm:flex">
          <Link href="#how-it-works" className="hover:text-beedero-white">
            How it works
          </Link>
          <Link href="/startups" className="hover:text-beedero-white">
            Discovery
          </Link>
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

        <details className="group relative sm:hidden">
          <summary className="list-none rounded-full border border-beedero-white/25 px-4 py-2 text-sm font-bold uppercase tracking-[-0.02em] text-beedero-white marker:hidden hover:bg-beedero-yellow hover:text-beedero-black">
            Menu
          </summary>
          <div className="absolute right-0 z-20 mt-3 flex w-52 flex-col rounded-2xl border border-beedero-white/10 bg-beedero-white p-2 text-beedero-black shadow-2xl">
            <Link
              href="#how-it-works"
              className="rounded-xl px-3 py-2 text-sm font-bold hover:bg-beedero-yellow"
            >
              How it works
            </Link>
            <Link
              href="/startups"
              className="rounded-xl px-3 py-2 text-sm font-bold hover:bg-beedero-yellow"
            >
              Discovery
            </Link>
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
              Checked against official records
            </p>
            {/* Fluid rather than stepped: at display sizes a fixed mobile step
                overflows before the next breakpoint catches it. */}
            <h1 className="max-w-4xl text-[clamp(2.9rem,10vw,8.5rem)] font-black uppercase leading-[0.82] tracking-[-0.08em]">
              Anyone can claim it. You can prove it.
            </h1>
            <p className="mt-8 max-w-2xl text-lg font-medium leading-8 text-beedero-white/70 sm:text-xl">
              Beedero checks your company against the registry, tax and social-security standing,
              filed accounts, and live revenue — then keeps that proof current. So it&apos;s still
              true on the day someone actually looks.
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
                Browse verified companies
              </Link>
            </div>
            <p className="mt-5 text-sm font-medium text-beedero-white/50">
              Free to create and verify. Investors search free too.
            </p>
          </div>

          {/* The ladder doubles as the hero visual: it explains the product
              faster than any description of it does. */}
          <div className="rounded-[2rem] border border-beedero-white/10 bg-beedero-white p-3 text-beedero-black shadow-2xl shadow-beedero-yellow/10">
            <div className="rounded-[1.5rem] bg-beedero-yellow px-6 py-7">
              <p className="text-xs font-black uppercase tracking-[0.2em]">
                The credibility ladder
              </p>
              <ol className="mt-5 flex flex-col gap-2">
                {LADDER.map(({ level }) => (
                  <li
                    key={level}
                    className="flex items-center gap-4 rounded-2xl bg-beedero-black px-5 py-4 text-beedero-white"
                  >
                    <span
                      aria-hidden="true"
                      className="text-2xl font-black tabular-nums leading-none tracking-[-0.06em] text-beedero-yellow"
                    >
                      {level}
                    </span>
                    <span className="text-sm font-black uppercase tracking-[-0.02em]">
                      <span className="sr-only">Level {level}: </span>
                      {CREDIBILITY_LEVEL_LABELS[level]}
                    </span>
                  </li>
                ))}
              </ol>
              <p className="mt-5 text-xs font-bold uppercase leading-5 tracking-[0.08em] text-beedero-black/60">
                Each rung expires. Let one lapse and the level drops on its own.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- Problem */}
      <section className="bg-beedero-white px-5 py-16 text-beedero-black sm:px-8 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-end">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-beedero-black/50">
                The problem
              </p>
              <h2 className="mt-4 text-[clamp(2.1rem,7vw,4.5rem)] font-black uppercase leading-[0.9] tracking-[-0.07em]">
                Every deal starts from zero.
              </h2>
            </div>
            <div className="flex flex-col gap-5 text-lg font-medium leading-8 text-beedero-black/70">
              <p>
                The bank wants a registry certificate. The tender wants tax and social-security
                clearance. The investor wants the accounts. You send the same documents again and
                again — and every one of them starts going out of date the moment it leaves your
                outbox.
              </p>
              <p className="font-bold text-beedero-black">
                Beedero verifies it once, keeps it live, and gives you a single link to share.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- How it works */}
      <section id="how-it-works" className="scroll-mt-8 px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-beedero-yellow">
            How it works
          </p>
          <h2 className="mt-4 max-w-4xl text-[clamp(2.1rem,7vw,4.5rem)] font-black uppercase leading-[0.9] tracking-[-0.07em]">
            Four levels. Every one checked, not claimed.
          </h2>

          <ol className="mt-12 grid gap-3 sm:grid-cols-2">
            {LADDER.map(({ level, checks }) => (
              <li
                key={level}
                className="flex flex-col rounded-[1.5rem] border border-beedero-white/10 bg-beedero-white/[0.04] p-7"
              >
                <div className="flex items-baseline gap-3">
                  <span
                    aria-hidden="true"
                    className="text-5xl font-black tabular-nums leading-none tracking-[-0.08em] text-beedero-yellow"
                  >
                    {level}
                  </span>
                  <h3 className="text-2xl font-black uppercase tracking-[-0.06em]">
                    <span className="sr-only">Level {level}: </span>
                    {CREDIBILITY_LEVEL_LABELS[level]}
                  </h3>
                </div>
                <p className="mt-4 text-sm font-medium leading-6 text-beedero-white/65">{checks}</p>
              </li>
            ))}
          </ol>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <p className="rounded-[1.5rem] border border-beedero-yellow/30 bg-beedero-yellow/10 p-7 text-sm font-medium leading-6 text-beedero-white/80">
              <strong className="font-black uppercase tracking-[-0.02em] text-beedero-yellow">
                The rungs are in order.
              </strong>{" "}
              Filed accounts don&apos;t count for anything until identity and compliance are done.
              Nobody skips to the top.
            </p>
            <p className="rounded-[1.5rem] border border-beedero-yellow/30 bg-beedero-yellow/10 p-7 text-sm font-medium leading-6 text-beedero-white/80">
              <strong className="font-black uppercase tracking-[-0.02em] text-beedero-yellow">
                Nothing is verified forever.
              </strong>{" "}
              Levels are recalculated from live certificates. Let one expire and you drop back
              automatically — which is what makes the badge worth reading.
            </p>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------------- Control */}
      <section className="bg-beedero-white px-5 py-16 text-beedero-black sm:px-8 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-beedero-black/50">
                Control
              </p>
              <h2 className="mt-4 text-[clamp(2.1rem,7vw,4.5rem)] font-black uppercase leading-[0.9] tracking-[-0.07em]">
                Verified doesn&apos;t mean public.
              </h2>
              <p className="mt-6 max-w-md text-lg font-medium leading-8 text-beedero-black/70">
                Being credible shouldn&apos;t cost you your privacy. You decide what each person
                gets to see, and for how long.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {CONTROL.map((item) => (
                <article
                  key={item.title}
                  className="rounded-[1.5rem] border border-beedero-border bg-beedero-yellow/20 p-6"
                >
                  <h3 className="text-2xl font-black uppercase tracking-[-0.06em]">{item.title}</h3>
                  <p className="mt-4 text-sm font-medium leading-6 text-beedero-black/70">
                    {item.text}
                  </p>
                </article>
              ))}
              <article className="rounded-[1.5rem] border-2 border-beedero-black bg-beedero-black p-6 text-beedero-white">
                <h3 className="text-2xl font-black uppercase tracking-[-0.06em] text-beedero-yellow">
                  Proof you can embed
                </h3>
                <p className="mt-4 text-sm font-medium leading-6 text-beedero-white/70">
                  Put your badge on your own site and link to a public verification page anyone can
                  check. It mirrors your live level — so it can never quietly overstate you.
                </p>
              </article>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ Audiences */}
      <section className="px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto grid max-w-7xl gap-3 lg:grid-cols-2">
          <article className="rounded-[2rem] border border-beedero-white/10 bg-beedero-white/[0.04] p-8 sm:p-10">
            <h2 className="text-[clamp(1.9rem,5vw,3rem)] font-black uppercase leading-[0.9] tracking-[-0.07em]">
              For founders
            </h2>
            <ul className="mt-8 flex flex-col gap-4">
              {FOUNDER_POINTS.map((point) => (
                <li key={point} className="flex gap-3 text-base font-medium leading-7 text-beedero-white/70">
                  <span aria-hidden="true" className="mt-2 h-2 w-2 shrink-0 rounded-full bg-beedero-yellow" />
                  {point}
                </li>
              ))}
            </ul>
          </article>

          <article className="rounded-[2rem] border border-beedero-white/10 bg-beedero-white/[0.04] p-8 sm:p-10">
            <h2 className="text-[clamp(1.9rem,5vw,3rem)] font-black uppercase leading-[0.9] tracking-[-0.07em]">
              For investors
            </h2>
            <ul className="mt-8 flex flex-col gap-4">
              {INVESTOR_POINTS.map((point) => (
                <li key={point} className="flex gap-3 text-base font-medium leading-7 text-beedero-white/70">
                  <span aria-hidden="true" className="mt-2 h-2 w-2 shrink-0 rounded-full bg-beedero-yellow" />
                  {point}
                </li>
              ))}
            </ul>
          </article>
        </div>
      </section>

      {/* ------------------------------------------------------------------ FAQ */}
      <section className="bg-beedero-white px-5 py-16 text-beedero-black sm:px-8 sm:py-24">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-[clamp(1.9rem,6vw,3.75rem)] font-black uppercase leading-[0.9] tracking-[-0.07em]">
            Before you sign up
          </h2>
          <div className="mt-10 flex flex-col gap-3">
            {FAQ.map((item) => (
              <details
                key={item.q}
                className="group rounded-[1.25rem] border border-beedero-border bg-beedero-yellow/10 px-6 py-5"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-black uppercase tracking-[-0.03em] marker:hidden">
                  {item.q}
                  <span
                    aria-hidden="true"
                    className="text-2xl font-black leading-none text-beedero-black/40 transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-4 text-base font-medium leading-7 text-beedero-black/70">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ Final CTA */}
      <section className="px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-7xl rounded-[2rem] border border-beedero-white/10 bg-beedero-black p-8 sm:p-12">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-beedero-yellow">
                Start now
              </p>
              <h2 className="mt-4 max-w-4xl text-[clamp(1.9rem,6vw,3.75rem)] font-black uppercase leading-[0.9] tracking-[-0.07em]">
                Start at level one today.
              </h2>
              <p className="mt-5 max-w-xl text-base font-medium leading-7 text-beedero-white/60">
                Create your profile, confirm your registry details, and you have something worth
                sending the next time someone asks you to prove it.
              </p>
            </div>
            <Link
              href={primaryCta.href}
              className="rounded-full bg-beedero-yellow px-8 py-4 text-center text-sm font-black uppercase tracking-[-0.02em] text-beedero-black hover:bg-beedero-white"
            >
              {primaryCta.label}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
