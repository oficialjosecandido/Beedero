import type { ReactNode } from "react";

/**
 * Shared pieces of the Figma organisation workspace — the light brutalist
 * context: hard 2px ink borders with a 5px offset shadow, on a yellow ground.
 * Colours come from the `--color-org-*` tokens in globals.css.
 */

/** The design's cut-corner hexagon used for organisation marks. */
export const orgHexClip =
  "[clip-path:polygon(20%_0,80%_0,100%_20%,100%_80%,80%_100%,20%_100%,0_80%,0_20%)]";

export const orgBrutalBorder = "border-2 border-org-ink shadow-[5px_5px_0_#17191f]";

export const orgEyebrowClass = "text-[10px] font-black uppercase tracking-[0.16em]";

/** `Alma Labs` → `A`; falls back to a bullet so the mark is never empty. */
export function orgInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "·";
}

export function personInitials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

export function OrgMark({
  name,
  logo,
  className,
  inverted = false,
}: {
  name: string;
  logo?: string | null;
  className: string;
  inverted?: boolean;
}) {
  if (logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logo}
        alt=""
        className={`shrink-0 object-cover ${orgHexClip} ${className}`}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center font-black ${orgHexClip} ${
        inverted ? "bg-beedero-yellow text-org-ink" : "bg-org-ink text-white"
      } ${className}`}
    >
      {orgInitial(name)}
    </span>
  );
}

/** A white brutalist card — the workspace's default content surface. */
export function OrgCard({
  children,
  className = "",
  tone = "white",
}: {
  children: ReactNode;
  className?: string;
  tone?: "white" | "cream" | "yellow" | "ink";
}) {
  const tones = {
    white: "bg-white text-org-ink",
    cream: "bg-org-cream text-org-ink",
    yellow: "bg-beedero-yellow text-org-ink",
    ink: "bg-org-ink text-white",
  };
  return (
    <section className={`${orgBrutalBorder} ${tones[tone]} p-5 sm:p-6 ${className}`}>
      {children}
    </section>
  );
}

/** Eyebrow + display heading, the pair every workspace card opens with. */
export function OrgCardHeading({
  eyebrow,
  title,
  onDark = false,
}: {
  eyebrow: string;
  title: string;
  onDark?: boolean;
}) {
  return (
    <div>
      <p className={`${orgEyebrowClass} ${onDark ? "text-beedero-yellow" : "text-org-ink"}`}>
        {eyebrow}
      </p>
      <h2 className="mt-2 text-3xl font-black tracking-[-0.04em]">{title}</h2>
    </div>
  );
}

export const orgInkButtonClass =
  "flex items-center gap-2 bg-org-ink px-3 py-2 text-xs font-bold text-white transition hover:bg-black";

export const orgOutlineButtonClass =
  "flex items-center gap-2 border border-black/30 px-4 py-2.5 text-xs font-bold text-org-ink transition hover:border-org-ink hover:bg-org-chip";
