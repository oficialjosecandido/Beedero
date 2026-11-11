import Link from "next/link";

import { PublicHeader } from "@/components/PublicHeader";
import { COMPANY } from "@/lib/legal-content";
import { loadFounder } from "@/lib/founder";
import { statusLine } from "@/lib/public-stats";
import { ONE_LINER, REGISTRY_SCOPE } from "@/lib/seo-content";

import { LandingPrimaryLink } from "./LandingPrimaryLink";
import { LandingPrivacyDemo } from "./LandingPrivacyDemo";
import { LandingStickyCta } from "./LandingStickyCta";
import { FOUNDER_NOTE, WHAT_WORKS } from "./landing-content";

type Props = {
  primaryHref: string;
  primaryLabel: string;
};

/**
 * The home page, in the order someone reads it: what this is, who is behind
 * it, what works today, where it actually is, what it costs, how to reach us.
 *
 * Server-rendered throughout — the H1 is real HTML on first paint, which the
 * old client-side audience switcher was not. The only client pieces left are
 * the prefetching CTA, the mobile bar and the privacy example.
 */
export async function LandingPage({ primaryHref, primaryLabel }: Props) {
  // The face comes from José's own public profile rather than a file in
  // /public, so the person who wrote the note below is someone a reader can
  // click through to. Null when the API is slow or down — the note still
  // renders, just without the photo.
  const founder = FOUNDER_NOTE.body ? await loadFounder() : null;
  const status = await statusLine();

  const entering = primaryLabel === "Enter Beedero";

  // The bottom padding on mobile clears the sticky bar, so it never covers
  // the footer.
  return (
    <main className="min-h-screen bg-[#070806] pb-20 text-white selection:bg-beedero-yellow selection:text-beedero-black md:pb-0">
      <PublicHeader cta={entering ? { href: primaryHref, label: "Enter" } : undefined} />

      {/* 1 — what it is */}
      <section className="mx-auto max-w-[1100px] px-5 pb-16 pt-12 sm:px-8 sm:pb-20 sm:pt-16">
        <h1 className="max-w-3xl text-[clamp(2.3rem,5.4vw,4rem)] font-black leading-[1.03] tracking-[-0.025em]">
          {ONE_LINER}
        </h1>
        <div className="mt-9 flex flex-wrap items-center gap-5">
          <LandingPrimaryLink
            href={primaryHref}
            className="rounded-full bg-beedero-yellow px-7 py-4 text-sm font-black text-beedero-black transition hover:bg-white"
          >
            {entering ? "Enter Beedero" : "Join"}
          </LandingPrimaryLink>
          <Link href="/pricing" className="text-sm font-bold text-white/60 hover:text-white">
            Pricing
          </Link>
        </div>
        <p className="mt-6 max-w-xl text-sm leading-6 text-white/50">{REGISTRY_SCOPE}</p>
      </section>

      {/* 2 — who is behind it. Renders only once there is a real note. */}
      {FOUNDER_NOTE.body && (
        <section className="border-y border-white/10 bg-white/[0.02] px-5 py-14 sm:px-8">
          <div className="mx-auto max-w-[1100px]">
            <p className="max-w-2xl text-lg leading-8 text-white/80">{FOUNDER_NOTE.body}</p>
            <div className="mt-6 flex items-center gap-3">
              {founder?.profile_picture && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={founder.profile_picture}
                  alt={`${founder.full_name}, founder of Beedero`}
                  width={48}
                  height={48}
                  className="size-12 shrink-0 rounded-full object-cover"
                />
              )}
              <p className="text-sm font-bold">
                {founder?.handle ? (
                  <Link href={`/p/${founder.handle}`} className="hover:underline">
                    {FOUNDER_NOTE.name}
                  </Link>
                ) : (
                  FOUNDER_NOTE.name
                )}
                <span className="font-medium text-white/45"> · {FOUNDER_NOTE.role}</span>
                {FOUNDER_NOTE.linkedin && (
                  <>
                    {" · "}
                    <a
                      href={FOUNDER_NOTE.linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-beedero-yellow hover:underline"
                    >
                      LinkedIn
                    </a>
                  </>
                )}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* 3 — what works today */}
      <section className="mx-auto max-w-[1100px] px-5 py-16 sm:px-8 sm:py-20">
        <h2 className="text-2xl font-black tracking-[-0.02em]">What works today</h2>
        <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-start">
          <div className="divide-y divide-white/10 border-y border-white/10">
            {WHAT_WORKS.map((item) => (
              <article key={item.title} className="py-6">
                <h3 className="text-lg font-black tracking-[-0.01em]">{item.title}</h3>
                <p className="mt-2 max-w-md text-sm leading-6 text-white/60">{item.body}</p>
              </article>
            ))}
          </div>
          <LandingPrivacyDemo />
        </div>
      </section>

      {/* 4 — where we are */}
      <section className="border-y border-white/10 px-5 py-14 sm:px-8">
        <div className="mx-auto max-w-[1100px]">
          <h2 className="text-2xl font-black tracking-[-0.02em]">Where we are</h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-white/65">{status}</p>
          <div className="mt-6 flex flex-wrap gap-5 text-sm font-bold">
            <Link href="/startups" className="text-beedero-yellow hover:underline">
              See who is on Beedero
            </Link>
            <Link href="/jobs" className="text-beedero-yellow hover:underline">
              Open roles
            </Link>
          </div>
        </div>
      </section>

      {/* 5 — price, and 6 — contact */}
      <section className="mx-auto max-w-[1100px] px-5 py-16 sm:px-8 sm:py-20">
        <h2 className="text-2xl font-black tracking-[-0.02em]">What it costs</h2>
        <p className="mt-4 max-w-2xl text-base leading-7 text-white/65">
          People are free. A startup is €33 a year or €3 a month; a company €99 a year or €9 a
          month, VAT included. With the code <span className="text-beedero-yellow">EARLYADOPTER</span>{" "}
          an organisation&rsquo;s first year is free, with no card.{" "}
          <Link href="/pricing" className="font-bold text-beedero-yellow hover:underline">
            Pricing
          </Link>
        </p>
        <p className="mt-8 text-sm leading-6 text-white/55">
          Questions go to{" "}
          <a
            href={`mailto:${COMPANY.contactEmail}`}
            className="font-bold text-beedero-yellow hover:underline"
          >
            {COMPANY.contactEmail}
          </a>
          .
        </p>
        <LandingPrimaryLink
          href={primaryHref}
          className="mt-10 inline-block rounded-full bg-beedero-yellow px-7 py-4 text-sm font-black text-beedero-black transition hover:bg-white"
        >
          {entering ? "Enter Beedero" : "Join"}
        </LandingPrimaryLink>
      </section>

      <LandingStickyCta primaryHref={primaryHref} primaryLabel={primaryLabel} />
    </main>
  );
}
