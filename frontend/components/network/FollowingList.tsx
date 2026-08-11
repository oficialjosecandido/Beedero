"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { unfollowOrgAction, unfollowUserAction, type FollowItem } from "@/app/(app)/network/actions";
import { formatRelativeTime } from "@/lib/format";

function FollowRow({ item, onRemoved }: { item: FollowItem; onRemoved: (key: string) => void }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const key = `${item.type}:${item.id}`;

  function unfollow() {
    startTransition(async () => {
      const result =
        item.type === "user"
          ? await unfollowUserAction(item.id as number)
          : await unfollowOrgAction(item.id as string);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      onRemoved(key);
    });
  }

  const href = item.type === "user" ? `/p/${item.target.handle}` : `/org/${item.target.slug}`;
  const picture = item.type === "user" ? item.target.profile_picture : item.target.logo;
  const name = item.target.name ?? "";

  return (
    <li className="flex items-center gap-3 rounded-2xl border-2 border-beedero-border bg-beedero-white p-4 shadow-sm">
      {picture ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={picture} alt="" className="size-11 shrink-0 rounded-full object-cover" />
      ) : (
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-beedero-yellow/30 text-lg font-extrabold text-beedero-black">
          {name.charAt(0)}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <Link href={href} className="font-bold text-beedero-black hover:underline">
          {name}
        </Link>
        {item.target.headline && <p className="text-sm text-zinc-600">{item.target.headline}</p>}
        <p className="mt-1 text-xs text-zinc-400">Since {formatRelativeTime(item.created_at)}</p>
      </div>
      <button
        type="button"
        onClick={unfollow}
        disabled={isPending}
        className="shrink-0 rounded-full border border-beedero-border px-3 py-1.5 text-xs font-semibold text-zinc-500 hover:bg-zinc-50 disabled:opacity-50"
      >
        {isPending ? "…" : "Unfollow"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </li>
  );
}

function FollowersRow({ item }: { item: FollowItem }) {
  const href = `/p/${item.target.handle}`;
  const name = item.target.name ?? "";

  return (
    <li className="flex items-center gap-3 rounded-2xl border-2 border-beedero-border bg-beedero-white p-4 shadow-sm">
      {item.target.profile_picture ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.target.profile_picture} alt="" className="size-11 shrink-0 rounded-full object-cover" />
      ) : (
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-beedero-yellow/30 text-lg font-extrabold text-beedero-black">
          {name.charAt(0)}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <Link href={href} className="font-bold text-beedero-black hover:underline">
          {name}
        </Link>
        {item.target.headline && <p className="text-sm text-zinc-600">{item.target.headline}</p>}
        <p className="mt-1 text-xs text-zinc-400">Since {formatRelativeTime(item.created_at)}</p>
      </div>
    </li>
  );
}

export function FollowingList({
  following,
  followers,
}: {
  following: FollowItem[];
  followers: FollowItem[];
}) {
  const [visibleFollowing, setVisibleFollowing] = useState(following);

  function remove(key: string) {
    setVisibleFollowing((current) => current.filter((item) => `${item.type}:${item.id}` !== key));
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-2xl bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
        Following fills your feed. Connecting shares information and unlocks messaging.
      </p>

      <div className="overflow-hidden rounded-3xl border-2 border-beedero-border bg-beedero-white shadow-sm">
        <div className="border-b border-beedero-border px-5 py-4">
          <h2 className="text-lg font-extrabold text-beedero-black">A seguir</h2>
        </div>
        {visibleFollowing.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-zinc-500">You&apos;re not following anyone yet.</p>
        ) : (
          <ul className="flex flex-col gap-4 p-5">
            {visibleFollowing.map((item) => (
              <FollowRow key={`${item.type}:${item.id}`} item={item} onRemoved={remove} />
            ))}
          </ul>
        )}
      </div>

      <div className="overflow-hidden rounded-3xl border-2 border-beedero-border bg-beedero-white shadow-sm">
        <div className="border-b border-beedero-border px-5 py-4">
          <h2 className="text-lg font-extrabold text-beedero-black">Seguidores</h2>
        </div>
        {followers.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-zinc-500">No followers yet.</p>
        ) : (
          <ul className="flex flex-col gap-4 p-5">
            {followers.map((item) => (
              <FollowersRow key={`${item.type}:${item.id}`} item={item} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
