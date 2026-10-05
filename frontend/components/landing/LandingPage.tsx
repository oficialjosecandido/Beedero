"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

const PEOPLE = {
  founders: {
    tab: "Founders",
    line: "Build the thing.\nFind your people.",
    copy: "A profile that turns your progress into introductions, hires and investor conversations.",
    action: "Build my profile",
    meta: "Build · hire · raise",
  },
  professionals: {
    tab: "Professionals",
    line: "Your next role\nknows your name.",
    copy: "Put your experience in front of founders and teams looking for exactly what you know.",
    action: "Show my work",
    meta: "Advise · join · contribute",
  },
  companies: {
    tab: "Companies",
    line: "Be worth\nlooking up.",
    copy: "Give your organisation a credible home for its story, team, jobs and milestones.",
    action: "Create an organisation",
    meta: "Tell · attract · grow",
  },
  investors: {
    tab: "Investors",
    line: "Find the signal\nbefore the noise.",
    copy: "See the context around the companies and people worth meeting next.",
    action: "Discover the network",
    meta: "Find · meet · back",
  },
} as const;

type PersonKey = keyof typeof PEOPLE;

const BENEFITS = [
  ["01", "Founders", "Get discovered for the work you’re actually doing."],
  ["02", "Professionals", "Turn experience into roles, advisory and board opportunities."],
  ["03", "Companies", "Build a presence your team can grow into."],
  ["04", "Investors", "Meet companies with context, not just a deck."],
] as const;

function Hex({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`grid place-items-center [clip-path:polygon(25%_6%,75%_6%,100%_50%,75%_94%,25%_94%,0_50%)] ${className}`}
    >
      {children}
    </span>
  );
}

type Props = {
  primaryHref: string;
  primaryLabel: string;
};

