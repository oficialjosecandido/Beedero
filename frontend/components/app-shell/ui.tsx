/**
 * Shared chrome for the dark `/(app)` routes, matching the Figma platform
 * design. Server-safe on purpose (no "use client") so both page Server
 * Components and the interactive client panels can import these.
 */
import type { ReactNode } from "react";

/**
 * Eyebrow + display heading. Every `/(app)` page opens with this pair.
 * `className` replaces the default bottom margin for pages whose next
 * element brings its own top spacing (the Opportunities search bar).
 */
export function PageHeading({
  eyebrow,
  title,
  actions,
  className = "mb-8",
}: {
  eyebrow: string;
  title: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-end justify-between gap-4 ${className}`}>
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-beedero-yellow">
          {eyebrow}
        </p>
        <h1 className="mt-2 text-[2.5rem] font-black leading-none tracking-[-0.045em] sm:text-5xl">
          {title}
        </h1>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** The design's base surface: a hairline border over a barely-lit panel. */
export function Panel({
  children,
  className = "",
  as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "article" | "aside";
}) {
  return <Tag className={`border border-white/10 bg-white/[0.025] ${className}`}>{children}</Tag>;
}

/** Panel header: icon + title, optional trailing slot. */
export function PanelHeader({
  icon,
  title,
  trailing,
}: {
  icon?: ReactNode;
  title: string;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
      <div className="flex min-w-0 items-center gap-2">
        {icon}
        <h2 className="truncate text-base font-black tracking-[-0.03em]">{title}</h2>
      </div>
      {trailing}
    </div>
  );
}

/** Count pill next to a panel title. */
export function CountPill({ count }: { count: number }) {
  return (
    <span className="rounded-full bg-beedero-yellow px-1.5 py-0.5 text-[9px] font-black text-beedero-black">
      {count}
    </span>
  );
}

/**
 * The hexagonal verification seal. `clip-path` rather than an SVG so it
 * inherits `currentColor` and scales with the surrounding type.
 */
export function Seal({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`grid size-5 shrink-0 place-items-center bg-beedero-yellow text-[9px] font-black text-beedero-black [clip-path:polygon(25%_6%,75%_6%,100%_50%,75%_94%,25%_94%,0_50%)] ${className}`}
    >
      ✓
    </span>
  );
}

/** Dashed "nothing here" box. */
export function EmptyPanel({ children }: { children: ReactNode }) {
  return (
    <p className="border border-dashed border-white/15 p-8 text-center text-sm text-white/45">
      {children}
    </p>
  );
}

/**
 * Pulsing placeholder for the dark shell's `loading.tsx` files. The light
 * `Skeleton` is `bg-zinc-100`, which glares on the app background.
 * Square-cornered like everything else in the design.
 */
export function Shimmer({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse bg-white/[0.06] ${className}`} />;
}

/** Dark form field + its uppercase label, as the design's modals use them. */
export const inputDark =
  "w-full border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-white outline-none transition focus:border-beedero-yellow";

export const labelDark = "text-[10px] font-black uppercase tracking-[0.12em] text-white/40";

export const btnPrimary =
  "flex items-center gap-2 bg-beedero-yellow px-4 py-2.5 text-xs font-black text-beedero-black transition hover:opacity-90 disabled:cursor-default disabled:opacity-40";

export const btnGhost =
  "flex items-center gap-2 border border-white/15 px-4 py-2.5 text-xs font-bold text-white/70 transition hover:border-beedero-yellow hover:text-beedero-yellow disabled:cursor-default disabled:opacity-40";

export const btnOutlineYellow =
  "flex items-center gap-2 border border-beedero-yellow/60 px-4 py-2.5 text-xs font-bold text-beedero-yellow transition hover:bg-beedero-yellow hover:text-beedero-black disabled:cursor-default disabled:opacity-40";

/** Initials avatar, used wherever a person has no picture. */
export function Initials({ name, className = "" }: { name: string; className?: string }) {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?";
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-full bg-[#5f6b80] font-black text-white ${className}`}
    >
      {initials}
    </span>
  );
}
