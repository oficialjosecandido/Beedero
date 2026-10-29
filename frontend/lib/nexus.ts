/**
 * Beedero Nexus — the staff and admin dashboard (backend: nexus/).
 * Types for the `/api/nexus/*` payloads and the helpers the pages share.
 */

export type NexusRole = "admin" | "staff";

export type NexusMe = {
  id: number;
  name: string;
  email: string;
  role: NexusRole;
  capabilities: string[];
};

export type Paged<T> = {
  results: T[];
  page: number;
  page_size: number;
  total: number;
  pages: number;
};

export type PersonRef = {
  id: number;
  name: string;
  email: string;
  handle: string | null;
  avatar: string | null;
};

export type KpiCard = {
  key: string;
  label: string;
  value: number | null;
  unit: "" | "%" | "cents";
  previous: number | null;
  hint: string;
  good_when_up: boolean;
};

export type SeriesPoint = { date: string; value: number };

export type Overview = {
  generated_at: string;
  north_star: {
    label: string;
    value: number;
    previous: number;
    parts: { roles: number; connections: number; registries: number; investments: number };
    connections_known: boolean;
  };
  sections: { key: string; title: string; cards: KpiCard[] }[];
  series: Record<"signups" | "active" | "posts" | "connections" | "visitors", SeriesPoint[]>;
  funnel: { label: string; count: number; pct_of_first: number | null }[];
  cohorts: { week_of: string; size: number; weeks: (number | null)[] }[];
  rollup: {
    date: string | null;
    computed_at: string | null;
    requests_pending: number | null;
    connections_total: number | null;
    fresh: boolean;
  };
};

export type Home = {
  queues: {
    reports_open: number;
    oldest_report_days: number | null;
    verifications_pending: number;
    oldest_verification_days: number | null;
    posts_24h: number;
    orgs_24h: number;
  };
  recent_actions: AuditRow[];
};

export type AuditRow = {
  id: number;
  action: string;
  action_label: string;
  actor: string;
  target_type: string;
  target_id: string;
  target_label: string;
  reason: string;
  data: Record<string, unknown>;
  created_at: string;
};

export type UserRow = PersonRef & {
  headline: string;
  joined_at: string;
  last_seen_at: string | null;
  email_verified: boolean;
  in_discover: boolean;
  orgs: number;
  intents: string[];
  is_active: boolean;
  is_internal: boolean;
  is_staff: boolean;
  beedero_verified: boolean;
  signup_source: string;
};

export type LadderRung = {
  key: string;
  band: string;
  label: string;
  hint: string;
  done: boolean;
  detail?: string;
  warning?: string;
};

export type Ladder = { rungs: LadderRung[]; percent: number; done_count: number; total_count: number };

export type UserDetail = PersonRef & {
  headline: string;
  city: string;
  country: string;
  joined_at: string;
  last_seen_at: string | null;
  email_verified_at: string | null;
  signup_source: string;
  signup_ref: string;
  intents: string[];
  is_active: boolean;
  is_internal: boolean;
  is_staff: boolean;
  beedero_verified: boolean;
  discoverable_since: string | null;
  active_days_30: number;
  ladder: Ladder | null;
  orgs: { slug: string; name: string; role: string; status: string; logo: string | null; plan: string }[];
  affiliations: { org: string; status: string; title: string }[];
  counts: { posts: number; posts_removed: number; applications: number; reports_filed: number };
  reports_against: { id: number; reason: string; created_at: string; resolution: string }[];
  public_url: string | null;
  history: AuditRow[];
  can_manage: boolean;
};

export type OrgRow = {
  slug: string;
  name: string;
  logo: string | null;
  one_liner: string;
  status: "draft" | "live";
  created_at: string;
  members: number;
  followers: number;
  listed: boolean;
  is_verified: boolean;
  plan: string;
  plan_until: string | null;
  owner: PersonRef | null;
};

