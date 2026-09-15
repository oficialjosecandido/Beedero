"use client";

import { useActionState } from "react";

import { confirmSignInAction, sendSignInLinkAction, type SignInState } from "@/lib/auth-actions";

type Props = {
  /** "send" emails a link; "confirm" redeems one that was opened on another
   * device, where only the person who requested it knows the address. */
  mode: "send" | "confirm";
  next: string;
  submitLabel: string;
  /** Surfaced by the callback route via ?error= when a link fails before any
   * form is submitted. */
  initialError?: string | null;
};

export function EmailLinkForm({ mode, next, submitLabel, initialError }: Props) {
  const action = mode === "confirm" ? confirmSignInAction : sendSignInLinkAction;
  const [state, formAction, pending] = useActionState<SignInState, FormData>(action, null);

  // A fresh submission's own result always wins over the stale query-string
  // error that brought the user here.
  const error = state?.error ?? (state === null ? initialError : null);

  if (state?.sent) {
    return (
      <div className="flex flex-col gap-3">
        <div className="rounded-2xl border-2 border-beedero-black bg-beedero-yellow/20 px-4 py-4">
          <p className="text-sm font-bold">Check your inbox</p>
          <p className="mt-1 text-sm text-zinc-700">
            We sent a sign-in link to <span className="font-semibold">{state.sent}</span>. It works
            once, and expires in a few hours.
          </p>
        </div>
        <p className="text-center text-xs text-zinc-500">
          Nothing after a minute or two? Check spam, or{" "}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="font-medium text-beedero-black underline decoration-beedero-yellow decoration-2 underline-offset-4"
          >
            try a different address
          </button>
          .
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="next" value={next} />
      {mode === "confirm" && (
        <p className="rounded-2xl bg-beedero-yellow/20 px-4 py-3 text-sm text-zinc-700">
          You opened your sign-in link on a different device. Confirm the email address you asked
          for it with.
        </p>
      )}
      {error && (
        <p className="rounded-2xl bg-danger-surface px-4 py-3 text-sm text-danger-strong">{error}</p>
      )}
      <label htmlFor="email" className="text-sm font-semibold">
        Email address
      </label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        required
        autoFocus
        placeholder="you@company.com"
        className="rounded-2xl border-2 border-beedero-border px-4 py-3 text-sm outline-none focus:border-beedero-black"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-beedero-black px-4 py-3 text-sm font-semibold text-beedero-yellow hover:bg-beedero-black/90 disabled:opacity-50"
      >
        {pending ? "Working…" : submitLabel}
      </button>
      {mode === "send" && (
        <p className="text-center text-xs text-zinc-500">
          No password to remember — we email you a link that signs you in.
        </p>
      )}
    </form>
  );
}
