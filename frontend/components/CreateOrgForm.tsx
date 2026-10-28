"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  createOrgWizardAction,
  inviteTeamMemberWizardAction,
  saveOrgLogoWizardAction,
  saveOrgTextFieldWizardAction,
  type WizardResult,
} from "@/app/(app)/dashboard/actions";
import { clearProfileSwitcherCache } from "@/lib/profile-switcher-client";

type ChecklistItem = { key: string; done: boolean; hint: string };

const STEPS = [
  { id: 0, label: "Basics" },
  { id: 1, label: "Logo" },
  { id: 2, label: "About" },
  { id: 3, label: "Market" },
  { id: 4, label: "Team" },
] as const;

const TOTAL_STEPS = STEPS.length;

type Tone = "light" | "dark";

function ProgressMeter({
  completeness,
  checklist,
  tone,
}: {
  completeness: number;
  checklist: ChecklistItem[];
  tone: Tone;
}) {
  const missing = checklist.filter((item) => !item.done);
  const muted = tone === "dark" ? "text-white/45" : "text-zinc-600";
  const track = tone === "dark" ? "bg-white/10" : "bg-zinc-100";
  const hint = tone === "dark" ? "text-white/40" : "text-zinc-500";
  return (
    <div className="flex flex-col gap-1.5">
      <div className={`flex items-center justify-between text-xs font-semibold ${muted}`}>
        <span>Profile strength</span>
        <span>{completeness}%</span>
      </div>
      <div className={`h-1.5 w-full overflow-hidden ${track}`}>
        <div
          className="h-full bg-beedero-yellow transition-all"
          style={{ width: `${completeness}%` }}
        />
      </div>
      {missing.length > 0 && <p className={`text-[11px] ${hint}`}>{missing[0].hint}</p>}
    </div>
  );
}

