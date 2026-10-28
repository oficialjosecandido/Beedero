"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { Check, X } from "lucide-react";

import {
  openBillingPortalAction,
  redeemCodeAction,
  startCheckoutAction,
} from "@/app/(org)/dashboard/[slug]/billing-actions";
import {
  DEFAULT_PRICES,
  PLAN_LABELS,
  billingDate,
  billingSummary,
  formatEuros,
  priceLine,
  welcomeLine,
  type OrgBilling,
  type PlanChoice,
} from "@/lib/billing";

import type { OrgTabId } from "./tabs";
import { OrgCard, OrgCardHeading, orgEyebrowClass, orgInkButtonClass, orgOutlineButtonClass } from "./ui";

export type BillingNotice = "welcome" | "checkout_success" | "checkout_cancelled" | null;

const STATE_LABELS: Record<OrgBilling["state"], string> = {
  free_year: "Free year",
  trialing: "Card on file",
  active: "Active",
  past_due: "Payment failed",
  comp: "Complimentary",
  needs_plan: "No plan",
  lapsed: "Ended",
};

/* -------------------------------------------------------------- actions */

function useGoTo() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  function go(load: () => Promise<{ url: string | null; error: string | null }>) {
    setError(null);
    startTransition(async () => {
      const result = await load();
      if (!result.url) {
        setError(result.error);
        return;
      }
      setLeaving(true);
      window.location.assign(result.url);
    });
  }
  return { go, error, busy: pending || leaving };
}

export function PortalButton({ slug, label = "Manage billing" }: { slug: string; label?: string }) {
  const { go, error, busy } = useGoTo();
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={() => go(() => openBillingPortalAction(slug))}
        className={`${orgInkButtonClass} self-start disabled:opacity-60`}
      >
        {busy ? "Opening…" : label}
      </button>
      {error && <p className="text-xs font-bold text-[#b3261e]">{error}</p>}
    </div>
  );
}

/**
 * Yearly or monthly, then Stripe. During the free year, the card is only
 * charged when the year ends — the backend sets that date on the checkout.
 */
export function PlanPicker({
  slug,
  billing,
  onDark = false,
}: {
  slug: string;
  billing: OrgBilling;
  onDark?: boolean;
}) {
  const prices = billing.prices.length > 0 ? billing.prices : DEFAULT_PRICES;
  const [plan, setPlan] = useState<PlanChoice>(billing.plan === "monthly" ? "monthly" : "yearly");
  const { go, error, busy } = useGoTo();
  const freeYear = billing.state === "free_year";
  const price = prices.find((item) => item.choice === plan) ?? prices[0];

  return (
    <div className="flex flex-col gap-3">
      <div role="radiogroup" aria-label="Plan" className="grid gap-2 sm:grid-cols-2">
        {prices.map((option) => {
          const selected = option.choice === plan;
          return (
            <button
              key={option.choice}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setPlan(option.choice)}
              className={`flex items-center justify-between gap-3 border-2 px-3 py-2.5 text-left transition ${
                selected
                  ? "border-beedero-yellow bg-beedero-yellow text-org-ink"
                  : onDark
                    ? "border-white/30 text-white hover:border-white"
                    : "border-black/20 bg-white text-org-ink hover:border-org-ink"
              }`}
            >
              <span>
                <span className={`${orgEyebrowClass} block opacity-70`}>{PLAN_LABELS[option.choice]}</span>
                <span className="text-lg font-black">{priceLine(option)}</span>
              </span>
              {selected && <Check size={16} strokeWidth={3} aria-hidden />}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => go(() => startCheckoutAction(slug, plan))}
        className="min-h-11 self-start bg-beedero-yellow px-4 text-xs font-black text-org-ink ring-2 ring-org-ink transition hover:bg-white disabled:opacity-60"
      >
        {busy
          ? "Opening payment…"
          : freeYear
            ? `Add a card — first charge on ${billingDate(billing.until)}`
            : `Continue to payment — ${formatEuros(price.amount_cents)}`}
      </button>
      <p className={`text-[11px] leading-4 ${onDark ? "text-white/55" : "text-black/55"}`}>
        VAT included. Paid on Stripe&apos;s secure page; cancel any time.
      </p>
      {error && <p className="text-xs font-bold text-[#b3261e]">{error}</p>}
    </div>
  );
}

function RedeemCodeForm({ slug, onDark = false }: { slug: string; onDark?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`self-start text-xs font-bold underline underline-offset-4 ${onDark ? "text-white" : "text-org-ink"}`}
      >
        Have a code?
      </button>
    );
  }
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await redeemCodeAction(slug, code, "yearly");
          if (result.error) {
            setError(result.error);
            return;
          }
          router.refresh();
        });
      }}
    >
      <span className="flex gap-2">
        <input
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          placeholder="10OFF"
          spellCheck={false}
          aria-label="Code"
          className="w-full max-w-60 border-2 border-org-ink bg-white px-3 py-2 text-sm font-bold tracking-[0.08em] text-org-ink outline-none focus:ring-4 focus:ring-beedero-yellow"
        />
        <button
          type="submit"
          disabled={pending || !code.trim()}
          className="border-2 border-org-ink bg-white px-4 text-xs font-black text-org-ink disabled:opacity-50"
        >
          {pending ? "…" : "Apply"}
        </button>
      </span>
      {error && (
        <p className={`text-xs font-bold ${onDark ? "text-beedero-yellow" : "text-[#b3261e]"}`}>{error}</p>
      )}
    </form>
  );
}

