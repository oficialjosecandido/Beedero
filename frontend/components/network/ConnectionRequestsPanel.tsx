"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import {
  acceptConnectionRequestAction,
  declineConnectionRequestAction,
  type ConnectionRequestItem,
} from "@/app/(app)/connections/actions";
import { CountPill, EmptyPanel, Initials } from "@/components/app-shell/ui";
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
  const { requester } = item;

  function accept() {
    startTransition(async () => {
      const result = await acceptConnectionRequestAction(item.id);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      onResolved(item.id);
      router.refresh();
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
    <article className="mb-3 border border-white/10 bg-white/[0.025] p-5">
      <div className="flex gap-3">
        {requester.profile_picture ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            loading="lazy"
            src={requester.profile_picture}
            alt=""
            className="size-10 shrink-0 rounded-full object-cover"
          />
        ) : (
          <Initials name={requester.name} className="size-10 text-xs" />
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {requester.handle ? (
              <Link href={`/p/${requester.handle}`} className="text-sm font-bold hover:underline">
                {requester.name}
              </Link>
            ) : (
              <b className="text-sm">{requester.name}</b>
            )}
            <span className="border border-white/15 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-white/55">
              {TIER_LABELS[requester.reputation_tier] ?? requester.reputation_tier}
            </span>
          </div>
          {requester.headline && <p className="text-xs text-white/45">{requester.headline}</p>}
          <p className="mt-1 text-[11px] text-white/30">{formatRelativeTime(item.created_at)}</p>
        </div>
      </div>

      {item.note && (
        <p className="mt-4 border-l-2 border-beedero-yellow pl-3 text-sm leading-6 text-white/75">
          “{item.note}”
        </p>
      )}

      {error && <p className="mt-3 text-xs text-beedero-yellow">{error}</p>}

      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={accept}
          disabled={isPending}
          className="bg-beedero-yellow px-4 py-2 text-xs font-black text-beedero-black transition hover:opacity-90 disabled:cursor-default disabled:opacity-40"
        >
          {isPending ? "…" : "Accept"}
        </button>
        <button
          type="button"
          onClick={decline}
          disabled={isPending}
          className="border border-white/15 px-4 py-2 text-xs font-bold text-white/65 transition hover:border-white/30 hover:text-white disabled:cursor-default disabled:opacity-40"
        >
          Not now
        </button>
      </div>
    </article>
  );
}

export function ConnectionRequestsPanel({ items }: { items: ConnectionRequestItem[] }) {
  const [resolvedIds, setResolvedIds] = useState<number[]>([]);

  const visible = useMemo(
    () => items.filter((item) => !resolvedIds.includes(item.id)),
    [items, resolvedIds]
  );

  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-white/80">
        Connection requests
        {visible.length > 0 && <CountPill count={visible.length} />}
      </h2>
      {visible.length === 0 ? (
        <EmptyPanel>
          No one is waiting on you. New requests land here with the note they sent.
        </EmptyPanel>
      ) : (
        visible.map((item) => (
          <RequestCard
            key={item.id}
            item={item}
            onResolved={(id) => setResolvedIds((current) => [...current, id])}
          />
        ))
      )}
    </section>
  );
}
