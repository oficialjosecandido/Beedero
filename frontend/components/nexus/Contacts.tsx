"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { nexusCall } from "@/app/beedero-nexus/actions";

import { nexusInputClass, nexusPrimaryButtonClass } from "./ui";

/** Add contacts who asked for the newsletter somewhere else. The source is
 *  required: it is the record of where their consent came from. */
export function AddContacts() {
  const router = useRouter();
  const [emails, setEmails] = useState("");
  const [source, setSource] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await nexusCall<{ added: number; already_there: number; invalid: number }>(
            "/nexus/newsletter/contacts/",
            "POST",
            { emails, source }
          );
          if (!result.ok || !result.data) {
            setError(result.error);
            return;
          }
          const { added, already_there, invalid } = result.data;
          toast.success(`${added} added · ${already_there} already there · ${invalid} invalid`);
          setEmails("");
          router.refresh();
        });
      }}
    >
      <textarea
        value={emails}
        onChange={(event) => setEmails(event.target.value)}
        rows={4}
        placeholder={"one@example.com\ntwo@example.com"}
        aria-label="Emails, one per line"
        className={`${nexusInputClass} font-mono text-xs`}
      />
      <input
        value={source}
        onChange={(event) => setSource(event.target.value)}
        placeholder="Where they asked for it — e.g. Web Summit 2026 sign-up sheet"
        aria-label="Source"
        className={nexusInputClass}
      />
      {error && <p className="text-xs font-bold text-[#ff8d82]">{error}</p>}
      <button type="submit" disabled={pending || !emails.trim()} className={`${nexusPrimaryButtonClass} self-start`}>
        {pending ? "…" : "Add contacts"}
      </button>
    </form>
  );
}
