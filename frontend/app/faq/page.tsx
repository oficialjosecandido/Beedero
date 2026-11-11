import type { Metadata } from "next";
import Link from "next/link";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { PublicHeader } from "@/components/PublicHeader";
import { FAQ_ITEMS } from "@/lib/faq-content";
import { jsonLdHtml } from "@/lib/json-ld";
import { COMPANY } from "@/lib/legal-content";
import { pageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = pageMetadata({
  title: "Questions about Beedero",
  description:
    "Answers about free personal accounts, certidão permanente company verification, startup verification by hand, organisation pricing (€33/€99), Discover and LinkedIn import.",
  path: "/faq",
  keywords: [
    "Beedero FAQ",
    "founder verification",
    "certidão permanente",
    "EARLYADOPTER",
    "startup pricing",
    "professional network support",
  ],
});

export default function FaqPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLd) }}
      />
      <main className="flex flex-1 flex-col bg-beedero-white text-beedero-black">
        <PublicHeader current="/faq" tone="light" />
        <div className="mx-auto w-full max-w-3xl flex-1 px-5 pb-14 sm:px-8">
          <Breadcrumbs items={[{ label: "FAQ" }]} />
          <h1 className="mt-8 text-4xl font-black tracking-[-0.02em]">Questions</h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-zinc-600">
            If the answer is not here, write to{" "}
            <a
              href={`mailto:${COMPANY.contactEmail}`}
              className="font-semibold text-beedero-black underline decoration-beedero-yellow decoration-2 underline-offset-4"
            >
              {COMPANY.contactEmail}
            </a>
            .
          </p>

          <div className="mt-10 divide-y divide-beedero-border border-y border-beedero-border">
            {FAQ_ITEMS.map((item) => (
              <details key={item.question} className="group py-5">
                <summary className="cursor-pointer list-none text-base font-bold tracking-[-0.02em] marker:content-none [&::-webkit-details-marker]:hidden">
                  <span className="flex items-start justify-between gap-4">
                    {item.question}
                    <span className="mt-0.5 text-beedero-black/35 transition group-open:rotate-45">+</span>
                  </span>
                </summary>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-600">{item.answer}</p>
              </details>
            ))}
          </div>

          <p className="mt-10 text-sm text-zinc-600">
            <Link
              href="/register"
              className="font-semibold underline decoration-beedero-yellow decoration-2 underline-offset-4"
            >
              Join Beedero
            </Link>{" "}
            — a personal account is free.
          </p>
        </div>
      </main>
    </>
  );
}
