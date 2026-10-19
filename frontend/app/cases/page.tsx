import type { Metadata } from "next";
import Link from "next/link";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CASE_STUDIES } from "@/lib/cases-content";
import { pageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = pageMetadata({
  title: "Cases & results",
  description:
    "How founders, hiring teams and professionals use Beedero’s verified record — concrete outcomes, not vanity metrics.",
  path: "/cases",
  keywords: ["Beedero cases", "startup network results", "verified profiles"],
});

export default function CasesPage() {
  return (
    <main className="min-h-screen bg-[#070806] px-5 pb-16 text-white sm:px-8">
      <header className="mx-auto flex max-w-[1100px] items-center justify-between pb-5 pt-[max(2rem,env(safe-area-inset-top))] sm:py-5">
        <Link href="/" className="text-lg font-black uppercase tracking-[-0.07em]">
          Beedero
        </Link>
        <Link
          href="/register"
          className="rounded-full bg-beedero-yellow px-5 py-2.5 text-xs font-black uppercase text-beedero-black"
        >
          Join
        </Link>
      </header>

      <div className="mx-auto max-w-[1100px] py-10 sm:py-16">
        <Breadcrumbs items={[{ label: "Cases" }]} tone="light" />
        <p className="mt-8 text-[10px] font-black uppercase tracking-[0.2em] text-beedero-yellow">
          Results
        </p>
        <h1 className="mt-4 max-w-3xl text-[clamp(2.8rem,7vw,5.5rem)] font-black uppercase leading-[0.88] tracking-[-0.06em]">
          Proof the record
          <br />
          can carry.
        </h1>
        <p className="mt-6 max-w-xl text-base leading-7 text-white/65">
          Early outcomes from putting work where organisations can confirm it — and where search
          and people can find it.
        </p>

        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {CASE_STUDIES.map((study) => (
            <article
              key={study.slug}
              id={study.slug}
              className="flex flex-col border border-white/15 bg-white/[0.03] p-6"
            >
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-beedero-yellow">
                {study.role}
              </p>
              <h2 className="mt-4 text-xl font-black tracking-[-0.03em]">{study.headline}</h2>
              <p className="mt-4 flex-1 text-sm leading-6 text-white/60">{study.result}</p>
              <div className="mt-8 border-t border-white/10 pt-5">
                <p className="text-3xl font-black tracking-[-0.05em] text-beedero-yellow">
                  {study.metric}
                </p>
                <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-white/45">
                  {study.metricLabel}
                </p>
                <p className="mt-3 text-xs leading-5 text-white/50">{study.summary}</p>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-14 flex flex-wrap items-center gap-4 border border-beedero-yellow/40 bg-beedero-yellow px-6 py-6 text-beedero-black">
          <div className="min-w-0 flex-1">
            <p className="text-lg font-black tracking-[-0.03em]">Start your own record.</p>
            <p className="mt-1 text-sm text-beedero-black/70">Free to join. Organisations confirm what matters.</p>
          </div>
          <Link
            href="/register"
            className="rounded-full bg-beedero-black px-6 py-3 text-xs font-black uppercase text-beedero-yellow"
          >
            Join Beedero →
          </Link>
        </div>
      </div>
    </main>
  );
}
