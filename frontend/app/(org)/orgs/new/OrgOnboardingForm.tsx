"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, Check } from "lucide-react";

import { OrgCard, orgEyebrowClass } from "@/components/org-workspace/ui";
import { DEFAULT_PRICES, billingDate, formatEuros, type PlanChoice } from "@/lib/billing";
import { GEO_FIELD_LABEL, GEO_OPTIONS, SECTOR_OPTIONS, STAGE_OPTIONS } from "@/lib/org-filters";
import { clearProfileSwitcherCache } from "@/lib/profile-switcher-client";

import { checkCodeAction, createOrganisationAction } from "./actions";

const inputClass =
  "w-full border-2 border-org-ink bg-white px-3 py-2.5 text-sm text-org-ink outline-none placeholder:text-black/35 focus:ring-4 focus:ring-beedero-yellow";

type CodeState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "valid"; code: string; freeUntil: string }
  | { status: "invalid"; message: string };

/** The co-founder match this organisation comes from, when it does. */
export type MatchContext = { id: number; otherName: string };

const PLAN_COPY: Record<PlanChoice, { title: string; note: string }> = {
  yearly: { title: "Yearly", note: "One month free compared with monthly." },
  monthly: { title: "Monthly", note: "Cancel any time." },
};

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className={`${orgEyebrowClass} text-black/60`}>{label}</span>
      {children}
      {hint && !error && <span className="text-[11px] leading-4 text-black/50">{hint}</span>}
      {error && <span className="text-xs font-bold text-[#b3261e]">{error}</span>}
    </label>
  );
}

function OptionSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
}) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className={inputClass}>
      <option value="">Choose…</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function StepTitle({ number, title }: { number: number; title: string }) {
  return (
    <h2 className="flex items-center gap-3 text-xl font-black tracking-[-0.03em]">
      <span className="grid size-7 place-items-center bg-org-ink text-xs text-white">{number}</span>
      {title}
    </h2>
  );
}

