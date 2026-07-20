import Link from "next/link";

import { SECTION_LABELS } from "@/lib/types";

export type TrendingItem = {
  id: number;
  title: string;
  kind: string;
  engagement: number;
  org?: { slug: string; name: string } | null;
  author?: { id: number; name: string; handle?: string | null } | null;
};

export function TrendingPanel({ items }: { items: TrendingItem[] }) {
  if (items.length === 0) return null;

  return (
    <div className="rounded-3xl border-2 border-beedero-border bg-beedero-white p-5 shadow-sm">
      <h2 className="text-sm font-extrabold text-beedero-black">Trending</h2>
      <ul className="mt-3 grid gap-3">
        {items.map((item) => {
          const href = item.org
            ? `/org/${item.org.slug}`
            : item.author?.handle
              ? `/p/${item.author.handle}`
              : null;
          const subtitle = item.org?.name ?? item.author?.name ?? "";
          const content = (
            <>
              <p className="text-sm font-semibold leading-5 text-zinc-950">{item.title}</p>
              <p className="mt-0.5 text-xs text-zinc-500">
                {subtitle} · {SECTION_LABELS[item.kind] ?? item.kind} · {item.engagement}{" "}
                {item.engagement === 1 ? "interaction" : "interactions"}
              </p>
            </>
          );
          return (
            <li key={item.id} className="border-t border-beedero-border pt-3 first:border-t-0 first:pt-0">
              {href ? (
                <Link href={href} className="block hover:opacity-80">
                  {content}
                </Link>
              ) : (
                <div>{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
