"use client";

import { useActionState } from "react";

import { useActionToast } from "@/lib/use-action-toast";
import { acceptInviteAction } from "./actions";

export function AcceptInviteForm({ token }: { token: string }) {
  const [error, formAction, pending] = useActionState(acceptInviteAction, null);
  useActionToast(error, pending);

  return (
    <form action={formAction} className="mt-6 flex flex-col items-center gap-3">
      <input type="hidden" name="token" value={token} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-beedero-yellow px-5 py-2.5 text-sm font-bold text-beedero-black shadow-sm hover:bg-beedero-black hover:text-beedero-white disabled:opacity-50"
      >
        {pending ? "Joining..." : "Accept invite"}
      </button>
    </form>
  );
}
