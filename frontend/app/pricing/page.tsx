import Link from "next/link";
import { LockKeyhole } from "lucide-react";

import { getAccessToken, getRefreshToken } from "@/lib/session";
import { pageMetadata } from "@/lib/site-metadata";

export const metadata = pageMetadata({
  title: "Pricing",
  description:
    "Your professional identity is free. When your organisation is ready to be seen and discovered, launch it for €99 for the full first year.",
  path: "/pricing",
});

const INCLUDED = [
  "Personal profile",
  "Network discovery",
  "Messaging after connection",
  "Posts and milestones",
  "Follow people and organisations",
] as const;

const ORGANISATION_INCLUDED = [
  "One credible home for your organisation",
  "Showcase your team, jobs and milestones",
  "Build trust with verification signals",
  "See how people discover your profile",
  "Publish opportunities that attract the right people",
] as const;

export default async function PricingPage() {
  const authed = Boolean((await getAccessToken()) || (await getRefreshToken()));
  const joinHref = authed ? "/feed" : "/register";

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
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-beedero-yellow">
          Start free. Step up when you&apos;re ready.
        </p>
        <h1 className="mt-6 max-w-4xl text-[clamp(3.5rem,8vw,7.5rem)] font-black uppercase leading-[0.82] tracking-[-0.02em]">
          Build credibility
          <br />
          before you need it.
        </h1>
        <p className="mt-7 max-w-xl text-lg leading-8 text-white/65">
          Your professional identity is free. When your organisation is ready to be seen, trusted and
          discovered, launch it for €99 for the full first year.
        </p>

        <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 border-y border-white/10 py-4 text-[10px] font-black uppercase tracking-[0.14em] text-white/45">
          <span>Personal profile · always free</span>
          <span className="text-beedero-yellow">Organisation · €99 first year</span>
          <span>One simple payment</span>
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
              {INCLUDED.map((item) => (
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
            <div className="flex items-center justify-between gap-4">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-beedero-black/55">
                For your organisation
              </p>
              <span className="rounded-full border border-black/25 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.14em]">
                Founding offer
              </span>
            </div>
            <div className="mt-6 flex flex-wrap items-end gap-x-3 gap-y-1">
              <h2 className="text-6xl font-black uppercase tracking-[-0.02em]">€99</h2>
              <p className="pb-2 text-xs font-black uppercase tracking-[0.12em] text-beedero-black/55">
                full first year
              </p>
            </div>
            <p className="mt-4 max-w-md text-sm leading-6 text-beedero-black/70">
              Turn scattered proof into one credible record. Show the people, progress and signals
              that make your organisation worth knowing — and easier to trust.
            </p>
            <div className="mt-6 bg-beedero-black p-5 text-white">
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-beedero-yellow">
                Less than €2 per week
              </p>
              <p className="mt-2 max-w-lg text-2xl font-black leading-tight">
                One year to build a record that keeps working long after the introduction.
              </p>
            </div>
            <ul className="mt-7 space-y-3 border-t border-black/15 pt-6 text-sm">
              {ORGANISATION_INCLUDED.map((item) => (
                <li className="flex gap-3" key={item}>
                  <span className="font-black">✓</span>
                  {item}
                </li>
              ))}
            </ul>
            <Link
              href={joinHref}
              className="mt-8 flex w-full items-center justify-center rounded-full bg-beedero-black px-6 py-4 text-xs font-black uppercase text-white transition hover:bg-white hover:text-beedero-black"
            >
              Secure early access — €99 →
            </Link>
            <p className="mt-4 flex items-center justify-center gap-2 text-center text-[10px] font-bold text-beedero-black/55">
              <LockKeyhole size={12} aria-hidden />
              Sign in or create your personal account to continue.
            </p>
          </section>
        </div>

        <p className="mt-8 text-center text-xs text-white/45">
          One payment. The complete organisation experience for your first year.
        </p>
      </section>
    </main>
  );
}
