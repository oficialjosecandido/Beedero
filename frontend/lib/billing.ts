/**
 * Organisation subscriptions — `GET /orgs/<slug>/billing/` (backend
 * billing/access.py `org_billing_state` + billing/views.py `billing_payload`).
 *
 * People are free. Each organisation needs a plan: €99/year or €9/month,
 * VAT included. A code (EARLYADOPTER) gives the first year free, no card.
 */

export type PlanChoice = "yearly" | "monthly";

export type BillingStateName =
  /** No card yet, free until `until`. */
  | "free_year"
  /** A card is on file; the first charge is on `until`. */
  | "trialing"
  /** Paid; renews (or ends, with `cancel_at_period_end`) on `until`. */
  | "active"
  /** The last charge failed and Stripe is retrying. Still has access. */
  | "past_due"
  /** Complimentary, no end. */
  | "comp"
  /** Never had a plan — usually a checkout that wasn't finished. */
  | "needs_plan"
  /** Had a plan, and it ended. */
  | "lapsed";

export type PlanPrice = {
  choice: PlanChoice;
  amount_cents: number;
  interval: "year" | "month";
  vat_included: boolean;
};

export type OrgBilling = {
  state: BillingStateName;
  has_access: boolean;
  plan: PlanChoice | "comp" | null;
  until: string | null;
  days_left: number | null;
  managed_by_stripe: boolean;
  cancel_at_period_end: boolean;
  promo_code: string | null;
  /** A free year in its last 30 days, with no card on file. */
  ending_soon: boolean;
  prices: PlanPrice[];
  terms_version: string;
};

/** Shown before the API answers, and on the onboarding page. Display only —
 *  Stripe charges whatever its Price says. */
export const DEFAULT_PRICES: PlanPrice[] = [
  { choice: "yearly", amount_cents: 9900, interval: "year", vat_included: true },
  { choice: "monthly", amount_cents: 900, interval: "month", vat_included: true },
];

export const PLAN_LABELS: Record<PlanChoice | "comp", string> = {
  yearly: "Yearly",
  monthly: "Monthly",
  comp: "Complimentary",
};

/** 9900 → "€99"; 950 → "€9.50". */
export function formatEuros(cents: number): string {
  const euros = cents / 100;
  return `€${Number.isInteger(euros) ? euros : euros.toFixed(2)}`;
}

export function priceLine(price: PlanPrice): string {
  return `${formatEuros(price.amount_cents)}/${price.interval}`;
}

/** "14 November 2027" — dates on billing screens are never relative. */
export function billingDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** One sentence on where the plan stands. */
export function billingSummary(name: string, billing: OrgBilling): string {
  const until = billingDate(billing.until);
  switch (billing.state) {
    case "free_year":
      return `${name} is free until ${until}. No card on file — nothing will be charged.`;
    case "trialing":
      return `${name} is free until ${until}. Your card is first charged on that day.`;
    case "active":
      return billing.cancel_at_period_end
        ? `${name}'s plan is cancelled and ends on ${until}.`
        : `${name}'s plan renews on ${until}.`;
    case "past_due":
      return `The last payment for ${name} failed. Update the card to keep the organisation listed.`;
    case "comp":
      return `${name} has a complimentary plan.`;
    case "lapsed":
      return `${name}'s plan has ended. It is hidden from Discover and can't post until it has a plan again.`;
    default:
      return `${name} needs a plan to be published, post and list jobs.`;
  }
}

/** The welcome line under "<name> is on Beedero." — no name, it was just said. */
export function welcomeLine(billing: OrgBilling): string {
  const until = billingDate(billing.until);
  switch (billing.state) {
    case "free_year":
      return `Free until ${until} — no card on file, so nothing will be charged.`;
    case "trialing":
      return `Free until ${until}; the card is first charged that day.`;
    case "active":
      return `The plan renews on ${until}.`;
    default:
      return "";
  }
}
