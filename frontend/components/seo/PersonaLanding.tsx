import Link from "next/link";

import { PublicHeader } from "@/components/PublicHeader";
import { jsonLdHtml } from "@/lib/json-ld";
import type { SeoPersona } from "@/lib/seo-content";
import { SITE_URL } from "@/lib/site-metadata";

/**
 * Crawlable audience page: one H1, three points and FAQPage JSON-LD.
 *
 * Three points, not six, and no slogan above the H1 — the earlier version
 * said each thing three times (heading, point, question) and read as filler.
 * Whatever the page claims is said once.
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
        <PublicHeader current={persona.path} />

        <section className="mx-auto max-w-[1100px] px-5 pb-16 pt-10 sm:px-8 sm:pt-16">
          <h1 className="max-w-3xl text-[clamp(2.1rem,5vw,3.4rem)] font-black leading-[1.05] tracking-[-0.02em]">
            {persona.h1}
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-white/65 sm:text-lg sm:leading-8">
            {persona.lead}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-5">
            <Link
              href={persona.ctaHref}
              className="rounded-full bg-beedero-yellow px-6 py-3.5 text-sm font-black text-beedero-black"
            >
              {persona.ctaLabel}
            </Link>
            <Link href="/pricing" className="text-sm font-bold text-white/60 hover:text-white">
              Pricing
            </Link>
          </div>
        </section>

        <section className="border-y border-white/10 bg-white/[0.02]">
          <div className="mx-auto grid max-w-[1100px] sm:grid-cols-3">
            {persona.points.map((point) => (
              <article
                key={point.title}
                className="border-b border-white/10 p-6 last:border-b-0 sm:border-b-0 sm:border-r sm:p-8 sm:last:border-r-0"
              >
                <h2 className="text-lg font-black tracking-[-0.01em]">{point.title}</h2>
                <p className="mt-3 text-sm leading-6 text-white/60">{point.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-[1100px] px-5 py-16 sm:px-8">
          <h2 className="text-2xl font-black tracking-[-0.02em]">Questions</h2>
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

          <div className="mt-14 flex flex-wrap items-center gap-5 border-t border-white/10 pt-10">
            <Link
              href={persona.ctaHref}
              className="rounded-full bg-beedero-yellow px-6 py-3.5 text-sm font-black text-beedero-black"
            >
              {persona.ctaLabel}
            </Link>
            <p className="text-sm text-white/55">
              People are free. Startups €33 a year, companies €99 a year.
            </p>
          </div>
        </section>
      </main>
    </>
  );
}
