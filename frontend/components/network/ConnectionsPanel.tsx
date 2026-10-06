"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Search } from "lucide-react";

import { startConversationAction } from "@/app/(app)/feed/actions";
import { removeConnectionAction, type ConnectionItem } from "@/app/(app)/network/actions";
import { CountPill, EmptyPanel, Initials } from "@/components/app-shell/ui";
import { formatRelativeTime } from "@/lib/format";

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
  const { user } = item;

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
      const result = await startConversationAction(user.id);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      router.push(`/feed?chat=${result.conversation.id}`);
    });
  }

  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      {user.profile_picture ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          loading="lazy"
          src={user.profile_picture}
          alt=""
          className="size-9 shrink-0 rounded-full object-cover"
        />
      ) : (
        <Initials name={user.name} className="size-9 text-[10px]" />
      )}
      <div className="min-w-0 flex-1">
        {user.handle ? (
          <Link href={`/p/${user.handle}`} className="block truncate text-xs font-bold hover:underline">
            {user.name}
          </Link>
        ) : (
          <b className="block truncate text-xs">{user.name}</b>
        )}
        <p className="truncate text-[10px] text-white/40">
          {user.headline ? `${user.headline} · ` : ""}
          Connected {formatRelativeTime(item.created_at)}
        </p>
      </div>
      <span className="text-[10px] font-bold text-emerald-400">Connected</span>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={message}
          disabled={isPending}
          className="border border-white/15 px-2 py-1 text-[10px] font-bold text-white/70 transition hover:border-beedero-yellow hover:text-beedero-yellow disabled:cursor-default disabled:opacity-40"
        >
          Message
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={isPending}
          className="border border-white/15 px-2 py-1 text-[10px] font-bold text-white/45 transition hover:border-white/35 hover:text-white/70 disabled:cursor-default disabled:opacity-40"
        >
          {isPending ? "…" : "Remove"}
        </button>
      </div>
      {error && <p className="w-full text-xs text-beedero-yellow">{error}</p>}
    </li>
  );
}

export function ConnectionsPanel({ items }: { items: ConnectionItem[] }) {
  const [removedIds, setRemovedIds] = useState<number[]>([]);
  const [q, setQ] = useState("");

  const visible = useMemo(
    () => items.filter((item) => !removedIds.includes(item.connection_id)),
    [items, removedIds]
  );

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
    <section className="mt-8">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-white/80">
        Your connections
        {visible.length > 0 && <CountPill count={visible.length} />}
      </h2>

      {visible.length > 0 && (
        <label className="mb-1 flex items-center gap-3 border border-white/15 bg-white/[0.02] px-4 py-2.5 text-sm text-white/40 focus-within:border-beedero-yellow">
          <Search size={15} strokeWidth={1.8} aria-hidden />
          <input
            type="search"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Search your connections…"
            aria-label="Search your connections"
            className="min-w-0 flex-1 bg-transparent text-white outline-none placeholder:text-white/40"
          />
        </label>
      )}

      {filtered.length === 0 ? (
        visible.length === 0 ? (
          <EmptyPanel>
            No connections yet.{" "}
            <Link href="/discovery" className="font-bold text-beedero-yellow hover:text-white">
              Find people to connect with →
            </Link>
          </EmptyPanel>
        ) : (
          <EmptyPanel>No connections match “{q.trim()}”.</EmptyPanel>
        )
      ) : (
        <ul className="divide-y divide-white/[0.07] border-y border-white/10">
          {filtered.map((item) => (
            <ConnectionRow
              key={item.connection_id}
              item={item}
              onRemoved={(id) => setRemovedIds((current) => [...current, id])}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