function StepRail({ current, tone }: { current: number; tone: Tone }) {
  return (
    <ol className="flex flex-wrap gap-2" aria-label="Creation steps">
      {STEPS.map((step) => {
        const done = current > step.id;
        const active = current === step.id;
        return (
          <li
            key={step.id}
            className={`flex items-center gap-2 border px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] ${
              active
                ? "border-beedero-yellow bg-beedero-yellow text-beedero-black"
                : done
                  ? tone === "dark"
                    ? "border-white/25 text-white"
                    : "border-beedero-black/30 text-beedero-black"
                  : tone === "dark"
                    ? "border-white/10 text-white/35"
                    : "border-zinc-200 text-zinc-400"
            }`}
          >
            <span className="tabular-nums">{String(step.id + 1).padStart(2, "0")}</span>
            {step.label}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Multi-step create-org wizard. Used as a full page at `/organisations/new`
 * (`tone="dark"`). The light tone remains for any legacy light surfaces.
 */
export function CreateOrgForm({ tone = "light" }: { tone?: Tone }) {
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
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteTitle, setInviteTitle] = useState("");
  const [invited, setInvited] = useState<string[]>([]);

  const dark = tone === "dark";
  const shell = dark
    ? "flex flex-col gap-5 border border-white/10 bg-white/[0.025] p-5 sm:p-7"
    : "flex flex-col gap-3 rounded-2xl border-2 border-beedero-border bg-beedero-white p-4";
  const inputClass = dark
    ? "w-full border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none transition focus:border-beedero-yellow placeholder:text-white/35"
    : "rounded-lg border border-beedero-border bg-white px-2.5 py-1.5 text-sm text-beedero-black outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60";
  const labelClass = dark
    ? "flex flex-col gap-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-white/40"
    : "flex flex-col gap-1 text-xs font-medium text-zinc-600";
  const titleClass = dark ? "text-lg font-black text-white" : "text-sm font-semibold text-zinc-700";
  const bodyClass = dark ? "text-sm leading-6 text-white/55" : "text-[11px] text-zinc-500";
  const errorClass = dark ? "text-sm text-red-300" : "text-xs text-danger";
  const primaryBtn = dark
    ? "bg-beedero-yellow px-4 py-2.5 text-xs font-black text-beedero-black transition hover:opacity-90 disabled:opacity-50"
    : "rounded-xl bg-beedero-yellow px-3 py-1.5 text-sm font-bold text-beedero-black hover:bg-beedero-black hover:text-beedero-white disabled:opacity-50";
  const ghostBtn = dark
    ? "text-xs font-bold text-white/45 transition hover:text-white disabled:opacity-50"
    : "text-xs font-semibold text-zinc-500 hover:text-beedero-black disabled:opacity-50";
  const secondaryBtn = dark
    ? "border border-white/15 px-4 py-2.5 text-xs font-bold text-white/70 transition hover:border-beedero-yellow hover:text-beedero-yellow disabled:opacity-50"
    : "rounded-xl border border-beedero-border px-3 py-1.5 text-xs font-bold text-beedero-black hover:bg-beedero-black hover:text-beedero-white disabled:opacity-50";

  function applyProgress(result: WizardResult) {
    setError(result.error);
    if (result.completeness !== undefined) setCompleteness(result.completeness);
    if (result.checklist !== undefined) setChecklist(result.checklist);
  }

  function finish() {
    if (!slug) return;
    // The new org has to reach both org lists in the shell: the client cache
    // behind the avatar menu, and the sidebar. Without the refresh, partial
    // rendering keeps serving the layout from before this org existed.
    clearProfileSwitcherCache();
    router.refresh();
    router.push(`/dashboard/${slug}`);
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
      setStep(4);
      return;
    }
    startTransition(async () => {
      const results: WizardResult[] = [];
      if (products.trim()) {
        results.push(await saveOrgTextFieldWizardAction(slug, "products", "overview", products.trim()));
      }
      if (market.trim()) {
        results.push(
          await saveOrgTextFieldWizardAction(slug, "market_thesis", "market", market.trim())
        );
      }
      const last = results[results.length - 1];
      if (last) applyProgress(last);
      setStep(4);
    });
  }

  function handleInvite() {
    if (!slug) return;
    const email = inviteEmail.trim();
    const title = inviteTitle.trim();
    if (!email || !title) {
      setError("Email and role are both needed to invite someone.");
      return;
    }
    startTransition(async () => {
      const result = await inviteTeamMemberWizardAction(slug, { email, title });
      applyProgress(result);
      if (result.error) return;
      // Kept client-side so the step can say what it just did without a
      // round-trip; the authoritative list lives on the Affiliations tab.
      setInvited((prev) => [
        ...prev,
        result.alreadyOnBeedero ? `${email} (already on Beedero)` : email,
      ]);
      setInviteEmail("");
      setInviteTitle("");
    });
  }

  return (
    <div className={shell}>
      <StepRail current={step} tone={tone} />

      {slug && (
        <div className="flex flex-col gap-3">
          <div
            className={`flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide ${
              dark ? "text-white/45" : "text-subtle"
            }`}
          >
            <span>
              Step {step + 1} of {TOTAL_STEPS}
            </span>
            <button type="button" onClick={finish} className={`normal-case ${ghostBtn}`}>
              Finish now
            </button>
          </div>
          <ProgressMeter completeness={completeness} checklist={checklist} tone={tone} />
        </div>
      )}

      {step === 0 && (
        <div className="flex flex-col gap-4">
          <div>
            <p className={titleClass}>Name the organisation</p>
            <p className={`mt-1 ${bodyClass}`}>
              Only the name is required. Everything else is optional — add as much or as little as
              you like, and we&apos;ll show your profile strength as you go.
            </p>
          </div>
          <label className={labelClass}>
            Name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={inputClass}
              required
            />
          </label>
          <label className={labelClass}>
            One-liner (optional)
            <input
              value={oneLiner}
              onChange={(event) => setOneLiner(event.target.value)}
              maxLength={140}
              placeholder="What do you do, in one sentence?"
              className={inputClass}
            />
          </label>
          {error && <p className={errorClass}>{error}</p>}
          <button type="button" onClick={handleCreate} disabled={pending} className={`self-start ${primaryBtn}`}>
            {pending ? "Creating…" : "Create draft"}
          </button>
        </div>
      )}

      {step === 1 && slug && (
        <div className="flex flex-col gap-4">
          <div>
            <p className={titleClass}>Add a logo</p>
            <p className={`mt-1 ${bodyClass}`}>Optional — you can upload one later from the workspace.</p>
          </div>
          <input
            type="file"
            accept="image/*"
            onChange={(event) => handleLogo(event.target.files?.[0] ?? null)}
            disabled={pending}
            className={
              dark
                ? "text-sm text-white/70 file:mr-3 file:border-0 file:bg-beedero-yellow file:px-3 file:py-2 file:text-xs file:font-black file:text-beedero-black"
                : "text-xs text-zinc-700 file:mr-2 file:rounded-lg file:border-0 file:bg-beedero-yellow file:px-2.5 file:py-1 file:text-xs file:font-bold file:text-beedero-black hover:file:bg-beedero-black hover:file:text-beedero-white"
            }
          />
          {error && <p className={errorClass}>{error}</p>}
          <button type="button" onClick={() => setStep(2)} disabled={pending} className={`self-start ${ghostBtn}`}>
            Skip
          </button>
        </div>
      )}

      {step === 2 && slug && (
        <div className="flex flex-col gap-4">
          <div>
            <p className={titleClass}>About</p>
            <p className={`mt-1 ${bodyClass}`}>Explain what the organisation does in simple language.</p>
          </div>
          <textarea
            value={about}
            onChange={(event) => setAbout(event.target.value)}
            rows={4}
            placeholder="Explain what the organization does in simple language."
            className={inputClass}
          />
          {error && <p className={errorClass}>{error}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => handleAbout(false)}
              disabled={pending}
              className={primaryBtn}
            >
              {pending ? "Saving…" : "Save & continue"}
            </button>
            <button type="button" onClick={() => handleAbout(true)} disabled={pending} className={ghostBtn}>
              Skip
            </button>
          </div>
        </div>
      )}

      {step === 3 && slug && (
        <div className="flex flex-col gap-4">
          <div>
            <p className={titleClass}>Products &amp; market</p>
            <p className={`mt-1 ${bodyClass}`}>Optional — helps people understand what you sell and to whom.</p>
          </div>
          <textarea
            value={products}
            onChange={(event) => setProducts(event.target.value)}
            rows={3}
            placeholder="What do you sell or offer?"
            className={inputClass}
          />
          <textarea
            value={market}
            onChange={(event) => setMarket(event.target.value)}
            rows={3}
            placeholder="Who is the target market and how big is the opportunity?"
            className={inputClass}
          />
          {error && <p className={errorClass}>{error}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => handleProductsMarket(false)}
              disabled={pending}
              className={primaryBtn}
            >
              {pending ? "Saving…" : "Continue"}
            </button>
            <button
              type="button"
              onClick={() => handleProductsMarket(true)}
              disabled={pending}
              className={ghostBtn}
            >
              Skip
            </button>
          </div>
        </div>
      )}

      {/* §2.3: the team step, prominent but never required. "I'll do this
          later" is a plain button at the same size as the primary one, not a
          greyed-out link, because a skip you have to hunt for isn't optional. */}
      {step === 4 && slug && (
        <div className="flex flex-col gap-4">
          <div>
            <p className={titleClass}>Who else is on the team?</p>
            <p className={`mt-1 ${bodyClass}`}>
              We&apos;ll email each person once to ask them to confirm the role themselves. A role
              they confirm counts for far more than one you type in — and nothing appears on their
              profile, or yours, until they agree.
            </p>
          </div>
          <label className={labelClass}>
            Their email
            <input
              type="email"
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              placeholder="person@company.com"
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            Their role
            <input
              value={inviteTitle}
              onChange={(event) => setInviteTitle(event.target.value)}
              maxLength={120}
              placeholder="e.g. Head of Design"
              className={inputClass}
            />
          </label>
          {invited.length > 0 && (
            <ul className={`flex flex-col gap-0.5 text-xs ${dark ? "text-white/45" : "text-zinc-500"}`}>
              {invited.map((entry) => (
                <li key={entry}>Invited {entry}</li>
              ))}
            </ul>
          )}
          {error && <p className={errorClass}>{error}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={handleInvite} disabled={pending} className={primaryBtn}>
              {pending ? "Sending…" : invited.length > 0 ? "Invite another" : "Send invite"}
            </button>
            <button type="button" onClick={finish} disabled={pending} className={secondaryBtn}>
              {invited.length > 0 ? "Done" : "I'll do this later"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
