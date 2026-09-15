"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { blockBuilderAction, reportBuilderAction } from "@/app/(app)/cofounder/actions";

/** Doc §7: block & report, reusing the platform's existing ones — "sem isto
 * não se lança". Deliberately quiet: a small text link under the card rather
 * than a button competing with Interested/Pass, because most people will
 * never need it and the ones who do will look for it. */

const REASONS = [
  { value: "harassment", label: "Harassment or abuse" },
  { value: "scam", label: "Scam or fraud" },
  { value: "unsolicited", label: "Unwanted contact" },
  { value: "other", label: "Something else" },
] as const;

export function SafetyMenu({
  userId,
  name,
  onBlocked,
}: {
  userId: number;
  name: string;
  /** Called once the person has read the confirmation and closed the dialog,
   * not the instant the block lands — so the deck advances past a blocked
   * card only after they've seen that it worked. */
  onBlocked?: () => void;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start text-xs font-medium text-zinc-500 underline underline-offset-2 hover:text-beedero-black"
      >
        Report or block {name}
      </button>
    );
  }

  return (
    <SafetyDialog
      userId={userId}
      name={name}
      onClose={() => setOpen(false)}
      onBlocked={onBlocked}
    />
  );
}

function SafetyDialog({
  userId,
  name,
  onClose,
  onBlocked,
}: {
  userId: number;
  name: string;
  onClose: () => void;
  onBlocked?: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [reason, setReason] = useState<string>(REASONS[0].value);
  const [details, setDetails] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [pending, startTransition] = useTransition();

  const dismiss = useCallback(() => {
    onClose();
    if (blocked) onBlocked?.();
  }, [blocked, onBlocked, onClose]);

  // Focus once, on open — re-running this would steal focus back from the
  // details textarea on every keystroke.
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

  function submitReport() {
    startTransition(async () => {
      setError(null);
      const result = await reportBuilderAction(userId, reason, details.trim());
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setDone("Report sent. Our team reviews every one — you won't hear back unless we need more.");
    });
  }

  function submitBlock() {
    startTransition(async () => {
      setError(null);
      const result = await blockBuilderAction(userId);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setBlocked(true);
      setDone(`${name} is blocked. Neither of you will see the other here or be able to message.`);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-beedero-black/50 p-4"
      onClick={dismiss}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Report or block ${name}`}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-md rounded-3xl border-2 border-beedero-border bg-beedero-white p-6 shadow-xl outline-none"
      >
        <h2 className="text-lg font-extrabold tracking-tight text-zinc-950">
          Report or block {name}
        </h2>

        {done ? (
          <>
            <p className="mt-3 text-sm leading-6 text-zinc-600">{done}</p>
            <button
              type="button"
              onClick={dismiss}
              className="mt-5 w-full rounded-xl bg-beedero-yellow px-4 py-2.5 text-sm font-bold text-beedero-black hover:bg-beedero-black hover:text-beedero-white"
            >
              Done
            </button>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Reporting sends this to our team. Blocking is immediate and private — {name} is never
              told.
            </p>

            <fieldset className="mt-4">
              <legend className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                What&apos;s wrong?
              </legend>
              <div className="mt-2 flex flex-col gap-1.5">
                {REASONS.map((option) => (
                  <label key={option.value} className="flex items-center gap-2 text-sm text-zinc-800">
                    <input
                      type="radio"
                      name="report-reason"
                      value={option.value}
                      checked={reason === option.value}
                      onChange={() => setReason(option.value)}
                      className="size-4 accent-beedero-black"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="mt-4 block">
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Anything else? (optional)
              </span>
              <textarea
                value={details}
                onChange={(event) => setDetails(event.target.value)}
                maxLength={1000}
                rows={3}
                className="mt-2 w-full rounded-xl border-2 border-beedero-border bg-beedero-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-beedero-black"
              />
            </label>

            {error && <p className="mt-3 text-sm text-danger">{error}</p>}

            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={submitReport}
                className="rounded-xl bg-beedero-yellow px-4 py-2.5 text-sm font-bold text-beedero-black hover:bg-beedero-black hover:text-beedero-white disabled:opacity-50"
              >
                {pending ? "Sending…" : "Send report"}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={submitBlock}
                className="rounded-xl border-2 border-beedero-border px-4 py-2.5 text-sm font-semibold text-danger hover:bg-zinc-50 disabled:opacity-50"
              >
                Block {name}
              </button>
              <button
                type="button"
                onClick={dismiss}
                className="text-xs font-medium text-zinc-500 hover:text-beedero-black"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
