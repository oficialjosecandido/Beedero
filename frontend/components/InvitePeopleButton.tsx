"use client";

import { useEffect, useId, useState } from "react";
import { FaFacebook, FaLinkedin, FaWhatsapp } from "react-icons/fa";

import { SITE_URL } from "@/lib/site-metadata";

const INVITE_PATH = "/register";
const INVITE_URL = `${SITE_URL}${INVITE_PATH}`;
const SHARE_TEXT = "Join me on Beedero — structured startup profiles for founders and investors.";

const SHARE_LINKS = [
  {
    label: "WhatsApp",
    href: `https://wa.me/?text=${encodeURIComponent(`${SHARE_TEXT} ${INVITE_URL}`)}`,
    icon: FaWhatsapp,
    iconClass: "text-[#25D366]",
    hoverClass: "hover:border-[#25D366]/30 hover:bg-[#25D366]/10",
  },
  {
    label: "LinkedIn",
    href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(INVITE_URL)}`,
    icon: FaLinkedin,
    iconClass: "text-[#0A66C2]",
    hoverClass: "hover:border-[#0A66C2]/30 hover:bg-[#0A66C2]/10",
  },
  {
    label: "Facebook",
    href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(INVITE_URL)}`,
    icon: FaFacebook,
    iconClass: "text-[#1877F2]",
    hoverClass: "hover:border-[#1877F2]/30 hover:bg-[#1877F2]/10",
  },
] as const;

function displayHost(url: string) {
  return url.replace(/^https?:\/\//, "");
}

export function InvitePeopleButton({ className = "mt-3" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function copyLink() {
    await navigator.clipboard.writeText(INVITE_URL);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-beedero-border bg-beedero-white px-3 py-2.5 text-sm font-bold text-beedero-black transition-colors hover:border-beedero-black hover:bg-beedero-yellow/15 ${className}`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4" aria-hidden>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M19 8v6M22 11h-6" />
        </svg>
        Convidar pessoas
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-beedero-black/45 p-4 backdrop-blur-[2px] sm:items-center"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            className="w-full max-w-lg overflow-hidden rounded-3xl border-2 border-beedero-border bg-beedero-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-beedero-border bg-gradient-to-br from-beedero-yellow/35 via-beedero-yellow/10 to-beedero-white px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl border-2 border-beedero-border bg-beedero-white shadow-sm">
                    <svg viewBox="0 0 64 64" className="size-7" aria-hidden>
                      <rect width="64" height="64" rx="16" fill="#050604" />
                      <circle cx="32" cy="32" r="14" fill="#f9de4a" />
                      <circle cx="32" cy="32" r="6" fill="#050604" />
                    </svg>
                  </span>
                  <div>
                    <h2 id={titleId} className="text-lg font-extrabold tracking-tight text-zinc-900">
                      Convidar pessoas
                    </h2>
                    <p id={descriptionId} className="mt-1 max-w-sm text-sm leading-6 text-zinc-600">
                      Partilha o Beedero com fundadores, investidores ou investigadores que deviam estar aqui.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-beedero-black/5 hover:text-beedero-black"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="space-y-5 px-6 py-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-zinc-500">Link de convite</p>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <div className="min-w-0 flex-1 rounded-xl border-2 border-beedero-border bg-zinc-50 px-3 py-2.5">
                    <p className="truncate font-mono text-sm text-zinc-800">{displayHost(INVITE_URL)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={copyLink}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-beedero-yellow px-4 py-2.5 text-sm font-bold text-beedero-black transition-colors hover:bg-beedero-black hover:text-beedero-white sm:min-w-[8.5rem]"
                  >
                    {copied ? (
                      <>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-4">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                        Copied
                      </>
                    ) : (
                      <>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4">
                          <rect x="9" y="9" width="13" height="13" rx="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                        Copy link
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-zinc-500">Share directly</p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {SHARE_LINKS.map((share) => (
                    <a
                      key={share.label}
                      href={share.href}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Share on ${share.label}`}
                      className={`flex flex-col items-center gap-2 rounded-2xl border-2 border-beedero-border bg-beedero-white px-3 py-3 transition-colors ${share.hoverClass}`}
                    >
                      <share.icon className={`size-6 ${share.iconClass}`} />
                      <span className="text-xs font-semibold text-zinc-700">{share.label}</span>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
