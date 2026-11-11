"use client";

import { useState, type ReactNode } from "react";

function Hex({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`grid place-items-center [clip-path:polygon(25%_6%,75%_6%,100%_50%,75%_94%,25%_94%,0_50%)] ${className}`}
    >
      {children}
    </span>
  );
}

/**
 * A made-up number, labelled as one. It used to be headed "Product preview"
 * with a fake company name and a "Live MRR" of €84,600, which read as a real
 * customer's real revenue — on a site whose whole argument is that nothing
 * here is made up. Same control, no pretending.
 */
export function LandingPrivacyDemo() {
  const [access, setAccess] = useState<"Public" | "Verified only" | "Private">("Verified only");

  return (
    <div className="border border-white/15 bg-white/5 p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <p className="inline-flex rounded-full bg-white/10 px-3 py-1 text-[11px] font-black text-white/70">
            Example
          </p>
          <p className="mt-2 text-sm text-white/55">
            How one private number works on a startup&rsquo;s page
          </p>
        </div>
        <Hex className="h-12 w-12 bg-beedero-yellow text-xs font-black text-beedero-black">✓</Hex>
      </div>
      <div className="my-6 flex flex-wrap gap-2">
        {(["Public", "Verified only", "Private"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setAccess(option)}
            className={`rounded-full border px-4 py-2.5 text-xs font-black transition ${
              access === option
                ? "border-beedero-yellow bg-beedero-yellow text-beedero-black"
                : "border-white/20 text-white/65 hover:border-beedero-yellow"
            }`}
          >
            {option}
          </button>
        ))}
      </div>
      <div className="border border-white/15 p-5">
        <p className="text-[11px] font-bold text-white/45">Monthly revenue</p>
        <p
          className={`mt-3 text-5xl font-black tracking-[-0.02em] ${
            access === "Private" ? "select-none blur-md" : ""
          }`}
        >
          €84,600
        </p>
        <p className="mt-5 text-xs text-white/55">
          Visible to{" "}
          <b className="text-beedero-yellow">
            {access === "Public"
              ? "everyone"
              : access === "Private"
                ? "only you"
                : "approved investors"}
          </b>
        </p>
      </div>
      <p className="mt-4 text-xs leading-5 text-white/45">
        Click an audience. You choose who sees each part of a page: everyone, verified investors, or
        no one.
      </p>
    </div>
  );
}
