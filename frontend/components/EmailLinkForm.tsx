"use client";

import { useActionState } from "react";

import {
  confirmSignInAction,
  sendSignInLinkAction,
  verifySignInCodeAction,
  type SignInState,
} from "@/lib/auth-actions";

type Props = {
  /** "send" emails a code and a link; "confirm" redeems a link that was opened
   * on another device, where only the person who requested it knows the
   * address. */
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
  const [codeState, codeAction, codePending] = useActionState<SignInState, FormData>(
    verifySignInCodeAction,
    null
  );

  // A fresh submission's own result always wins over the stale query-string
  // error that brought the user here.
  const error =
    state?.error ?? (state === null && codeState === null ? initialError : null);

  // Second step: the email is out, and the code is what finishes the job. It
  // beats the link on every device and is the only thing that works inside an
  // installed iOS app, where a tapped link opens Safari — a different cookie
  // jar from the app, so it would sign in the wrong place.
  if (state?.sent) {
    return (
      <form action={codeAction} className="flex flex-col gap-3">
        <input type="hidden" name="next" value={next} />
        <div className="rounded-2xl border-2 border-beedero-black bg-beedero-yellow/20 px-4 py-4">
          <p className="text-sm font-bold">Check your inbox</p>
          <p className="mt-1 text-sm text-zinc-700">
            We sent a 6-digit code to <span className="font-semibold">{state.sent}</span>. Enter it
            below — it expires in 10 minutes.
          </p>
        </div>

        {codeState?.error && (
          <p className="rounded-2xl bg-danger-surface px-4 py-3 text-sm text-danger-strong">
            {codeState.error}
          </p>
        )}

        <label htmlFor="code" className="text-sm font-semibold">
          Sign-in code
        </label>
        <input
          id="code"
          name="code"
          type="text"
          // Numeric keypad on phones, and the one-time-code hint that lets iOS
          // and Android offer the code straight from the notification.
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="one-time-code"
          maxLength={7}
          required
          autoFocus
          placeholder="123456"
          className="rounded-2xl border-2 border-beedero-border px-4 py-3 text-center font-mono text-2xl tracking-[0.4em] outline-none focus:border-beedero-black"
        />
        <button
          type="submit"
          disabled={codePending}
          className="rounded-full bg-beedero-black px-4 py-3 text-sm font-semibold text-beedero-yellow hover:bg-beedero-black/90 disabled:opacity-50"
        >
          {codePending ? "Signing in…" : "Sign in"}
        </button>
        <p className="text-center text-xs text-zinc-500">
          The email also has a link you can tap, if you&apos;re reading it on this device. Nothing
          after a minute or two? Check spam, or{" "}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="font-medium text-beedero-black underline decoration-beedero-yellow decoration-2 underline-offset-4"
          >
            start again
          </button>
          .
        </p>
      </form>
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
          No password to remember — we email you a code that signs you in.
        </p>
      )}
    </form>
  );
}
