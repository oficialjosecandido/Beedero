"use client";

import { useActionState } from "react";

import { submitVerificationAction } from "@/app/(app)/dashboard/actions";
import type { OrgLadderRung } from "@/lib/org-ladder";
import { useActionToast } from "@/lib/use-action-toast";

const fieldClass =
  "w-full rounded-xl border border-beedero-border bg-white px-3 py-2.5 text-sm text-beedero-black outline-none transition-colors focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60";

/**
 * Rung 6 of the organisation's ladder: the company registry check.
 *
 * Only the NIF and the certidão permanente's access code — no document
 * upload. The code opens the certificate on the registry's own website, so
 * the check reads the official source and Beedero never stores a PDF. The
 * review is manual (Django admin, credibility app), and the owners get an
 * email when it is decided.
 */
export function CompanyRegistryCard({ slug, rung }: { slug: string; rung: OrgLadderRung }) {
  const [error, formAction, pending] = useActionState(submitVerificationAction, null);
  useActionToast(error, pending, { successMessage: "Sent for review." });
  const showForm = !rung.pending && (!rung.done || Boolean(rung.warning));

  return (
    <section
      aria-labelledby="registry-title"
      className="rounded-2xl border-2 border-beedero-border bg-beedero-white p-6 shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="registry-title" className="font-extrabold text-zinc-900">
          Company registry
        </h3>
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
            rung.done
              ? "bg-emerald-100 text-emerald-900"
              : rung.pending
                ? "bg-zinc-900 text-white"
                : "bg-zinc-100 text-zinc-600"
          }`}
        >
          {rung.done ? "Confirmed" : rung.pending ? "In review" : "Not sent"}
        </span>
      </div>

      <p className="mt-1.5 text-sm text-zinc-600">
        {rung.done
          ? rung.detail
          : "Send the access code of your certidão permanente. We open it on the commercial registry's website — you don't upload any document."}
      </p>
      {rung.pending && (
        <p className="mt-2 text-sm text-zinc-600">
          We&apos;re checking it. The owners get an email as soon as it&apos;s decided.
        </p>
      )}
      {rung.warning && <p className="mt-2 text-sm font-semibold text-danger">{rung.warning}</p>}

      {showForm && (
        <form action={formAction} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="type" value="company_registry" />
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-zinc-700">Company NIF</span>
            <input
              name="nif"
              required
              inputMode="numeric"
              pattern="\d{9}"
              maxLength={9}
              placeholder="501234567"
              autoComplete="off"
              className={fieldClass}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-zinc-700">Access code</span>
            <input
              name="access_code"
              required
              pattern="\d{4}-?\d{4}-?\d{4}"
              maxLength={14}
              placeholder="1234-5678-9012"
              autoComplete="off"
              aria-describedby="registry-code-help"
              className={fieldClass}
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="min-h-11 rounded-xl bg-beedero-black px-4 text-sm font-bold text-beedero-yellow transition hover:bg-beedero-yellow hover:text-beedero-black disabled:opacity-60"
          >
            {pending ? "Sending…" : "Send for review"}
          </button>
          <p id="registry-code-help" className="text-xs text-zinc-500 sm:col-span-3">
            The 12-digit code on your company&apos;s certidão permanente. A check counts for a year,
            so this step asks again before it runs out.
          </p>
        </form>
      )}
    </section>
  );
}
