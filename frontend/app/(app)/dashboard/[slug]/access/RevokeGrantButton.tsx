"use client";

import { useActionState } from "react";

import { deleteGrantAction } from "../../actions";
import { useActionToast } from "@/lib/use-action-toast";

export function RevokeGrantButton({ slug, grantId }: { slug: string; grantId: number }) {
  const [error, formAction, pending] = useActionState(deleteGrantAction, null);
  useActionToast(error, pending, { successMessage: "Access revoked." });

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!window.confirm("Revoke this access grant?")) event.preventDefault();
      }}
    >
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="grant_id" value={grantId} />
      <button
        disabled={pending}
        className="rounded-xl border border-red-200 px-3 py-1.5 text-xs font-medium text-danger-strong hover:bg-danger-surface disabled:opacity-50"
      >
        {pending ? "Revoking…" : "Revoke"}
      </button>
    </form>
  );
}
