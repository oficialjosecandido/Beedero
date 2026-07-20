import type { Metadata } from "next";
import Link from "next/link";

import { pageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = pageMetadata({
  title: "Pricing",
  description:
    "Start for free on Beedero. Build your startup profile, get discovered by investors, and upgrade to Founder Pro when you are fundraising.",
  path: "/pricing",
});

const freePlanItems = [
  "Full organization profile",
  "All sections: team, products, market, milestones, awards, events",
  "Feed to share updates",
  "Visible in investor discovery",
  "Follow and be followed",
  "Fundraise section with a private data room, visible only to verified investors",
  "Receive investor outreach",
  "See how many investors viewed your profile",
];

const founderProItems = [
  ["Who viewed your profile", "names, when, and how often"],
  ["Data room analytics", "which investors opened your deck and how long they stayed"],
  ["Interest signals", "who saved your profile and who expressed interest"],
  ["Advanced discovery", "which investors match your stage and sector"],
];

const faqs = [
  {
    q: "Is creating a profile really free?",
    a: "Yes. Creating, publishing, getting discovered, following others, posting updates, and receiving outreach is free — with no time limit.",
  },
  {
    q: "So what is paid?",
    a: "Only extra insight for founders who are fundraising: knowing who viewed your profile, who opened your deck, and who showed interest. We never charge for platform access or for being contactable.",
  },
  {
    q: "Do investors pay?",
    a: "No. Investors use Beedero for free.",
  },
  {
    q: "Do I have to pay to share fundraising data?",
    a: "No. Your fundraise section and data room are free, and only visible to verified investors — you control who sees what.",
  },
  {
    q: "Can I cancel Founder Pro?",
    a: "Yes, at any time. It makes sense during your round; when it closes, you can cancel.",
  },
  {
    q: "Do I need an organization to sign up?",
    a: "No. You can have a personal profile, follow organizations and people, and stay up to date — even without creating an organization.",
  },
];

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-beedero-black text-beedero-white">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/" className="text-lg font-black uppercase tracking-[-0.04em]">
          Beedero
        </Link>
        <div className="hidden items-center gap-6 text-sm font-semibold uppercase tracking-[-0.02em] text-beedero-white/70 sm:flex">
          <Link href="/discovery" className="hover:text-beedero-white">
            Discovery
          </Link>
          <Link href="/pricing" className="text-beedero-white">
            Pricing
          </Link>
          <Link href="/login" className="hover:text-beedero-white">
            Login
          </Link>
          <Link
            href="/register"
            className="rounded-full bg-beedero-yellow px-5 py-2 text-beedero-black hover:bg-beedero-white"
          >
            Join
          </Link>
        </div>
      </nav>

      <section className="relative isolate overflow-hidden px-5 pb-16 pt-12 sm:px-8 sm:pb-20 lg:pt-16">
        <div className="absolute left-1/2 top-12 -z-10 h-[30rem] w-[30rem] -translate-x-1/2 rounded-full bg-beedero-yellow/20 blur-3xl" />
        <div className="mx-auto max-w-4xl text-center">
          <p className="mx-auto mb-5 inline-flex rounded-full border border-beedero-white/15 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-beedero-yellow">
            Pricing
          </p>
          <h1 className="text-5xl font-black uppercase leading-[0.9] tracking-[-0.06em] sm:text-7xl">
            Start free. Stay free.
          </h1>
          <p className="mx-auto mt-8 max-w-2xl text-lg font-medium leading-8 text-beedero-white/70">
            Build your startup profile, get discovered by investors, and grow your network — at no
            cost. When you are fundraising, get tools to understand who is genuinely interested.
          </p>
          <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/register"
              className="rounded-full bg-beedero-yellow px-8 py-4 text-center text-sm font-black uppercase tracking-[-0.02em] text-beedero-black hover:bg-beedero-white"
            >
              Create organization
            </Link>
            <Link
              href="/register"
              className="rounded-full border border-beedero-white/25 px-8 py-4 text-center text-sm font-black uppercase tracking-[-0.02em] text-beedero-white hover:border-beedero-white hover:bg-beedero-white hover:text-beedero-black"
            >
              I am an investor
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-beedero-white px-5 py-16 text-beedero-black sm:px-8 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <p className="text-center text-sm font-black uppercase tracking-[0.2em] text-beedero-black/50">
            Plans
          </p>
          <div className="mt-8 grid gap-6 lg:grid-cols-3 lg:items-stretch">
            <article className="flex flex-col rounded-[1.5rem] border border-beedero-border bg-beedero-yellow/20 p-8">
              <h2 className="text-3xl font-black uppercase tracking-[-0.05em]">Free</h2>
              <p className="mt-1 text-sm font-bold uppercase tracking-[-0.02em] text-beedero-black/60">
                For every startup. Forever.
              </p>
              <p className="mt-4 text-sm font-medium leading-6 text-beedero-black/70">
                Everything you need to exist, be found, and grow.
              </p>
              <p className="mt-6 text-4xl font-black tracking-[-0.06em]">
                €0 <span className="text-base font-bold text-beedero-black/50">/ forever</span>
              </p>
              <ul className="mt-6 flex flex-1 flex-col gap-2.5 text-sm font-medium leading-6 text-beedero-black/75">
                {freePlanItems.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="text-beedero-black/40">—</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/register"
                className="mt-8 rounded-full bg-beedero-black px-6 py-3 text-center text-sm font-black uppercase tracking-[-0.02em] text-beedero-yellow hover:bg-beedero-black/85"
              >
                Create organization
              </Link>
            </article>

            <article className="flex flex-col rounded-[1.5rem] border border-beedero-border bg-beedero-black p-8 text-beedero-white">
              <h2 className="text-3xl font-black uppercase tracking-[-0.05em]">Founder Pro</h2>
              <p className="mt-1 text-sm font-bold uppercase tracking-[-0.02em] text-beedero-yellow">
                For when you are fundraising and want to know who is paying attention.
              </p>
              <p className="mt-4 text-sm font-medium leading-6 text-beedero-white/70">
                Everything in Free, plus:
              </p>
              <p className="mt-6 text-4xl font-black tracking-[-0.06em]">
                €[XX]{" "}
                <span className="text-base font-bold text-beedero-white/50">
                  / month (during your round)
                </span>
              </p>
              <ul className="mt-6 flex flex-1 flex-col gap-3 text-sm font-medium leading-6 text-beedero-white/80">
                {founderProItems.map(([title, detail]) => (
                  <li key={title} className="flex flex-col gap-0.5">
                    <span className="font-bold text-beedero-white">{title}</span>
                    <span className="text-beedero-white/60">— {detail}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/register"
                className="mt-8 rounded-full bg-beedero-yellow px-6 py-3 text-center text-sm font-black uppercase tracking-[-0.02em] text-beedero-black hover:bg-beedero-white"
              >
                Learn more
              </Link>
              <p className="mt-3 text-center text-xs font-medium text-beedero-white/50">
                Cancel when your round closes. No commitments.
              </p>
            </article>

            <article className="flex flex-col rounded-[1.5rem] border border-beedero-border bg-beedero-yellow/20 p-8">
              <h2 className="text-3xl font-black uppercase tracking-[-0.05em]">Investors</h2>
              <p className="mt-1 text-sm font-bold uppercase tracking-[-0.02em] text-beedero-black/60">
                Free.
              </p>
              <p className="mt-4 text-sm font-medium leading-6 text-beedero-black/70">
                Structured deal flow, filters by stage, sector, geography, and check size, access to
                verified data rooms, and direct contact with founders. No cost.
              </p>
              <p className="mt-6 text-4xl font-black tracking-[-0.06em]">€0</p>
              <div className="flex-1" />
              <Link
                href="/register"
                className="mt-8 rounded-full bg-beedero-black px-6 py-3 text-center text-sm font-black uppercase tracking-[-0.02em] text-beedero-yellow hover:bg-beedero-black/85"
              >
                Join as investor
              </Link>
            </article>
          </div>
        </div>
      </section>

      <section className="px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-beedero-yellow">
            Why free?
          </p>
          <p className="mt-6 text-2xl font-medium leading-9 text-beedero-white/80 sm:text-3xl">
            Beedero only works when everyone is here — founders and investors. That is why the
            essentials will never sit behind a paywall. We only charge for extra advantage while
            you are fundraising, never for what you need to be discovered.
          </p>
        </div>
      </section>

      <section className="bg-beedero-white px-5 py-16 text-beedero-black sm:px-8 sm:py-24">
        <div className="mx-auto max-w-3xl">
          <p className="text-center text-sm font-black uppercase tracking-[0.2em] text-beedero-black/50">
            Frequently asked questions
          </p>
          <div className="mt-8 flex flex-col gap-6">
            {faqs.map((faq) => (
              <div
                key={faq.q}
                className="rounded-[1.5rem] border border-beedero-border bg-beedero-yellow/10 p-6"
              >
                <h3 className="text-lg font-black tracking-[-0.02em]">{faq.q}</h3>
                <p className="mt-2 text-sm font-medium leading-6 text-beedero-black/70">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-7xl rounded-[2rem] border border-beedero-white/10 bg-beedero-black p-8 sm:p-12">
          <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-beedero-yellow">
                Start now
              </p>
              <h2 className="mt-4 max-w-4xl text-4xl font-black uppercase leading-[0.9] tracking-[-0.07em] sm:text-6xl">
                Join the startup discovery layer.
              </h2>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <Link
                href="/register"
                className="rounded-full bg-beedero-white px-8 py-4 text-center text-sm font-black uppercase tracking-[-0.02em] text-beedero-black hover:bg-beedero-yellow"
              >
                Create organization — free
              </Link>
              <Link
                href="mailto:hello@beedero.com"
                className="rounded-full border border-beedero-white/25 px-8 py-4 text-center text-sm font-black uppercase tracking-[-0.02em] text-beedero-white hover:border-beedero-white hover:bg-beedero-white hover:text-beedero-black"
              >
                Contact us
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
