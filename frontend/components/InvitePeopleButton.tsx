"use client";

import { useState } from "react";

import { SITE_URL } from "@/lib/site-metadata";

const INVITE_URL = `${SITE_URL}/register`;
const SHARE_TEXT = "Join me on Beedero — structured startup profiles and verified credibility.";

const SHARE_LINKS = [
  {
    label: "WhatsApp",
    href: `https://wa.me/?text=${encodeURIComponent(`${SHARE_TEXT} ${INVITE_URL}`)}`,
  },
  {
    label: "LinkedIn",
    href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(INVITE_URL)}`,
  },
  {
    label: "X",
    href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(SHARE_TEXT)}&url=${encodeURIComponent(INVITE_URL)}`,
  },
  {
    label: "Facebook",
    href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(INVITE_URL)}`,
  },
  {
    label: "Email",
    href: `mailto:?subject=${encodeURIComponent("Join me on Beedero")}&body=${encodeURIComponent(`${SHARE_TEXT}\n\n${INVITE_URL}`)}`,
  },
];

export function InvitePeopleButton() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  function copyLink() {
    navigator.clipboard.writeText(INVITE_URL);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 w-full rounded-xl border-2 border-beedero-border px-3 py-2 text-sm font-bold text-beedero-black hover:bg-beedero-yellow/20"
      >
        Invite people
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl border-2 border-beedero-border bg-beedero-white p-6 shadow-sm"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold uppercase tracking-[0.15em] text-beedero-black/60">
                Invite people
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="text-sm font-semibold text-zinc-500 hover:text-beedero-black"
              >
                ✕
              </button>
            </div>

            <p className="mt-3 text-sm leading-6 text-zinc-600">
              Share Beedero with founders, investors, or researchers you think should be here.
            </p>

            <div className="mt-4 flex items-center gap-2 rounded-xl border-2 border-beedero-border bg-zinc-50 px-3 py-2">
              <p className="min-w-0 flex-1 truncate text-sm text-zinc-700">
                {INVITE_URL.replace(/^https?:\/\//, "")}
              </p>
              <button
                type="button"
                onClick={copyLink}
                className="shrink-0 rounded-lg bg-beedero-yellow px-3 py-1.5 text-xs font-bold text-beedero-black hover:bg-beedero-black hover:text-beedero-white"
              >
                {copied ? "Copied!" : "Copy link"}
              </button>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
              {SHARE_LINKS.map((share) => (
                <a
                  key={share.label}
                  href={share.href}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center rounded-xl border-2 border-beedero-border px-2 py-2 text-xs font-semibold text-beedero-black hover:bg-beedero-yellow/20"
                >
                  {share.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
