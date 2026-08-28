"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  acceptConnectionRequestAction,
  declineConnectionRequestAction,
  type ConnectionRequestItem,
} from "@/app/(app)/connections/actions";
import { formatRelativeTime } from "@/lib/format";

const TIER_LABELS: Record<string, string> = {
  verified_investor: "Verified investor",
  verified_identity: "Verified",
  unverified_new: "New member",
  unverified: "Member",
};

function RequestCard({
  item,
  onResolved,
}: {
  item: ConnectionRequestItem;
  onResolved: (id: number) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function accept() {
    startTransition(async () => {
      const result = await acceptConnectionRequestAction(item.id);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      onResolved(item.id);
      if (result.conversationId) {
        router.push(`/feed?chat=${result.conversationId}`);
      }
    });
  }

  function decline() {
    startTransition(async () => {
      const result = await declineConnectionRequestAction(item.id);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      onResolved(item.id);
    });
  }

  return (
    <li className="flex flex-col gap-3 rounded-2xl border-2 border-beedero-border bg-beedero-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        {item.requester.profile_picture ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img loading="lazy"
            src={item.requester.profile_picture}
            alt=""
            className="size-11 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-beedero-yellow/30 text-lg font-extrabold text-beedero-black">
            {item.requester.name.charAt(0)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {item.requester.handle ? (
              <Link
                href={`/p/${item.requester.handle}`}
                className="font-bold text-beedero-black hover:underline"
              >
                {item.requester.name}
              </Link>
            ) : (
              <span className="font-bold text-beedero-black">{item.requester.name}</span>
            )}
            <span className="rounded-full bg-beedero-yellow/30 px-2 py-0.5 text-xs font-semibold text-beedero-black">
              {TIER_LABELS[item.requester.reputation_tier] ?? item.requester.reputation_tier}
            </span>
          </div>
          {item.requester.headline && (
            <p className="text-sm text-zinc-600">{item.requester.headline}</p>
          )}
          <p className="mt-1 text-xs text-subtle">{formatRelativeTime(item.created_at)}</p>
        </div>
      </div>

      {item.note && (
        <p className="rounded-xl bg-zinc-50 px-4 py-3 text-sm text-zinc-700">{item.note}</p>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={accept}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-full bg-beedero-yellow px-4 py-2 text-sm font-bold text-beedero-black hover:bg-beedero-black hover:text-beedero-white disabled:opacity-50"
        >
          {isPending ? "…" : "Accept"}
        </button>
        <button
          type="button"
          onClick={decline}
          disabled={isPending}
          className="rounded-full border border-beedero-border px-4 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
        >
          Decline
        </button>
      </div>
    </li>
  );
}

export function ConnectionRequestsList({ items }: { items: ConnectionRequestItem[] }) {
  const [visible, setVisible] = useState(items);

  function remove(id: number) {
    setVisible((current) => current.filter((item) => item.id !== id));
  }

  return (
    <div className="overflow-hidden rounded-3xl border-2 border-beedero-border bg-beedero-white shadow-sm">
      <div className="border-b border-beedero-border px-5 py-4">
        <h1 className="text-xl font-extrabold text-beedero-black">Connection requests</h1>
      </div>
      {visible.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-zinc-500">No pending requests.</p>
      ) : (
        <ul className="flex flex-col gap-4 p-5">
          {visible.map((item) => (
            <RequestCard key={item.id} item={item} onResolved={remove} />
          ))}
        </ul>
      )}
    </div>
  );
}
