"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { BellDot, CheckCheck, ChevronRight, Settings2, X } from "lucide-react";

import {
  acceptAffiliationAction,
  withdrawAffiliationByIdAction,
} from "@/app/(app)/dashboard/affiliation-actions";
import {
  PageHeading,
  Shimmer,
  btnGhost,
  btnOutlineYellow,
  btnPrimary,
} from "@/components/app-shell/ui";
import { formatRelativeTime } from "@/lib/format";
import {
  type NotificationItem,
  type NotificationPreferences,
  useNotifications,
} from "@/lib/notifications-context";

/**
 * The design paints the bell yellow for notifications that carry a deadline or
 * ask for a decision; everything else is a grey pulse. There is no `urgent`
 * flag on the model, so it is derived from the kind.
 */
const URGENT_KINDS = new Set([
  "verification",
  "job_expiring",
  "affiliation_request",
  "investment_request",
  "connection_request",
]);

const PREFERENCE_ROWS: {
  key: keyof NotificationPreferences;
  label: string;
  detail: string;
}[] = [
  {
    key: "inapp_engagement",
    label: "In-app engagement",
    detail: "Reactions, comments, mentions and profile views",
  },
  {
    key: "digest_email",
    label: "Email digest",
    detail: "A weekly recap of what you missed",
  },
  {
    key: "push_enabled",
    label: "Push on this device",
    detail: "Needs your browser's permission to deliver",
  },
];

