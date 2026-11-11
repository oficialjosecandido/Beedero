import Link from "next/link";

import { SUPPORT_RESPONSE_SLA } from "@/lib/faq-content";
import { COMPANY } from "@/lib/legal-content";
import { ONE_LINER, SEO_PERSONAS } from "@/lib/seo-content";

const PRODUCT_LINKS = [
  ...SEO_PERSONAS.map((persona) => ({ href: persona.path, label: persona.navLabel })),
  { href: "/pricing", label: "Pricing" },
  { href: "/startups", label: "Discover" },
  // On every page, which is how a crawler finds /jobs without waiting for the
  // sitemap — and how a visitor who came for a company finds the roles.
  { href: "/jobs", label: "Open roles" },
] as const;

const LEGAL_LINKS = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms & Conditions" },
  { href: "/cookies", label: "Cookie Policy" },
  { href: "/disputes", label: "Dispute Resolution" },
  { href: "/legal-information", label: "Legal Information" },
] as const;

const COMPANY_LINKS = [
  { href: "/about", label: "About" },
  { href: "/faq", label: "FAQ" },
  { href: `mailto:${COMPANY.contactEmail}`, label: COMPANY.contactEmail },
  {
    href: "https://www.livroreclamacoes.pt/inicio",
    label: "Complaints Book",
    external: true,
  },
] as const;

function FooterNav({
  title,
  label,
  links,
}: {
  title: string;
  label: string;
  links: readonly { href: string; label: string; external?: boolean }[];
}) {
  return (
    <nav aria-label={label} className="flex flex-col gap-3">
      <h2 className="text-xs font-black uppercase tracking-[0.14em] text-beedero-black">{title}</h2>
      <ul className="flex flex-col gap-2">
        {links.map((link) => (
          <li key={link.href}>
            {link.external ? (
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-beedero-black/80 transition-colors hover:text-beedero-black"
              >
                {link.label}
              </a>
            ) : link.href.startsWith("mailto:") ? (
              <a
                href={link.href}
                className="text-sm font-medium text-beedero-black/80 transition-colors hover:text-beedero-black"
              >
                {link.label}
              </a>
            ) : (
              <Link
                href={link.href}
                prefetch={false}
                className="text-sm font-medium text-beedero-black/80 transition-colors hover:text-beedero-black"
              >
                {link.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * The one footer, on every public page. The landing had a second one with a
 * different tagline and a different set of links; both said something
 * different about what Beedero is, so both now say `ONE_LINER`.
 *
 * This is also the one place that states the support promise, so it is not
 * repeated three times on the way down a page.
 */
export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto bg-beedero-yellow text-beedero-black">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          <div className="sm:col-span-2 lg:col-span-1">
            <Link href="/" className="text-lg font-black uppercase tracking-[-0.02em]">
              Beedero
            </Link>
            <p className="mt-3 max-w-xs text-sm leading-6 text-beedero-black/75">{ONE_LINER}</p>
            <p className="mt-3 max-w-xs text-sm leading-6 text-beedero-black/60">
              {SUPPORT_RESPONSE_SLA}
            </p>
          </div>

          <FooterNav title="Product" label="Product" links={PRODUCT_LINKS} />
          <FooterNav title="Legal" label="Legal" links={LEGAL_LINKS} />
          <FooterNav title="Company" label="Company" links={COMPANY_LINKS} />
        </div>

        <div className="mt-10 border-t border-beedero-black/15 pt-8 text-xs leading-6 text-beedero-black/75">
          <p>
            {COMPANY.name} · Tax ID {COMPANY.nif} · {COMPANY.address} · Share capital{" "}
            {COMPANY.capital} · {COMPANY.registry}
          </p>
          <p className="mt-2">© {year} Beedero. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
