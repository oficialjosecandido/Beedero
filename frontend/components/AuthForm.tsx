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
  const [error, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-4">
      {fields.map((f) => (
        <label key={f.name} className="flex flex-col gap-1 text-sm">
          {f.label}
          <input
            name={f.name}
            type={f.type}
            required
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>
      ))}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
      >
        {pending ? "..." : submitLabel}
      </button>
    </form>
  );
}
