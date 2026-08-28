"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { startConversationAction } from "@/app/(app)/feed/actions";
import { removeConnectionAction, type ConnectionItem } from "@/app/(app)/network/actions";
import { formatRelativeTime } from "@/lib/format";

const TIER_LABELS: Record<string, string> = {
  verified_investor: "Verified investor",
  verified_identity: "Verified",
  unverified_new: "New member",
  unverified: "Member",
};

function ConnectionRow({
  item,
  onRemoved,
}: {
  item: ConnectionItem;
  onRemoved: (connectionId: number) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function remove() {
    startTransition(async () => {
      const result = await removeConnectionAction(item.connection_id);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      onRemoved(item.connection_id);
    });
  }

  function message() {
    startTransition(async () => {
      const result = await startConversationAction(item.user.id);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      router.push(`/feed?chat=${result.conversation.id}`);
    });
  }

  return (
    <li className="flex flex-col gap-2 rounded-2xl border-2 border-beedero-border bg-beedero-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        {item.user.profile_picture ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img loading="lazy"
            src={item.user.profile_picture}
            alt=""
            className="size-11 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-beedero-yellow/30 text-lg font-extrabold text-beedero-black">
            {item.user.name.charAt(0)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {item.user.handle ? (
              <Link href={`/p/${item.user.handle}`} className="font-bold text-beedero-black hover:underline">
                {item.user.name}
              </Link>
            ) : (
              <span className="font-bold text-beedero-black">{item.user.name}</span>
            )}
            <span className="rounded-full bg-beedero-yellow/30 px-2 py-0.5 text-xs font-semibold text-beedero-black">
              {TIER_LABELS[item.user.reputation_tier] ?? item.user.reputation_tier}
            </span>
          </div>
          {item.user.headline && <p className="text-sm text-zinc-600">{item.user.headline}</p>}
          <p className="mt-1 text-xs text-subtle">Connected {formatRelativeTime(item.created_at)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={message}
            disabled={isPending}
            className="rounded-full border border-beedero-border px-3 py-1.5 text-xs font-semibold text-beedero-black hover:bg-zinc-50 disabled:opacity-50"
          >
            Message
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={isPending}
            className="rounded-full border border-beedero-border px-3 py-1.5 text-xs font-semibold text-zinc-500 hover:bg-zinc-50 disabled:opacity-50"
          >
            {isPending ? "…" : "Remove"}
          </button>
        </div>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </li>
  );
}

export function ConnectionsList({ items }: { items: ConnectionItem[] }) {
  const [visible, setVisible] = useState(items);
  const [q, setQ] = useState("");

  function remove(connectionId: number) {
    setVisible((current) => current.filter((item) => item.connection_id !== connectionId));
  }

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return visible;
    return visible.filter(
      (item) =>
        item.user.name.toLowerCase().includes(query) ||
        (item.user.handle ?? "").toLowerCase().includes(query)
    );
  }, [visible, q]);

  return (
    <div className="overflow-hidden rounded-3xl border-2 border-beedero-border bg-beedero-white shadow-sm">
      <div className="border-b border-beedero-border px-5 py-4">
        <h1 className="text-xl font-extrabold text-beedero-black">Connections</h1>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search connections…"
          className="mt-3 w-full rounded-full border border-beedero-border px-4 py-2 text-sm text-beedero-black focus:border-beedero-black focus:outline-none"
        />
      </div>
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-5 py-10 text-center text-sm text-zinc-500">
          <p>{visible.length === 0 ? "No connections yet." : "No connections match your search."}</p>
          {visible.length === 0 && (
            <Link
              href="/discovery"
              className="rounded-xl border border-beedero-border px-4 py-2 text-sm font-semibold text-beedero-black hover:bg-beedero-yellow"
            >
              Find people to connect with
            </Link>
          )}
        </div>
      ) : (
        <ul className="flex flex-col gap-4 p-5">
          {filtered.map((item) => (
            <ConnectionRow key={item.connection_id} item={item} onRemoved={remove} />
          ))}
        </ul>
      )}
    </div>
  );
}
