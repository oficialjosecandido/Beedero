import Link from "next/link";
import type { ReactNode } from "react";

import { formatDate, formatRelativeTime } from "@/lib/format";
import { PLAN_STATE_LABELS, kpiValue, type KpiCard, type PersonRef } from "@/lib/nexus";

/**
 * The Nexus look: the dark app surfaces with the yellow kept for what needs
 * attention. Dense on purpose — it is a tool for reading a lot at once.
 */

export const nexusInputClass =
  "w-full border border-app-border bg-app-bg px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-beedero-yellow";

export const nexusButtonClass =
  "inline-flex items-center justify-center gap-2 border border-app-border px-3 py-2 text-xs font-bold text-white transition hover:border-white/40 hover:bg-white/5 disabled:opacity-50";

export const nexusPrimaryButtonClass =
  "inline-flex items-center justify-center gap-2 bg-beedero-yellow px-3 py-2 text-xs font-black text-beedero-black transition hover:bg-white disabled:opacity-50";

export const nexusDangerButtonClass =
  "inline-flex items-center justify-center gap-2 border border-[#ff6b5e]/50 px-3 py-2 text-xs font-bold text-[#ff8d82] transition hover:bg-[#ff6b5e]/10 disabled:opacity-50";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-app-border pb-5">
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-beedero-yellow">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-white">{title}</h1>
        {description && <p className="mt-2 max-w-3xl text-sm leading-6 text-white/55">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Panel({
  title,
  aside,
  children,
  className = "",
}: {
  title?: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`min-w-0 border border-app-border bg-app-surface ${className}`}>
      {(title || aside) && (
        <div className="flex items-center justify-between gap-3 border-b border-app-border px-4 py-3">
          {title && <h2 className="text-[11px] font-black uppercase tracking-[0.16em] text-white/70">{title}</h2>}
          {aside}
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "good" | "warn" | "bad" | "accent";
}) {
  const tones = {
    neutral: "border-app-border text-white/60",
    good: "border-[#3ecf8e]/40 text-[#6ee7b7]",
    warn: "border-beedero-yellow/50 text-beedero-yellow",
    bad: "border-[#ff6b5e]/50 text-[#ff8d82]",
    accent: "border-beedero-yellow bg-beedero-yellow text-beedero-black",
  };
  return (
    <span
      className={`inline-flex shrink-0 items-center border px-1.5 py-0.5 text-[10px] font-black uppercase tracking-[0.08em] ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function PlanBadge({ state }: { state: string }) {
  const tone =
    state === "active" || state === "comp"
      ? "good"
      : state === "free_year" || state === "trialing"
        ? "neutral"
        : state === "past_due"
          ? "warn"
          : "bad";
  return <Badge tone={tone}>{PLAN_STATE_LABELS[state] ?? state}</Badge>;
}

function trend(card: KpiCard): { text: string; tone: string } | null {
  if (card.value === null || card.previous === null || card.previous === undefined) return null;
  const diff = card.value - card.previous;
  if (diff === 0) return { text: "same as before", tone: "text-white/40" };
  const up = diff > 0;
  const good = up === card.good_when_up;
  const pct = card.previous ? ` (${up ? "+" : ""}${Math.round((diff / card.previous) * 100)}%)` : "";
  return {
    text: `${up ? "+" : ""}${diff.toLocaleString("en-GB")}${pct} vs previous`,
    tone: good ? "text-[#6ee7b7]" : "text-[#ff8d82]",
  };
}

export function Kpi({ card }: { card: KpiCard }) {
  const change = trend(card);
  return (
    <div className="border border-app-border bg-app-surface p-4" title={card.hint || undefined}>
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/45">{card.label}</p>
      <p className="mt-2 text-3xl font-black tabular-nums tracking-[-0.04em] text-white">{kpiValue(card)}</p>
      {change && <p className={`mt-1 text-[11px] font-bold ${change.tone}`}>{change.text}</p>}
      {card.hint && <p className="mt-1 text-[11px] leading-4 text-white/35">{card.hint}</p>}
    </div>
  );
}

export function Avatar({ person, size = 32 }: { person: Pick<PersonRef, "name" | "avatar">; size?: number }) {
  const initials =
    person.name
      .split(/[\s@]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?";
  if (person.avatar) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={person.avatar} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-full bg-white/10 text-[10px] font-black text-white/70"
      style={{ width: size, height: size }}
    >
      {initials}
    </span>
  );
}

export function PersonCell({ person, href }: { person: PersonRef | null; href?: string }) {
  if (!person) return <span className="text-white/40">—</span>;
  const content = (
    <span className="flex min-w-0 items-center gap-2.5">
      <Avatar person={person} />
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold text-white">{person.name}</span>
        <span className="block truncate text-xs text-white/45">{person.email}</span>
      </span>
    </span>
  );
  return href ? (
    <Link href={href} className="hover:opacity-80">
      {content}
    </Link>
  ) : (
    content
  );
}

/** Tabs that are just links, so a filtered list is a URL that can be shared. */
export function FilterTabs({
  base,
  current,
  options,
  keep = {},
  param = "filter",
}: {
  base: string;
  current: string;
  options: { key: string; label: string }[];
  keep?: Record<string, string | undefined>;
  param?: string;
}) {
  return (
    <nav className="flex flex-wrap gap-1" aria-label="Filter">
      {options.map((option) => {
        const search = new URLSearchParams();
        for (const [key, value] of Object.entries(keep)) if (value) search.set(key, value);
        if (option.key) search.set(param, option.key);
        const href = `${base}${search.toString() ? `?${search}` : ""}`;
        const active = option.key === current;
        return (
          <Link
            key={option.key || "all"}
            href={href}
            className={`border px-2.5 py-1.5 text-xs font-bold transition ${
              active
                ? "border-beedero-yellow bg-beedero-yellow text-beedero-black"
                : "border-app-border text-white/60 hover:border-white/40 hover:text-white"
            }`}
          >
            {option.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** A plain GET form: the search lives in the URL. */
export function SearchForm({
  action,
  value,
  placeholder,
  hidden = {},
}: {
  action: string;
  value?: string;
  placeholder: string;
  hidden?: Record<string, string | undefined>;
}) {
  return (
    <form action={action} className="flex w-full max-w-md gap-2">
      {Object.entries(hidden).map(([key, val]) => (val ? <input key={key} type="hidden" name={key} value={val} /> : null))}
      <input name="q" defaultValue={value} placeholder={placeholder} className={nexusInputClass} aria-label="Search" />
      <button type="submit" className={nexusButtonClass}>
        Search
      </button>
    </form>
  );
}

export function Pager({
  base,
  page,
  pages,
  total,
  params = {},
}: {
  base: string;
  page: number;
  pages: number;
  total: number;
  params?: Record<string, string | undefined>;
}) {
  const href = (target: number) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
    if (target > 1) search.set("page", String(target));
    return `${base}${search.toString() ? `?${search}` : ""}`;
  };
  return (
    <div className="mt-4 flex items-center justify-between text-xs text-white/50">
      <span>
        {total.toLocaleString("en-GB")} {total === 1 ? "result" : "results"}
      </span>
      <span className="flex items-center gap-2">
        {page > 1 && (
          <Link href={href(page - 1)} className={nexusButtonClass}>
            ← Previous
          </Link>
        )}
        <span>
          Page {page} of {pages}
        </span>
        {page < pages && (
          <Link href={href(page + 1)} className={nexusButtonClass}>
            Next →
          </Link>
        )}
      </span>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="border border-dashed border-app-border px-4 py-8 text-center text-sm text-white/45">{children}</p>;
}

export function When({ at, relative = true }: { at: string | null | undefined; relative?: boolean }) {
  if (!at) return <span className="text-white/35">—</span>;
  return (
    <time dateTime={at} title={new Date(at).toLocaleString("en-GB")}>
      {relative ? formatRelativeTime(at) : formatDate(at)}
    </time>
  );
}

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-app-border py-2 last:border-0">
      <dt className="shrink-0 text-xs text-white/45">{label}</dt>
      <dd className="min-w-0 text-right text-sm text-white">{children}</dd>
    </div>
  );
}

export const tableClass = "w-full min-w-[720px] border-collapse text-left text-sm";
export const thClass = "border-b border-app-border px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-white/40";
export const tdClass = "border-b border-app-border px-3 py-2.5 align-middle text-white/80";
