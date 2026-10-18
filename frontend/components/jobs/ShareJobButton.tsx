"use client";

import { useState } from "react";
import { Link2, Share2 } from "lucide-react";

import { jobShareText, jobShareUrl, linkedInShareUrl } from "@/lib/job-share";

/**
 * "Partilha no LinkedIn" — doc §3.4, offered right after a role is published
 * and again on the role's own public page. "Cada partilha leva candidatos para
 * dentro", so the button exists in both places rather than only in the
 * backoffice.
 *
 * Copy sits beside it because most sharing is not LinkedIn: it is a link
 * pasted into a WhatsApp group or a Slack channel, and that link should carry
 * the same `?ref=share:<org>` as the one LinkedIn gets, or half the sharing
 * disappears from §8.3's funnel.
 *
 * `tone` exists because this renders on the dark org dashboard and on the light
 * public page; everything else about the two is identical.
 */
export function ShareJobButton({
  jobId,
  jobTitle,
  orgSlug,
  orgName,
  tone = "dark",
}: {
  jobId: number;
  jobTitle: string;
  orgSlug: string;
  orgName: string;
  tone?: "dark" | "light";
}) {
  const [copied, setCopied] = useState(false);

  const url = jobShareUrl(jobId, orgSlug);
  const share = linkedInShareUrl(url, jobShareText(jobTitle, orgName));

  const buttonClass =
    tone === "light"
      ? "flex items-center gap-2 rounded-xl border-2 border-beedero-border px-4 py-2 text-sm font-semibold text-beedero-black transition hover:bg-beedero-yellow/20"
      : "flex items-center gap-2 border border-white/15 px-4 py-2 text-xs font-bold text-white/70 transition hover:border-beedero-yellow hover:text-beedero-yellow";

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // Clipboard denied or unavailable (an insecure origin, an old browser).
      // Nothing to recover: the link is visible in the LinkedIn button's href,
      // and a failed copy that claimed success would be worse than silence.
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a href={share} target="_blank" rel="noopener noreferrer" className={buttonClass}>
        <Share2 size={14} aria-hidden /> Share on LinkedIn
      </a>
      <button type="button" onClick={copy} className={buttonClass}>
        <Link2 size={14} aria-hidden /> {copied ? "Link copied" : "Copy link"}
      </button>
    </div>
  );
}