/* --------------------------------------------------------------- notice */

function NoticeBar({
  children,
  tone = "white",
  onClose,
}: {
  children: ReactNode;
  tone?: "white" | "ink" | "alert";
  onClose?: () => void;
}) {
  const tones = {
    white: "bg-white text-org-ink",
    ink: "bg-org-ink text-white",
    alert: "bg-[#ffe1dc] text-org-ink",
  };
  return (
    <div
      role="status"
      className={`mb-5 flex flex-wrap items-center gap-3 border-2 border-org-ink px-4 py-3 shadow-[5px_5px_0_#17191f] ${tones[tone]}`}
    >
      <div className="min-w-0 flex-1 text-sm leading-6">{children}</div>
      {onClose && (
        <button type="button" onClick={onClose} aria-label="Dismiss" className="opacity-60 hover:opacity-100">
          <X size={16} aria-hidden />
        </button>
      )}
    </div>
  );
}

/**
 * The one thing the workspace has to say about the plan, above everything
 * else: welcome, a missing plan, a failed payment or a free year running out.
 */
export function OrgPlanNotice({
  name,
  slug,
  billing,
  notice,
  canManage,
  onSelect,
}: {
  name: string;
  slug: string;
  billing: OrgBilling | null;
  notice: BillingNotice;
  canManage: boolean;
  onSelect: (tab: OrgTabId) => void;
}) {
  const [dismissed, setDismissed] = useState(false);
  if (!billing) return null;

  function dismiss() {
    setDismissed(true);
    window.history.replaceState(null, "", `/dashboard/${slug}`);
  }

  if (!billing.has_access) {
    const ended = billing.state === "lapsed";
    return (
      <OrgCard tone="ink" className="mb-5">
        <OrgCardHeading
          onDark
          eyebrow={ended ? "Plan ended" : "Choose a plan"}
          title={ended ? `${name} is paused.` : `One step left for ${name}.`}
        />
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70">
          {notice === "checkout_cancelled" && "Checkout cancelled — nothing was charged. "}
          {ended
            ? "Its page stays up, but it's read-only — hidden from Discover, and nothing can be edited, posted or listed until it has a plan again."
            : "The organisation exists as a draft. Until it has a plan, nothing can be edited or deleted. With a plan it can be published, post and list jobs."}
        </p>
        <div className="mt-5 flex flex-col gap-4">
          {canManage ? (
            <>
              <PlanPicker slug={slug} billing={billing} onDark />
              <RedeemCodeForm slug={slug} onDark />
            </>
          ) : (
            <p className="text-sm font-bold text-beedero-yellow">An owner or admin can choose the plan.</p>
          )}
        </div>
      </OrgCard>
    );
  }

  if (dismissed) return null;

  if (notice === "welcome" || notice === "checkout_success") {
    return (
      <NoticeBar tone="ink" onClose={dismiss}>
        <b className="font-black text-beedero-yellow">
          {notice === "welcome" ? `${name} is on Beedero.` : "Payment set up."}
        </b>{" "}
        {notice === "welcome" ? welcomeLine(billing) : billingSummary(name, billing)}{" "}
        <button
          type="button"
          onClick={() => onSelect("affiliations")}
          className="font-bold text-white underline underline-offset-4"
        >
          Next: ask your team to confirm their roles
        </button>
      </NoticeBar>
    );
  }

  if (notice === "checkout_cancelled") {
    return (
      <NoticeBar onClose={dismiss}>Checkout cancelled — nothing was charged and nothing changed.</NoticeBar>
    );
  }

  if (billing.state === "past_due") {
    return (
      <NoticeBar tone="alert">
        <span className="flex flex-wrap items-center gap-3">
          <span className="min-w-0 flex-1">
            <b className="font-black">Payment failed.</b> {billingSummary(name, billing)}
          </span>
          {canManage && <PortalButton slug={slug} label="Update card" />}
        </span>
      </NoticeBar>
    );
  }

  if (billing.ending_soon) {
    return (
      <NoticeBar>
        <b className="font-black">
          The free year ends on {billingDate(billing.until)}
          {billing.days_left !== null && ` (${billing.days_left} ${billing.days_left === 1 ? "day" : "days"})`}.
        </b>{" "}
        Add a card to keep {name} listed — nothing is charged before that day.{" "}
        {canManage && (
          <button
            type="button"
            onClick={() => onSelect("billing")}
            className="font-bold underline underline-offset-4"
          >
            Choose a plan
          </button>
        )}
      </NoticeBar>
    );
  }

  return null;
}

