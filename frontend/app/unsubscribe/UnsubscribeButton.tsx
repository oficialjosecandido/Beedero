"use client";

import { useState, useTransition } from "react";

import { unsubscribeAction } from "./actions";

/** A button, not an automatic unsubscribe on page load: link scanners in
 *  mail systems open every link, and must not unsubscribe people by visiting. */
export function UnsubscribeButton({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();

  if (state === "done") {
    return (
      <p className="text-lg font-bold">
        Done. {email ? `${email} won't` : "You won't"} get the newsletter any more. You can turn it back on in your
        notification settings.
      </p>
    );
  }
  return (
    <div className="flex flex-col items-start gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await unsubscribeAction(token);
            if (result.ok) {
              setEmail(result.email ?? "");
              setState("done");
            } else {
              setState("failed");
            }
          })
        }
        className="rounded-full bg-beedero-yellow px-6 py-3 text-sm font-black text-beedero-black disabled:opacity-60"
      >
        {pending ? "…" : "Unsubscribe from the newsletter"}
      </button>
      {state === "failed" && <p className="text-sm text-[#ff8d82]">This link doesn&apos;t work. Write to hello@beedero.com and we&apos;ll do it.</p>}
    </div>
  );
}
