"use client";

import { useActionState, useRef } from "react";

import { submitCredentialAction } from "@/app/(app)/dashboard/actions";
import { useActionToast } from "@/lib/use-action-toast";

const fieldClass =
  "w-full rounded-xl border border-beedero-border bg-white px-3 py-2.5 text-sm text-beedero-black outline-none transition-colors focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60";

export type PersonCredential = {
  id: number;
  title: string;
  issuer: string;
  identifier: string;
  status: "pending" | "verified" | "rejected" | "expired";
  submitted_at: string;
  reviewed_at: string | null;
  rejection_reason: string;
  verified_at: string | null;
};

const STATUS_STYLES: Record<PersonCredential["status"], string> = {
  pending: "bg-zinc-100 text-zinc-600",
  verified: "bg-success/15 text-success",
  rejected: "bg-red-100 text-red-700",
  expired: "bg-zinc-100 text-zinc-500",
};

function CredentialRow({ credential }: { credential: PersonCredential }) {
  return (
    <div className="rounded-2xl border border-beedero-border bg-zinc-50/50 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-zinc-800">{credential.title}</p>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold capitalize ${STATUS_STYLES[credential.status]}`}
        >
          {credential.status}
        </span>
      </div>
      <p className="mt-1 text-xs text-subtle">
        {credential.identifier} · {credential.issuer}
      </p>
      {credential.status === "rejected" && credential.rejection_reason && (
        <p className="mt-1 text-xs text-red-700">{credential.rejection_reason}</p>
      )}
    </div>
  );
}

export function ProfessionalCredentialsPanel({ credentials }: { credentials: PersonCredential[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, formAction, pending] = useActionState(submitCredentialAction, null);
  useActionToast(error, pending, {
    successMessage: "Credential submitted for review.",
    onSuccess: () => formRef.current?.reset(),
  });

  return (
    <div className="overflow-hidden rounded-3xl border-2 border-beedero-border bg-beedero-white shadow-sm">
      <div className="border-b border-beedero-border bg-beedero-yellow px-6 py-5">
        <h2 className="text-xl font-extrabold tracking-tight text-zinc-900">Professional credentials</h2>
        <p className="mt-1 max-w-xl text-sm leading-6 text-zinc-600">
          Submit a licence or professional order registration for manual review. Once verified, your
          public profile states exactly what was confirmed — issuer, identifier, and date.
        </p>
      </div>
      <div className="flex flex-col gap-4 px-6 py-6">
        {credentials.length > 0 && (
          <div className="flex flex-col gap-3">
            {credentials.map((credential) => (
              <CredentialRow key={credential.id} credential={credential} />
            ))}
          </div>
        )}

        <form ref={formRef} action={formAction} className="flex flex-col gap-3">
          <input
            name="title"
            placeholder="Title (e.g. Psychotherapist)"
            required
            className={fieldClass}
          />
          <input
            name="issuer"
            placeholder="Issuer (e.g. Ordem dos Psicólogos)"
            required
            className={fieldClass}
          />
          <input
            name="identifier"
            placeholder="Licence / cédula number"
            required
            className={fieldClass}
          />
          <input name="document" type="file" accept="application/pdf" className={fieldClass} />
          <button
            type="submit"
            disabled={pending}
            className="self-start rounded-lg bg-beedero-yellow px-4 py-2 text-xs font-bold text-beedero-black hover:bg-beedero-black hover:text-beedero-white disabled:opacity-50"
          >
            {pending ? "Submitting..." : "Submit for review"}
          </button>
        </form>
      </div>
    </div>
  );
}
