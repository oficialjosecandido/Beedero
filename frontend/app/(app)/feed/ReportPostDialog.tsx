"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { reportPostAction } from "./actions";

const REASONS = [
  { value: "harassment", label: "Harassment or abuse" },
  { value: "scam", label: "Scam or fraud" },
  { value: "unsolicited", label: "Spam or unwanted content" },
  { value: "other", label: "Something else" },
] as const;

/** Dark dialog matching the feed chrome — files into /api/reports/ so Nexus
 * staff see the same queue as messaging and co-founder reports. */
export function ReportPostDialog({
  activityId,
  subjectName,
  onClose,
}: {
  activityId: number;
  subjectName: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [reason, setReason] = useState<string>(REASONS[0].value);
  const [details, setDetails] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  const dismiss = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") dismiss();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [dismiss]);

  function submit() {
    startTransition(async () => {
      setError(null);
      const result = await reportPostAction(activityId, reason, details.trim());
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setDone(true);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end bg-black/70 backdrop-blur-sm sm:place-items-center sm:p-6"
      onClick={(event) => {
        if (event.target === event.currentTarget) dismiss();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Report post by ${subjectName}`}
        tabIndex={-1}
        className="w-full max-w-md border border-white/15 bg-app-elevated shadow-2xl outline-none"
      >
        <header className="border-b border-white/10 px-6 py-5">
          <h2 className="text-xl font-black tracking-[-0.02em]">Report this post</h2>
          <p className="mt-1 text-xs text-white/45">About {subjectName}</p>
        </header>

        <div className="px-6 py-5">
          {done ? (
            <p className="text-sm leading-6 text-white/70">
              Report sent. Our team reviews every one — you won&apos;t hear back unless we need more.
            </p>
          ) : (
            <>
              <fieldset>
                <legend className="text-[10px] font-black uppercase tracking-[0.14em] text-white/40">
                  What&apos;s wrong?
                </legend>
                <div className="mt-3 flex flex-col gap-2">
                  {REASONS.map((option) => (
                    <label key={option.value} className="flex items-center gap-2.5 text-sm text-white/80">
                      <input
                        type="radio"
                        name="report-reason"
                        value={option.value}
                        checked={reason === option.value}
                        onChange={() => setReason(option.value)}
                        className="size-4 accent-beedero-yellow"
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </fieldset>

              <label className="mt-5 block">
                <span className="text-[10px] font-black uppercase tracking-[0.14em] text-white/40">
                  Anything else? (optional)
                </span>
                <textarea
                  value={details}
                  onChange={(event) => setDetails(event.target.value)}
                  maxLength={1000}
                  rows={3}
                  className="mt-2 w-full border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none focus:border-beedero-yellow/50"
                />
              </label>

              {error && (
                <p role="alert" className="mt-3 text-sm text-red-300">
                  {error}
                </p>
              )}
            </>
          )}
        </div>

        <footer className="flex justify-end gap-2 border-t border-white/10 px-6 py-4">
          {done ? (
            <button
              type="button"
              onClick={dismiss}
              className="bg-beedero-yellow px-4 py-2.5 text-xs font-black text-beedero-black"
            >
              Done
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={dismiss}
                className="px-4 py-2.5 text-xs font-bold text-white/45 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={submit}
                className="bg-beedero-yellow px-4 py-2.5 text-xs font-black text-beedero-black disabled:opacity-50"
              >
                {pending ? "Sending…" : "Send report"}
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}
