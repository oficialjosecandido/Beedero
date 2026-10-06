"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";

import {
  withdrawConnectionRequestAction,
  type SentConnectionRequestItem,
} from "@/app/(app)/connections/actions";
import { unfollowOrgAction, type FollowItem } from "@/app/(app)/network/actions";
import { Initials } from "@/components/app-shell/ui";
import { formatRelativeTime } from "@/lib/format";

function SectionHeading({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h3 className="text-sm font-bold">{title}</h3>
      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-black text-white/70">
        {count}
      </span>
    </div>
  );
}

function SentRequestRow({
  item,
  onWithdrawn,
}: {
  item: SentConnectionRequestItem;
  onWithdrawn: (id: number) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { recipient } = item;

  function withdraw() {
    startTransition(async () => {
      const result = await withdrawConnectionRequestAction(item.id);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      onWithdrawn(item.id);
    });
  }

  return (
    <li className="flex items-center gap-3 py-3">
      {recipient.profile_picture ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          loading="lazy"
          src={recipient.profile_picture}
          alt=""
          className="size-8 shrink-0 rounded-full object-cover"
        />
      ) : (
        <Initials name={recipient.name} className="size-8 text-[10px]" />
      )}
      <div className="min-w-0 flex-1">
        {recipient.handle ? (
          <Link
            href={`/p/${recipient.handle}`}
            className="block truncate text-xs font-bold hover:underline"
          >
            {recipient.name}
          </Link>
        ) : (
          <b className="block truncate text-xs">{recipient.name}</b>
        )}
        <p className="truncate text-[10px] text-white/40">
          {recipient.headline ? `${recipient.headline} · ` : ""}
          Sent {formatRelativeTime(item.created_at)}
        </p>
        {error && <p className="mt-1 text-[10px] text-beedero-yellow">{error}</p>}
      </div>
      <button
        type="button"
        onClick={withdraw}
        disabled={isPending}
        className="shrink-0 border border-white/15 px-2 py-1 text-[10px] font-bold text-white/55 transition hover:border-beedero-yellow hover:text-beedero-yellow disabled:cursor-default disabled:opacity-40"
      >
        {isPending ? "…" : "Withdraw"}
      </button>
    </li>
  );
}

function FollowRow({ item, onRemoved }: { item: FollowItem; onRemoved: (id: string) => void }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const name = item.target.name ?? "";

  function unfollow() {
    startTransition(async () => {
      const result = await unfollowOrgAction(item.id);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      onRemoved(item.id);
    });
  }

  return (
    <li className="flex items-center gap-3 py-3">
      {item.target.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          loading="lazy"
          src={item.target.logo}
          alt=""
          className="size-8 shrink-0 rounded-sm object-cover"
        />
      ) : (
        <Initials name={name} className="size-8 rounded-sm text-[10px]" />
      )}
      <div className="min-w-0 flex-1">
        <Link
          href={`/org/${item.target.slug}`}
          className="block truncate text-xs font-bold hover:underline"
        >
          {name}
        </Link>
        <p className="truncate text-[10px] text-white/40">
          Following since {formatRelativeTime(item.created_at)}
        </p>
        {error && <p className="mt-1 text-[10px] text-beedero-yellow">{error}</p>}
      </div>
      <button
        type="button"
        onClick={unfollow}
        disabled={isPending}
        className="shrink-0 border border-white/15 px-2 py-1 text-[10px] font-bold text-white/55 transition hover:border-white/35 hover:text-white/80 disabled:cursor-default disabled:opacity-40"
      >
        {isPending ? "…" : "Unfollow"}
      </button>
    </li>
  );
}

/**
 * The design's right-hand card: what connections mean on Beedero, then the
 * two relationships the viewer controls from their side — requests they sent
 * and organisations they follow — and how visible their profile is.
 */
export function NetworkPrinciples({
  sent,
  following,
  visibilityLabel,
}: {
  sent: SentConnectionRequestItem[];
  following: FollowItem[];
  visibilityLabel: string;
}) {
  const [withdrawnIds, setWithdrawnIds] = useState<number[]>([]);
  const [unfollowedIds, setUnfollowedIds] = useState<string[]>([]);

  const visibleSent = useMemo(
    () => sent.filter((item) => !withdrawnIds.includes(item.id)),
    [sent, withdrawnIds]
  );
  const visibleFollowing = useMemo(
    () => following.filter((item) => !unfollowedIds.includes(item.id)),
    [following, unfollowedIds]
  );

  return (
    <section className="h-fit border border-white/10 bg-white/[0.025] p-5">
      <h2 className="text-2xl font-black tracking-[-0.03em]">Connection principles</h2>
      <p className="mt-4 text-sm leading-6 text-white/60">
        Beedero keeps attention and trust distinct. Following shapes your feed; connections open a
        shared relationship and messaging.
      </p>

      <div className="mt-7 border-t border-white/10 pt-4">
        <SectionHeading title="My connection requests" count={visibleSent.length} />
        <p className="mt-1 text-xs leading-5 text-white/40">
          People you asked to connect with, still awaiting a response.
        </p>
        <ul className="mt-3 divide-y divide-white/[0.07]">
          {visibleSent.map((item) => (
            <SentRequestRow
              key={item.id}
              item={item}
              onWithdrawn={(id) => setWithdrawnIds((current) => [...current, id])}
            />
          ))}
        </ul>
        {visibleSent.length === 0 && (
          <p className="py-4 text-xs text-white/40">No connection requests are pending.</p>
        )}
      </div>

      <div className="mt-6 border-t border-white/10 pt-4">
        <SectionHeading title="Following" count={visibleFollowing.length} />
        <p className="mt-1 text-xs leading-5 text-white/40">
          Organisations whose updates reach your feed.
        </p>
        <ul className="mt-3 divide-y divide-white/[0.07]">
          {visibleFollowing.map((item) => (
            <FollowRow
              key={item.id}
              item={item}
              onRemoved={(id) => setUnfollowedIds((current) => [...current, id])}
            />
          ))}
        </ul>
        {visibleFollowing.length === 0 && (
          <p className="py-4 text-xs text-white/40">
            You are not following any organisation yet.{" "}
            <Link href="/discovery" className="font-bold text-beedero-yellow hover:text-white">
              Discover organisations →
            </Link>
          </p>
        )}
      </div>

      <Link
        href="/profile?tab=settings"
        className="mt-6 flex items-center justify-between gap-3 border-t border-white/10 pt-4 text-xs transition hover:text-white"
      >
        <span className="text-white/45">Profile visibility</span>
        <b className="text-emerald-400">{visibilityLabel}</b>
      </Link>
    </section>
  );
}
