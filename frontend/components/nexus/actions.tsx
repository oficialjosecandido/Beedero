"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";

import { nexusCall } from "@/app/beedero-nexus/actions";

import { nexusButtonClass, nexusDangerButtonClass, nexusInputClass, nexusPrimaryButtonClass } from "./ui";

type Tone = "default" | "primary" | "danger";

const TONES: Record<Tone, string> = {
  default: nexusButtonClass,
  primary: nexusPrimaryButtonClass,
  danger: nexusDangerButtonClass,
};

/**
 * A Nexus change that needs a reason (suspend, remove a post, give a plan…):
 * the button opens a small dialog, the reason goes to the API and from there
 * into the audit log. `choices` turns the reason into a pick-list (posts).
 */
export function ReasonAction({
  label,
  title,
  description,
  path,
  method = "POST",
  body = {},
  reasonField = "reason",
  reasonRequired = true,
  choices,
  extraNumber,
  confirmLabel,
  tone = "default",
  done,
}: {
  label: ReactNode;
  title: string;
  description?: ReactNode;
  path: string;
  method?: "POST" | "PATCH" | "DELETE";
  body?: Record<string, unknown>;
  reasonField?: string;
  reasonRequired?: boolean;
  choices?: { key: string; label: string }[];
  extraNumber?: { field: string; label: string; min: number; max: number; initial: number };
  confirmLabel: string;
  tone?: Tone;
  done?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [choice, setChoice] = useState("");
  const [number, setNumber] = useState(extraNumber?.initial ?? 0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    if (choices && !choice) {
      setError("Choose a reason.");
      return;
    }
    if (!choices && reasonRequired && !reason.trim()) {
      setError("Say why — it goes in the audit log.");
      return;
    }
    const payload: Record<string, unknown> = { ...body };
    if (choices) {
      payload.reason = choice;
      if (reason.trim()) payload.note = reason.trim();
    } else if (reason.trim()) {
      payload[reasonField] = reason.trim();
    }
    if (extraNumber) payload[extraNumber.field] = number;
    startTransition(async () => {
      const result = await nexusCall(path, method, payload);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      setReason("");
      setChoice("");
      toast.success(done ?? "Done.");
      router.refresh();
    });
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={TONES[tone]}>
        {label}
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={title}
          onClick={() => !pending && setOpen(false)}
        >
          <div
            className="w-full max-w-md border border-app-border bg-app-elevated p-5 text-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-black tracking-[-0.02em]">{title}</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-white/50 hover:text-white">
                <X size={18} aria-hidden />
              </button>
            </div>
            {description && <div className="mt-2 text-sm leading-6 text-white/60">{description}</div>}
            {choices && (
              <fieldset className="mt-4 space-y-1.5">
                <legend className="sr-only">Reason</legend>
                {choices.map((option) => (
                  <label
                    key={option.key}
                    className={`flex cursor-pointer items-center gap-2.5 border px-3 py-2 text-sm ${
                      choice === option.key ? "border-beedero-yellow bg-beedero-yellow/10" : "border-app-border"
                    }`}
                  >
                    <input
                      type="radio"
                      name="reason"
                      value={option.key}
                      checked={choice === option.key}
                      onChange={() => setChoice(option.key)}
                      className="accent-beedero-yellow"
                    />
                    {option.label}
                  </label>
                ))}
              </fieldset>
            )}
            {extraNumber && (
              <label className="mt-4 block text-xs font-bold text-white/60">
                {extraNumber.label}
                <input
                  type="number"
                  min={extraNumber.min}
                  max={extraNumber.max}
                  value={number}
                  onChange={(event) => setNumber(Number(event.target.value))}
                  className={`${nexusInputClass} mt-1.5`}
                />
              </label>
            )}
            <label className="mt-4 block text-xs font-bold text-white/60">
              {choices ? "Note for the audit log (optional)" : reasonRequired ? "Reason (goes in the audit log)" : "Note (optional)"}
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={3}
                maxLength={300}
                className={`${nexusInputClass} mt-1.5`}
              />
            </label>
            {error && <p className="mt-3 text-xs font-bold text-[#ff8d82]">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className={nexusButtonClass} disabled={pending}>
                Cancel
              </button>
              <button type="button" onClick={submit} className={TONES[tone === "default" ? "primary" : tone]} disabled={pending}>
                {pending ? "…" : confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** A change with no reason to give (the internal flag, a code on/off). */
export function QuickAction({
  label,
  path,
  method = "POST",
  body = {},
  tone = "default",
  done,
}: {
  label: ReactNode;
  path: string;
  method?: "POST" | "PATCH" | "DELETE";
  body?: Record<string, unknown>;
  tone?: Tone;
  done?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className={TONES[tone]}
      onClick={() =>
        startTransition(async () => {
          const result = await nexusCall(path, method, body);
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success(done ?? "Done.");
          router.refresh();
        })
      }
    >
      {pending ? "…" : label}
    </button>
  );
}
