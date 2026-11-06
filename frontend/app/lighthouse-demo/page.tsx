import type { Metadata } from "next";
import Link from "next/link";

import { pageMetadata } from "@/lib/site-metadata";

/**
 * Stable public surface for Lighthouse / SEO / perf audits.
 *
 * Static on purpose: no backend seed, no auth, no API round-trips — so
 * https://beedero.com/lighthouse-demo never 404s the way /p/lighthouse-demo
 * did when the fixture person was missing. Looks like a public org dashboard
 * (the product surface auditors should measure), not a marketing landing.
 */
export const metadata: Metadata = pageMetadata({
  title: "Lighthouse Demo — public org dashboard",
  description:
    "Public Beedero organisation dashboard used only for Lighthouse, SEO and performance audits. Fixture content — not a real company.",
  path: "/lighthouse-demo",
  keywords: ["Beedero", "startup network", "organisation profile", "public dashboard"],
});

const UPDATES = [
  {
    title: "Opened the seed round",
    body: "We're raising to grow the network for founders and operators moving between companies.",
    when: "2 days ago",
  },
  {
    title: "Shipped public profiles",
    body: "Personal and organisation pages are now shareable without a Beedero account.",
    when: "1 week ago",
  },
  {
    title: "Lisbon meetup",
    body: "An evening for builders who want warm introductions, not cold outreach.",
    when: "3 weeks ago",
  },
] as const;

const TEAM = [
  { name: "Alex Rivera", title: "Founder" },
  { name: "Sam Okonkwo", title: "Product" },
  { name: "Jamie Chen", title: "Growth" },
] as const;

const STATS = [
  { label: "Followers", value: "128" },
  { label: "Updates", value: "24" },
  { label: "Team", value: "3" },
  { label: "Open roles", value: "2" },
] as const;

export default function LighthouseDemoPage() {
  return (
    <main className="min-h-screen bg-[#0f1117] text-white">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-5 py-10 sm:px-8 sm:py-14">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-8">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-beedero-yellow">
              Public test fixture
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-[-0.03em] sm:text-5xl">
              Lighthouse Demo
            </h1>
            <p className="mt-3 max-w-xl text-base leading-7 text-white/60">
              A stable public organisation dashboard for performance and SEO audits.
              Fixture data only — safe to crawl, not a real company.
            </p>
          </div>
          <Link
            href="/"
            className="text-xs font-bold uppercase tracking-[0.14em] text-beedero-yellow hover:underline"
          >
            beedero.com
          </Link>
        </header>

        <section aria-label="Organisation overview" className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="border border-white/10 bg-white/[0.03] p-6 sm:p-8">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/40">About</p>
            <p className="mt-3 text-lg font-semibold leading-8 text-white/90">
              Building the trust network for people in motion — founders, operators and
              investors who want verified context before they connect.
            </p>
            <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-white/40">Stage</dt>
                <dd className="mt-1 font-semibold">Seed</dd>
              </div>
              <div>
                <dt className="text-white/40">Sector</dt>
                <dd className="mt-1 font-semibold">Network / marketplace</dd>
              </div>
              <div>
                <dt className="text-white/40">Based in</dt>
                <dd className="mt-1 font-semibold">Lisbon, Portugal</dd>
              </div>
              <div>
                <dt className="text-white/40">Status</dt>
                <dd className="mt-1 font-semibold text-beedero-yellow">Live · public</dd>
              </div>
            </dl>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {STATS.map((stat) => (
              <div key={stat.label} className="border border-white/10 bg-white/[0.03] p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/40">
                  {stat.label}
                </p>
                <p className="mt-3 text-3xl font-black tracking-[-0.03em]">{stat.value}</p>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="updates-heading">
          <h2 id="updates-heading" className="text-[10px] font-black uppercase tracking-[0.18em] text-beedero-yellow">
            Recent updates
          </h2>
          <ul className="mt-4 divide-y divide-white/10 border-y border-white/10">
            {UPDATES.map((update) => (
              <li key={update.title} className="py-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-lg font-bold">{update.title}</h3>
                  <time className="text-xs text-white/40">{update.when}</time>
                </div>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">{update.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="team-heading">
          <h2 id="team-heading" className="text-[10px] font-black uppercase tracking-[0.18em] text-beedero-yellow">
            Team
          </h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-3">
            {TEAM.map((person) => (
              <li key={person.name} className="border border-white/10 bg-white/[0.03] p-5">
                <p className="text-base font-bold">{person.name}</p>
                <p className="mt-1 text-sm text-white/45">{person.title}</p>
              </li>
            ))}
          </ul>
        </section>

        <footer className="border-t border-white/10 pt-6 text-xs text-white/35">
          Audit this URL for Lighthouse. Prefer it over authenticated routes like{" "}
          <code className="text-white/55">/feed</code> or <code className="text-white/55">/login</code>.
        </footer>
      </div>
    </main>
  );
}
