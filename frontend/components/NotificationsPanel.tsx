"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import {
  acceptAffiliationAction,
  withdrawAffiliationByIdAction,
} from "@/app/(app)/dashboard/affiliation-actions";
import { Skeleton } from "@/components/Skeleton";
import { formatRelativeTime } from "@/lib/format";
import { type NotificationItem, useNotifications } from "@/lib/notifications-context";

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
          className="rounded-full bg-beedero-yellow px-3 py-1.5 text-xs font-bold text-beedero-black hover:bg-beedero-black hover:text-beedero-white disabled:opacity-50"
        >
          {isPending ? "…" : "Accept"}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => run(withdrawAffiliationByIdAction)}
          className="rounded-full border border-beedero-border px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
        >
          Withdraw
        </button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

function NotificationRow({
  item,
  onAffiliationResolved,
}: {
  item: NotificationItem;
  onAffiliationResolved: (id: number) => void;
}) {
  const actionable =
    item.kind === "affiliation_request" &&
    Boolean(item.payload?.can_accept && item.payload?.affiliation_id);

  const body = (
    <>
      <span
        className={`mt-2 size-2 shrink-0 rounded-full ${item.read ? "bg-transparent" : "bg-beedero-black"}`}
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-3">
          <span className={`text-sm leading-6 ${item.read ? "text-zinc-700" : "font-semibold text-beedero-black"}`}>
            {item.title}
          </span>
          <span className="shrink-0 text-xs text-zinc-500">{formatRelativeTime(item.updated_at)}</span>
        </span>
        {item.body && <span className="mt-1 block text-sm text-zinc-600">{item.body}</span>}
        {actionable && (
          <AffiliationRequestActions item={item} onResolved={() => onAffiliationResolved(item.id)} />
        )}
      </span>
    </>
  );

  const className = `flex gap-4 px-5 py-4 transition hover:bg-beedero-yellow/10 ${
    item.read ? "bg-white" : "bg-beedero-yellow/5"
  }`;

  if (actionable) {
    return <div className={className}>{body}</div>;
  }

  return (
    <Link href={notificationHref(item)} className={className}>
      {body}
    </Link>
  );
}

export function NotificationsPanel() {
  const {
    unread,
    items,
    loading,
    prefs,
    refresh,
    markAllRead,
    loadPreferences,
    updatePreference,
    setPushEnabled,
  } = useNotifications();
  const [showPrefs, setShowPrefs] = useState(false);
  const [resolvedIds, setResolvedIds] = useState<number[]>([]);

  useEffect(() => {
    void refresh();
    void loadPreferences();
  }, [refresh, loadPreferences]);

  const visibleItems = items.filter((item) => !resolvedIds.includes(item.id));

  return (
    <div className="overflow-hidden rounded-3xl border-2 border-beedero-border bg-beedero-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-beedero-border px-5 py-4">
        <h1 className="text-xl font-extrabold text-beedero-black">Notifications</h1>
        <div className="flex items-center gap-3">
          {unread > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="text-sm font-semibold text-beedero-black/70 hover:text-beedero-black"
            >
              Mark all read
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowPrefs((value) => !value)}
            className="text-sm font-semibold text-beedero-black/70 hover:text-beedero-black"
          >
            Settings
          </button>
        </div>
      </div>

      {showPrefs && (
        <div className="flex flex-col gap-2 border-b border-beedero-border bg-beedero-yellow/10 px-5 py-4 text-sm text-beedero-black">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={prefs?.inapp_engagement ?? true}
              onChange={(e) => updatePreference("inapp_engagement", e.target.checked)}
            />
            In-app engagement notifications
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={prefs?.digest_email ?? true}
              onChange={(e) => updatePreference("digest_email", e.target.checked)}
            />
            Weekly digest email
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={prefs?.push_enabled ?? false}
              onChange={(e) => setPushEnabled(e.target.checked)}
            />
            Push notifications on this device
          </label>
        </div>
      )}

      <div className="divide-y divide-beedero-border">
        {loading && items.length === 0 && (
          <div className="flex flex-col gap-4 px-5 py-4" aria-hidden="true">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-3/5" />
          </div>
        )}
        {!loading && visibleItems.length === 0 && (
          <p className="px-5 py-10 text-center text-sm text-zinc-500">No notifications yet.</p>
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
    </div>
  );
}
