import Link from "next/link";

import { CASE_STUDIES } from "@/lib/cases-content";
import { FAQ_ITEMS, SUPPORT_RESPONSE_SLA } from "@/lib/faq-content";
import { COMPANY } from "@/lib/legal-content";

import { LandingHero } from "./LandingHero";
import { LandingPrivacyDemo } from "./LandingPrivacyDemo";
import { LandingStickyCta } from "./LandingStickyCta";
import { BENEFITS } from "./landing-content";

type Props = {
  primaryHref: string;
  primaryLabel: string;
};

/**
 * Server-rendered landing shell so the first paint (and LCP text) does not wait
 * on the client bundle. Interactive pieces live in small client islands.
 */
export function LandingPage({ primaryHref, primaryLabel }: Props) {
  return (
    <main className="min-h-screen overflow-hidden bg-[#070806] text-white selection:bg-beedero-yellow selection:text-beedero-black">
      <header className="relative z-10 mx-auto flex max-w-[1440px] items-center justify-between px-5 pb-5 pt-[max(3rem,env(safe-area-inset-top))] sm:px-8 sm:py-5">
        <Link href="/" className="text-lg font-black uppercase tracking-[-0.07em]">
          Beedero
        </Link>
        <nav className="hidden gap-7 text-xs font-bold uppercase text-white/65 md:flex">
          <a href="#benefits" className="hover:text-white">
            Benefits
          </a>
          <a href="#product" className="hover:text-white">
            How it works
          </a>
          <Link href="/cases" className="hover:text-white">
            Cases
          </Link>
          <Link href="/faq" className="hover:text-white">
            FAQ
          </Link>
        </nav>
        <Link
          href={primaryHref}
          className="rounded-full bg-beedero-yellow px-5 py-2.5 text-xs font-black uppercase text-beedero-black transition hover:bg-white"
        >
          {primaryLabel === "Enter Beedero" ? "Enter" : "Join"}
        </Link>
      </header>

      {/*
        Noscript / first-paint fallback: founders copy is also the client default,
        so crawlers and Lighthouse see real H1 HTML before hydration.
      */}
      <noscript>
        <section className="px-5 pb-12 pt-14 sm:px-8">
          <h1 className="whitespace-pre-line text-[clamp(3.15rem,15vw,7.4rem)] font-black uppercase leading-[0.88] tracking-[-0.052em]">
            Build the thing.
            {"\n"}
            Find your people.
          </h1>
        </section>
      </noscript>

      <LandingHero primaryHref={primaryHref} />

      <section
        id="benefits"
        className="scroll-mt-8 border-y border-black bg-beedero-yellow px-5 py-16 text-beedero-black sm:px-8"
      >
        <div className="mx-auto max-w-[1440px]">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <h2 className="max-w-xl text-4xl font-black uppercase leading-[0.84] tracking-[-0.075em] sm:text-6xl">
              One network.
              <br />
              Four ways forward.
            </h2>
            <p className="max-w-sm text-sm font-semibold leading-6">
              Beedero is where opportunity stops being a lucky accident.
            </p>
          </div>
          <div className="mt-12 grid border-y border-black/20 sm:grid-cols-2 lg:grid-cols-4">
            {BENEFITS.map(([number, title, copy]) => (
              <article
                key={title}
                className="group border-b border-black/20 p-5 last:border-0 sm:border-r sm:[&:nth-child(2)]:border-r-0 lg:border-b-0 lg:[&:nth-child(2)]:border-r lg:[&:nth-child(4)]:border-r-0"
              >
                <p className="text-4xl font-black tracking-[-0.08em] text-beedero-black/35">
                  {number}
                </p>
                <h3 className="mt-9 text-lg font-black uppercase tracking-[-0.04em]">{title}</h3>
                <p className="mt-3 max-w-[220px] text-sm leading-6 text-beedero-black/65">{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        id="product"
        className="mx-auto grid max-w-[1440px] scroll-mt-8 gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[0.85fr_1.15fr] lg:py-28"
      >
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-beedero-yellow">
            Trust, on your terms
          </p>
          <h2 className="mt-5 text-5xl font-black uppercase leading-[0.84] tracking-[-0.075em] sm:text-7xl">
            Share enough.
            <br />
            <span className="text-beedero-yellow">Keep what matters.</span>
          </h2>
          <p className="mt-7 max-w-md text-base leading-7 text-white/65">
            Your profile creates opportunity. Your controls make it safe. Every meaningful field has
            its own audience.
          </p>
        </div>
        <LandingPrivacyDemo />
      </section>

      <section id="cases" className="scroll-mt-8 border-t border-white/10 px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-[1440px]">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-beedero-yellow">
                Results
              </p>
              <h2 className="mt-4 max-w-xl text-4xl font-black uppercase leading-[0.84] tracking-[-0.075em] sm:text-5xl">
                Cases with outcomes.
              </h2>
            </div>
            <Link href="/cases" className="text-xs font-black uppercase text-beedero-yellow hover:text-white">
              All cases →
            </Link>
          </div>
          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {CASE_STUDIES.map((study) => (
              <Link
                key={study.slug}
                href={`/cases#${study.slug}`}
                className="border border-white/15 bg-white/[0.03] p-5 transition hover:border-beedero-yellow"
              >
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-beedero-yellow">
                  {study.role}
                </p>
                <h3 className="mt-3 text-lg font-black tracking-[-0.03em]">{study.headline}</h3>
                <p className="mt-3 text-sm leading-6 text-white/55">{study.summary}</p>
                <p className="mt-6 text-2xl font-black text-beedero-yellow">{study.metric}</p>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/40">
                  {study.metricLabel}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="scroll-mt-8 border-t border-white/10 px-5 py-20 sm:px-8">
        <div className="mx-auto grid max-w-[1440px] gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-beedero-yellow">
              FAQ
            </p>
            <h2 className="mt-4 text-4xl font-black uppercase leading-[0.84] tracking-[-0.075em] sm:text-5xl">
              Straight answers.
            </h2>
            <p className="mt-5 max-w-sm text-sm leading-6 text-white/55">
              {SUPPORT_RESPONSE_SLA}{" "}
              <a href={`mailto:${COMPANY.contactEmail}`} className="text-beedero-yellow hover:underline">
                {COMPANY.contactEmail}
              </a>
            </p>
            <Link
              href="/faq"
              className="mt-6 inline-block text-xs font-black uppercase text-beedero-yellow hover:text-white"
            >
              Full FAQ →
            </Link>
          </div>
          <div className="divide-y divide-white/10 border-y border-white/10">
            {FAQ_ITEMS.slice(0, 5).map((item) => (
              <details key={item.question} className="group py-4">
                <summary className="cursor-pointer list-none text-sm font-bold marker:content-none [&::-webkit-details-marker]:hidden">
                  <span className="flex items-start justify-between gap-3">
                    {item.question}
                    <span className="text-white/35 transition group-open:rotate-45">+</span>
                  </span>
                </summary>
                <p className="mt-2 text-sm leading-6 text-white/55">{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-beedero-yellow px-5 py-16 text-beedero-black sm:px-8">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-end justify-between gap-8">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-beedero-black/55">
              Your next move starts here
            </p>
            <h2 className="mt-4 text-4xl font-black uppercase leading-[0.84] tracking-[-0.075em] sm:text-6xl">
              Make yourself
              <br />
              easy to find.
            </h2>
          </div>
          <Link
            href={primaryHref}
            className="rounded-full bg-beedero-black px-7 py-4 text-sm font-black uppercase text-white transition hover:bg-white hover:text-beedero-black"
          >
            {primaryLabel} →
          </Link>
        </div>
      </section>

      <footer className="px-5 py-9 pb-28 sm:px-8 md:pb-9">
        <div className="mx-auto grid max-w-[1440px] gap-7 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <p className="text-lg font-black uppercase tracking-[-0.07em]">Beedero</p>
            <p className="mt-2 text-xs text-white/45">
              A professional network built to move people forward. {SUPPORT_RESPONSE_SLA}
            </p>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-3 text-[11px] font-bold uppercase text-white/55">
            <Link href="/startups" className="hover:text-white">
              Discover
            </Link>
            <Link href="/jobs" className="hover:text-white">
              Open roles
            </Link>
            <Link href="/cases" className="hover:text-white">
              Cases
            </Link>
            <Link href="/faq" className="hover:text-white">
              FAQ
            </Link>
            <Link href="/about" className="hover:text-white">
              About
            </Link>
            <Link href="/privacy" className="hover:text-white">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-white">
              Terms
            </Link>
          </div>
        </div>
      </footer>

      <LandingStickyCta primaryHref={primaryHref} primaryLabel={primaryLabel} />
    </main>
  );
}
