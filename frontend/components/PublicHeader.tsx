"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { Menu, X } from "lucide-react";

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
 *
 * Below `md` the link row collapses into a menu: same six destinations, same
 * labels — otherwise mobile visitors only ever saw Log in / Join.
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
  const [open, setOpen] = useState(false);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function linkClass(href: string) {
    if (href === current) {
      return dark ? "text-beedero-yellow" : "text-beedero-black";
    }
    return dark
      ? "text-white/60 transition hover:text-white"
      : "text-beedero-black/60 transition hover:text-beedero-black";
  }

  return (
    <header
      className={`relative mx-auto w-full max-w-[1440px] px-5 pb-5 pt-[max(2rem,env(safe-area-inset-top))] sm:px-8 sm:py-5 ${
        dark ? "text-white" : "text-beedero-black"
      }`}
    >
      <div className="flex items-center gap-x-4 sm:gap-x-6">
        <Link href="/" className="shrink-0 text-lg font-black uppercase tracking-[-0.02em]">
          Beedero
        </Link>

        <nav
          aria-label="Beedero"
          className="hidden flex-1 items-center gap-6 text-[13px] font-bold md:flex"
        >
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={link.href === current ? "page" : undefined}
              className={linkClass(link.href)}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3 sm:gap-4">
          {!cta && (
            <Link href="/login" className={`text-[13px] font-bold ${linkClass("/login")}`}>
              Log in
            </Link>
          )}
          <Link
            href={cta?.href ?? "/register"}
            className="rounded-full bg-beedero-yellow px-4 py-2.5 text-[13px] font-black text-beedero-black transition hover:bg-white sm:px-5"
          >
            {cta?.label ?? "Join"}
          </Link>
          <button
            type="button"
            className={`grid size-10 place-items-center md:hidden ${
              dark ? "text-white/80 hover:text-white" : "text-beedero-black/70 hover:text-beedero-black"
            }`}
            aria-expanded={open}
            aria-controls={menuId}
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X size={22} aria-hidden /> : <Menu size={22} aria-hidden />}
          </button>
        </div>
      </div>

      {open && (
        <nav
          id={menuId}
          aria-label="Beedero"
          className={`mt-4 border md:hidden ${
            dark ? "border-white/15 bg-[#0f1117]" : "border-beedero-border bg-beedero-white"
          }`}
        >
          <ul className={`divide-y ${dark ? "divide-white/10" : "divide-beedero-border"}`}>
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={link.href === current ? "page" : undefined}
                  onClick={() => setOpen(false)}
                  className={`block px-4 py-3.5 text-sm font-bold ${linkClass(link.href)}`}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