/* ------------------------------------------------------------------ tab */

export function OrgBillingPanel({
  name,
  slug,
  billing,
  canManage,
}: {
  name: string;
  slug: string;
  billing: OrgBilling | null;
  canManage: boolean;
}) {
  if (!billing) {
    return (
      <OrgCard>
        <OrgCardHeading eyebrow="Plan" title="Unavailable right now." />
        <p className="mt-3 text-sm text-black/60">The plan couldn&apos;t be loaded. Try again in a moment.</p>
      </OrgCard>
    );
  }

  const prices = billing.prices.length > 0 ? billing.prices : DEFAULT_PRICES;
  const price = billing.plan && billing.plan !== "comp" ? prices.find((item) => item.choice === billing.plan) : null;
  const dateLabel =
    billing.state === "free_year" || billing.state === "trialing"
      ? "Free until"
      : billing.cancel_at_period_end
        ? "Ends on"
        : "Renews on";

  const rows: [string, string][] = [
    ["Status", STATE_LABELS[billing.state]],
    ["Plan", billing.plan ? PLAN_LABELS[billing.plan] : "—"],
  ];
  if (price) rows.push(["Price", `${priceLine(price)} · VAT included`]);
  if (billing.until && billing.has_access) rows.push([dateLabel, billingDate(billing.until)]);
  if (billing.promo_code) rows.push(["Code", billing.promo_code]);

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.6fr)]">
      <OrgCard>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <OrgCardHeading eyebrow="Plan" title={billing.plan ? `${PLAN_LABELS[billing.plan]}.` : "No plan yet."} />
          <span
            className={`border border-org-ink px-2 py-1 text-[10px] font-black uppercase ${
              billing.has_access && billing.state !== "past_due" ? "bg-beedero-yellow" : "bg-[#ffe1dc]"
            }`}
          >
            {STATE_LABELS[billing.state]}
          </span>
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-black/65">{billingSummary(name, billing)}</p>

        <dl className="mt-5 divide-y divide-black/10 border-y border-black/10 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 py-2.5">
              <dt className="text-black/55">{label}</dt>
              <dd className="text-right font-bold">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-6 flex flex-col gap-4">
          {!canManage ? (
            <p className="text-sm text-black/55">Only owners and admins can change the plan.</p>
          ) : billing.managed_by_stripe ? (
            <>
              <p className="text-sm leading-6 text-black/65">
                Change the card, switch between monthly and yearly, see receipts or cancel — on Stripe.
              </p>
              <PortalButton slug={slug} />
            </>
          ) : billing.state === "comp" ? null : (
            <>
              {billing.state === "free_year" && (
                <p className="text-sm leading-6 text-black/65">
                  Adding a card now is optional. Without one, {name} pauses when the free year ends.
                </p>
              )}
              <PlanPicker slug={slug} billing={billing} />
              {!billing.has_access && <RedeemCodeForm slug={slug} />}
            </>
          )}
        </div>
      </OrgCard>

      <OrgCard tone="cream">
        <p className={orgEyebrowClass}>Invoices</p>
        <p className="mt-3 text-sm leading-6 text-black/70">
          Stripe emails a receipt for every payment. The fatura — the Portuguese invoice, with your
          VAT number — follows by email.
        </p>
        <p className="mt-3 text-sm leading-6 text-black/70">
          Add the company&apos;s VAT number at checkout{billing.managed_by_stripe ? " or in Manage billing" : ""} so
          it appears on the fatura.
        </p>
        <a href="/terms#subscriptions" className={`${orgOutlineButtonClass} mt-5 w-fit`}>
          Subscription terms
        </a>
      </OrgCard>
    </div>
  );
}
