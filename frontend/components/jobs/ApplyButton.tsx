"use client";

import { useState, useTransition } from "react";

import { applyToJobAction } from "@/app/(app)/jobs/actions";

const fieldClass =
  "w-full border border-white/15 bg-white/[0.02] px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-beedero-yellow";

export function ApplyButton({ jobId, jobTitle }: { jobId: number; jobTitle: string }) {
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [note, setNote] = useState("");
  const [externalLink, setExternalLink] = useState("");
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleApply() {
    startTransition(async () => {
      const result = await applyToJobAction(jobId, note, externalLink);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setError(null);
      setApplied(true);
      setShowForm(false);
    });
  }

  if (applied) {
    return (
      <span className="shrink-0 border border-emerald-400/40 px-4 py-2 text-xs font-bold text-emerald-400">
        Applied
      </span>
    );
  }

  if (!showForm) {
    return (
      <button
        type="button"
        onClick={() => setShowForm(true)}
        className="shrink-0 border border-beedero-yellow/55 px-4 py-2 text-xs font-bold text-beedero-yellow transition hover:bg-beedero-yellow/10"
      >
        Express interest
      </button>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2 border border-white/15 bg-white/[0.02] p-3">
      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value.slice(0, 1500))}
        placeholder={`Say why you're a fit for ${jobTitle}…`}
        rows={3}
        className={`${fieldClass} resize-y`}
      />
      <input
        value={externalLink}
        onChange={(event) => setExternalLink(event.target.value)}
        placeholder="Link to CV / portfolio (optional)"
        type="url"
        className={fieldClass}
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleApply}
          disabled={isPending}
          className="bg-beedero-yellow px-4 py-2 text-xs font-black text-beedero-black transition hover:opacity-90 disabled:cursor-default disabled:opacity-40"
        >
          {isPending ? "Sending…" : "Send application"}
        </button>
        <button
          type="button"
          onClick={() => setShowForm(false)}
          className="text-xs font-bold text-white/50 transition hover:text-white"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-xs text-beedero-yellow">{error}</p>}
    </div>
  );
}
