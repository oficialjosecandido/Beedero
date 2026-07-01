"use client";

import { useActionState } from "react";

import { createOrgAction } from "@/app/(app)/dashboard/actions";

export function CreateOrgForm() {
  const [error, formAction, pending] = useActionState(createOrgAction, null);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Slug
        <input
          name="slug"
          required
          pattern="[a-z0-9-]+"
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Nome
        <input name="name" required className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Stage
        <input name="stage" className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Setor
        <input name="sector" className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Geografia
        <input name="geo" className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm" />
      </label>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-black px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
      >
        {pending ? "..." : "Criar organização"}
      </button>
    </form>
  );
}
