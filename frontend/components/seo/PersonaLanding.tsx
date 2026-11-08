import Link from "next/link";

import { jsonLdHtml } from "@/lib/json-ld";
import type { SeoPersona } from "@/lib/seo-content";
import { SEO_PERSONAS } from "@/lib/seo-content";
import { SITE_URL } from "@/lib/site-metadata";

/**
 * Crawlable persona landing — one H1, value points and FAQPage JSON-LD so
 * search engines can rank Beedero for founder / talent / startup / company
 * intent without needing an account.
 */
export function PersonaLanding({ persona }: { persona: SeoPersona }) {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: persona.faqs.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };

  const webPageJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: persona.title,
    description: persona.description,
    url: `${SITE_URL}${persona.path}`,
    isPartOf: { "@type": "WebSite", name: "Beedero", url: SITE_URL },
    about: {
      "@type": "SoftwareApplication",
      name: "Beedero",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(faqJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(webPageJsonLd) }}
      />
      <main className="min-h-screen bg-[#070806] text-white">
        <header className="mx-auto flex max-w-[1100px] items-center justify-between px-5 pb-5 pt-[max(2rem,env(safe-area-inset-top))] sm:px-8 sm:py-5">
          <Link href="/" className="text-lg font-black uppercase tracking-[-0.02em]">
            Beedero
          </Link>
          <nav className="hidden items-center gap-5 text-[11px] font-black uppercase tracking-[0.06em] text-white/55 md:flex">
            {SEO_PERSONAS.map((item) => (
              <Link
                key={item.slug}
                href={item.path}
                className={
                  item.slug === persona.slug ? "text-beedero-yellow" : "transition hover:text-white"
                }
              >
                {item.navLabel}
              </Link>
            ))}
            <Link href="/pricing" className="transition hover:text-white">
              Pricing
            </Link>
          </nav>
          <Link
            href={persona.ctaHref}
            className="rounded-full bg-beedero-yellow px-5 py-2.5 text-xs font-black uppercase text-beedero-black"
          >
            Join
          </Link>
        </header>

        <section className="mx-auto max-w-[1100px] px-5 pb-16 pt-10 sm:px-8 sm:pt-16">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-beedero-yellow">
            {persona.eyebrow}
          </p>
          <h1 className="mt-5 max-w-4xl text-[clamp(2.6rem,6.5vw,5.2rem)] font-black uppercase leading-[0.9] tracking-[-0.02em]">
            {persona.h1}
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-white/65 sm:text-lg sm:leading-8">
            {persona.lead}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={persona.ctaHref}
              className="rounded-full bg-beedero-yellow px-6 py-3.5 text-xs font-black uppercase text-beedero-black"
            >
              {persona.ctaLabel} →
            </Link>
            <Link
              href="/pricing"
              className="rounded-full border border-white/20 px-6 py-3.5 text-xs font-black uppercase text-white/80 transition hover:border-beedero-yellow hover:text-beedero-yellow"
            >
              See pricing
            </Link>
          </div>
        </section>

        <section className="border-y border-white/10 bg-white/[0.02]">
          <div className="mx-auto grid max-w-[1100px] sm:grid-cols-2">
            {persona.points.map((point, index) => (
              <article
                key={point.title}
                className="border-b border-white/10 p-6 sm:border-r sm:p-8 sm:odd:[&:nth-last-child(-n+2)]:border-b-0 sm:even:border-r-0"
              >
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-beedero-yellow/70">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <h2 className="mt-4 text-xl font-black tracking-[-0.02em] sm:text-2xl">{point.title}</h2>
                <p className="mt-3 max-w-md text-sm leading-6 text-white/60">{point.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-[1100px] px-5 py-16 sm:px-8">
          <h2 className="text-3xl font-black uppercase tracking-[-0.02em] sm:text-4xl">
            Common questions
          </h2>
          <div className="mt-8 divide-y divide-white/10 border-y border-white/10">
            {persona.faqs.map((item) => (
              <details key={item.question} className="group py-5">
                <summary className="cursor-pointer list-none text-base font-bold marker:content-none [&::-webkit-details-marker]:hidden">
                  <span className="flex items-start justify-between gap-4">
                    {item.question}
                    <span className="text-white/35 transition group-open:rotate-45">+</span>
                  </span>
                </summary>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-white/55">{item.answer}</p>
              </details>
            ))}
          </div>

          <div className="mt-14 flex flex-wrap items-end justify-between gap-6 border-t border-white/10 pt-10">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-beedero-yellow">
                Next step
              </p>
              <p className="mt-3 max-w-md text-2xl font-black uppercase tracking-[-0.02em]">
                Join free. Organisations start from €33/year.
              </p>
            </div>
            <Link
              href={persona.ctaHref}
              className="rounded-full bg-beedero-yellow px-7 py-4 text-xs font-black uppercase text-beedero-black"
            >
              {persona.ctaLabel} →
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
