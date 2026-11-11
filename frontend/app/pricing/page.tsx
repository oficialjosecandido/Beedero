import Link from "next/link";

import { PublicHeader } from "@/components/PublicHeader";
import { jsonLdHtml } from "@/lib/json-ld";
import { getAccessToken, getRefreshToken } from "@/lib/session";
import { pageMetadata, SITE_URL } from "@/lib/site-metadata";

export const metadata = pageMetadata({
  title: "Pricing — free for people, from €33/year for organisations",
  description:
    "Beedero is free for people. Startups pay €33/year or €3/month; companies €99/year or €9/month, VAT included. First year free with EARLYADOPTER — no card required.",
  path: "/pricing",
  keywords: [
    "Beedero pricing",
    "free professional network",
    "startup €33 year",
    "company €99 year",
    "EARLYADOPTER",
    "VAT included",
  ],
});

const PERSONAL = [
  "Verified personal profile",
  "Organisation-confirmed roles",
  "Network discovery and messaging after connection",
  "Apply to jobs at verified startups and companies",
  "Co-founder matching as a person",
] as const;

/** Same amounts as lib/billing.ts PRICES_BY_KIND (display only). */
const ORG_PLANS = [
  {
    kind: "startup",
    label: "Startup",
    plural: "startups",
    short: "Not incorporated yet",
    yearly: "€33",
    monthly: "€3",
    href: "/for-startups",
    description: "Verified by hand, because there is no company to look up yet.",
    extras: [
      "Co-founder roles and matching",
      "Private pre-seed ask for verified investors",
      "Weekly updates, events and jobs",
      "Keep history when you incorporate",
    ],
  },
  {
    kind: "company",
    label: "Company",
    // Spelled out because "company" + "s" is how the page used to say
    // "companys" to every visitor.
    plural: "companies",
    short: "Incorporated",
    yearly: "€99",
    monthly: "€9",
    href: "/for-companies",
    description:
      "Confirmed against its certidão permanente at the commercial registry. Portugal for now.",
    extras: [
      "Full fundraising rounds with data room",
      "Investor-confirmed track record",
      "Job posts that can state the equity on offer",
      "Verified page with Insights",
    ],
  },
] as const;

const QUESTIONS = [
  {
    q: "Startup or company?",
    a: "A startup hasn’t incorporated yet; a company has. When your startup becomes a company, confirm its certidão permanente in the workspace — the company price applies from a renewal at least 30 days after we tell you.",
  },
  {
    q: "Do I need a card for the free year?",
    a: "No. With the EARLYADOPTER code the organisation is free for a year, with nothing to fill in. A month before the year ends we remind you; if you don’t add a card, the organisation simply pauses.",
  },
  {
    q: "What does “paused” mean?",
    a: "The public page stays up and nothing is deleted. The organisation is hidden from Discover and can’t post or publish jobs until it has a plan again.",
  },
  {
    q: "Can I cancel?",
    a: "Any time, from the workspace. The plan runs until the end of the period you paid for. Within 14 days of your first payment, you can ask for a full refund.",
  },
  {
    q: "Do you issue invoices?",
    a: "Yes. Stripe emails a receipt for every payment, and the fatura — with your company’s VAT number, if you add it at checkout — follows by email.",
  },
] as const;