function notificationHref(item: NotificationItem): string {
  const base = item.link || "/feed";
  const suggestionTitle = item.payload?.suggestion_title;
  const suggestionBody = item.payload?.suggestion_body;
  if (!suggestionTitle && !suggestionBody) return base;
  const params = new URLSearchParams();
  if (suggestionTitle) params.set("suggested_title", suggestionTitle);
  if (suggestionBody) params.set("suggested_body", suggestionBody);
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}${params.toString()}`;
}

function AffiliationRequestActions({
  item,
  onResolved,
}: {
  item: NotificationItem;
  onResolved: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const affiliationId = item.payload?.affiliation_id;

  if (!affiliationId || !item.payload?.can_accept) return null;

  function run(action: typeof acceptAffiliationAction | typeof withdrawAffiliationByIdAction) {
    startTransition(async () => {
      const result = await action(affiliationId!);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setError(null);
      onResolved();
      router.refresh();
    });
  }

  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={() => run(acceptAffiliationAction)}
          className="bg-beedero-yellow px-3 py-1.5 text-xs font-black text-beedero-black transition hover:opacity-90 disabled:cursor-default disabled:opacity-40"
        >
          {isPending ? "…" : "Accept"}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => run(withdrawAffiliationByIdAction)}
          className="border border-white/15 px-3 py-1.5 text-xs font-bold text-white/65 transition hover:border-white/30 hover:text-white disabled:cursor-default disabled:opacity-40"
        >
          Withdraw
        </button>
      </div>
      {error && <p className="text-xs text-beedero-yellow">{error}</p>}
    </div>
  );
}

function NotificationBody({
  item,
  onAffiliationResolved,
  actionable,
}: {
  item: NotificationItem;
  onAffiliationResolved: (id: number) => void;
  actionable: boolean;
}) {
  return (
    <>
      {!item.read && <span className="absolute inset-y-4 left-0 w-0.5 bg-beedero-yellow" aria-hidden />}
      <BellDot
        size={18}
        strokeWidth={1.8}
        className={`mt-0.5 shrink-0 ${URGENT_KINDS.has(item.kind) ? "text-beedero-yellow" : "text-white/40"}`}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className={`text-sm leading-6 ${item.read ? "text-white/75" : "font-semibold text-white"}`}>
          {item.title}
        </p>
        {item.body && <p className="mt-1 text-xs leading-5 text-white/45">{item.body}</p>}
        <small className="mt-2 block text-[11px] text-white/35">
          {formatRelativeTime(item.updated_at)}
        </small>
        {actionable && (
          <AffiliationRequestActions item={item} onResolved={() => onAffiliationResolved(item.id)} />
        )}
      </div>
      {!actionable && (
        <ChevronRight
          size={17}
          className="mt-1 shrink-0 text-white/25 transition group-hover:translate-x-0.5 group-hover:text-beedero-yellow"
          aria-hidden
        />
      )}
    </>
  );
}

function NotificationRow({
  item,
  onAffiliationResolved,
}: {
  item: NotificationItem;
  onAffiliationResolved: (id: number) => void;
}) {
  const { markRead } = useNotifications();
  // An affiliation request is answered in place, so the whole row must not be
  // a link — the Accept/Withdraw buttons would sit inside it.
  const actionable =
    item.kind === "affiliation_request" &&
    Boolean(item.payload?.can_accept && item.payload?.affiliation_id);

  const className = `group relative flex gap-4 px-4 py-5 transition hover:bg-white/[0.025] sm:px-5 ${
    item.read ? "" : "bg-white/[0.025]"
  }`;

  if (actionable) {
    return (
      <div className={className}>
        <NotificationBody item={item} onAffiliationResolved={onAffiliationResolved} actionable />
      </div>
    );
  }

  return (
    <Link href={notificationHref(item)} onClick={() => void markRead(item.id)} className={className}>
      <NotificationBody
        item={item}
        onAffiliationResolved={onAffiliationResolved}
        actionable={false}
      />
    </Link>
  );
}

function PreferenceToggle({
  checked,
  label,
  detail,
  disabled,
  onCheckedChange,
}: {
  checked: boolean;
  label: string;
  detail: string;
  disabled?: boolean;
  onCheckedChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className="flex w-full items-center gap-3 py-4 text-left disabled:opacity-50"
    >
      <span
        className={`relative h-5 w-9 shrink-0 rounded-full transition ${
          checked ? "bg-beedero-yellow" : "bg-white/15"
        }`}
        aria-hidden
      >
        <span
          className={`absolute top-0.5 size-4 rounded-full transition-[left] ${
            checked ? "left-4 bg-beedero-black" : "left-0.5 bg-white/70"
          }`}
        />
      </span>
      <span className="min-w-0 flex-1">
        <b className="block text-xs">{label}</b>
        <small className="mt-0.5 block text-[10px] leading-4 text-white/40">{detail}</small>
      </span>
    </button>
  );
}

function PreferencesModal({ onClose }: { onClose: () => void }) {
  const { prefs, updatePreference, setPushEnabled } = useNotifications();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle(key: keyof NotificationPreferences, next: boolean) {
    setError(null);
    // Push is the one preference that needs a browser permission and a token
    // registration behind it, so it goes through its own path.
    if (key !== "push_enabled") {
      void updatePreference(key, next);
      return;
    }
    setBusy(true);
    const message = await setPushEnabled(next);
    if (message) setError(message);
    setBusy(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end bg-black/70 backdrop-blur-sm sm:place-items-center sm:p-6"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Notification preferences"
        className="w-full max-w-md border border-white/15 bg-app-elevated shadow-2xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-white/10 px-6 py-5">
          <div>
            <div className="flex items-center gap-2">
              <Settings2 size={16} className="text-beedero-yellow" aria-hidden />
              <h2 className="text-2xl font-black tracking-[-0.03em]">Notification preferences</h2>
            </div>
            <p className="mt-1 text-xs text-white/45">
              Choose the signals that deserve your attention.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/45 transition hover:text-white"
            aria-label="Close preferences"
          >
            <X size={19} aria-hidden />
          </button>
        </header>

        <div className="divide-y divide-white/[0.08] px-6">
          {PREFERENCE_ROWS.map(({ key, label, detail }) => (
            <PreferenceToggle
              key={key}
              label={label}
              detail={detail}
              checked={prefs[key]}
              disabled={key === "push_enabled" && busy}
              onCheckedChange={(next) => void toggle(key, next)}
            />
          ))}
        </div>

        {error && <p className="px-6 pb-2 text-xs text-beedero-yellow">{error}</p>}

        <footer className="flex justify-end border-t border-white/10 px-6 py-4">
          <button type="button" onClick={onClose} className={btnPrimary}>
            Done
          </button>
        </footer>
      </section>
    </div>
  );
}

export function NotificationsPanel() {
  const { unread, items, loading, refresh, markAllRead, loadPreferences } = useNotifications();
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [resolvedIds, setResolvedIds] = useState<number[]>([]);

  useEffect(() => {
    void refresh();
    void loadPreferences();
  }, [refresh, loadPreferences]);

  const visibleItems = items.filter((item) => !resolvedIds.includes(item.id));

  return (
    <>
      <PageHeading
        eyebrow="Keep the right pulse"
        title="Notifications."
        actions={
          <>
            <button
              type="button"
              onClick={() => void markAllRead()}
              disabled={unread === 0}
              className={btnOutlineYellow}
            >
              <CheckCheck size={15} aria-hidden /> Mark all as read
              {unread > 0 && ` (${unread})`}
            </button>
            <button
              type="button"
              onClick={() => setPreferencesOpen(true)}
              className={btnGhost}
            >
              <Settings2 size={15} aria-hidden /> Preferences
            </button>
          </>
        }
      />

      <div
        className="max-w-4xl divide-y divide-white/10 border-y border-white/10"
        aria-live="polite"
        aria-busy={loading && items.length === 0}
      >
        {loading && items.length === 0 && (
          <>
            {[0, 1, 2].map((row) => (
              <div key={row} className="flex gap-4 px-4 py-5 sm:px-5">
                <Shimmer className="size-[18px] shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Shimmer className="h-3.5 w-2/3" />
                  <Shimmer className="h-2.5 w-1/2" />
                </div>
              </div>
            ))}
          </>
        )}

        {!loading && visibleItems.length === 0 && (
          <p className="px-4 py-12 text-center text-sm text-white/45 sm:px-5">
            Nothing yet. Connections, reactions and verification reminders land here.
          </p>
        )}

        {visibleItems.map((item) => (
          <NotificationRow
            key={item.id}
            item={item}
            onAffiliationResolved={(id) => {
              setResolvedIds((current) => [...current, id]);
              void refresh();
            }}
          />
        ))}
      </div>

      {/* The API returns the 50 most recent and no cursor, so the design's
          infinite scroll has nothing to page through — say so instead. */}
      {visibleItems.length >= 50 && (
        <p className="flex h-20 max-w-4xl items-center justify-center text-xs text-white/40">
          Showing your 50 most recent notifications.
        </p>
      )}

      {preferencesOpen && <PreferencesModal onClose={() => setPreferencesOpen(false)} />}
    </>
  );
}
