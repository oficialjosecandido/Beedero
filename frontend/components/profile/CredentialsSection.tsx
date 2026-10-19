"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";

import { submitCredentialAction } from "@/app/(app)/dashboard/actions";
import { btnGhost, btnPrimary, inputDark, labelDark } from "@/components/app-shell/ui";
import type { PersonCredential } from "@/lib/types";
import { useActionToast } from "@/lib/use-action-toast";

import { VisibilityPill } from "./VisibilityPill";

const STATUS: Record<PersonCredential["status"], { label: string; className: string }> = {
  pending: { label: "In review", className: "border-sky-300/45 text-sky-300" },
  verified: { label: "Verified", className: "border-emerald-400/45 text-emerald-400" },
  rejected: { label: "Not accepted", className: "border-red-400/45 text-red-300" },
  expired: { label: "Expired", className: "border-white/20 text-white/50" },
};

/**
 * Professional credentials, in the profile's dark language (was a light
 * yellow card). The add form opens inline and only when asked for, because
 * most people never need it.
 */
export function CredentialsSection({
  credentials,
  visibility,
}: {
  credentials: PersonCredential[];
  visibility: string | undefined;
}) {
  const [adding, setAdding] = useState(false);
  const [error, formAction, pending] = useActionState(submitCredentialAction, null);
  useActionToast(error, pending, {
    successMessage: "Sent for review. We'll email you when it's checked.",
    onSuccess: () => setAdding(false),
  });

  return (
    <section id="credentials" aria-labelledby="credentials-title" className="scroll-mt-24 border border-white/10 bg-white/[0.025] p-5 sm:p-7">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <h2 id="credentials-title" className="mt-1 text-2xl font-black tracking-[-0.04em]">
          Credentials
        </h2>
        <div className="flex items-center gap-2">
          <VisibilityPill section="credentials" value={visibility} label="Credentials" />
          {!adding && credentials.length > 0 && (
            <button type="button" onClick={() => setAdding(true)} className={btnGhost}>
              <Plus size={14} aria-hidden /> Add
            </button>
          )}
        </div>
      </header>

      {credentials.length > 0 && (
        <ul className="mt-4 flex flex-col gap-3">
          {credentials.map((c) => (
            <li key={c.id} className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.08] pb-3 last:border-0">
              <div className="min-w-0">
                <p className="font-bold">{c.title}</p>
                <p className="text-xs text-white/45">
                  {c.issuer} · {c.identifier}
                </p>
                {c.status === "rejected" && c.rejection_reason && (
                  <p className="mt-1 text-xs text-red-300">{c.rejection_reason}</p>
                )}
              </div>
              <span className={`shrink-0 border px-2 py-1 text-[9px] font-black uppercase tracking-[0.1em] ${STATUS[c.status].className}`}>
                {STATUS[c.status].label}
              </span>
            </li>
          ))}
        </ul>
      )}

      {credentials.length === 0 && !adding && (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-4 w-full border border-dashed border-white/15 p-5 text-left text-sm text-white/55 transition hover:border-beedero-yellow hover:text-white"
        >
          <span className="font-bold text-beedero-yellow">+ </span>
          Licensed professional? Add your licence or professional registration — we check it by hand and
          show exactly what was confirmed.
        </button>
      )}

      {adding && (
        <form action={formAction} className="mt-5 grid gap-4 border border-white/15 bg-white/[0.02] p-4 sm:grid-cols-2">
          <label className={`sm:col-span-2 ${labelDark}`}>
            Title
            <input name="title" required placeholder="Psychotherapist" className={`mt-2 ${inputDark} placeholder:text-white/35`} />
          </label>
          <label className={labelDark}>
            Issued by
            <input name="issuer" required placeholder="Ordem dos Psicólogos" className={`mt-2 ${inputDark} placeholder:text-white/35`} />
          </label>
          <label className={labelDark}>
            Licence / cédula number
            <input name="identifier" required className={`mt-2 ${inputDark}`} />
          </label>
          <label className={`sm:col-span-2 ${labelDark}`}>
            Proof (PDF, optional)
            <input name="document" type="file" accept="application/pdf" className={`mt-2 ${inputDark}`} />
          </label>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button type="submit" disabled={pending} className={btnPrimary}>
              {pending ? "Sending…" : "Send for review"}
            </button>
            <button type="button" onClick={() => setAdding(false)} disabled={pending} className={btnGhost}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
