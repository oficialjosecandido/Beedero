"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Globe2, LockKeyhole, Share2, UsersRound, X } from "lucide-react";

import { updateProfileVisibilityAction } from "@/app/(app)/dashboard/actions";
import { personProfileUrl } from "@/components/PersonalProfilePanels";
import { VISIBILITY_SECTIONS } from "@/lib/profile-visibility";

/**
 * The sheet speaks in the design's three words. The platform stores four
 * levels, so "Restricted" is the pair of audience-gated ones and the audience
 * select below picks which — one choice for the whole profile, as in Figma.
 */
type Tier = "public" | "restricted" | "private";

const RESTRICTED_LEVELS = ["connections", "verified_investors"] as const;
type RestrictedLevel = (typeof RESTRICTED_LEVELS)[number];

const RESTRICTED_AUDIENCES: { value: RestrictedLevel; label: string; hint: string }[] = [
  {
    value: "connections",
    label: "My connections",
    hint: "People you have accepted a connection with.",
  },
  {
    value: "verified_investors",
    label: "Verified members",
    hint: "Anyone whose own profile is verified on Beedero.",
  },
];

const TIERS: { value: Tier; label: string }[] = [
  { value: "public", label: "Public" },
  { value: "restricted", label: "Restricted" },
  { value: "private", label: "Private" },
];

function isRestrictedLevel(level: string | undefined): level is RestrictedLevel {
  return RESTRICTED_LEVELS.some((candidate) => candidate === level);
}

function tierOf(level: string | undefined): Tier {
  if (level === "private") return "private";
  if (isRestrictedLevel(level)) return "restricted";
  return "public";
}

function tierButtonClass(active: boolean, tier: Tier) {
  if (!active) return "px-2.5 py-1.5 text-[10px] font-bold text-white/45 transition hover:text-white";
  if (tier === "public") return "bg-beedero-yellow px-2.5 py-1.5 text-[10px] font-black text-beedero-black";
  if (tier === "restricted") return "bg-sky-300 px-2.5 py-1.5 text-[10px] font-black text-beedero-black";
  return "bg-white/20 px-2.5 py-1.5 text-[10px] font-black text-white";
}

/**
 * Figma "Share profile": set the audience section by section, then copy the
 * link. There is one public URL — what a visitor actually sees behind it is
 * decided per section by these settings, so a restricted section simply does
 * not render for someone outside the audience.
 */
