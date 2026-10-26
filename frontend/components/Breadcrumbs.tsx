import Link from "next/link";

import { jsonLdHtml } from "@/lib/json-ld";
import { SITE_URL } from "@/lib/site-metadata";

export type Crumb = {
  href?: string;
  label: string;
};

type Props = {
  items: Crumb[];
  /** Light text for dark marketing pages. */
  tone?: "light" | "dark";
};

export function Breadcrumbs({ items, tone = "dark" }: Props) {
  const crumbs = [{ href: "/", label: "Home" }, ...items];
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.label,
      ...(crumb.href
        ? { item: crumb.href.startsWith("http") ? crumb.href : `${SITE_URL}${crumb.href}` }
        : {}),
    })),
  };

  const muted = tone === "light" ? "text-white/45" : "text-zinc-500";
  const link = tone === "light" ? "text-white/70 hover:text-white" : "text-zinc-600 hover:text-beedero-black";

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLd) }}
      />
      <nav aria-label="Breadcrumb" className={`text-xs ${muted}`}>
        <ol className="flex flex-wrap items-center gap-1.5">
          {crumbs.map((crumb, index) => {
            const last = index === crumbs.length - 1;
            return (
              <li key={`${crumb.label}-${index}`} className="flex items-center gap-1.5">
                {index > 0 && <span aria-hidden>/</span>}
                {crumb.href && !last ? (
                  <Link href={crumb.href} className={`font-semibold underline-offset-2 hover:underline ${link}`}>
                    {crumb.label}
                  </Link>
                ) : (
                  <span className={tone === "light" ? "text-white/85" : "text-zinc-800"} aria-current={last ? "page" : undefined}>
                    {crumb.label}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
