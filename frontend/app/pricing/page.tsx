import Link from "next/link";
import { LockKeyhole } from "lucide-react";

import { getAccessToken, getRefreshToken } from "@/lib/session";
import { pageMetadata } from "@/lib/site-metadata";

export const metadata = pageMetadata({
  title: "Pricing",
  description:
    "Beedero is free for people. Organisations pay €99 a year or €9 a month, VAT included — and early adopters get the first year free.",
  path: "/pricing",
});

const PERSONAL = [
  "Personal profile",
  "Network discovery",
  "Messaging after connection",
  "Posts and milestones",
  "Follow people and organisations",
] as const;

const ORGANISATION = [
  "Published and listed in Discover",
  "Updates, milestones and events",
  "Job posts",
  "Verification ladder and badge",
  "The team, confirmed by each person",
] as const;

const QUESTIONS = [
  {
    q: "Do I need a card for the free year?",
    a: "No. With an early-adopter code the organisation is free for a year, with nothing to fill in. A month before the year ends we remind you; if you don't add a card, the organisation simply pauses.",
  },
  {
    q: "What does “paused” mean?",
    a: "The public page stays up and nothing is deleted. The organisation is hidden from Discover and can't post or publish jobs until it has a plan again.",
  },
  {
    q: "Can I cancel?",
    a: "Any time, from the workspace. The plan runs until the end of the period you paid for. Within 14 days of your first payment, you can ask for a full refund.",
  },
  {
    q: "Do you issue invoices?",
    a: "Yes. Stripe emails a receipt for every payment, and the fatura — with your company's VAT number, if you add it at checkout — follows by email.",
  },
] as const;

export default async function PricingPage() {
  const authed = Boolean((await getAccessToken()) || (await getRefreshToken()));
  const joinHref = authed ? "/feed" : "/register";
  const orgHref = authed ? "/orgs/new" : "/register";

  return (
    <main className="min-h-screen bg-[#070806] px-5 pb-10 text-white sm:px-8">
      <header className="mx-auto flex max-w-[1280px] items-center justify-between pb-5 pt-[max(2rem,env(safe-area-inset-top))] sm:py-5">
        <Link href="/" className="text-lg font-black uppercase tracking-[-0.02em]">
          Beedero
        </Link>
        <Link
          href={joinHref}
          className="rounded-full bg-beedero-yellow px-5 py-2.5 text-xs font-black uppercase text-beedero-black"
        >
          Get started
        </Link>
      </header>

      <section className="mx-auto max-w-[1280px] py-16 sm:py-24">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-beedero-yellow">Pricing</p>
        <h1 className="mt-6 max-w-4xl text-[clamp(3.2rem,7.5vw,7rem)] font-black uppercase leading-[0.84] tracking-[-0.02em]">
          Free for people.
          <br />
          Fair for companies.
        </h1>
        <p className="mt-7 max-w-xl text-lg leading-8 text-white/65">
          Your profile, your connections and your messages cost nothing. Organisations pay a small
          subscription — a company on Beedero is a promise that real people stand behind it.
        </p>

        <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 border-y border-white/10 py-4 text-[10px] font-black uppercase tracking-[0.14em] text-white/45">
          <span>People · always free</span>
          <span className="text-beedero-yellow">Organisation · €99 a year</span>
          <span>Early adopters · first year free</span>
        </div>

        <div className="mt-8 grid gap-3 lg:grid-cols-[0.8fr_1.2fr]">
          <section className="border border-white/15 bg-white/5 p-7 sm:p-9">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-beedero-yellow">
              For you
            </p>
            <h2 className="mt-6 text-5xl font-black uppercase tracking-[-0.02em]">Free</h2>
            <p className="mt-4 max-w-md text-sm leading-6 text-white/65">
              Build your professional identity, grow the right network and stay close to the
              opportunities that move you forward.
            </p>
            <ul className="mt-9 space-y-3 border-t border-white/10 pt-6 text-sm">
              {PERSONAL.map((item) => (
                <li className="flex gap-3" key={item}>
                  <span className="text-beedero-yellow">✓</span>
                  {item}
                </li>
              ))}
            </ul>
            <Link
              href={joinHref}
              className="mt-10 inline-block rounded-full bg-beedero-yellow px-6 py-3.5 text-xs font-black uppercase text-beedero-black"
            >
              Start your free profile →
            </Link>
          </section>

          <section className="relative overflow-hidden border border-beedero-yellow bg-beedero-yellow p-7 text-beedero-black sm:p-9">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-beedero-black/55">
              For your organisation
            </p>
            <h2 className="mt-6 flex flex-wrap items-baseline gap-x-3 font-black uppercase tracking-[-0.02em]">
              <span className="text-6xl">€99</span>
              <span className="text-xl">/ year</span>
            </h2>
            <p className="mt-2 text-sm font-bold">or €9 a month · VAT included</p>
            <p className="mt-4 max-w-md text-sm leading-6 text-beedero-black/70">
              Turn scattered proof into one credible record. Show the people, progress and signals
              that make your organisation worth knowing — and easier to trust.
            </p>
            <ul className="mt-7 space-y-3 border-t border-black/15 pt-6 text-sm">
              {ORGANISATION.map((item) => (
                <li className="flex gap-3" key={item}>
                  <span className="font-black">✓</span>
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-8 bg-beedero-black px-5 py-4 text-white">
              <p className="text-sm font-black">Early adopter? Your first year is free.</p>
              <p className="mt-1 text-xs leading-5 text-white/65">
                Enter your code when you create the organisation. No card needed.
              </p>
            </div>
            <Link
              href={orgHref}
              className="mt-8 flex w-full items-center justify-center rounded-full bg-beedero-black px-6 py-4 text-xs font-black uppercase text-white transition hover:bg-white hover:text-beedero-black"
            >
              Create organisation →
            </Link>
            {!authed && (
              <p className="mt-4 flex items-center justify-center gap-2 text-center text-[10px] font-bold text-beedero-black/55">
                <LockKeyhole size={12} aria-hidden />
                Sign in or create your personal account to continue.
              </p>
            )}
          </section>
        </div>

        <div className="mt-16 grid gap-x-10 gap-y-8 border-t border-white/10 pt-10 md:grid-cols-2">
          {QUESTIONS.map((item) => (
            <div key={item.q}>
              <h3 className="text-base font-black">{item.q}</h3>
              <p className="mt-2 text-sm leading-6 text-white/60">{item.a}</p>
            </div>
          ))}
        </div>

        <p className="mt-12 text-center text-xs text-white/45">
          Prices include VAT. Full conditions in the{" "}
          <Link href="/terms#subscriptions" className="underline">
            Terms
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