export function LandingPage({ primaryHref, primaryLabel }: Props) {
  const [person, setPerson] = useState<PersonKey>("founders");
  const [access, setAccess] = useState<"Public" | "Verified only" | "Private">("Verified only");
  const [showTop, setShowTop] = useState(false);
  const current = PEOPLE[person];

  useEffect(() => {
    function onScroll() {
      setShowTop(window.scrollY > 560);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
          <Link href="/pricing" className="hover:text-white">
            Pricing
          </Link>
        </nav>
        <Link
          href={primaryHref}
          className="rounded-full bg-beedero-yellow px-5 py-2.5 text-xs font-black uppercase text-beedero-black transition hover:bg-white"
        >
          {primaryLabel === "Enter Beedero" ? "Enter" : "Join"}
        </Link>
      </header>

      <section className="relative isolate px-5 pb-20 pt-14 sm:px-8 lg:pb-28 lg:pt-20">
        <div className="absolute left-1/2 top-[-10rem] -z-10 h-[42rem] w-[42rem] -translate-x-1/2 rounded-full bg-beedero-yellow/20 blur-[110px]" />
        <div className="mx-auto grid max-w-[1440px] gap-10 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
          <div>
            <p className="inline-flex rounded-full border border-white/15 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-beedero-yellow">
              The network for people in motion
            </p>
            <h1 className="mt-8 whitespace-pre-line text-[clamp(3.15rem,15vw,7.4rem)] font-black uppercase leading-[0.88] tracking-[-0.052em] sm:mt-7 sm:text-[clamp(3.7rem,7.5vw,7.4rem)] sm:leading-[0.84] sm:tracking-[-0.065em]">
              {current.line}
            </h1>
            <p className="mt-7 max-w-xl text-base leading-7 text-white/70 sm:text-lg sm:leading-8">
              {current.copy}
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                href={primaryHref}
                className="rounded-full bg-beedero-yellow px-7 py-4 text-sm font-black uppercase text-beedero-black transition hover:-translate-y-0.5 hover:bg-white"
              >
                {current.action} →
              </Link>
              <Link
                href="/pricing"
                className="rounded-full border border-white/25 px-7 py-4 text-sm font-black uppercase transition hover:bg-white hover:text-beedero-black"
              >
                It’s free to start
              </Link>
            </div>
            <p className="mt-5 text-sm text-white/45">Free to join. Built for the next step.</p>
          </div>

          <div className="border border-beedero-yellow/45 bg-beedero-yellow p-3 text-beedero-black">
            <div className="bg-[#080907] p-5 text-white sm:p-7">
              <div className="flex items-center justify-between border-b border-white/10 pb-5">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-beedero-yellow">
                  What brings you here?
                </p>
                <Hex className="h-10 w-10 bg-beedero-yellow text-beedero-black">↗</Hex>
              </div>
              <div className="mt-4 grid gap-2">
                {(Object.entries(PEOPLE) as [PersonKey, (typeof PEOPLE)[PersonKey]][]).map(
                  ([key, item], i) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setPerson(key)}
                      className={`grid grid-cols-[35px_1fr_auto] items-center gap-3 border px-4 py-4 text-left transition ${
                        person === key
                          ? "border-beedero-yellow bg-beedero-yellow text-beedero-black"
                          : "border-white/15 hover:border-beedero-yellow"
                      }`}
                    >
                      <span className="text-2xl opacity-50">0{i + 1}</span>
                      <span>
                        <b className="block text-sm font-black uppercase">{item.tab}</b>
                        <small
                          className={`mt-1 block text-xs ${
                            person === key ? "text-beedero-black/60" : "text-white/50"
                          }`}
                        >
                          {item.meta}
                        </small>
                      </span>
                      <span>{person === key ? "↗" : "+"}</span>
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

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
        <div className="border border-white/15 bg-white/5 p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-beedero-yellow">
                Product preview
              </p>
              <p className="mt-1 text-sm text-white/55">Alma Labs · Monthly revenue</p>
            </div>
            <Hex className="h-12 w-12 bg-beedero-yellow text-xs font-black text-beedero-black">✓</Hex>
          </div>
          <div className="my-6 flex flex-wrap gap-2">
            {(["Public", "Verified only", "Private"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setAccess(option)}
                className={`rounded-full border px-4 py-2.5 text-xs font-black transition ${
                  access === option
                    ? "border-beedero-yellow bg-beedero-yellow text-beedero-black"
                    : "border-white/20 text-white/65 hover:border-beedero-yellow"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
          <div className="border border-white/15 p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/45">Live MRR</p>
            <p
              className={`mt-3 text-5xl font-black tracking-[-0.07em] ${
                access === "Private" ? "select-none blur-md" : ""
              }`}
            >
              €84,600
            </p>
            <p className="mt-5 text-xs text-white/55">
              Visible to{" "}
              <b className="text-beedero-yellow">
                {access === "Public"
                  ? "everyone"
                  : access === "Private"
                    ? "only you"
                    : "approved investors"}
              </b>
            </p>
          </div>
          <p className="mt-4 text-xs leading-5 text-white/45">
            Click the audience to see how privacy changes without removing the value of your profile.
          </p>
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

      <footer className="px-5 py-9 sm:px-8">
        <div className="mx-auto grid max-w-[1440px] gap-7 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <p className="text-lg font-black uppercase tracking-[-0.07em]">Beedero</p>
            <p className="mt-2 text-xs text-white/45">
              A professional network built to move people forward.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-3 text-[11px] font-bold uppercase text-white/55">
            <Link href="/pricing" className="hover:text-white">
              Pricing
            </Link>
            <Link href="/privacy" className="hover:text-white">
              Privacy policy
            </Link>
            <Link href="/terms" className="hover:text-white">
              Terms of use
            </Link>
            <Link href="/cookies" className="hover:text-white">
              Cookie policy
            </Link>
            <Link href="/about" className="hover:text-white">
              Legal information
            </Link>
          </div>
        </div>
      </footer>

      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        aria-label="Back to top"
        className={`fixed bottom-5 right-5 z-30 grid h-12 w-12 place-items-center rounded-full border border-beedero-yellow/70 bg-black text-lg text-beedero-yellow shadow-xl transition-all ${
          showTop ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
        }`}
      >
        ↑
      </button>
    </main>
  );
}
