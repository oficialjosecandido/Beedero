"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { nexusCall } from "@/app/beedero-nexus/actions";

import { nexusButtonClass, nexusInputClass, nexusPrimaryButtonClass } from "./ui";

/** The fatura was issued in the certified software: write its number here. */
export function IssueFatura({ id }: { id: number }) {
  const router = useRouter();
  const [reference, setReference] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="flex gap-1.5"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const result = await nexusCall(`/nexus/billing/invoices/${id}/issue/`, "POST", { fatura_reference: reference });
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success("Fatura recorded.");
          router.refresh();
        });
      }}
    >
      <input
        value={reference}
        onChange={(event) => setReference(event.target.value)}
        placeholder="FR 2026/1"
        aria-label="Fatura number"
        className={`${nexusInputClass} w-32 py-1.5 text-xs`}
      />
      <button type="submit" disabled={pending || !reference.trim()} className={nexusButtonClass}>
        Issued
      </button>
    </form>
  );
}

export function NewPromoCode() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [days, setDays] = useState(365);
  const [limit, setLimit] = useState("");
  const [expires, setExpires] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="grid gap-2 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await nexusCall("/nexus/billing/promo-codes/", "POST", {
            code,
            free_days: days,
            max_redemptions: limit || null,
            expires_at: expires ? new Date(`${expires}T23:59:59`).toISOString() : null,
            note,
          });
          if (!result.ok) {
            setError(result.error);
            return;
          }
          toast.success("Code created.");
          setCode("");
          setNote("");
          router.refresh();
        });
      }}
    >
      <label className="text-xs font-bold text-white/60">
        Code
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="WEBSUMMIT26" className={`${nexusInputClass} mt-1`} />
      </label>
      <label className="text-xs font-bold text-white/60">
        Free days
        <input type="number" min={1} max={730} value={days} onChange={(e) => setDays(Number(e.target.value))} className={`${nexusInputClass} mt-1`} />
      </label>
      <label className="text-xs font-bold text-white/60">
        Max organisations (optional)
        <input type="number" min={1} value={limit} onChange={(e) => setLimit(e.target.value)} className={`${nexusInputClass} mt-1`} />
      </label>
      <label className="text-xs font-bold text-white/60">
        Last day (optional)
        <input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} className={`${nexusInputClass} mt-1`} />
      </label>
      <label className="text-xs font-bold text-white/60 sm:col-span-2">
        Note
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Who it's for" className={`${nexusInputClass} mt-1`} />
      </label>
      {error && <p className="text-xs font-bold text-[#ff8d82] sm:col-span-2">{error}</p>}
      <button type="submit" disabled={pending || !code.trim()} className={`${nexusPrimaryButtonClass} justify-self-start`}>
        {pending ? "…" : "Create code"}
      </button>
    </form>
  );
}
