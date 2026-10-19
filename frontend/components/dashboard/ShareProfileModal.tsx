"use client";

import Link from "next/link";
import { useState } from "react";
import { Globe2, Share2, X } from "lucide-react";

import { PersonBadgeEmbedPanel, personProfileUrl } from "@/components/PersonalProfilePanels";
import { VISIBILITY_SECTIONS, visibilityLabel } from "@/lib/profile-visibility";

type BadgeProps = Parameters<typeof PersonBadgeEmbedPanel>[0];

/**
 * Share profile: copy the link, see what visitors get, grab the badge.
 *
 * It no longer edits visibility. That lives on each section of /profile
 * (VisibilityPill); a second editor here showed stale values as soon as a
 * pill changed, and two places to set one thing is one too many.
 */
export function ShareProfileModal({
  handle,
  visibility,
  badgeEmbed,
  badge,
}: {
  handle: string | null | undefined;
  visibility: Record<string, string> | undefined;
  badgeEmbed?: BadgeProps["embed"] | null;
  badge?: BadgeProps["badge"] | null;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const profileUrl = handle ? personProfileUrl(handle) : null;

  function copyLink() {
    if (!profileUrl) return;
    navigator.clipboard?.writeText(profileUrl);
    setCopied(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setCopied(false);
          setOpen(true);
        }}
        className="flex items-center gap-2 border border-white/15 px-4 py-2.5 text-xs font-bold text-white/70 transition hover:border-beedero-yellow hover:text-beedero-yellow"
      >
        <Share2 size={14} aria-hidden /> Share profile
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-end bg-black/70 backdrop-blur-sm sm:place-items-center sm:p-6"
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Share profile"
            className="flex max-h-[92vh] w-full max-w-xl flex-col border border-white/15 bg-app-elevated shadow-2xl"
          >
            <header className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4 sm:px-6">
              <h2 className="text-2xl font-black tracking-[-0.035em]">Share profile</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid size-11 shrink-0 place-items-center text-white/45 transition hover:text-white"
                aria-label="Close"
              >
                <X size={19} aria-hidden />
              </button>
            </header>

            <div className="min-h-0 space-y-5 overflow-y-auto p-5 sm:p-6">
              {profileUrl ? (
                <div className="border border-beedero-yellow/30 bg-beedero-yellow/[0.04] p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-beedero-yellow">
                    Profile link
                  </p>
                  <div className="mt-2 flex gap-2">
                    <input
                      readOnly
                      value={profileUrl}
                      aria-label="Your profile link"
                      className="min-w-0 flex-1 border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white/75 outline-none"
                    />
                    <button
                      type="button"
                      onClick={copyLink}
                      className="shrink-0 bg-beedero-yellow px-4 py-2.5 text-xs font-black text-beedero-black transition hover:opacity-90"
                    >
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <Link
                    href={`/p/${handle}`}
                    target="_blank"
                    className="mt-3 flex items-center gap-2 text-xs font-bold text-beedero-yellow transition hover:text-white"
                  >
                    <Globe2 size={14} aria-hidden /> Preview as a visitor
                  </Link>
                </div>
              ) : (
                <p className="border border-white/10 p-4 text-xs leading-5 text-white/45">
                  Your public link appears once your profile has a name, headline and country.
                </p>
              )}

              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/45">
                  What visitors see
                </p>
                <dl className="mt-2 space-y-1.5">
                  {VISIBILITY_SECTIONS.map((section) => {
                    const label = visibilityLabel(visibility?.[section.key]);
                    return (
                      <div key={section.key} className="flex justify-between gap-3 text-xs">
                        <dt className="text-white/55">{section.label}</dt>
                        <dd className={label === "Public" ? "font-bold text-emerald-400" : "font-bold text-sky-300"}>
                          {label}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
                <p className="mt-2 text-[11px] leading-5 text-white/40">
                  Change it with the audience button on each section of your profile.
                </p>
              </div>

              {badgeEmbed && badge && <PersonBadgeEmbedPanel embed={badgeEmbed} badge={badge} />}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
