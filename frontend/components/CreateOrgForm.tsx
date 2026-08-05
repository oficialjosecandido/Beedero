"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  createOrgWizardAction,
  saveOrgLogoWizardAction,
  saveOrgTextFieldWizardAction,
  type WizardResult,
} from "@/app/(app)/dashboard/actions";

type ChecklistItem = { key: string; done: boolean; hint: string };

const TOTAL_STEPS = 4;

const inputClass =
  "rounded-lg border border-beedero-border bg-white px-2.5 py-1.5 text-sm text-beedero-black outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60";

function ProgressMeter({ completeness, checklist }: { completeness: number; checklist: ChecklistItem[] }) {
  const missing = checklist.filter((item) => !item.done);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs font-semibold text-zinc-600">
        <span>Profile strength</span>
        <span>{completeness}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
        <div
          className="h-full rounded-full bg-beedero-yellow transition-all"
          style={{ width: `${completeness}%` }}
        />
      </div>
      {missing.length > 0 && (
        <p className="text-[11px] text-zinc-500">{missing[0].hint}</p>
      )}
    </div>
  );
}

export function CreateOrgForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState(0);
  const [slug, setSlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completeness, setCompleteness] = useState(0);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);

  const [name, setName] = useState("");
  const [oneLiner, setOneLiner] = useState("");
  const [about, setAbout] = useState("");
  const [products, setProducts] = useState("");
  const [market, setMarket] = useState("");

  function applyProgress(result: WizardResult) {
    setError(result.error);
    if (result.completeness !== undefined) setCompleteness(result.completeness);
    if (result.checklist !== undefined) setChecklist(result.checklist);
  }

  function finish() {
    if (slug) router.push(`/dashboard/${slug}`);
  }

  function handleCreate() {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    startTransition(async () => {
      const result = await createOrgWizardAction(name.trim(), oneLiner.trim());
      if (result.error || !result.slug) {
        applyProgress(result);
        return;
      }
      setSlug(result.slug);
      applyProgress(result);
      setStep(1);
    });
  }

  function handleLogo(file: File | null) {
    if (!slug) return;
    if (!file) {
      setStep(2);
      return;
    }
    startTransition(async () => {
      const result = await saveOrgLogoWizardAction(slug, file);
      applyProgress(result);
      if (!result.error) setStep(2);
    });
  }

  function handleAbout(skip: boolean) {
    if (!slug) return;
    if (skip || !about.trim()) {
      setStep(3);
      return;
    }
    startTransition(async () => {
      const result = await saveOrgTextFieldWizardAction(slug, "about", "summary", about.trim());
      applyProgress(result);
      if (!result.error) setStep(3);
    });
  }

  function handleProductsMarket(skip: boolean) {
    if (!slug) return;
    if (skip || (!products.trim() && !market.trim())) {
      finish();
      return;
    }
    startTransition(async () => {
      const results: WizardResult[] = [];
      if (products.trim()) {
        results.push(await saveOrgTextFieldWizardAction(slug, "products", "overview", products.trim()));
      }
      if (market.trim()) {
        results.push(await saveOrgTextFieldWizardAction(slug, "market_thesis", "market", market.trim()));
      }
      const last = results[results.length - 1];
      if (last) applyProgress(last);
      finish();
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border-2 border-beedero-border bg-beedero-white p-4">
      {slug && (
        <>
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
            <span>Step {step} of {TOTAL_STEPS}</span>
            <button type="button" onClick={finish} className="normal-case text-beedero-black hover:underline">
              Finish now
            </button>
          </div>
          <ProgressMeter completeness={completeness} checklist={checklist} />
        </>
      )}

      {step === 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-zinc-700">Create organization</p>
          <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
            Name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={inputClass}
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
            One-liner (optional)
            <input
              value={oneLiner}
              onChange={(event) => setOneLiner(event.target.value)}
              maxLength={140}
              placeholder="What do you do, in one sentence?"
              className={inputClass}
            />
          </label>
          <p className="text-[11px] text-zinc-500">
            Only the name is required. Everything else is optional — add as much or as little as
            you like, and we&apos;ll show your profile strength as you go.
          </p>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            type="button"
            onClick={handleCreate}
            disabled={pending}
            className="self-start rounded-xl bg-beedero-yellow px-3 py-1.5 text-sm font-bold text-beedero-black hover:bg-beedero-black hover:text-beedero-white disabled:opacity-50"
          >
            {pending ? "…" : "Create draft"}
          </button>
        </div>
      )}

      {step === 1 && slug && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-zinc-700">Add a logo (optional)</p>
          <input
            type="file"
            accept="image/*"
            onChange={(event) => handleLogo(event.target.files?.[0] ?? null)}
            disabled={pending}
            className="text-xs text-zinc-700 file:mr-2 file:rounded-lg file:border-0 file:bg-beedero-yellow file:px-2.5 file:py-1 file:text-xs file:font-bold file:text-beedero-black hover:file:bg-beedero-black hover:file:text-beedero-white"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            type="button"
            onClick={() => setStep(2)}
            disabled={pending}
            className="self-start text-xs font-semibold text-zinc-500 hover:text-beedero-black"
          >
            Skip
          </button>
        </div>
      )}

      {step === 2 && slug && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-zinc-700">About (optional)</p>
          <textarea
            value={about}
            onChange={(event) => setAbout(event.target.value)}
            rows={3}
            placeholder="Explain what the organization does in simple language."
            className={inputClass}
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => handleAbout(false)}
              disabled={pending}
              className="rounded-xl bg-beedero-yellow px-3 py-1.5 text-xs font-bold text-beedero-black hover:bg-beedero-black hover:text-beedero-white disabled:opacity-50"
            >
              {pending ? "…" : "Save & continue"}
            </button>
            <button
              type="button"
              onClick={() => handleAbout(true)}
              disabled={pending}
              className="text-xs font-semibold text-zinc-500 hover:text-beedero-black"
            >
              Skip
            </button>
          </div>
        </div>
      )}

      {step === 3 && slug && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-zinc-700">Products & market (optional)</p>
          <textarea
            value={products}
            onChange={(event) => setProducts(event.target.value)}
            rows={2}
            placeholder="What do you sell or offer?"
            className={inputClass}
          />
          <textarea
            value={market}
            onChange={(event) => setMarket(event.target.value)}
            rows={2}
            placeholder="Who is the target market and how big is the opportunity?"
            className={inputClass}
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => handleProductsMarket(false)}
              disabled={pending}
              className="rounded-xl bg-beedero-yellow px-3 py-1.5 text-xs font-bold text-beedero-black hover:bg-beedero-black hover:text-beedero-white disabled:opacity-50"
            >
              {pending ? "…" : "Finish"}
            </button>
            <button
              type="button"
              onClick={() => handleProductsMarket(true)}
              disabled={pending}
              className="text-xs font-semibold text-zinc-500 hover:text-beedero-black"
            >
              Skip & finish
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
