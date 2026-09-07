"use client";

import { useState, useTransition } from "react";

import { applyToJobAction } from "@/app/(app)/jobs/actions";

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
      <span className="inline-flex items-center gap-2 rounded-full border border-beedero-border px-4 py-2 text-xs font-semibold text-zinc-500">
        Applied
      </span>
    );
  }

  if (!showForm) {
    return (
      <button
        type="button"
        onClick={() => setShowForm(true)}
        className="inline-flex shrink-0 items-center gap-2 rounded-full bg-beedero-yellow px-4 py-2 text-xs font-bold text-beedero-black hover:bg-beedero-black hover:text-beedero-white"
      >
        Apply
      </button>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2 rounded-xl border border-beedero-border p-3">
      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value.slice(0, 1500))}
        placeholder={`Say why you're a fit for ${jobTitle}…`}
        rows={3}
        className="w-full rounded-lg border border-beedero-border p-2 text-sm text-beedero-black focus:border-beedero-black focus:outline-none"
      />
      <input
        value={externalLink}
        onChange={(event) => setExternalLink(event.target.value)}
        placeholder="Link to CV / portfolio (optional)"
        type="url"
        className="w-full rounded-lg border border-beedero-border p-2 text-sm text-beedero-black focus:border-beedero-black focus:outline-none"
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleApply}
          disabled={isPending}
          className="rounded-full bg-beedero-yellow px-4 py-2 text-xs font-bold text-beedero-black hover:bg-beedero-black hover:text-beedero-white disabled:opacity-50"
        >
          {isPending ? "Sending…" : "Send application"}
        </button>
        <button
          type="button"
          onClick={() => setShowForm(false)}
          className="text-xs font-semibold text-zinc-500 hover:text-beedero-black"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