export type OrgDetail = {
  slug: string;
  name: string;
  logo: string | null;
  one_liner: string;
  status: "draft" | "live";
  stage: string;
  sector: string;
  geo: string;
  created_at: string;
  discoverable_since: string | null;
  is_verified: boolean;
  listed: boolean;
  public_url: string | null;
  members: (PersonRef & { role: string; title: string })[];
  ladder: Ladder & { plan_active?: boolean };
  billing: { state: string; until: string | null; plan: string | null; managed_by_stripe: boolean };
  subscriptions: {
    plan: string;
    status: string;
    source: string;
    managed_by_stripe: boolean;
    promo_code: string | null;
    trial_end: string | null;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
    created_at: string | null;
  }[];
  invoices: { number: string; amount_cents: number; paid_at: string; fatura_reference: string }[];
  verifications: {
    type: string;
    status: string;
    submitted_at: string;
    reviewed_at: string | null;
    valid_until: string | null;
  }[];
  stats: { followers: number; profile_views_30d: number; posts: number; posts_removed: number; jobs_open: number };
  history: AuditRow[];
  can_manage: boolean;
};

export type PostRow = {
  id: number;
  kind: string;
  title: string;
  body: string;
  image: string | null;
  created_at: string;
  visibility: string;
  org: { slug: string; name: string; logo: string | null } | null;
  author: PersonRef | null;
  reactions: number;
  comments: number;
  impressions: number;
  removed: { at: string; by: string; reason: string; reason_label: string } | null;
  public_url: string | null;
};

export type ReportRow = {
  id: number;
  reason: string;
  reason_label: string;
  details: string;
  created_at: string;
  from_conversation: boolean;
  reporter: PersonRef;
  reported: PersonRef & { is_active: boolean; reports_total: number };
  resolved_at: string | null;
  resolved_by: string;
  resolution: string;
  resolution_label: string;
  resolution_note: string;
};

export type Segment = { key: string; kind: "newsletter" | "announcement"; label: string; description: string; count: number };

export type SendProgress = {
  status: string;
  total: number;
  sent: number;
  failed: number;
  pending: number;
  unsubscribed: number;
};

export type NewsletterSendRow = {
  id: number;
  subject: string;
  kind: "newsletter" | "announcement";
  segment: string;
  segment_label: string;
  status: "draft" | "sending" | "sent";
  created_at: string;
  queued_at: string | null;
  finished_at: string | null;
  author: string;
  recipients: number;
  failed: number;
  progress?: SendProgress;
  body?: string;
  preview_html?: string;
  audience_count?: number;
};

export type Billing = {
  summary: {
    paying_orgs: number;
    paying_yearly: number;
    paying_monthly: number;
    mrr_cents: number;
    mrr_net_cents: number;
    arr_cents: number;
    card_on_file_in_free_year: number;
    free_periods_active: number;
    free_periods_ending_30d: number;
    past_due: number;
    free_periods_ended_12m: number;
    free_periods_converted_12m: number;
    conversion_pct: number | null;
    orgs_without_plan: number;
  };
  free_ending: BillingOrg[];
  past_due: BillingOrg[];
  without_plan: (BillingOrg & { created_at: string })[];
  invoices_to_issue: Invoice[];
  invoices_issued: Invoice[];
  promo_codes: PromoCode[];
};

export type BillingOrg = { slug: string; name: string; state: string; until: string | null; days_left: number | null };

export type Invoice = {
  id: number;
  org: { slug: string; name: string } | null;
  number: string;
  amount_cents: number;
  currency: string;
  customer_name: string;
  customer_tax_ids: string;
  receipt_url: string;
  paid_at: string;
  fatura_reference: string;
  fatura_issued_at: string | null;
};

export type PromoCode = {
  code: string;
  free_days: number;
  active: boolean;
  redemptions: number | null;
  max_redemptions: number | null;
  expires_at: string | null;
  note: string;
  created_at: string;
};

export const PLAN_STATE_LABELS: Record<string, string> = {
  free_year: "Free year",
  trialing: "Card on file",
  active: "Paying",
  past_due: "Payment failing",
  comp: "Complimentary",
  needs_plan: "No plan",
  lapsed: "Plan ended",
};

/** 172500 → "€1,725"; 5250 → "€52.50". Cents are dropped from €100 up. */
export function euros(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "—";
  const value = cents / 100;
  const digits = value >= 100 || Number.isInteger(value) ? 0 : 2;
  return `€${value.toLocaleString("en-GB", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

export function kpiValue(card: Pick<KpiCard, "value" | "unit">): string {
  if (card.value === null || card.value === undefined) return "—";
  if (card.unit === "cents") return euros(card.value);
  if (card.unit === "%") return `${card.value}%`;
  return card.value.toLocaleString("en-GB");
}

/** Query string from the current filters, dropping empty ones. */
export function query(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}