export function OrgOnboardingForm({ match }: { match: MatchContext | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [leaving, setLeaving] = useState(false);

  const [name, setName] = useState("");
  const [oneLiner, setOneLiner] = useState("");
  const [sector, setSector] = useState("");
  const [stage, setStage] = useState("");
  const [geo, setGeo] = useState("");
  const [plan, setPlan] = useState<PlanChoice>("yearly");
  const [codeOpen, setCodeOpen] = useState(false);
  const [code, setCode] = useState("");
  const [codeState, setCodeState] = useState<CodeState>({ status: "idle" });
  const [accepted, setAccepted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const price = DEFAULT_PRICES.find((item) => item.choice === plan) ?? DEFAULT_PRICES[0];
  const free = codeState.status === "valid";
  const busy = pending || leaving;

  async function checkCode(raw: string): Promise<CodeState> {
    if (!raw.trim()) return { status: "idle" };
    const result = await checkCodeAction(raw);
    if (result.valid && result.code) {
      // The clock is read here, in an event, never during render.
      const until = new Date(Date.now() + (result.free_days ?? 365) * 86_400_000).toISOString();
      return { status: "valid", code: result.code, freeUntil: billingDate(until) };
    }
    return { status: "invalid", message: result.detail ?? "That code doesn't exist." };
  }

  function applyCode() {
    setCodeState({ status: "checking" });
    startTransition(async () => {
      setCodeState(await checkCode(code));
    });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const local: Record<string, string> = {};
    if (!name.trim()) local.name = "Give the organisation a name.";
    if (!accepted) local.accept_terms = "Tick the box to continue.";
    setErrors(local);
    if (Object.keys(local).length > 0) return;

    startTransition(async () => {
      // A code typed but never checked is checked now, so the button never
      // promises a free year the server then refuses.
      let current = codeState;
      if (code.trim() && current.status !== "valid") {
        current = await checkCode(code);
        setCodeState(current);
        if (current.status === "invalid") return;
      }
      const result = await createOrganisationAction({
        name: name.trim(),
        one_liner: oneLiner.trim(),
        sector,
        stage,
        geo,
        plan,
        code: current.status === "valid" ? current.code : "",
        accept_terms: accepted,
        match: match?.id ?? null,
      });
      if (!result.url) {
        setErrors(result.errors);
        if (result.errors.code) setCodeState({ status: "invalid", message: result.errors.code });
        return;
      }
      setLeaving(true);
      if (result.next === "checkout") {
        window.location.assign(result.url);
        return;
      }
      clearProfileSwitcherCache();
      router.refresh();
      router.push(result.url);
    });
  }

  let buttonLabel = free ? "Create organisation — free for a year" : `Continue to payment — ${formatEuros(price.amount_cents)}`;
  if (busy) buttonLabel = free ? "Creating…" : "Opening payment…";

  return (
    <div className="mx-auto max-w-[1080px] px-4 pb-16 pt-6 sm:px-6 lg:pt-10">
      <Link
        href={match ? "/cofounder" : "/feed"}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-black/60 transition hover:text-org-ink"
      >
        <ArrowLeft size={14} aria-hidden /> Back
      </Link>
      <p className={`${orgEyebrowClass} mt-6`}>{match ? "Start it together" : "New organisation"}</p>
      <h1 className="mt-2 max-w-2xl text-4xl font-black leading-[0.95] tracking-[-0.05em] sm:text-5xl">
        Put your company on the record.
      </h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-black/65">
        One page. The logo, the story and the team come later, from the workspace.
      </p>
      {match && (
        <p className="mt-4 max-w-xl border-2 border-org-ink bg-org-chip px-4 py-3 text-sm leading-6">
          You become the first owner and <b>{match.otherName}</b> is invited as an owner too — they
          have to accept, nobody is added to a company without saying yes.
        </p>
      )}

      <form
        onSubmit={submit}
        noValidate
        className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]"
      >
        <div className="flex min-w-0 flex-col gap-6">
          <OrgCard>
            <StepTitle number={1} title="The organisation" />
            <div className="mt-5 flex flex-col gap-4">
              <Field label="Name" error={errors.name}>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={200}
                  autoFocus
                  autoComplete="organization"
                  className={inputClass}
                />
              </Field>
              <Field
                label="One-liner (optional)"
                error={errors.one_liner}
                hint={`${oneLiner.length}/140 · What you do, in one sentence.`}
              >
                <input
                  value={oneLiner}
                  onChange={(event) => setOneLiner(event.target.value)}
                  maxLength={140}
                  placeholder="Credit for small shops, decided in a day."
                  className={inputClass}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Sector" error={errors.sector}>
                  <OptionSelect value={sector} onChange={setSector} options={SECTOR_OPTIONS} />
                </Field>
                <Field label="Stage" error={errors.stage}>
                  <OptionSelect value={stage} onChange={setStage} options={STAGE_OPTIONS} />
                </Field>
                <Field label={GEO_FIELD_LABEL} error={errors.geo}>
                  <OptionSelect value={geo} onChange={setGeo} options={GEO_OPTIONS} />
                </Field>
              </div>
            </div>
          </OrgCard>

          <OrgCard>
            <StepTitle number={2} title="Plan" />
            <div role="radiogroup" aria-label="Plan" className="mt-5 grid gap-3 sm:grid-cols-2">
              {DEFAULT_PRICES.map((option) => {
                const selected = option.choice === plan;
                return (
                  <button
                    key={option.choice}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setPlan(option.choice)}
                    className={`flex flex-col items-start border-2 p-4 text-left transition ${
                      selected
                        ? "border-org-ink bg-org-chip shadow-[4px_4px_0_#17191f]"
                        : "border-black/20 bg-white hover:border-org-ink"
                    }`}
                  >
                    <span className="flex w-full items-center justify-between">
                      <span className={`${orgEyebrowClass} text-black/60`}>{PLAN_COPY[option.choice].title}</span>
                      <span
                        aria-hidden
                        className={`grid size-5 place-items-center border-2 border-org-ink ${
                          selected ? "bg-org-ink text-white" : "bg-white"
                        }`}
                      >
                        {selected && <Check size={12} strokeWidth={3} />}
                      </span>
                    </span>
                    <span className="mt-3 text-3xl font-black tracking-[-0.04em]">
                      {formatEuros(option.amount_cents)}
                      <span className="text-sm font-bold text-black/55">/{option.interval}</span>
                    </span>
                    <span className="mt-1 text-xs text-black/60">{PLAN_COPY[option.choice].note}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-[11px] leading-4 text-black/55">
              VAT included. The plan is for the organisation — people on Beedero are always free.
            </p>

            <div className="mt-5 border-t border-black/15 pt-4">
              {!codeOpen ? (
                <button
                  type="button"
                  onClick={() => setCodeOpen(true)}
                  className="text-xs font-bold text-org-ink underline underline-offset-4"
                >
                  Have a code?
                </button>
              ) : (
                <Field
                  label="Code"
                  error={codeState.status === "invalid" ? codeState.message : undefined}
                >
                  <span className="flex gap-2">
                    <input
                      value={code}
                      onChange={(event) => {
                        setCode(event.target.value.toUpperCase());
                        setCodeState({ status: "idle" });
                      }}
                      onBlur={() => code.trim() && codeState.status === "idle" && applyCode()}
                      autoCapitalize="characters"
                      spellCheck={false}
                      placeholder="10OFF"
                      className={`${inputClass} font-bold tracking-[0.08em]`}
                    />
                    <button
                      type="button"
                      onClick={applyCode}
                      disabled={!code.trim() || busy}
                      className="shrink-0 border-2 border-org-ink bg-white px-4 text-xs font-black transition hover:bg-org-chip disabled:opacity-50"
                    >
                      {codeState.status === "checking" ? "…" : "Apply"}
                    </button>
                  </span>
                </Field>
              )}
              {codeState.status === "valid" && (
                <p className="mt-3 flex items-start gap-2 bg-org-ink px-3 py-2.5 text-xs font-bold leading-5 text-white">
                  <Check size={14} strokeWidth={3} className="mt-0.5 shrink-0 text-beedero-yellow" aria-hidden />
                  {codeState.code}: the first year is free, until {codeState.freeUntil}. No card needed.
                </p>
              )}
            </div>
          </OrgCard>
        </div>

        <aside className="lg:sticky lg:top-24">
          <OrgCard tone="ink">
            <p className={`${orgEyebrowClass} text-beedero-yellow`}>3 · Confirm</p>
            <dl className="mt-4 divide-y divide-white/10 text-sm">
              <div className="flex justify-between gap-4 py-2">
                <dt className="text-white/55">Organisation</dt>
                <dd className="truncate font-bold">{name.trim() || "—"}</dd>
              </div>
              <div className="flex justify-between gap-4 py-2">
                <dt className="text-white/55">Plan</dt>
                <dd className="font-bold">
                  {PLAN_COPY[plan].title} · {formatEuros(price.amount_cents)}/{price.interval}
                </dd>
              </div>
              {match && (
                <div className="flex justify-between gap-4 py-2">
                  <dt className="text-white/55">Co-founder</dt>
                  <dd className="truncate font-bold">{match.otherName}</dd>
                </div>
              )}
              {free && (
                <div className="flex justify-between gap-4 py-2">
                  <dt className="text-white/55">Code</dt>
                  <dd className="font-bold text-beedero-yellow">{codeState.code}</dd>
                </div>
              )}
            </dl>

            <div className="mt-4 border-t-2 border-white/80 pt-4">
              <p className="flex items-baseline justify-between">
                <span className={`${orgEyebrowClass} text-white/70`}>Due today</span>
                <b className="text-4xl font-black tracking-[-0.04em]">
                  {free ? "€0" : formatEuros(price.amount_cents)}
                </b>
              </p>
              <p className="mt-2 text-xs leading-5 text-white/65">
                {free
                  ? `Free until ${codeState.freeUntil}. Nothing is charged unless you add a card — we'll remind you a month before the year ends.`
                  : `You'll pay on Stripe's secure page. Renews every ${price.interval} until you cancel. A refund is yours if you ask within 14 days.`}
              </p>
            </div>

            <label className="mt-5 flex items-start gap-3 text-xs leading-5 text-white/85">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(event) => setAccepted(event.target.checked)}
                className="mt-0.5 size-4 shrink-0 accent-beedero-yellow"
              />
              <span>
                I can act for this organisation, and I accept the{" "}
                <Link href="/terms#subscriptions" target="_blank" className="font-bold text-white underline">
                  Terms, including the subscription terms
                </Link>
                .
              </span>
            </label>
            {errors.accept_terms && (
              <p className="mt-2 text-xs font-bold text-beedero-yellow">{errors.accept_terms}</p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="mt-5 min-h-12 w-full bg-beedero-yellow px-4 text-sm font-black text-org-ink transition hover:bg-white disabled:opacity-60"
            >
              {buttonLabel}
            </button>
            {errors.detail && <p className="mt-3 text-xs font-bold text-beedero-yellow">{errors.detail}</p>}
          </OrgCard>
        </aside>
      </form>
    </div>
  );
}
