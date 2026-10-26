import type { Metadata } from "next";
import Link from "next/link";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { FAQ_ITEMS, SUPPORT_RESPONSE_SLA } from "@/lib/faq-content";
import { jsonLdHtml } from "@/lib/json-ld";
import { COMPANY } from "@/lib/legal-content";
import { pageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = pageMetadata({
  title: "FAQ",
  description:
    "Answers about Beedero accounts, verification, pricing and support — including our 24-hour response commitment.",
  path: "/faq",
  keywords: ["Beedero FAQ", "verification", "support", "startup network"],
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
        <div className="mx-auto w-full max-w-3xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
          <Breadcrumbs items={[{ label: "FAQ" }]} />
          <p className="mt-8 text-[10px] font-black uppercase tracking-[0.18em] text-beedero-black/45">
            Help
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] sm:text-5xl">
            Questions, answered.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-zinc-600">
            {SUPPORT_RESPONSE_SLA}{" "}
            <a
              href={`mailto:${COMPANY.contactEmail}`}
              className="font-semibold text-beedero-black underline decoration-beedero-yellow decoration-2 underline-offset-4"
            >
              {COMPANY.contactEmail}
            </a>
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
            Still stuck?{" "}
            <Link href="/register" className="font-semibold underline decoration-beedero-yellow decoration-2 underline-offset-4">
              Join Beedero
            </Link>{" "}
            or read how{" "}
            <Link href="/cases" className="font-semibold underline decoration-beedero-yellow decoration-2 underline-offset-4">
              teams use the record
            </Link>
            .
          </p>
        </div>
      </main>
    </>
  );
}
