"use client";

import { useActionState } from "react";

type Field = { name: string; label: string; type: string };

export function AuthForm({
  action,
  fields,
  submitLabel,
  pendingLabel,
}: {
  action: (prevState: string | null, formData: FormData) => Promise<string | null>;
  fields: Field[];
  submitLabel: string;
  pendingLabel?: string;
}) {
  const [message, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className="flex w-full flex-col gap-4">
      {fields.map((f) => (
        <label key={f.name} className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
          {f.label}
          <input
            name={f.name}
            type={f.type}
            required
            disabled={pending}
            className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-beedero-black outline-none transition focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
          />
        </label>
      ))}
      {message && (
        <p
          className={`text-sm ${
            message.startsWith("If an account exists") ? "text-beedero-black" : "text-red-600"
          }`}
        >
          {message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-beedero-yellow px-5 py-2.5 text-sm font-bold text-beedero-black shadow-sm hover:bg-beedero-black hover:text-beedero-white disabled:cursor-wait disabled:opacity-70 disabled:hover:bg-beedero-yellow disabled:hover:text-beedero-black"
      >
        {pending && (
          <span className="size-4 animate-spin rounded-full border-2 border-beedero-black/25 border-t-beedero-black" />
        )}
        {pending ? (pendingLabel ?? "Please wait...") : submitLabel}
      </button>
    </form>
  );
}