export function ShareProfileModal({
  handle,
  visibility,
}: {
  handle: string | null | undefined;
  visibility: Record<string, string> | undefined;
}) {
  const [open, setOpen] = useState(false);
  const [tiers, setTiers] = useState<Record<string, Tier>>(() =>
    Object.fromEntries(
      VISIBILITY_SECTIONS.map((section) => [section.key, tierOf(visibility?.[section.key])])
    )
  );
  const [audience, setAudience] = useState<RestrictedLevel>(() => {
    const current = VISIBILITY_SECTIONS.map((section) => visibility?.[section.key]).find(
      isRestrictedLevel
    );
    return current ?? "connections";
  });
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const values = Object.values(tiers);
  const hasRestricted = values.includes("restricted");
  const hasPublic = values.includes("public");
  const allPrivate = values.every((tier) => tier === "private");
  const profileUrl = handle ? personProfileUrl(handle) : null;

  function setTier(key: string, tier: Tier) {
    setTiers((current) => ({ ...current, [key]: tier }));
    setSaved(false);
  }

  function copyLink() {
    if (!profileUrl) return;
    navigator.clipboard?.writeText(profileUrl);
    setCopied(true);
  }

  function save() {
    setError(null);
    const payload = Object.fromEntries(
      Object.entries(tiers).map(([key, tier]) => [
        key,
        tier === "restricted" ? audience : tier,
      ])
    );
    startTransition(async () => {
      const result = await updateProfileVisibilityAction(payload);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setSaved(true);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setCopied(false);
          setSaved(false);
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
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Share profile"
            className="flex max-h-[92vh] w-full max-w-2xl flex-col border border-white/15 bg-app-elevated shadow-2xl"
          >
            <header className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4 sm:px-6 sm:py-5">
              <div>
                <h2 className="text-2xl font-black tracking-[-0.035em]">Share profile</h2>
                <p className="mt-1 text-xs text-white/45">
                  Choose exactly what each audience can see before sharing a link.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="shrink-0 text-white/45 transition hover:text-white"
                aria-label="Close"
              >
                <X size={19} aria-hidden />
              </button>
            </header>

            <div className="min-h-0 overflow-y-auto p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-beedero-yellow">
                    Profile visibility
                  </p>
                  <p className="mt-1 text-xs text-white/45">Set visibility section by section.</p>
                </div>
                <span className="text-[10px] text-white/35">Public · Restricted · Private</span>
              </div>

              <div className="mt-4 space-y-2">
                {VISIBILITY_SECTIONS.map((section) => (
                  <div
                    key={section.key}
                    className="flex flex-col gap-3 border border-white/10 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <b className="block text-xs">{section.label}</b>
                      <small className="mt-0.5 block text-[10px] leading-4 text-white/40">
                        {section.hint}
                      </small>
                    </div>
                    <div
                      role="group"
                      aria-label={`${section.label} visibility`}
                      className="grid shrink-0 grid-cols-3 gap-1 border border-white/10 p-1"
                    >
                      {TIERS.map((tier) => (
                        <button
                          key={tier.value}
                          type="button"
                          aria-pressed={tiers[section.key] === tier.value}
                          onClick={() => setTier(section.key, tier.value)}
                          className={tierButtonClass(tiers[section.key] === tier.value, tier.value)}
                        >
                          {tier.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {hasRestricted && (
                <div className="mt-5 border border-sky-300/30 bg-sky-300/[0.06] p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-sky-300">
                    Restricted audience
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {RESTRICTED_AUDIENCES.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={audience === option.value}
                        onClick={() => {
                          setAudience(option.value);
                          setSaved(false);
                        }}
                        className={`border p-3 text-left transition ${
                          audience === option.value
                            ? "border-sky-300 bg-sky-300/10 text-white"
                            : "border-white/10 text-white/50 hover:border-white/25"
                        }`}
                      >
                        <b className="block text-xs">{option.label}</b>
                        <small className="mt-1 block text-[10px] leading-4">{option.hint}</small>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {profileUrl ? (
                <div className="mt-5 border border-beedero-yellow/30 bg-beedero-yellow/[0.04] p-4">
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
                  <p className="mt-3 text-[11px] leading-5 text-white/45">
                    {hasRestricted
                      ? "One link, different views: a visitor outside your restricted audience simply does not see those sections."
                      : "Anyone with this link sees the sections you marked public."}
                  </p>
                  {hasPublic && (
                    <Link
                      href={`/p/${handle}`}
                      className="mt-3 flex items-center gap-2 text-xs font-bold text-beedero-yellow transition hover:text-white"
                    >
                      <Globe2 size={14} aria-hidden /> Preview public profile
                    </Link>
                  )}
                </div>
              ) : (
                <p className="mt-5 border border-white/10 p-4 text-xs leading-5 text-white/45">
                  Your public link appears once your profile has a name, headline and country.
                </p>
              )}

              {allPrivate && (
                <p className="mt-3 flex items-start gap-2 border border-white/10 p-4 text-xs leading-5 text-white/45">
                  <LockKeyhole size={13} className="mt-0.5 shrink-0 text-white/60" aria-hidden />
                  Every section is private. The link still resolves, but a visitor sees only your
                  name and headline.
                </p>
              )}
            </div>

            <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-white/10 px-5 py-4 sm:px-6">
              {error && <p className="mr-auto text-xs text-red-300">{error}</p>}
              {!error && saved && (
                <p className="mr-auto flex items-center gap-1.5 text-xs text-emerald-400">
                  <UsersRound size={13} aria-hidden /> Visibility saved.
                </p>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-xs text-white/45 transition hover:text-white"
              >
                Close
              </button>
              <button
                type="button"
                onClick={save}
                disabled={pending}
                className="bg-beedero-yellow px-4 py-2.5 text-xs font-black text-beedero-black transition hover:opacity-90 disabled:opacity-50"
              >
                {pending ? "Saving…" : "Save visibility"}
              </button>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
