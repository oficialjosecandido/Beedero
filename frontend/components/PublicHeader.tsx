import Link from "next/link";

import { SEO_PERSONAS } from "@/lib/seo-content";

const LINKS = [
  ...SEO_PERSONAS.map((persona) => ({ href: persona.path, label: persona.navLabel })),
  { href: "/pricing", label: "Pricing" },
  { href: "/faq", label: "FAQ" },
] as const;

/**
 * The one header every public page uses. There were six different ones, with
 * different links and a different button on each — which is most of why the
 * site read as a template.
 *
 * `tone` is the only thing that varies: the marketing pages are dark and the
 * help and legal pages are light. Links, labels and the button do not.
 *
 * Signed out, there is one primary action — Join — and a quiet Log in. `cta`
 * replaces it on the home page when there is already a session, so the button
 * goes to the feed instead of asking someone to sign up twice.
 */
export function PublicHeader({
  current,
  tone = "dark",
  cta,
}: {
  /** Path of the page itself, so its own link is marked. */
  current?: string;
  tone?: "dark" | "light";
  cta?: { href: string; label: string };
}) {
  const dark = tone === "dark";

  return (
    <header
      className={`mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-6 gap-y-3 px-5 pb-5 pt-[max(2rem,env(safe-area-inset-top))] sm:px-8 sm:py-5 ${
        dark ? "text-white" : "text-beedero-black"
      }`}
    >
      <Link href="/" className="text-lg font-black uppercase tracking-[-0.02em]">
        Beedero
      </Link>

      <nav
        aria-label="Beedero"
        className={`hidden flex-1 items-center gap-6 text-[13px] font-bold md:flex ${
          dark ? "text-white/60" : "text-beedero-black/60"
        }`}
      >
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            aria-current={link.href === current ? "page" : undefined}
            className={
              link.href === current
                ? dark
                  ? "text-beedero-yellow"
                  : "text-beedero-black"
                : dark
                  ? "transition hover:text-white"
                  : "transition hover:text-beedero-black"
            }
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-4 md:ml-0">
        {!cta && (
          <Link
            href="/login"
            className={`text-[13px] font-bold ${
              dark ? "text-white/60 hover:text-white" : "text-beedero-black/60 hover:text-beedero-black"
            }`}
          >
            Log in
          </Link>
        )}
        <Link
          href={cta?.href ?? "/register"}
          className="rounded-full bg-beedero-yellow px-5 py-2.5 text-[13px] font-black text-beedero-black transition hover:bg-white"
        >
          {cta?.label ?? "Join"}
        </Link>
      </div>
    </header>
  );
}
