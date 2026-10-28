"use server";

import { revalidatePath } from "next/cache";

import { apiFetch } from "@/lib/api";
import { firstMessage, fieldErrors } from "@/lib/billing-errors";
import type { OrgBilling, PlanChoice } from "@/lib/billing";

type UrlResult = { url: string | null; error: string | null };

/** Owners/admins → a Stripe Checkout URL. During a free year, the first
 *  charge is set for the day the year ends. */
export async function startCheckoutAction(slug: string, plan: PlanChoice): Promise<UrlResult> {
  try {
    const { url } = await apiFetch<{ url: string }>(`/orgs/${slug}/billing/checkout/`, {
      method: "POST",
      body: { plan },
    });
    return { url, error: null };
  } catch (err) {
    return { url: null, error: firstMessage(err, "Could not open the payment page.") };
  }
}

/** Owners/admins → Stripe's customer portal: card, invoices, cancel. */
export async function openBillingPortalAction(slug: string): Promise<UrlResult> {
  try {
    const { url } = await apiFetch<{ url: string }>(`/orgs/${slug}/billing/portal/`, {
      method: "POST",
    });
    return { url, error: null };
  } catch (err) {
    return { url: null, error: firstMessage(err, "Could not open billing.") };
  }
}

/** A code typed in the workspace (an organisation that has no plan yet). */
export async function redeemCodeAction(
  slug: string,
  code: string,
  plan: PlanChoice
): Promise<{ billing: OrgBilling | null; error: string | null }> {
  try {
    const billing = await apiFetch<OrgBilling>(`/orgs/${slug}/billing/redeem/`, {
      method: "POST",
      body: { code, plan },
    });
    revalidatePath(`/dashboard/${slug}`);
    return { billing, error: null };
  } catch (err) {
    const errors = fieldErrors(err);
    return { billing: null, error: errors.code ?? firstMessage(err, "Could not apply that code.") };
  }
}