export default async function PricingPage() {
  const authed = Boolean((await getAccessToken()) || (await getRefreshToken()));
  const joinHref = authed ? "/feed" : "/register";

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: QUESTIONS.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "Beedero organisation plans",
    description:
      "Organisation workspaces on Beedero — startups from €33/year, companies from €99/year, VAT included.",
    brand: { "@type": "Brand", name: "Beedero" },
    offers: ORG_PLANS.map((plan) => ({
      "@type": "Offer",
      name: `${plan.label} yearly`,
      price: plan.kind === "startup" ? "33.00" : "99.00",
      priceCurrency: "EUR",
      url: `${SITE_URL}${plan.href}`,
      description: `${plan.description} Or ${plan.monthly}/month. First year free with EARLYADOPTER.`,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(faqJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(productJsonLd) }}
      />
      <main className="min-h-screen bg-[#070806] text-white">
        <PublicHeader current="/pricing" />

        <section className="mx-auto max-w-[1280px] px-5 py-12 sm:px-8 sm:py-16">
          <h1 className="max-w-3xl text-[clamp(2.3rem,5.4vw,4rem)] font-black leading-[1.03] tracking-[-0.025em]">
            Pricing
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-white/65">
            People pay nothing — profile, connections and messages. An organisation pays a
            subscription, priced by what it is: a startup that has not incorporated yet, or a
            company that has.
          </p>

          <div className="mt-8 grid gap-3 lg:grid-cols-[0.75fr_1.25fr]">
            <section className="border border-white/15 bg-white/5 p-7 sm:p-9">
              <p className="text-sm font-black text-beedero-yellow">People</p>
              <h2 className="mt-4 text-5xl font-black tracking-[-0.02em]">Free</h2>
              <p className="mt-4 max-w-md text-sm leading-6 text-white/65">
                A personal account is free: profile, roles your organisation confirms, connections,
                messages and job applications.
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
                className="mt-10 inline-block rounded-full bg-beedero-yellow px-6 py-3.5 text-sm font-black text-beedero-black"
              >
                {authed ? "Enter Beedero" : "Join"}
              </Link>
              <p className="mt-4 text-xs text-white/40">
                Also see{" "}
                <Link href="/for-founders" className="text-beedero-yellow hover:underline">
                  founders
                </Link>{" "}
                and{" "}
                <Link href="/for-professionals" className="text-beedero-yellow hover:underline">
                  professionals
                </Link>
                .
              </p>
            </section>

            <div className="grid gap-3 sm:grid-cols-2">
              {ORG_PLANS.map((plan) => (
                <section
                  key={plan.kind}
                  className={
                    plan.kind === "company"
                      ? "border border-beedero-yellow bg-beedero-yellow p-7 text-beedero-black sm:p-8"
                      : "border border-white/15 bg-white/5 p-7 sm:p-8"
                  }
                >
                  <p
                    className={`text-sm font-black ${
                      plan.kind === "company" ? "text-beedero-black/70" : "text-beedero-yellow"
                    }`}
                  >
                    {plan.label} · {plan.short}
                  </p>
                  <h2 className="mt-4 flex flex-wrap items-baseline gap-x-2 font-black tracking-[-0.02em]">
                    <span className="text-5xl">{plan.yearly}</span>
                    <span className="text-base">/ year</span>
                  </h2>
                  <p
                    className={`mt-1 text-sm font-bold ${
                      plan.kind === "company" ? "text-beedero-black/70" : "text-white/70"
                    }`}
                  >
                    or {plan.monthly}/month · VAT included
                  </p>
                  <p
                    className={`mt-4 text-sm leading-6 ${
                      plan.kind === "company" ? "text-beedero-black/70" : "text-white/65"
                    }`}
                  >
                    {plan.description}
                  </p>
                  <ul
                    className={`mt-6 space-y-2.5 border-t pt-5 text-sm ${
                      plan.kind === "company" ? "border-black/15" : "border-white/10"
                    }`}
                  >
                    {plan.extras.map((item) => (
                      <li className="flex gap-2" key={item}>
                        <span className="font-black">✓</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                  {/* The card is where the kind is chosen, so it travels with
                      the link — the creation page arrives with it ticked. */}
                  <div className="mt-6 flex flex-col gap-2">
                    <Link
                      href={authed ? `/orgs/new?kind=${plan.kind}` : "/register"}
                      className={`inline-block self-start rounded-full px-5 py-3 text-sm font-black ${
                        plan.kind === "company"
                          ? "bg-beedero-black text-white"
                          : "bg-beedero-yellow text-beedero-black"
                      }`}
                    >
                      Create {plan.kind === "company" ? "a company" : "a startup"}
                    </Link>
                    <Link
                      href={plan.href}
                      className={`inline-block text-sm font-bold ${
                        plan.kind === "company"
                          ? "text-beedero-black underline decoration-2 underline-offset-4"
                          : "text-beedero-yellow hover:underline"
                      }`}
                    >
                      What {plan.plural} get
                    </Link>
                  </div>
                </section>
              ))}
            </div>
          </div>

          {/* Information, not a third button — the two cards above already
              carry the only CTA this page needs. */}
          <div className="mt-6 border border-white/10 bg-white/[0.03] px-6 py-5">
            <p className="text-sm font-black">The first year is free.</p>
            <p className="mt-1 max-w-xl text-sm leading-6 text-white/55">
              Enter <span className="text-beedero-yellow">EARLYADOPTER</span> when you create the
              organisation. No card needed.
            </p>
          </div>

          <div className="mt-16 grid gap-x-10 gap-y-8 border-t border-white/10 pt-10 md:grid-cols-2">
            {QUESTIONS.map((item) => (
              <div key={item.q}>
                <h3 className="text-base font-black">{item.q}</h3>
                <p className="mt-2 text-sm leading-6 text-white/60">{item.a}</p>
              </div>
            ))}
          </div>

          <p className="mt-12 text-sm text-white/45">
            Prices include VAT. Full conditions in the{" "}
            <Link href="/terms#subscriptions" className="underline">
              Terms
            </Link>
            .
          </p>
        </section>
      </main>
    </>
  );
}
