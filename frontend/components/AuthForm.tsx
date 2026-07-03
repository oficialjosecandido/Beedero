"use client";

import { useActionState } from "react";

type Field = { name: string; label: string; type: string };

export function AuthForm({
  action,
  fields,
  submitLabel,
}: {
  action: (prevState: string | null, formData: FormData) => Promise<string | null>;
  fields: Field[];
  submitLabel: string;
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
            className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
          />
        </label>
      ))}
      {message && (
        <p
          className={`text-sm ${
            message.startsWith("If an account exists") ? "text-emerald-700" : "text-red-600"
          }`}
        >
          {message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 disabled:opacity-50"
      >
        {pending ? "..." : submitLabel}
      </button>
    </form>
  );
}
